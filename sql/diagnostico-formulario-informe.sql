-- ============================================================================
-- El formulario del informe: lo que solo se puede comprobar en la base real
-- ============================================================================
-- Todo lo que sigue es de LECTURA. No cambia ni una fila.
--
-- El formulario se ha probado entero —los ocho campos del informe y los tres
-- tipos de hallazgo, abriendo desde las tres vistas que lo usan— contra una
-- base simulada que imita a Postgres. Eso deja fuera lo que depende de esta
-- base en concreto: con qué permisos escribe cada rol, de qué tipo son de
-- verdad las columnas y si ya hay daño hecho por los dos fallos que se
-- arreglaron:
--
--   1. El selector de asistencia se vaciaba al abrir un informe guardado como
--      «Físico» y el guardado automático escribía NULL.
--   2. En las dos líneas de tiempo (la del auditor y «Administrar
--      Auditorías»), cerrar un informe y elegir otra auditoría en los tres
--      segundos siguientes guardaba los hallazgos del primero en el segundo,
--      y si el primero no tenía ninguno, borraba los del segundo.
--
-- Ojo con el editor SQL de Supabase: si se corren varias consultas de golpe,
-- solo enseña el resultado de la ÚLTIMA. El bloque 7, al final, junta todo en
-- una sola tabla para poder copiarla entera.
-- ============================================================================


-- ── 1 · Tipos de las columnas que escribe el formulario ─────────────────────
-- Se espera:
--   fecha_auditoria, fecha_seguimiento    date
--   asistencia_tipo, objetivo, criterios,
--   conclusiones, recomendaciones         text
--   auditores_acompanantes                ARRAY (udt_name _text)
--   *_id de los hallazgos                 integer / bigint
--   descripcion, razon, para_que,
--   evidencia                             text
-- Cualquier otra cosa en las fechas importa: el calendario del formulario solo
-- entiende «YYYY-MM-DD» y pinta vacía cualquier otra forma.

SELECT table_name  AS tabla,
       column_name AS columna,
       data_type,
       udt_name,
       is_nullable,
       column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
         (table_name = 'informes_auditoria'
          AND column_name IN ('fecha_auditoria', 'asistencia_tipo', 'auditores_acompanantes',
                              'objetivo', 'criterios', 'conclusiones', 'recomendaciones',
                              'fecha_seguimiento'))
      OR (table_name IN ('fortalezas', 'oportunidades_mejora', 'no_conformidades')
          AND column_name IN ('informe_id', 'iso_id', 'capitulo_id', 'numeral_id',
                              'descripcion', 'razon', 'para_que', 'evidencia'))
       )
 ORDER BY table_name, column_name;


-- ── 2 · Quién puede escribir: RLS y políticas ───────────────────────────────
-- El formulario escribe desde el navegador, con la sesión del usuario, así que
-- manda RLS. Con RLS activada, cada rol necesita una política que le deje:
--
--   informes_auditoria   UPDATE   el auditor, sus informes; el admin, todos
--   fortalezas,
--   oportunidades_mejora,
--   no_conformidades     INSERT, UPDATE y DELETE, los mismos dos roles
--
-- Sin política de UPDATE, el UPDATE no da error: devuelve cero filas. Hasta
-- hoy el formulario lo daba por guardado; ahora lo dice («La base no aceptó el
-- cambio…»). En los hallazgos, un UPDATE o un DELETE sin política sigue sin
-- avisar, así que conviene mirarlo aquí.

SELECT rel.relname          AS tabla,
       rel.relrowsecurity   AS rls_activada,
       rel.relforcerowsecurity AS rls_forzada
  FROM pg_class rel
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
 WHERE nsp.nspname = 'public'
   AND rel.relname IN ('informes_auditoria', 'fortalezas', 'oportunidades_mejora', 'no_conformidades')
 ORDER BY rel.relname;

SELECT tablename  AS tabla,
       policyname AS politica,
       cmd        AS para,
       roles,
       qual       AS usando,
       with_check AS con_comprobacion
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('informes_auditoria', 'fortalezas', 'oportunidades_mejora', 'no_conformidades')
 ORDER BY tablename, cmd, policyname;

-- Y los permisos de tabla: sin UPDATE para `authenticated` no hay política que
-- valga.
SELECT table_name AS tabla,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS permisos
  FROM information_schema.role_table_grants
 WHERE grantee = 'authenticated'
   AND table_schema = 'public'
   AND table_name IN ('informes_auditoria', 'fortalezas', 'oportunidades_mejora', 'no_conformidades')
 GROUP BY table_name
 ORDER BY table_name;


-- ── 3 · Disparadores ────────────────────────────────────────────────────────
-- Se espera solo `registro_actividad_trg`, que es AFTER y no puede cambiar la
-- fila. Un BEFORE UPDATE de otro origen podría reescribir un valor sin que el
-- formulario se entere.

SELECT rel.relname                AS tabla,
       tg.tgname                  AS disparador,
       CASE WHEN tg.tgenabled = 'D' THEN 'DESACTIVADO' ELSE 'activo' END AS estado,
       pg_get_triggerdef(tg.oid)  AS definicion
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
 WHERE nsp.nspname = 'public'
   AND rel.relname IN ('informes_auditoria', 'fortalezas', 'oportunidades_mejora', 'no_conformidades')
   AND NOT tg.tgisinternal
 ORDER BY rel.relname, tg.tgname;


-- ── 4 · Valores que el formulario enseña distinto de como están ─────────────
-- El selector solo conoce «Digital» y «Físico». Otras grafías se casan al
-- abrir (`FÍSICO` → «Físico») y lo desconocido se enseña «como está
-- guardado»; aquí se ve cuánto hay de cada.

SELECT COALESCE(asistencia_tipo, '(sin indicar)') AS asistencia_tipo,
       count(*)                                   AS informes
  FROM informes_auditoria
 GROUP BY 1
 ORDER BY 2 DESC;

-- Acompañantes con un nombre vacío dentro: salen de dejar una coma al final
-- («Ana Pérez, »). No se pierde nada, pero cuentan como un acompañante más.
SELECT id, auditores_acompanantes
  FROM informes_auditoria
 WHERE EXISTS (SELECT 1 FROM unnest(auditores_acompanantes) AS nombre WHERE btrim(nombre) = '')
 ORDER BY id;


-- ── 5 · ¿Ya hubo informes que perdieron «Físico»? ───────────────────────────
-- Cambios de «Físico» a NULL. `registro_id` es el informe; si sale vacío, el
-- disparador desplegado es anterior a `sql/registro-actividad.sql` y hay que
-- tirar de `contexto` (dependencia y auditor) y de la hora.

SELECT ocurrido_at,
       registro_id                         AS informe,
       contexto ->> 'dependencia_id'       AS dependencia_id,
       contexto ->> 'usuario_id'           AS auditor_id,
       actor_nombre                        AS quien,
       datos_antes   ->> 'asistencia_tipo' AS antes,
       datos_despues ->> 'asistencia_tipo' AS despues
  FROM registro_actividad
 WHERE tipo = 'dato'
   AND accion = 'modificar'
   AND entidad = 'informes_auditoria'
   AND 'asistencia_tipo' = ANY (campos)
   AND datos_antes ->> 'asistencia_tipo' IS NOT NULL
   AND datos_despues ->> 'asistencia_tipo' IS NULL
 ORDER BY ocurrido_at DESC;


-- ── 6 · ¿Ya hubo hallazgos copiados o borrados al cambiar de auditoría? ─────
-- La huella del fallo de las líneas de tiempo, en el registro de actividad:
-- un hallazgo borrado que reaparece con el MISMO texto y OTRO id en los
-- segundos siguientes, en el mismo informe o en otro. Si `informe_del_borrado`
-- y `informe_de_la_copia` coinciden, el hallazgo sobrevivió con id nuevo; si no
-- coinciden, viajó de un informe a otro.

SELECT b.entidad                                  AS tabla,
       b.ocurrido_at                              AS borrado_a_las,
       b.datos_antes   ->> 'informe_id'           AS informe_del_borrado,
       i.datos_despues ->> 'informe_id'           AS informe_de_la_copia,
       b.registro_id                              AS id_borrado,
       i.registro_id                              AS id_nuevo,
       left(b.datos_antes ->> 'descripcion', 60)  AS descripcion,
       b.actor_nombre                             AS quien
  FROM registro_actividad b
  JOIN registro_actividad i
    ON i.entidad = b.entidad
   AND i.tipo = 'dato'
   AND i.accion = 'crear'
   AND i.registro_id IS DISTINCT FROM b.registro_id
   AND i.datos_despues ->> 'descripcion' = b.datos_antes ->> 'descripcion'
   AND i.ocurrido_at BETWEEN b.ocurrido_at - interval '30 seconds'
                         AND b.ocurrido_at + interval '30 seconds'
 WHERE b.tipo = 'dato'
   AND b.accion = 'eliminar'
   AND b.entidad IN ('fortalezas', 'oportunidades_mejora', 'no_conformidades')
 ORDER BY b.ocurrido_at DESC;

-- Y lo que sigue en las tablas: el mismo texto de hallazgo en más de un
-- informe. Una frase genérica puede repetirse de verdad; un párrafo largo
-- idéntico en dos informes de dependencias distintas es casi seguro una copia.
WITH hallazgos AS (
  SELECT 'fortalezas' AS tabla, id, informe_id, descripcion FROM fortalezas
  UNION ALL
  SELECT 'oportunidades_mejora', id, informe_id, descripcion FROM oportunidades_mejora
  UNION ALL
  SELECT 'no_conformidades', id, informe_id, descripcion FROM no_conformidades
)
SELECT tabla,
       left(descripcion, 80)                     AS descripcion,
       array_agg(informe_id ORDER BY informe_id) AS informes,
       array_agg(id ORDER BY id)                 AS ids
  FROM hallazgos
 WHERE length(btrim(COALESCE(descripcion, ''))) >= 25
 GROUP BY tabla, descripcion
HAVING count(DISTINCT informe_id) > 1
 ORDER BY tabla, descripcion;


-- ── 7 · Todo junto, en una sola tabla ───────────────────────────────────────
-- Los bloques 1 a 6 resumidos, para correrlo SOLO y copiar el resultado entero.
-- La fila «5 · Físico → NULL por» dice además con qué rol escribía cada uno:
-- si un admin aparece ahí, sus escrituras desde el formulario sí llegan a la
-- base, que es la duda del bloque 2.

WITH tablas(t) AS (
  VALUES ('informes_auditoria'), ('fortalezas'), ('oportunidades_mejora'), ('no_conformidades')
)
SELECT '1 · columna' AS bloque,
       c.table_name::text AS donde,
       c.column_name || ' · ' || c.data_type || ' (' || c.udt_name || ')' AS detalle
  FROM information_schema.columns c
 WHERE c.table_schema = 'public'
   AND c.table_name IN (SELECT t FROM tablas)
   AND c.column_name IN ('fecha_auditoria', 'asistencia_tipo', 'auditores_acompanantes',
                         'objetivo', 'criterios', 'conclusiones', 'recomendaciones',
                         'fecha_seguimiento', 'informe_id', 'iso_id', 'capitulo_id',
                         'numeral_id', 'descripcion', 'razon', 'para_que', 'evidencia')
UNION ALL
SELECT '2a · RLS', c.relname::text,
       CASE WHEN c.relrowsecurity THEN 'activada' ELSE 'desactivada' END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN (SELECT t FROM tablas)
UNION ALL
SELECT '2b · política', p.tablename::text,
       p.cmd || ' · ' || p.policyname || ' · roles ' || array_to_string(p.roles, ',')
         || ' · usando ' || COALESCE(p.qual, '—')
         || ' · comprobación ' || COALESCE(p.with_check, '—')
  FROM pg_policies p
 WHERE p.schemaname = 'public'
   AND p.tablename IN (SELECT t FROM tablas)
UNION ALL
SELECT '2c · permisos de authenticated', g.table_name::text,
       string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type)
  FROM information_schema.role_table_grants g
 WHERE g.grantee = 'authenticated'
   AND g.table_schema = 'public'
   AND g.table_name IN (SELECT t FROM tablas)
 GROUP BY g.table_name
UNION ALL
SELECT '3 · disparador', r.relname::text,
       tg.tgname || ' · ' || CASE WHEN tg.tgenabled = 'D' THEN 'DESACTIVADO' ELSE 'activo' END
         || ' · ' || pg_get_triggerdef(tg.oid)
  FROM pg_trigger tg
  JOIN pg_class r ON r.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
 WHERE n.nspname = 'public'
   AND r.relname IN (SELECT t FROM tablas)
   AND NOT tg.tgisinternal
UNION ALL
SELECT '4 · asistencia', COALESCE(asistencia_tipo, '(sin indicar)'),
       count(*)::text || ' informes'
  FROM informes_auditoria
 GROUP BY asistencia_tipo
UNION ALL
SELECT '5 · Físico → NULL por', COALESCE(actor_nombre, '?'),
       'rol ' || COALESCE(actor_rol, '?') || ' · origen ' || origen
         || ' · ' || count(*)::text || ' veces · de '
         || to_char(min(ocurrido_at) AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI')
         || ' a ' || to_char(max(ocurrido_at) AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI')
         || ' (hora de Colombia)'
  FROM registro_actividad
 WHERE tipo = 'dato'
   AND accion = 'modificar'
   AND entidad = 'informes_auditoria'
   AND 'asistencia_tipo' = ANY (campos)
   AND datos_antes ->> 'asistencia_tipo' IS NOT NULL
   AND datos_despues ->> 'asistencia_tipo' IS NULL
 GROUP BY actor_nombre, actor_rol, origen
UNION ALL
SELECT '6a · hallazgo borrado que reaparece', b.entidad,
       to_char(b.ocurrido_at AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD HH24:MI:SS')
         || ' · informe ' || COALESCE(b.datos_antes ->> 'informe_id', '?')
         || ' → ' || COALESCE(i.datos_despues ->> 'informe_id', '?')
         || ' · id ' || COALESCE(b.registro_id, '?') || ' → ' || COALESCE(i.registro_id, '?')
         || ' · ' || COALESCE(b.actor_nombre, '?')
         || ' · «' || left(COALESCE(b.datos_antes ->> 'descripcion', ''), 50) || '»'
  FROM registro_actividad b
  JOIN registro_actividad i
    ON i.entidad = b.entidad
   AND i.tipo = 'dato'
   AND i.accion = 'crear'
   AND i.registro_id IS DISTINCT FROM b.registro_id
   AND i.datos_despues ->> 'descripcion' = b.datos_antes ->> 'descripcion'
   AND i.ocurrido_at BETWEEN b.ocurrido_at - interval '30 seconds'
                         AND b.ocurrido_at + interval '30 seconds'
 WHERE b.tipo = 'dato'
   AND b.accion = 'eliminar'
   AND b.entidad IN ('fortalezas', 'oportunidades_mejora', 'no_conformidades')
UNION ALL
SELECT '6b · mismo texto en varios informes', h.tabla,
       'informes ' || array_to_string(array_agg(DISTINCT h.informe_id ORDER BY h.informe_id), ', ')
         || ' · «' || left(h.descripcion, 60) || '»'
  FROM (
    SELECT 'fortalezas' AS tabla, informe_id, descripcion FROM fortalezas
    UNION ALL
    SELECT 'oportunidades_mejora', informe_id, descripcion FROM oportunidades_mejora
    UNION ALL
    SELECT 'no_conformidades', informe_id, descripcion FROM no_conformidades
  ) h
 WHERE length(btrim(COALESCE(h.descripcion, ''))) >= 25
 GROUP BY h.tabla, h.descripcion
HAVING count(DISTINCT h.informe_id) > 1
 ORDER BY 1, 2, 3;


-- ============================================================================
-- ── 8 · ¿QUÉ informes perdieron «Físico»? ───────────────────────────────────
-- ============================================================================
-- El bloque 5 sale con `informe` vacío: el disparador que hay en la base es
-- anterior a `sql/registro-actividad.sql` y en las modificaciones no guarda el
-- id de la fila. Volver a ejecutar ese archivo lo arregla para lo que venga
-- —es seguro: solo reemplaza funciones, disparadores y la política, y no toca
-- los asientos ya guardados—, pero no recupera lo de antes.
--
-- Lo de antes está en los registros de la API, no en Postgres. En el panel de
-- Supabase: Logs → Logs Explorer, con un rango de tiempo que cubra el de los
-- cambios, y esta consulta (es del explorador de registros, NO del editor SQL):
--
--   select
--     cast(t.timestamp as datetime) as hora_utc,
--     r.method,
--     r.search,
--     s.status_code
--   from edge_logs as t
--   cross join unnest(t.metadata) as m
--   cross join unnest(m.request) as r
--   cross join unnest(m.response) as s
--   where r.path like '%/rest/v1/informes_auditoria%'
--     and r.method = 'PATCH'
--   order by t.timestamp desc
--   limit 200
--
-- Cada PATCH que coincide al segundo con un `ocurrido_at` del bloque 5 (los
-- dos van en UTC) lleva el informe en `search`: `?id=eq.355`. Los registros de
-- la API duran poco —un día en el plan gratuito—, así que conviene hacerlo
-- pronto.
--
-- ── 9 · Devolver «Físico» ───────────────────────────────────────────────────
-- SOLO con el arreglo ya desplegado: con el código viejo, la siguiente vez que
-- alguien abra el informe se vuelve a borrar. Y solo a los que sigan vacíos,
-- para no pisar uno que alguien haya pasado a «Digital» a propósito.
--
--   UPDATE informes_auditoria
--      SET asistencia_tipo = 'Físico'
--    WHERE id IN (/* los ids del bloque 8 */)
--      AND asistencia_tipo IS NULL
--   RETURNING id, asistencia_tipo;
-- ============================================================================
