-- ============================================================
-- EVALUACIÓN DE AUDITADOS
--
-- La valoración que hace el auditor del proceso que auditó: cómo se preparó,
-- si estuvo disponible, si entregó la información a tiempo, cómo atendió el
-- cierre… Es la «Propuesta Evaluación de Auditados»: ocho aspectos con una
-- escala de 1 (deficiente) a 5 (excelente) y unas observaciones.
--
-- Una por auditoría. La fecha y la dependencia NO se guardan aquí: salen del
-- informe, que es la fuente, y copiarlas haría que se desincronizaran el día
-- que alguien corrija la fecha de la auditoría. El líder y el proceso sí, porque
-- no están en ninguna otra parte (el proceso se propone desde el programa de
-- auditoría, pero el auditor lo puede corregir).
--
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluaciones_auditados (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- UNIQUE: una evaluación por auditoría; al guardar se hace `upsert` sobre
  -- esta columna. En CASCADE: sin la auditoría, la evaluación no significa nada.
  informe_id           bigint NOT NULL UNIQUE
                       REFERENCES informes_auditoria(id) ON DELETE CASCADE,

  lider_proceso        text NOT NULL,
  proceso_auditado     text NOT NULL,

  -- Una columna por aspecto, y no un JSON: así se puede promediar cada uno en
  -- SQL o en el Excel sin desempaquetar nada. El nombre de cada columna es la
  -- `clave` de `ASPECTOS` en `src/features/evaluaciones/lib/evaluacion-auditados.js`.
  preparacion          smallint NOT NULL CHECK (preparacion BETWEEN 1 AND 5),
  disponibilidad       smallint NOT NULL CHECK (disponibilidad BETWEEN 1 AND 5),
  entrega_informacion  smallint NOT NULL CHECK (entrega_informacion BETWEEN 1 AND 5),
  claridad_informacion smallint NOT NULL CHECK (claridad_informacion BETWEEN 1 AND 5),
  colaboracion         smallint NOT NULL CHECK (colaboracion BETWEEN 1 AND 5),
  aclaraciones         smallint NOT NULL CHECK (aclaraciones BETWEEN 1 AND 5),
  participacion_cierre smallint NOT NULL CHECK (participacion_cierre BETWEEN 1 AND 5),
  compromiso_mejora    smallint NOT NULL CHECK (compromiso_mejora BETWEEN 1 AND 5),

  observaciones        text NOT NULL DEFAULT '',

  -- Quién la guardó por última vez (`auth.uid()`). El detalle de cada cambio
  -- queda además en `registro_actividad`.
  actualizado_por      uuid DEFAULT auth.uid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE evaluaciones_auditados IS
  'Valoración del proceso auditado hecha por el auditor. Una por auditoría. Ver sql/evaluacion-auditados.sql.';

-- ------------------------------------------------------------
-- RLS
--
-- La escribe y la lee el auditor al que está asignada la auditoría, y
-- administración. A diferencia de las notas de etapa, NO la lee cualquiera:
-- es una valoración de una dependencia con nombre y apellidos.
-- ------------------------------------------------------------
ALTER TABLE evaluaciones_auditados ENABLE ROW LEVEL SECURITY;

-- El `WITH CHECK` repite el `USING` a propósito: sin él se podría mover una
-- evaluación a la auditoría de otro.
DROP POLICY IF EXISTS "Auditor gestiona la evaluación de su auditoría" ON evaluaciones_auditados;
CREATE POLICY "Auditor gestiona la evaluación de su auditoría"
ON evaluaciones_auditados FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM informes_auditoria i
      JOIN usuarios u ON u.usuario_id = i.usuario_id
     WHERE i.id = evaluaciones_auditados.informe_id
       AND u.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM informes_auditoria i
      JOIN usuarios u ON u.usuario_id = i.usuario_id
     WHERE i.id = evaluaciones_auditados.informe_id
       AND u.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admin gestiona evaluaciones de auditados" ON evaluaciones_auditados;
CREATE POLICY "Admin gestiona evaluaciones de auditados"
ON evaluaciones_auditados FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

-- ------------------------------------------------------------
-- Registro de actividad
--
-- Mismo disparador que el resto de tablas (ver `sql/registro-actividad.sql`,
-- donde también está ya en la lista). Va aquí para que la tabla quede
-- registrada desde el primer guardado sin tener que volver a ejecutar aquel
-- archivo. Si el registro no está instalado, se omite.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'registrar_actividad') THEN
    DROP TRIGGER IF EXISTS registro_actividad_trg ON evaluaciones_auditados;
    CREATE TRIGGER registro_actividad_trg
      AFTER INSERT OR UPDATE OR DELETE ON evaluaciones_auditados
      FOR EACH ROW EXECUTE FUNCTION registrar_actividad();
  ELSE
    RAISE NOTICE '[evaluaciones_auditados] sin registro de actividad instalado: no se registrará';
  END IF;
END $$;

-- Comprobación: la tabla, sus dos políticas y el disparador.
SELECT 'políticas' AS comprobacion, count(*)::text AS total
  FROM pg_policies
 WHERE tablename = 'evaluaciones_auditados'
UNION ALL
SELECT 'disparador de registro', count(*)::text
  FROM pg_trigger
 WHERE tgname = 'registro_actividad_trg'
   AND tgrelid = 'evaluaciones_auditados'::regclass;
