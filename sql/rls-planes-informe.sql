-- ============================================================
-- RLS DE `planes_auditoria_informe`
--
-- Síntoma: al subir el plan de auditoría desde el panel del auditor,
--   «new row violates row-level security policy for table
--    planes_auditoria_informe»
--
-- Causa: la tabla tiene RLS activo, pero la única política que existe es la de
-- LECTURA para el rol visualizador (`rls-visualizador.sql`). Sin política de
-- escritura, Postgres rechaza cualquier INSERT o UPDATE que no venga con
-- service-role, y esa subida sale del navegador con la sesión del auditor.
--
-- No es un fallo del código: el archivo se sube bien al bucket y lo que falla
-- es dejar constancia en la tabla.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

ALTER TABLE planes_auditoria_informe ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Lectura: cualquiera del sistema
--
-- La política de `rls-visualizador.sql` solo deja leer al visualizador, así
-- que al auditor y al administrador la tabla les salía vacía: el plan subido
-- existía pero no se veía, y los contadores de «Planes» daban de menos.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Lectura de planes" ON planes_auditoria_informe;
CREATE POLICY "Lectura de planes"
ON planes_auditoria_informe FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid()));

-- ------------------------------------------------------------
-- Escritura: el auditor responsable de esa auditoría
--
-- Se comprueba contra `informes_auditoria.usuario_id`, que es a quien está
-- asignada: cada auditor sube el plan de lo suyo y de nada más. El `WITH CHECK`
-- repite la condición a propósito —`USING` filtra lo que se puede modificar y
-- `WITH CHECK` valida la fila resultante—; sin él se podría mover una fila a
-- una auditoría ajena.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Auditor gestiona el plan de su auditoría" ON planes_auditoria_informe;
CREATE POLICY "Auditor gestiona el plan de su auditoría"
ON planes_auditoria_informe FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM informes_auditoria i
      JOIN usuarios u ON u.usuario_id = i.usuario_id
     WHERE i.id = planes_auditoria_informe.informe_id
       AND u.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM informes_auditoria i
      JOIN usuarios u ON u.usuario_id = i.usuario_id
     WHERE i.id = planes_auditoria_informe.informe_id
       AND u.auth_user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- Escritura: administración, sobre cualquier auditoría
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admin gestiona planes" ON planes_auditoria_informe;
CREATE POLICY "Admin gestiona planes"
ON planes_auditoria_informe FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

-- ------------------------------------------------------------
-- El `upsert` necesita una restricción única sobre `informe_id`
--
-- El código sube el plan con `onConflict: 'informe_id'`, y eso exige que la
-- columna tenga índice único. Si no lo tiene, al volver a subir el plan de una
-- auditoría que ya tenía uno falla con «no unique or exclusion constraint
-- matching the ON CONFLICT specification» en vez de reemplazarlo.
--
-- Se crea solo si no hay ya una restricción equivalente, y solo si no hay
-- duplicados; con duplicados hay que decidir cuál se queda, y eso no lo puede
-- hacer un script a ciegas.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT informe_id FROM planes_auditoria_informe
     GROUP BY informe_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Hay auditorías con más de un plan; revisa antes de crear el índice único.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS planes_auditoria_informe_informe_id_key
      ON planes_auditoria_informe (informe_id);
  END IF;
END $$;

-- Comprobaciones:
--   Políticas de la tabla:
--     SELECT policyname, cmd FROM pg_policies
--      WHERE tablename = 'planes_auditoria_informe' ORDER BY cmd, policyname;
--
--   Auditorías con plan registrado:
--     SELECT count(*) FROM planes_auditoria_informe;
