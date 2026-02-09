-- =====================================================
-- MIGRACIÓN: Agregar dependencia_id a encuestas_auditores
-- =====================================================

-- Agregar columna dependencia_id a la tabla encuestas_auditores
ALTER TABLE encuestas_auditores 
ADD COLUMN IF NOT EXISTS dependencia_id UUID;

-- Agregar comentario
COMMENT ON COLUMN encuestas_auditores.dependencia_id IS 'FK a tabla dependencias, vinculada por fuzzy matching del nombre de la dependencia del Excel';

-- Recrear vista para incluir información de dependencia del auditor
CREATE OR REPLACE VIEW vista_resumen_evaluaciones AS
SELECT 
  e.id,
  e.periodo,
  e.anio,
  u.nombre as auditor_nombre,
  u.apellido as auditor_apellido,
  u.email as auditor_correo,
  u.rol as auditor_rol,
  -- Obtener la dependencia más reciente del auditor desde las encuestas
  (
    SELECT d.nombre 
    FROM encuestas_auditores enc
    LEFT JOIN dependencias d ON enc.dependencia_id = d.id
    WHERE enc.auditor_id = e.auditor_id 
      AND enc.periodo = e.periodo
      AND enc.dependencia_id IS NOT NULL
    ORDER BY enc.fecha_respuesta DESC
    LIMIT 1
  ) as auditor_dependencia_nombre,
  e.nota_archivos,
  e.porcentaje_completitud,
  e.nota_encuesta,
  e.num_encuestas_recibidas,
  e.nota_rubrica,
  e.nota_final,
  e.estado,
  e.created_at,
  e.updated_at,
  CASE 
    WHEN e.nota_final >= 4.5 THEN 'Excelente'
    WHEN e.nota_final >= 4.0 THEN 'Sobresaliente'
    WHEN e.nota_final >= 3.5 THEN 'Bueno'
    WHEN e.nota_final >= 3.0 THEN 'Aceptable'
    ELSE 'Insuficiente'
  END as calificacion_cualitativa
FROM evaluaciones_auditores e
INNER JOIN usuarios u ON e.auditor_id = u.auth_user_id
ORDER BY e.anio DESC, e.periodo DESC, e.nota_final DESC;

COMMENT ON VIEW vista_resumen_evaluaciones IS 'Vista consolidada de evaluaciones con información del auditor, dependencia y calificación cualitativa';
