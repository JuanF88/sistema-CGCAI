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
  mes_auditoria     text,   -- p. ej. «SEPTIEMBRE»

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
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programa_auditoria_cronograma (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  programa_id    bigint NOT NULL
                 REFERENCES programas_auditoria(id) ON DELETE CASCADE,

  orden          integer NOT NULL DEFAULT 0,
  proceso        text NOT NULL,          -- PROCESO A AUDITAR
  auditado       text,                   -- AUDITADO/PROGRAMA
  auditores      text,                   -- AUDITOR(ES)
  requisitos_9001  text,
  requisitos_14001 text,

  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programa_cronograma_programa_idx
  ON programa_auditoria_cronograma (programa_id, orden);

-- La primera versión tenía una columna `semana` (1-4) que marcaba la X en la
-- cuadrícula del formato. Se retiró: el mes de auditoría de la cabecera basta.
ALTER TABLE programa_auditoria_cronograma DROP COLUMN IF EXISTS semana;

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
