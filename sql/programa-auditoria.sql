-- ============================================================
-- PROGRAMA DE AUDITORÍA INTERNA
-- Formato PE-GS-2.2.1-FOR-7 (v11)
--
-- Tres tablas:
--   programas_auditoria              cabecera (una fila por programa/año)
--   programa_auditoria_cronograma    filas de la hoja «Programa AI Estratégico»
--   programa_auditoria_distribucion  filas de la hoja «Distribución»
--
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente:
-- se puede volver a correr sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CABECERA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programas_auditoria (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Identificación
  anio              integer NOT NULL,
  nombre            text    NOT NULL,
  codigo_formato    text    NOT NULL DEFAULT 'PE-GS-2.2.1-FOR-7',
  version_formato   text    NOT NULL DEFAULT '11',
  estado            text    NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN ('borrador', 'aprobado', 'archivado')),

  -- Bloque superior del formato
  objetivo          text,
  alcance           text,
  -- En el Excel los criterios están en dos celdas por maquetación; aquí van
  -- en una sola y la exportación los reparte en dos columnas.
  criterios         text,
  metodologia       text,

  -- RECURSOS
  recurso_humano       text,
  recurso_financiero   text,
  recurso_tecnologico  text,

  -- RIESGOS / CONTROLES / OPORTUNIDADES
  --
  -- Listas abiertas: el Excel solo dibuja dos filas, pero no hay motivo para
  -- limitar a dos. La exportación crea tantas filas como el más largo.
  riesgos           text[] NOT NULL DEFAULT '{}',
  controles         text[] NOT NULL DEFAULT '{}',
  oportunidades     text[] NOT NULL DEFAULT '{}',

  -- Cronograma
  --
  -- El programa abarca un rango de meses dentro del año, de `mes_inicio` a
  -- `mes_fin`, ambos incluidos. Con uno solo los dos valores coinciden. De aquí
  -- salen las semanas del cronograma: cuatro por mes, numeradas de corrido.
  mes_inicio        text,   -- p. ej. «SEPTIEMBRE»
  mes_fin           text,   -- p. ej. «OCTUBRE»

  -- Pie del formato
  nomenclatura      text,
  observaciones     text,
  elaborado_por     text,
  elaborado_cargo   text,
  revisado_por      text,
  revisado_cargo    text,
  aprobado_por      text,
  aprobado_cargo    text,
  fecha_aprobacion  date,

  creado_por        bigint REFERENCES usuarios(usuario_id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE programas_auditoria IS
  'Cabecera del Programa de Auditoría Interna (formato PE-GS-2.2.1-FOR-7).';

-- Un programa por año y nombre.
CREATE UNIQUE INDEX IF NOT EXISTS programas_auditoria_anio_nombre_key
  ON programas_auditoria (anio, lower(nombre));

-- ------------------------------------------------------------
-- 1.b AJUSTE — solo hace algo si ya se corrió la versión anterior
--
-- La primera versión tenía `criterios_1`/`criterios_2` y seis columnas sueltas
-- de riesgo/control/oportunidad. Este bloque migra los datos y deja el
-- esquema nuevo. Si la tabla se acaba de crear arriba, no hace nada.
-- ------------------------------------------------------------

-- `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe: las columnas
-- nuevas hay que añadirlas aparte antes de poder volcar nada en ellas.
ALTER TABLE programas_auditoria
  ADD COLUMN IF NOT EXISTS criterios     text,
  ADD COLUMN IF NOT EXISTS riesgos       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS controles     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS oportunidades text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  -- Criterios: las dos celdas se juntan en una.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'programas_auditoria' AND column_name = 'criterios_1') THEN

    UPDATE programas_auditoria
       SET criterios = concat_ws(E'\n', nullif(criterios_1, ''), nullif(criterios_2, ''))
     WHERE criterios IS NULL;

    ALTER TABLE programas_auditoria DROP COLUMN criterios_1, DROP COLUMN criterios_2;
  END IF;

  -- Riesgos/controles/oportunidades: las dos columnas de cada uno se vuelven
  -- los dos primeros elementos de la lista, sin los vacíos.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'programas_auditoria' AND column_name = 'riesgo_1') THEN

    UPDATE programas_auditoria
       SET riesgos = array_remove(ARRAY[nullif(riesgo_1, ''), nullif(riesgo_2, '')], NULL),
           controles = array_remove(ARRAY[nullif(control_1, ''), nullif(control_2, '')], NULL),
           oportunidades = array_remove(
             ARRAY[nullif(oportunidad_1, ''), nullif(oportunidad_2, '')], NULL)
     WHERE riesgos = '{}' AND controles = '{}' AND oportunidades = '{}';

    ALTER TABLE programas_auditoria
      DROP COLUMN riesgo_1, DROP COLUMN control_1, DROP COLUMN oportunidad_1,
      DROP COLUMN riesgo_2, DROP COLUMN control_2, DROP COLUMN oportunidad_2;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. CRONOGRAMA  (hoja «Programa AI Estratégico», filas 14+)
--
-- Dos niveles, como el formato: una fila por **proceso** del mapa institucional
-- y, colgando de ella, las dependencias que se auditan en ese proceso.
--
-- En el Excel esto se ve como un bloque por proceso: A:B (proceso), E (ISO
-- 9001), F (ISO 14001) y las cuatro columnas de semanas van combinadas
-- verticalmente en todo el bloque, y solo C (auditado) y D (auditores) cambian
-- de una línea a otra.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programa_auditoria_cronograma (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  programa_id    bigint NOT NULL
                 REFERENCES programas_auditoria(id) ON DELETE CASCADE,

  orden          integer NOT NULL DEFAULT 0,
  proceso        text NOT NULL,          -- PROCESO A AUDITAR (nombre impreso)
  proceso_clave  text,                   -- clave del mapa: igual a dependencias.gestion
  requisitos_9001  text,
  requisitos_14001 text,

  -- Semanas del mes marcadas para este proceso, separadas por comas: «1,3».
  -- En el formato son las cuatro columnas (G:H, I:J, K:L, M:N) a la derecha de
  -- los requisitos ISO 14001, bajo el rótulo «MES DE AUDITORIA: …».
  semanas        text,

  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programa_cronograma_programa_idx
  ON programa_auditoria_cronograma (programa_id, orden);

-- `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe.
ALTER TABLE programa_auditoria_cronograma
  ADD COLUMN IF NOT EXISTS semanas       text,
  ADD COLUMN IF NOT EXISTS proceso_clave text;

-- La primera versión tenía una columna `semana` (un único 1-4). Ahora un mismo
-- proceso puede ocupar varias semanas, así que se pasa a la lista y se retira.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programa_auditoria_cronograma' AND column_name = 'semana'
  ) THEN
    UPDATE programa_auditoria_cronograma
       SET semanas = semana::text
     WHERE semanas IS NULL AND semana IS NOT NULL;

    ALTER TABLE programa_auditoria_cronograma DROP COLUMN semana;
  END IF;
END $$;

-- ---- 2b. Dependencias auditadas en cada proceso -------------
CREATE TABLE IF NOT EXISTS programa_auditoria_cronograma_dependencias (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cronograma_id  bigint NOT NULL
                 REFERENCES programa_auditoria_cronograma(id) ON DELETE CASCADE,

  orden          integer NOT NULL DEFAULT 0,
  auditado       text NOT NULL,          -- AUDITADO/PROGRAMA
  auditores      text,                   -- AUDITOR(ES)

  -- Texto libre y opcional: la «AA» (Auditor Acompañante) de la nomenclatura
  -- del formato. Va aquí y no en la sección porque acompaña a una auditoría
  -- concreta, y suele ser alguien que no está en el catálogo de usuarios.
  auditor_acompanante text,

  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programa_cronograma_dep_idx
  ON programa_auditoria_cronograma_dependencias (cronograma_id, orden);

-- `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe.
ALTER TABLE programa_auditoria_cronograma_dependencias
  ADD COLUMN IF NOT EXISTS auditor_acompanante text;

-- Antes el cronograma era plano: una fila por dependencia, repitiendo el
-- proceso y los requisitos. Cada una de esas filas pasa a ser una sección con
-- una sola dependencia. Puede dejar varias secciones del mismo proceso; se ven
-- en el formulario y se juntan a mano, que es preferible a adivinar cuál de los
-- requisitos repetidos era el bueno.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programa_auditoria_cronograma' AND column_name = 'auditado'
  ) THEN
    INSERT INTO programa_auditoria_cronograma_dependencias (cronograma_id, orden, auditado, auditores)
    SELECT id, 0, coalesce(nullif(auditado, ''), proceso), auditores
      FROM programa_auditoria_cronograma;

    ALTER TABLE programa_auditoria_cronograma
      DROP COLUMN auditado,
      DROP COLUMN auditores;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. DISTRIBUCIÓN  (hoja «Distribución»)
--
-- ⚠️ El Excel original trae una columna «CONTRASEÑA» con claves en texto
-- plano. NO se modela aquí a propósito: guardar contraseñas legibles en la
-- base de datos —y exportarlas en un archivo descargable— es justo lo que
-- estamos intentando quitar del sistema (ver docs/MIGRACION-PASSWORDS.md).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programa_auditoria_distribucion (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  programa_id         bigint NOT NULL
                      REFERENCES programas_auditoria(id) ON DELETE CASCADE,

  orden               integer NOT NULL DEFAULT 0,

  -- Responsable del organismo
  responsable_titulo  text,   -- Magíster / Doctor / …
  responsable_nombre  text,
  organismo           text,

  -- Clasificación
  gestion             text,
  facultad            text,
  proceso             text,   -- PROCESO/FACULTAD (columna F)

  -- Auditor asignado
  auditor_nombre      text,
  auditor_correo      text,
  auditor_estudios    text,

  -- Coordinador del proceso
  coordinador_nombre  text,
  coordinador_correo  text,
  coordinador_alterno text,
  coordinador_nivel   text,

  -- Gestor de calidad
  gestor_nombre       text,
  gestor_correo       text,

  -- Decanatura (solo aplica a facultades)
  decanatura_nombre   text,
  decanatura_correo   text,
  decano_titulo       text,
  decano_nombre       text,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programa_distribucion_programa_idx
  ON programa_auditoria_distribucion (programa_id, orden);

-- ------------------------------------------------------------
-- 4. updated_at automático en la cabecera
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_programa_auditoria_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programas_auditoria_updated_at ON programas_auditoria;
CREATE TRIGGER programas_auditoria_updated_at
  BEFORE UPDATE ON programas_auditoria
  FOR EACH ROW EXECUTE FUNCTION set_programa_auditoria_updated_at();

-- ------------------------------------------------------------
-- 5. RLS
--
-- La API usa el cliente service-role, que salta RLS; estas políticas cubren
-- el acceso directo desde el navegador y siguen el patrón de las demás
-- tablas: admin escribe, visualizador y auditor solo leen.
-- ------------------------------------------------------------
ALTER TABLE programas_auditoria             ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_auditoria_cronograma   ENABLE ROW LEVEL SECURITY;
ALTER TABLE programa_auditoria_distribucion ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario registrado en `usuarios`.
DROP POLICY IF EXISTS "Lectura de programas" ON programas_auditoria;
CREATE POLICY "Lectura de programas"
ON programas_auditoria FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Lectura de cronograma" ON programa_auditoria_cronograma;
CREATE POLICY "Lectura de cronograma"
ON programa_auditoria_cronograma FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Lectura de distribución" ON programa_auditoria_distribucion;
CREATE POLICY "Lectura de distribución"
ON programa_auditoria_distribucion FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid()));

-- Escritura: solo admin.
DROP POLICY IF EXISTS "Admin gestiona programas" ON programas_auditoria;
CREATE POLICY "Admin gestiona programas"
ON programas_auditoria FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
          WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
          WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

DROP POLICY IF EXISTS "Admin gestiona cronograma" ON programa_auditoria_cronograma;
CREATE POLICY "Admin gestiona cronograma"
ON programa_auditoria_cronograma FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
          WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
          WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

DROP POLICY IF EXISTS "Admin gestiona distribución" ON programa_auditoria_distribucion;
CREATE POLICY "Admin gestiona distribución"
ON programa_auditoria_distribucion FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
          WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
          WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

-- ------------------------------------------------------------
-- 5. DE QUÉ PROGRAMA VIENE CADA AUDITORÍA
--
-- Al aprobar un programa se podrán generar sus auditorías, y luego hay que
-- poder responder «¿de qué programa salió esta?».
--
-- Va en `informes_auditoria` y NO en `planes_auditoria_informe`: esa tabla es
-- el PDF del plan (`archivo_path NOT NULL`, una fila por informe) y solo existe
-- cuando alguien lo sube. Una auditoría recién generada todavía no tiene plan,
-- así que no tendría dónde guardar su origen.
--
-- Las auditorías que ya existen NO se tocan:
--   · la columna es NULLABLE y sin DEFAULT, así que Postgres no reescribe la
--     tabla; es un cambio solo de catálogo y las filas antiguas quedan en NULL.
--   · `ON DELETE SET NULL` y nunca CASCADE: borrar un programa jamás puede
--     arrastrar auditorías.
--   · el índice es parcial, así que solo pesa lo que ocupen las nuevas.
--
-- NULL significa exactamente «se creó a mano, antes de los programas»; es un
-- dato, no un hueco por rellenar.
-- ------------------------------------------------------------
ALTER TABLE informes_auditoria
  ADD COLUMN IF NOT EXISTS programa_auditoria_id bigint
    REFERENCES programas_auditoria(id) ON DELETE SET NULL;

COMMENT ON COLUMN informes_auditoria.programa_auditoria_id IS
  'Programa de auditoría que generó esta auditoría. NULL = creada a mano.';

CREATE INDEX IF NOT EXISTS informes_programa_auditoria_idx
  ON informes_auditoria (programa_auditoria_id)
  WHERE programa_auditoria_id IS NOT NULL;

-- Comprobación: cuántas auditorías vienen de un programa y cuántas son previas.
--   SELECT coalesce(programa_auditoria_id::text, 'a mano') AS origen, count(*)
--     FROM informes_auditoria GROUP BY 1 ORDER BY 2 DESC;

-- ------------------------------------------------------------
-- Migración: mes único → rango de meses
--
-- Antes había una sola columna `mes_auditoria`. Ahora el programa puede abarcar
-- varios meses, y el Excel dibuja cuatro semanas por cada uno.
--
-- El bloque es idempotente y no pierde nada: crea las dos columnas, copia el
-- mes que hubiera a los dos extremos del rango —un programa de un solo mes
-- sigue siendo exactamente eso— y solo entonces retira la columna vieja. En una
-- base recién creada con el CREATE TABLE de arriba no hace nada.
-- ------------------------------------------------------------
ALTER TABLE programas_auditoria
  ADD COLUMN IF NOT EXISTS mes_inicio text,
  ADD COLUMN IF NOT EXISTS mes_fin    text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'programas_auditoria' AND column_name = 'mes_auditoria'
  ) THEN
    EXECUTE $sql$
      UPDATE programas_auditoria
         SET mes_inicio = COALESCE(mes_inicio, mes_auditoria),
             mes_fin    = COALESCE(mes_fin,    mes_auditoria)
       WHERE mes_auditoria IS NOT NULL
    $sql$;
  END IF;
END $$;

ALTER TABLE programas_auditoria DROP COLUMN IF EXISTS mes_auditoria;

COMMENT ON COLUMN programas_auditoria.mes_inicio IS
  'Primer mes del programa, en mayúsculas y sin tildes decorativas: «SEPTIEMBRE».';
COMMENT ON COLUMN programas_auditoria.mes_fin IS
  'Último mes del programa, incluido. Igual a mes_inicio si dura un solo mes.';

-- Comprobación: qué rango tiene cada programa.
--   SELECT anio, nombre, mes_inicio, mes_fin FROM programas_auditoria ORDER BY anio DESC;
