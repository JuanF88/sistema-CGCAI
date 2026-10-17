-- ============================================================================
-- Registro de actividad: quién entra y quién hace qué
-- ============================================================================
-- Se captura en la BASE, con disparadores, y no en la aplicación. El motivo es
-- que en este sistema el navegador escribe directo a Supabase —los hallazgos,
-- el informe, las notas de etapa, las evaluaciones, los archivos—, así que un
-- registro escrito desde el front sería esquivable y, sobre todo, habría que
-- acordarse de añadirlo en cada sitio nuevo. Un disparador no se olvida: cae
-- igual si la escritura viene del navegador, de una ruta de API con
-- service-role, de un script o del propio panel de Supabase.
--
-- Tres clases de asiento (`tipo`):
--   dato     cambios en las tablas (crear / modificar / eliminar)
--   archivo  subidas y borrados en Storage
--   sesion   entradas y salidas, que se leen del registro de Supabase Auth
--            mediante la función `registro_accesos` del final
--
-- SEGURIDAD — leer antes de tocar `TABLAS_AUDITADAS`:
-- La tabla `usuarios` tiene una columna `password` en texto plano (ver
-- docs/MIGRACION-PASSWORDS.md). Un registro que copiara la fila entera
-- duplicaría esas contraseñas en otra tabla, y además las dejaría a la vista
-- de cualquier admin que abriera la vista de logs. Por eso `sin_sensibles()`
-- descarta las claves por PATRÓN y no por lista: cualquier columna que se
-- añada mañana y se llame password, clave, contraseña, secret, token o hash
-- queda fuera sin que haya que acordarse de nada.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. La tabla
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registro_actividad (
  id              bigserial PRIMARY KEY,
  ocurrido_at     timestamptz NOT NULL DEFAULT now(),

  tipo            text NOT NULL CHECK (tipo IN ('dato', 'archivo', 'sesion')),
  accion          text NOT NULL,
  entidad         text NOT NULL,
  registro_id     text,

  -- Quién. `actor_nombre` y `actor_rol` se congelan a propósito: si mañana se
  -- borra o se renombra al usuario, el registro tiene que seguir diciendo
  -- quién hizo aquello. Por lo mismo NO hay clave ajena a `usuarios`: una
  -- traza que desaparece al borrar a su autor no sirve para auditar.
  actor_auth_id   uuid,
  actor_usuario_id integer,
  actor_nombre    text,
  actor_rol       text,

  -- 'navegador' cuando la escritura trae sesión de usuario, 'servidor' cuando
  -- viene con service-role (rutas de API, cron) y no se pudo atribuir.
  origen          text NOT NULL DEFAULT 'navegador',

  campos          text[],
  datos_antes     jsonb,
  datos_despues   jsonb,
  contexto        jsonb,

  ip              text,
  agente          text
);

COMMENT ON TABLE registro_actividad IS
  'Traza de auditoría: sólo se añade, nunca se modifica. Ver sql/registro-actividad.sql.';
COMMENT ON COLUMN registro_actividad.actor_nombre IS
  'Nombre congelado en el momento del hecho; no se resuelve por join a propósito.';
COMMENT ON COLUMN registro_actividad.campos IS
  'Columnas que cambiaron de verdad, para no tener que comparar los dos JSON.';

-- La vista se consulta casi siempre por fecha descendente, y se filtra por
-- persona, por entidad y por tipo.
CREATE INDEX IF NOT EXISTS registro_actividad_ocurrido_idx
  ON registro_actividad (ocurrido_at DESC);
CREATE INDEX IF NOT EXISTS registro_actividad_actor_idx
  ON registro_actividad (actor_usuario_id, ocurrido_at DESC);
CREATE INDEX IF NOT EXISTS registro_actividad_entidad_idx
  ON registro_actividad (entidad, ocurrido_at DESC);
CREATE INDEX IF NOT EXISTS registro_actividad_tipo_idx
  ON registro_actividad (tipo, ocurrido_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Quitar lo que no debe guardarse
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sin_sensibles(datos jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_object_agg(clave, valor) FILTER (
      WHERE clave !~* '(password|passwd|clave|contrase|secret|token|hash|api_key)'
    ),
    '{}'::jsonb
  )
  FROM jsonb_each(COALESCE(datos, '{}'::jsonb)) AS campos(clave, valor);
$$;

COMMENT ON FUNCTION sin_sensibles(jsonb) IS
  'Descarta por patrón las columnas que no deben acabar en el registro (usuarios.password, entre otras).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. El disparador
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_actividad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id     uuid := auth.uid();
  -- Variables sueltas y no un `record`: si el `SELECT INTO` no llega a
  -- ejecutarse —escritura sin sesión—, leer un campo de un record sin asignar
  -- revienta con «record is not assigned yet». Así quedan en NULL y se puede
  -- preguntar por ellas sin más.
  v_usuario_id  integer;
  v_nombre      text;
  v_rol         text;
  v_antes       jsonb;
  v_despues     jsonb;
  v_campos      text[];
  v_accion      text;
  v_id          text;
  -- La fila entera, aparte de los recortes. `v_antes`/`v_despues` se reducen a
  -- las columnas que cambiaron, y de ahí no se puede sacar el `id` de un
  -- UPDATE: el `id` nunca cambia, así que no está entre ellas. Sin esto los
  -- asientos de modificación salían sin decir QUÉ registro se modificó, que
  -- es media pregunta de una auditoría.
  v_fila        jsonb;
  v_origen      text := 'navegador';
  v_cabeceras   jsonb;
  v_ip          text;
  v_agente      text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_accion  := 'crear';
    v_fila    := sin_sensibles(to_jsonb(NEW));
    v_despues := v_fila;
  ELSIF TG_OP = 'DELETE' THEN
    v_accion := 'eliminar';
    v_fila   := sin_sensibles(to_jsonb(OLD));
    v_antes  := v_fila;
  ELSE
    v_accion := 'modificar';
    v_antes   := sin_sensibles(to_jsonb(OLD));
    v_despues := sin_sensibles(to_jsonb(NEW));
    v_fila    := v_despues;

    -- Sólo las columnas que cambiaron de verdad. Sin esto, guardar un informe
    -- sin tocar nada dejaba un asiento con las veinte columnas repetidas.
    SELECT array_agg(d.clave ORDER BY d.clave)
      INTO v_campos
      FROM jsonb_each(v_despues) AS d(clave, valor)
     WHERE v_antes -> d.clave IS DISTINCT FROM d.valor;

    -- Un UPDATE que no cambia nada no es actividad: no se registra.
    IF v_campos IS NULL THEN
      RETURN NULL;
    END IF;

    -- De los dos JSON sólo se guarda lo que cambió; el resto es ruido que
    -- multiplica el tamaño de la tabla por cada guardado.
    v_antes   := (SELECT COALESCE(jsonb_object_agg(t.k, v_antes -> t.k), '{}'::jsonb)
                    FROM unnest(v_campos) AS t(k));
    v_despues := (SELECT COALESCE(jsonb_object_agg(t.k, v_despues -> t.k), '{}'::jsonb)
                    FROM unnest(v_campos) AS t(k));
  END IF;

  -- El identificador del registro, como texto: en este esquema conviven
  -- `id`, `usuario_id` y claves uuid. Se saca de `v_fila`, la fila completa,
  -- y no de los recortes.
  v_id := COALESCE(
    (v_fila -> 'id')          #>> '{}',
    (v_fila -> 'usuario_id')  #>> '{}',
    (v_fila -> 'programa_id') #>> '{}',
    (v_fila -> 'informe_id')  #>> '{}'
  );

  -- Quién. Con sesión de usuario, `auth.uid()` lo dice. Sin ella la escritura
  -- vino con service-role; PostgREST deja las cabeceras de la petición en una
  -- variable de la transacción, así que una ruta de API puede declararse
  -- enviando `x-actor-usuario` y seguimos sabiendo quién fue.
  IF v_auth_id IS NOT NULL THEN
    SELECT u.usuario_id, NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), ''), u.rol
      INTO v_usuario_id, v_nombre, v_rol
      FROM usuarios u
     WHERE u.auth_user_id = v_auth_id
     LIMIT 1;
  END IF;

  BEGIN
    v_cabeceras := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN others THEN
    v_cabeceras := NULL;
  END;

  v_ip     := COALESCE(v_cabeceras ->> 'x-forwarded-for', v_cabeceras ->> 'x-real-ip');
  v_agente := v_cabeceras ->> 'user-agent';

  IF v_usuario_id IS NULL THEN
    v_origen := 'servidor';

    IF (v_cabeceras ->> 'x-actor-usuario') ~ '^\d+$' THEN
      SELECT u.usuario_id, NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), ''), u.rol
        INTO v_usuario_id, v_nombre, v_rol
        FROM usuarios u
       WHERE u.usuario_id = (v_cabeceras ->> 'x-actor-usuario')::integer
       LIMIT 1;
    END IF;
  END IF;

  INSERT INTO registro_actividad (
    tipo, accion, entidad, registro_id,
    actor_auth_id, actor_usuario_id, actor_nombre, actor_rol, origen,
    campos, datos_antes, datos_despues, contexto, ip, agente
  ) VALUES (
    'dato', v_accion, TG_TABLE_NAME, v_id,
    v_auth_id, v_usuario_id, v_nombre, v_rol, v_origen,
    v_campos, v_antes, v_despues,
    -- Lo justo para poder decir «del informe #352» sin otra consulta. También
    -- de la fila completa: en un UPDATE de un hallazgo, `informe_id` no cambia
    -- y por tanto no está entre las columnas recortadas.
    jsonb_strip_nulls(jsonb_build_object(
      'informe_id',     v_fila -> 'informe_id',
      'dependencia_id', v_fila -> 'dependencia_id',
      'usuario_id',     v_fila -> 'usuario_id'
    )),
    v_ip, v_agente
  );

  RETURN NULL;  -- AFTER trigger: el valor no se usa.
EXCEPTION WHEN others THEN
  -- Un fallo registrando NO puede tumbar la operación del auditor. Se deja
  -- aviso en los logs de Postgres y la escritura original sigue su camino.
  RAISE WARNING '[registro_actividad] % en %: %', TG_OP, TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Enganchar las tablas
-- ─────────────────────────────────────────────────────────────────────────────
-- Fuera quedan los catálogos que no cambian (iso, capitulos, numerales) y
-- `ia_revisiones`, que ya es un registro de por sí.

DO $$
DECLARE
  TABLAS_AUDITADAS text[] := ARRAY[
    'informes_auditoria',
    'fortalezas',
    'oportunidades_mejora',
    'no_conformidades',
    'usuarios',
    'dependencias',
    'programas_auditoria',
    'programa_auditoria_cronograma',
    'programa_auditoria_cronograma_dependencias',
    'programa_auditoria_distribucion',
    'planes_auditoria_informe',
    'plan_auditoria',
    'validaciones_auditoria',
    'evaluaciones_auditores',
    'evaluaciones_pesos',
    'rubricas_evaluacion',
    'encuestas_auditores',
    'notas_etapa_auditoria',
    'alertas_historial',
    'alertas_procesos_config'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY TABLAS_AUDITADAS LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS registro_actividad_trg ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER registro_actividad_trg
           AFTER INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION registrar_actividad()', t
      );
    ELSE
      RAISE NOTICE '[registro_actividad] la tabla % no existe, se omite', t;
    END IF;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Archivos de Storage
-- ─────────────────────────────────────────────────────────────────────────────
-- `storage.objects` es una tabla normal, así que la subida de un acta o de un
-- plan se puede registrar igual. Va en su propio bloque con captura de
-- excepción porque crear disparadores en el esquema `storage` depende de los
-- permisos del proyecto: si no se puede, el resto de la migración queda hecho.

CREATE OR REPLACE FUNCTION registrar_actividad_archivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- `COALESCE(NEW, OLD)` no vale: son registros y COALESCE no opera sobre
  -- ellos. Se eligen con un IF y se copian los campos que interesan.
  v_bucket   text;
  v_nombre_archivo text;
  v_meta     jsonb;
  v_dueno    uuid;
  v_auth_id  uuid;
  v_usuario_id integer;
  v_nombre   text;
  v_rol      text;
  v_accion   text := CASE TG_OP WHEN 'INSERT' THEN 'subir'
                                WHEN 'DELETE' THEN 'eliminar'
                                ELSE 'reemplazar' END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_bucket := OLD.bucket_id;
    v_nombre_archivo := OLD.name;
    v_meta := OLD.metadata;
    v_dueno := OLD.owner;
  ELSE
    v_bucket := NEW.bucket_id;
    v_nombre_archivo := NEW.name;
    v_meta := NEW.metadata;
    v_dueno := NEW.owner;
  END IF;

  -- El marcador que Supabase crea en cada carpeta no es actividad de nadie.
  IF v_nombre_archivo LIKE '%.emptyFolderPlaceholder' THEN
    RETURN NULL;
  END IF;

  v_auth_id := COALESCE(auth.uid(), v_dueno);

  IF v_auth_id IS NOT NULL THEN
    SELECT u.usuario_id, NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), ''), u.rol
      INTO v_usuario_id, v_nombre, v_rol
      FROM usuarios u
     WHERE u.auth_user_id = v_auth_id
     LIMIT 1;
  END IF;

  INSERT INTO registro_actividad (
    tipo, accion, entidad, registro_id,
    actor_auth_id, actor_usuario_id, actor_nombre, actor_rol, origen,
    datos_despues
  ) VALUES (
    'archivo', v_accion, v_bucket, v_nombre_archivo,
    v_auth_id, v_usuario_id, v_nombre, v_rol,
    CASE WHEN v_usuario_id IS NULL THEN 'servidor' ELSE 'navegador' END,
    jsonb_strip_nulls(jsonb_build_object(
      'nombre',    v_nombre_archivo,
      'bucket',    v_bucket,
      'tamano',    v_meta -> 'size',
      'tipo_mime', v_meta -> 'mimetype'
    ))
  );

  RETURN NULL;
EXCEPTION WHEN others THEN
  RAISE WARNING '[registro_actividad] archivo % en %: %', TG_OP, v_bucket, SQLERRM;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS registro_actividad_archivo_trg ON storage.objects;
  CREATE TRIGGER registro_actividad_archivo_trg
    AFTER INSERT OR UPDATE OR DELETE ON storage.objects
    FOR EACH ROW EXECUTE FUNCTION registrar_actividad_archivo();
  RAISE NOTICE '[registro_actividad] disparador de Storage instalado';
EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
  RAISE NOTICE '[registro_actividad] sin permisos sobre storage.objects: las subidas no se registrarán (%)', SQLERRM;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Entradas y salidas del sistema
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase Auth ya anota cada inicio de sesión en `auth.audit_log_entries`,
-- que PostgREST no expone porque sólo publica el esquema `public`. Y es la
-- fuente buena, mejor que apuntarlo en nuestra ruta de login: registra la
-- entrada aunque no pase por ahí.
--
-- Se COPIAN a `registro_actividad` en vez de leerlas aparte y mezclarlas al
-- vuelo. Mezclar dos fuentes rompe la paginación —la página 2 de la unión de
-- dos listas ordenadas no es la unión de las dos páginas 2— y obligaría a
-- traerlo todo para poder ordenar. Con los accesos dentro, la vista es una
-- sola consulta con su `count` y su rango.
--
-- `registro_id` guarda el id del asiento de Auth, que es lo que permite
-- llamar a esto tantas veces como se quiera sin duplicar nada.

CREATE UNIQUE INDEX IF NOT EXISTS registro_actividad_sesion_uq
  ON registro_actividad (registro_id) WHERE tipo = 'sesion';

CREATE OR REPLACE FUNCTION sincronizar_accesos(limite integer DEFAULT 2000)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_insertadas integer;
BEGIN
  INSERT INTO registro_actividad (
    ocurrido_at, tipo, accion, entidad, registro_id,
    actor_auth_id, actor_usuario_id, actor_nombre, actor_rol, origen, ip, contexto
  )
  SELECT a.created_at,
         'sesion',
         CASE a.payload ->> 'action'
           WHEN 'login'  THEN 'entrar'
           WHEN 'logout' THEN 'salir'
           ELSE a.payload ->> 'action'
         END,
         'sesion',
         a.id::text,
         NULLIF(a.payload ->> 'actor_id', '')::uuid,
         u.usuario_id,
         NULLIF(TRIM(CONCAT_WS(' ', u.nombre, u.apellido)), ''),
         u.rol,
         'navegador',
         a.ip_address::text,
         jsonb_strip_nulls(jsonb_build_object(
           'email',           a.payload ->> 'actor_username',
           'accion_original', a.payload ->> 'action'
         ))
    FROM auth.audit_log_entries a
    LEFT JOIN usuarios u
           ON u.auth_user_id = NULLIF(a.payload ->> 'actor_id', '')::uuid
   WHERE a.payload ->> 'action' IN (
           -- El refresco de token ocurre cada hora en cada pestaña abierta y
           -- ahogaría la vista; lo que se audita es entrar, salir y lo que
           -- toca a las cuentas.
           'login', 'logout', 'user_signedup', 'user_deleted',
           'user_invited', 'user_modified', 'user_recovery_requested',
           'user_updated_password'
         )
     AND NOT EXISTS (
           SELECT 1 FROM registro_actividad r
            WHERE r.tipo = 'sesion' AND r.registro_id = a.id::text
         )
   ORDER BY a.created_at DESC
   LIMIT LEAST(GREATEST(limite, 1), 20000);

  GET DIAGNOSTICS v_insertadas = ROW_COUNT;
  RETURN v_insertadas;
END;
$$;

COMMENT ON FUNCTION sincronizar_accesos(integer) IS
  'Copia los accesos de auth.audit_log_entries al registro. Idempotente.';

-- Sólo `service_role`: la llama la ruta de API, que ya comprueba que quien
-- pregunta es admin. Un auditor con su propio token no puede invocarla.
REVOKE ALL ON FUNCTION sincronizar_accesos(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION sincronizar_accesos(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION sincronizar_accesos(integer) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Quién puede leer el registro
-- ─────────────────────────────────────────────────────────────────────────────
-- Sólo lectura, y sólo admin. **No se crea ninguna política de INSERT, UPDATE
-- ni DELETE**: con RLS activo y sin política, nadie puede escribir ni borrar a
-- través de la API. Las únicas escrituras son las de los disparadores, que al
-- ser `SECURITY DEFINER` no pasan por RLS. Es decir: desde la aplicación el
-- registro sólo se puede leer, que es lo que convierte una tabla de logs en
-- una traza de auditoría.

ALTER TABLE registro_actividad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo admin lee el registro de actividad" ON registro_actividad;
CREATE POLICY "Solo admin lee el registro de actividad"
  ON registro_actividad FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
       WHERE u.auth_user_id = auth.uid()
         AND lower(u.rol) = 'admin'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON registro_actividad FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Comprobación
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'disparadores instalados' AS comprobacion, count(*) AS total
  FROM pg_trigger
 WHERE tgname = 'registro_actividad_trg' AND NOT tgisinternal
UNION ALL
SELECT 'disparador de storage', count(*)
  FROM pg_trigger
 WHERE tgname = 'registro_actividad_archivo_trg' AND NOT tgisinternal
UNION ALL
SELECT 'la contraseña queda fuera (debe decir 0)',
       (SELECT count(*) FROM jsonb_each(sin_sensibles(
          '{"nombre":"Prueba","password":"NO-DEBE-GUARDARSE","email":"a@b.c"}'::jsonb
        )) WHERE key = 'password');
