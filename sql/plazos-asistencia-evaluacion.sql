-- ============================================================
-- PLAZO DE LA ASISTENCIA Y LA EVALUACIÓN: EL DÍA HÁBIL SIGUIENTE
--
-- Hasta ahora ambos vencían el mismo día de la auditoría. En la práctica los
-- dos documentos se recogen en la reunión y se digitalizan después, así que el
-- plazo pasa a ser el día hábil siguiente.
--
-- El plazo con el que se dispara la alerta ya sale del código
-- (`src/lib/catalogos/plazos.js`), así que los avisos funcionan bien sin tocar
-- nada. Lo que arregla este script es la columna `due_offset_business_days`,
-- que es la que se **muestra** en el panel de alertas y seguiría diciendo 0.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente y no borra nada.
-- ============================================================

UPDATE alertas_procesos_config
   SET due_offset_business_days = 1,
       updated_at = NOW()
 WHERE proceso_key IN ('listado_asistencia', 'evaluacion')
   AND due_offset_business_days <> 1;

-- Comprobación: los seis procesos con su plazo en días hábiles.
--   -5 carta de compromiso y plan · 1 asistencia y evaluación · 10 acta e informe
--
--   SELECT proceso_key, proceso_label, due_offset_business_days, activo
--     FROM alertas_procesos_config
--    ORDER BY due_offset_business_days, proceso_key;
--
-- Después de esto, en «Evaluación de auditores» conviene pulsar «Recalcular
-- archivos»: las notas guardadas se calcularon con el plazo anterior y el
-- nuevo solo puede mejorarlas, nunca empeorarlas.
