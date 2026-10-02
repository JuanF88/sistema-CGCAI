-- ============================================================
-- AVISOS ENVIADOS A MANO DESDE LA MALLA DE INICIO
--
-- Hasta ahora las alertas solo salían del barrido automático, y solo en los
-- tres momentos que tiene programados: cinco días antes, un día antes y cada
-- diez días hábiles de retraso. Entre uno y otro no había forma de recordarle
-- a un auditor que le falta un documento.
--
-- El Centro de Control permite ahora pulsar una celda con documentos
-- pendientes y enviar el aviso en el momento. Esos envíos se registran en el
-- mismo historial que los automáticos, con su propio tipo, para que quede
-- claro cuáles los mandó una persona y cuáles el sistema.
--
-- El índice único de `alertas_historial` es
-- (informe_id, proceso_key, tipo_alerta, dias_referencia). En los envíos a
-- mano, `dias_referencia` guarda los días hábiles que faltan o sobran —con
-- signo—, así que cambia cada día: eso limita el recordatorio manual a uno
-- por auditoría, documento y día, que es un freno razonable sin tener que
-- inventar otra tabla.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente y no borra nada.
-- ============================================================

ALTER TABLE alertas_historial
  DROP CONSTRAINT IF EXISTS alertas_historial_tipo_alerta_check;

ALTER TABLE alertas_historial
  ADD CONSTRAINT alertas_historial_tipo_alerta_check
  CHECK (tipo_alerta IN ('before_5', 'before_1', 'overdue', 'manual'));

COMMENT ON COLUMN alertas_historial.tipo_alerta IS
  'before_5 / before_1 / overdue los manda el barrido automático; manual, una persona desde el Centro de Control.';

-- Comprobaciones:
--   Que el tipo nuevo se acepta:
--     SELECT conname, pg_get_constraintdef(oid)
--       FROM pg_constraint
--      WHERE conrelid = 'alertas_historial'::regclass
--        AND conname = 'alertas_historial_tipo_alerta_check';
--
--   Reparto de envíos por tipo:
--     SELECT tipo_alerta, count(*) FROM alertas_historial
--      GROUP BY tipo_alerta ORDER BY 2 DESC;
