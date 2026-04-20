-- =====================================================
-- SISTEMA DE ALERTAS DE AUDITORÍA
-- =====================================================
-- Configuración por proceso + historial de correos enviados
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS alertas_procesos_config (
  proceso_key TEXT PRIMARY KEY,
  proceso_label TEXT NOT NULL,
  bucket TEXT,
  due_offset_business_days INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_5_dias BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_1_dia BOOLEAN NOT NULL DEFAULT TRUE,
  alerta_vencido BOOLEAN NOT NULL DEFAULT TRUE,
  dias_repeticion_vencido INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alertas_procesos_config IS 'Configuración de alertas por proceso de auditoría';

INSERT INTO alertas_procesos_config (
  proceso_key,
  proceso_label,
  bucket,
  due_offset_business_days,
  activo,
  alerta_5_dias,
  alerta_1_dia,
  alerta_vencido,
  dias_repeticion_vencido
)
VALUES
  ('carta_compromiso', 'Carta de compromiso', 'actascompromiso', -5, TRUE, TRUE, TRUE, TRUE, 10),
  ('plan_auditoria', 'Plan de auditoría', 'planes', -5, TRUE, TRUE, TRUE, TRUE, 10),
  ('listado_asistencia', 'Listado de asistencia', 'asistencias', 0, TRUE, TRUE, TRUE, TRUE, 10),
  ('evaluacion', 'Evaluación', 'evaluaciones', 0, TRUE, TRUE, TRUE, TRUE, 10),
  ('acta_reunion', 'Acta de reunión', 'actas', 10, TRUE, TRUE, TRUE, TRUE, 10),
  ('informe_auditoria', 'Informe de auditoría', 'validaciones', 10, TRUE, TRUE, TRUE, TRUE, 10)
ON CONFLICT (proceso_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS alertas_historial (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  informe_id BIGINT NOT NULL,
  proceso_key TEXT NOT NULL,
  proceso_label TEXT NOT NULL,
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('before_5', 'before_1', 'overdue')),
  dias_referencia INTEGER NOT NULL,
  fecha_vencimiento DATE,
  correo_destino TEXT,
  enviado_por UUID,
  estado TEXT NOT NULL DEFAULT 'enviado',
  observaciones TEXT,
  enviado_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_historial_unico
ON alertas_historial (informe_id, proceso_key, tipo_alerta, dias_referencia);

CREATE INDEX IF NOT EXISTS idx_alertas_historial_enviado_at
ON alertas_historial (enviado_at DESC);

COMMENT ON TABLE alertas_historial IS 'Historial de correos enviados por alertas de auditoría';
