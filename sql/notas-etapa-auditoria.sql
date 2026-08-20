-- ============================================================
-- NOTAS DE LAS ETAPAS DE LA LÍNEA DE TRABAJO
--
-- Una fila por (auditoría, etapa) con texto libre del auditor: «la dependencia
-- pidió mover la reunión», «el acta la firma el decano el viernes», «falta la
-- evidencia del numeral 8.5». Hasta ahora eso vivía en el correo o en la
-- cabeza de quien audita, y al cambiar de auditor se perdía.
--
-- La nota es del paso, no del documento: existe aunque no se haya subido nada
-- todavía, que es justo cuando hace falta explicar por qué.
--
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS notas_etapa_auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- En CASCADE: la nota no significa nada sin su auditoría.
  informe_id  bigint NOT NULL REFERENCES informes_auditoria(id) ON DELETE CASCADE,

  -- La clave de la etapa tal y como la nombra la línea de trabajo:
  -- 'acta_compromiso', 'plan', 'asistencia', 'evaluacion', 'acta', 'informe',
  -- 'plan_mejora'. Texto libre y no un CHECK a propósito: las etapas se
  -- definen en el código y una lista aquí obligaría a migrar la base cada vez
  -- que se añade un paso.
  etapa       text NOT NULL,

  nota        text NOT NULL DEFAULT '',

  -- Quién la escribió por última vez. Es `auth.uid()`, el usuario de Supabase,
  -- que es lo que el cliente tiene a mano al guardar.
  actualizado_por uuid,
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Una nota por etapa: al guardar se hace `upsert` sobre esta pareja, así que
  -- editar sustituye en vez de acumular versiones.
  UNIQUE (informe_id, etapa)
);

COMMENT ON TABLE notas_etapa_auditoria IS
  'Texto libre del auditor en cada paso de la línea de trabajo. Una nota por auditoría y etapa.';

-- La consulta del panel es siempre «todas las notas de esta auditoría»; la
-- restricción única ya crea el índice que la resuelve.

-- ------------------------------------------------------------
-- RLS
--
-- Mismo criterio que `planes_auditoria_informe`: lee cualquiera del sistema
-- —el administrador necesita ver por qué un paso va tarde— y escribe el
-- auditor al que está asignada la auditoría, más administración.
-- ------------------------------------------------------------
ALTER TABLE notas_etapa_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de notas de etapa" ON notas_etapa_auditoria;
CREATE POLICY "Lectura de notas de etapa"
ON notas_etapa_auditoria FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid()));

-- El `WITH CHECK` repite el `USING` a propósito: `USING` decide qué filas se
-- pueden tocar y `WITH CHECK` valida la fila resultante. Sin él se podría
-- mover una nota a la auditoría de otro.
DROP POLICY IF EXISTS "Auditor escribe las notas de su auditoría" ON notas_etapa_auditoria;
CREATE POLICY "Auditor escribe las notas de su auditoría"
ON notas_etapa_auditoria FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM informes_auditoria i
      JOIN usuarios u ON u.usuario_id = i.usuario_id
     WHERE i.id = notas_etapa_auditoria.informe_id
       AND u.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM informes_auditoria i
      JOIN usuarios u ON u.usuario_id = i.usuario_id
     WHERE i.id = notas_etapa_auditoria.informe_id
       AND u.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin gestiona notas de etapa" ON notas_etapa_auditoria;
CREATE POLICY "Admin gestiona notas de etapa"
ON notas_etapa_auditoria FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

-- Comprobaciones:
--   Políticas de la tabla:
--     SELECT policyname, cmd FROM pg_policies
--      WHERE tablename = 'notas_etapa_auditoria' ORDER BY cmd, policyname;
--
--   Notas escritas, por etapa:
--     SELECT etapa, count(*) FROM notas_etapa_auditoria
--      WHERE nota <> '' GROUP BY etapa ORDER BY 2 DESC;
