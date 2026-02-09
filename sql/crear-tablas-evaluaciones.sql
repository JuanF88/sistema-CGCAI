-- =====================================================
-- SISTEMA DE EVALUACIÓN DE AUDITORES
-- =====================================================
-- Autor: Sistema CGCAI
-- Fecha: Enero 2026
-- Descripción: Tablas para evaluar auditores con 3 fuentes:
--   1. Nota automática por archivos cargados
--   2. Nota de encuestas Google Forms (Excel)
--   3. Nota manual por rúbrica
-- =====================================================

-- Habilitar extensión para UUID si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TABLA: encuestas_auditores
-- Almacena respuestas crudas del Google Forms
-- =====================================================
CREATE TABLE IF NOT EXISTS encuestas_auditores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relación con auditor (se vincula después por matching de nombre)
  auditor_id UUID, -- Sin FK inicialmente, se vincula después
  auditor_nombre TEXT NOT NULL, -- Nombre tal como viene del Excel
  
  -- Información del evaluador (quien llena la encuesta)
  evaluador_nombre TEXT,
  evaluador_cargo TEXT,
  
  -- Contexto de la auditoría
  dependencia_auditada TEXT, -- Dependencia que recibe la auditoría
  dependencia_id BIGINT, -- FK a tabla dependencias (si se encontró match)
  fecha_respuesta TIMESTAMP, -- Marca temporal del formulario
  
  -- Periodo de evaluación
  periodo TEXT, -- Formato: "2024-S1" o "2024-S2"
  anio INTEGER,
  semestre TEXT, -- "S1" o "S2"
  
  -- 10 preguntas de evaluación (escala 0-5, donde 0 = No aplica)
  pregunta_1 INTEGER CHECK (pregunta_1 >= 0 AND pregunta_1 <= 5), -- Notificación plan
  pregunta_2 INTEGER CHECK (pregunta_2 >= 0 AND pregunta_2 <= 5), -- Lenguaje claro
  pregunta_3 INTEGER CHECK (pregunta_3 >= 0 AND pregunta_3 <= 5), -- Evidencia objetiva
  pregunta_4 INTEGER CHECK (pregunta_4 >= 0 AND pregunta_4 <= 5), -- Argumentos norma
  pregunta_5 INTEGER CHECK (pregunta_5 >= 0 AND pregunta_5 <= 5), -- Aporte mejoramiento
  pregunta_6 INTEGER CHECK (pregunta_6 >= 0 AND pregunta_6 <= 5), -- Claridad hallazgos
  pregunta_7 INTEGER CHECK (pregunta_7 >= 0 AND pregunta_7 <= 5), -- Manejo conflictos
  pregunta_8 INTEGER CHECK (pregunta_8 >= 0 AND pregunta_8 <= 5), -- Concertación cierre
  pregunta_9 INTEGER CHECK (pregunta_9 >= 0 AND pregunta_9 <= 5), -- Ambiente cordial
  pregunta_10 INTEGER CHECK (pregunta_10 >= 0 AND pregunta_10 <= 5), -- Coordinación equipo
  
  -- Nota calculada (promedio de las 10 preguntas convertido a escala 0-5)
  nota_calculada NUMERIC(3,2),
  
  -- Observaciones/comentarios del formulario
  observaciones TEXT,
  
  -- Metadatos de importación
  archivo_nombre TEXT,
  archivo_url TEXT, -- URL del Excel en Supabase Storage
  importado_por UUID, -- Sin FK inicialmente
  fecha_importacion TIMESTAMP DEFAULT NOW(),
  
  -- Estado
  validada BOOLEAN DEFAULT false,
  procesada BOOLEAN DEFAULT false, -- Si ya se usó para calcular evaluación final
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_encuestas_auditor_id ON encuestas_auditores(auditor_id);
CREATE INDEX IF NOT EXISTS idx_encuestas_auditor_nombre ON encuestas_auditores(auditor_nombre);
CREATE INDEX IF NOT EXISTS idx_encuestas_fecha ON encuestas_auditores(fecha_respuesta);
CREATE INDEX IF NOT EXISTS idx_encuestas_importacion ON encuestas_auditores(fecha_importacion);

-- Comentarios
COMMENT ON TABLE encuestas_auditores IS 'Almacena respuestas individuales de encuestas de Google Forms para evaluar auditores';
COMMENT ON COLUMN encuestas_auditores.nota_calculada IS 'Promedio de las 10 preguntas: ((p1+p2+...+p10)/10) convertido a escala 0-5';

-- =====================================================
-- 2. TABLA: rubricas_evaluacion
-- Rúbricas configurables para evaluación manual
-- =====================================================
CREATE TABLE IF NOT EXISTS rubricas_evaluacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  
  -- Estructura de criterios en JSON
  -- Formato: [
  --   {
  --     "id": "c1",
  --     "nombre": "Cumplimiento de cronograma",
  --     "descripcion": "Entrega puntual...",
  --     "peso": 0.25,
  --     "escala": 5.0
  --   },
  --   ...
  -- ]
  criterios JSONB NOT NULL,
  
  -- Control
  activa BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  
  created_by UUID, -- Sin FK inicialmente
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_rubricas_activa ON rubricas_evaluacion(activa);

COMMENT ON TABLE rubricas_evaluacion IS 'Rúbricas configurables para evaluación manual de auditores';

-- =====================================================
-- 3. TABLA: evaluaciones_auditores
-- Consolidado de evaluaciones (3 fuentes)
-- =====================================================
CREATE TABLE IF NOT EXISTS evaluaciones_auditores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relaciones (sin FK por ahora, se agregan después)
  auditor_id UUID NOT NULL,
  auditoria_id UUID,
  
  -- NUEVO: Vínculo directo con informe de auditoría
  informe_auditoria_id BIGINT,
  
  -- Dependencia auditada (un auditor puede tener varias evaluaciones en el mismo periodo, una por dependencia)
  dependencia_auditada TEXT, -- Nombre de la dependencia que recibió la auditoría
  dependencia_id BIGINT, -- FK a tabla dependencias (opcional)
  
  -- Periodo de evaluación
  periodo TEXT NOT NULL, -- Ej: "2024-S1", "2024-S2", "2024"
  anio INTEGER NOT NULL,
  
  -- ==========================================
  -- FUENTE 1: Archivos cargados (automático)
  -- ==========================================
  nota_archivos NUMERIC(3,2) CHECK (nota_archivos >= 0 AND nota_archivos <= 5.0),
  archivos_esperados INTEGER DEFAULT 0,
  archivos_cargados INTEGER DEFAULT 0,
  porcentaje_completitud NUMERIC(5,2), -- Porcentaje de archivos cargados
  detalle_archivos JSONB, -- {esperados: [...], cargados: [...], faltantes: [...]}
  fecha_calculo_archivos TIMESTAMP,
  
  -- ==========================================
  -- FUENTE 2: Encuestas (Google Forms)
  -- ==========================================
  nota_encuesta NUMERIC(3,2) CHECK (nota_encuesta >= 0 AND nota_encuesta <= 5.0),
  num_encuestas_recibidas INTEGER DEFAULT 0, -- Cantidad de encuestas para este auditor
  encuestas_ids UUID[], -- Array de IDs de encuestas_auditores
  fecha_calculo_encuesta TIMESTAMP,
  
  -- ==========================================
  -- FUENTE 3: Evaluación manual (Rúbrica)
  -- ==========================================
  nota_rubrica NUMERIC(3,2) CHECK (nota_rubrica >= 0 AND nota_rubrica <= 5.0),
  rubrica_id UUID, -- Sin FK por ahora
  rubrica_respuestas JSONB, -- {c1: 4.5, c2: 5.0, ...} puntajes por criterio
  evaluado_por UUID, -- Sin FK por ahora
  fecha_evaluacion_manual TIMESTAMP,
  observaciones_manual TEXT,
  
  -- ==========================================
  -- NOTA FINAL (promedio ponderado)
  -- ==========================================
  nota_final NUMERIC(3,2) CHECK (nota_final >= 0 AND nota_final <= 5.0),
  ponderacion_archivos NUMERIC(3,2) DEFAULT 0.33 CHECK (ponderacion_archivos >= 0 AND ponderacion_archivos <= 1),
  ponderacion_encuesta NUMERIC(3,2) DEFAULT 0.33 CHECK (ponderacion_encuesta >= 0 AND ponderacion_encuesta <= 1),
  ponderacion_rubrica NUMERIC(3,2) DEFAULT 0.34 CHECK (ponderacion_rubrica >= 0 AND ponderacion_rubrica <= 1),
  
  -- Metadatos
  observaciones_generales TEXT,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'completa', 'publicada')),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Un auditor puede tener múltiples evaluaciones por periodo (una por dependencia auditada)
  UNIQUE(auditor_id, periodo, dependencia_auditada)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_eval_auditor ON evaluaciones_auditores(auditor_id);
CREATE INDEX IF NOT EXISTS idx_eval_periodo ON evaluaciones_auditores(periodo);
CREATE INDEX IF NOT EXISTS idx_eval_anio ON evaluaciones_auditores(anio);
CREATE INDEX IF NOT EXISTS idx_eval_auditoria ON evaluaciones_auditores(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_eval_estado ON evaluaciones_auditores(estado);
CREATE INDEX IF NOT EXISTS idx_eval_nota_final ON evaluaciones_auditores(nota_final);

COMMENT ON TABLE evaluaciones_auditores IS 'Evaluaciones consolidadas de auditores con 3 fuentes: archivos, encuestas y rúbrica';
COMMENT ON COLUMN evaluaciones_auditores.nota_final IS 'Nota final = (archivos*pond1) + (encuesta*pond2) + (rubrica*pond3)';

-- =====================================================
-- 4. FUNCIÓN: Calcular nota de encuesta (promedio 10 preguntas)
-- =====================================================
CREATE OR REPLACE FUNCTION calcular_nota_encuesta(
  p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER,
  p6 INTEGER, p7 INTEGER, p8 INTEGER, p9 INTEGER, p10 INTEGER
) RETURNS NUMERIC AS $$
DECLARE
  suma INTEGER;
  promedio NUMERIC;
BEGIN
  -- Suma de las 10 preguntas (ya en escala 0-5)
  suma := COALESCE(p1, 0) + COALESCE(p2, 0) + COALESCE(p3, 0) + 
          COALESCE(p4, 0) + COALESCE(p5, 0) + COALESCE(p6, 0) + 
          COALESCE(p7, 0) + COALESCE(p8, 0) + COALESCE(p9, 0) + 
          COALESCE(p10, 0);
  
  -- Promedio simple (las preguntas ya están en escala 0-5)
  promedio := (suma::NUMERIC / 10.0);
  
  -- Redondear a 2 decimales
  RETURN ROUND(promedio, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calcular_nota_encuesta IS 'Calcula nota de encuesta: promedio de 10 preguntas en escala 0-5';

-- =====================================================
-- 5. TRIGGER: Auto-calcular nota_calculada en encuestas
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_calcular_nota_encuesta()
RETURNS TRIGGER AS $$
BEGIN
  NEW.nota_calculada := calcular_nota_encuesta(
    NEW.pregunta_1, NEW.pregunta_2, NEW.pregunta_3, NEW.pregunta_4, NEW.pregunta_5,
    NEW.pregunta_6, NEW.pregunta_7, NEW.pregunta_8, NEW.pregunta_9, NEW.pregunta_10
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS before_insert_update_encuesta ON encuestas_auditores;
CREATE TRIGGER before_insert_update_encuesta
  BEFORE INSERT OR UPDATE ON encuestas_auditores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calcular_nota_encuesta();

-- =====================================================
-- 6. FUNCIÓN: Actualizar timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_encuestas_timestamp ON encuestas_auditores;
CREATE TRIGGER update_encuestas_timestamp
  BEFORE UPDATE ON encuestas_auditores
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_rubricas_timestamp ON rubricas_evaluacion;
CREATE TRIGGER update_rubricas_timestamp
  BEFORE UPDATE ON rubricas_evaluacion
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_evaluaciones_timestamp ON evaluaciones_auditores;
CREATE TRIGGER update_evaluaciones_timestamp
  BEFORE UPDATE ON evaluaciones_auditores
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- =====================================================
-- 7. FUNCIÓN: Calcular nota final consolidada
-- =====================================================
CREATE OR REPLACE FUNCTION calcular_nota_final(evaluacion_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  eval RECORD;
  v_nota_final NUMERIC;
  suma_ponderaciones NUMERIC;
  cant_notas INTEGER := 0;
BEGIN
  -- Obtener registro de evaluación
  SELECT * INTO eval FROM evaluaciones_auditores WHERE id = evaluacion_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluación no encontrada: %', evaluacion_id;
  END IF;
  
  v_nota_final := 0;
  suma_ponderaciones := 0;
  
  -- Sumar notas ponderadas solo si existen
  IF eval.nota_archivos IS NOT NULL THEN
    v_nota_final := v_nota_final + (eval.nota_archivos * eval.ponderacion_archivos);
    suma_ponderaciones := suma_ponderaciones + eval.ponderacion_archivos;
    cant_notas := cant_notas + 1;
  END IF;
  
  IF eval.nota_encuesta IS NOT NULL THEN
    v_nota_final := v_nota_final + (eval.nota_encuesta * eval.ponderacion_encuesta);
    suma_ponderaciones := suma_ponderaciones + eval.ponderacion_encuesta;
    cant_notas := cant_notas + 1;
  END IF;
  
  IF eval.nota_rubrica IS NOT NULL THEN
    v_nota_final := v_nota_final + (eval.nota_rubrica * eval.ponderacion_rubrica);
    suma_ponderaciones := suma_ponderaciones + eval.ponderacion_rubrica;
    cant_notas := cant_notas + 1;
  END IF;
  
  -- Si no hay notas, retornar NULL
  IF cant_notas = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Normalizar si las ponderaciones no suman 1.0
  IF suma_ponderaciones > 0 THEN
    v_nota_final := v_nota_final / suma_ponderaciones;
  END IF;
  
  -- Actualizar el registro
  UPDATE evaluaciones_auditores 
  SET nota_final = ROUND(v_nota_final, 2)
  WHERE id = evaluacion_id;
  
  RETURN ROUND(v_nota_final, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_nota_final IS 'Calcula y actualiza la nota final de una evaluación basada en notas disponibles';

-- =====================================================
-- 8. INSERTAR RÚBRICA POR DEFECTO
-- =====================================================
INSERT INTO rubricas_evaluacion (nombre, descripcion, criterios, activa) VALUES
('Rúbrica Evaluación Auditores 2024', 
 'Rúbrica estándar para evaluación de desempeño de auditores internos',
 '[
   {
     "id": "c1",
     "nombre": "Cumplimiento de cronograma",
     "descripcion": "Entrega puntual de documentos y cumplimiento de fechas establecidas en el plan de auditoría",
     "peso": 0.20,
     "escala": 5.0
   },
   {
     "id": "c2",
     "nombre": "Calidad de hallazgos",
     "descripcion": "Pertinencia, claridad, fundamentación técnica y evidencia de los hallazgos reportados",
     "peso": 0.30,
     "escala": 5.0
   },
   {
     "id": "c3",
     "nombre": "Comunicación y profesionalismo",
     "descripcion": "Habilidades de comunicación, trato respetuoso y actitud profesional durante la auditoría",
     "peso": 0.20,
     "escala": 5.0
   },
   {
     "id": "c4",
     "nombre": "Documentación técnica",
     "descripcion": "Calidad, completitud y claridad de la documentación generada (informes, listas de chequeo, evidencias)",
     "peso": 0.20,
     "escala": 5.0
   },
   {
     "id": "c5",
     "nombre": "Conocimiento de la norma",
     "descripcion": "Dominio de la normatividad aplicable y capacidad de interpretación",
     "peso": 0.10,
     "escala": 5.0
   }
 ]'::jsonb,
 true
) ON CONFLICT (nombre) DO NOTHING;

-- =====================================================
-- 9. POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE encuestas_auditores ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubricas_evaluacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluaciones_auditores ENABLE ROW LEVEL SECURITY;

-- ========== Políticas para encuestas_auditores ==========

-- Admin: acceso total
DROP POLICY IF EXISTS admin_encuestas_all ON encuestas_auditores;
CREATE POLICY admin_encuestas_all ON encuestas_auditores
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE auth_user_id = auth.uid() AND rol = 'admin'
    )
  );

-- Auditores: solo pueden VER sus propias encuestas
DROP POLICY IF EXISTS auditores_ver_propias_encuestas ON encuestas_auditores;
CREATE POLICY auditores_ver_propias_encuestas ON encuestas_auditores
  FOR SELECT
  USING (
    auditor_id = auth.uid()
  );

-- ========== Políticas para rubricas_evaluacion ==========

-- Admin: acceso total
DROP POLICY IF EXISTS admin_rubricas_all ON rubricas_evaluacion;
CREATE POLICY admin_rubricas_all ON rubricas_evaluacion
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE auth_user_id = auth.uid() AND rol = 'admin'
    )
  );

-- Todos pueden ver rúbricas activas (lectura)
DROP POLICY IF EXISTS todos_ver_rubricas_activas ON rubricas_evaluacion;
CREATE POLICY todos_ver_rubricas_activas ON rubricas_evaluacion
  FOR SELECT
  USING (activa = true);

-- ========== Políticas para evaluaciones_auditores ==========

-- Admin: acceso total
DROP POLICY IF EXISTS admin_evaluaciones_all ON evaluaciones_auditores;
CREATE POLICY admin_evaluaciones_all ON evaluaciones_auditores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE auth_user_id = auth.uid() AND rol = 'admin'
    )
  );

-- Auditores: solo pueden VER sus propias evaluaciones
DROP POLICY IF EXISTS auditores_ver_propias_eval ON evaluaciones_auditores;
CREATE POLICY auditores_ver_propias_eval ON evaluaciones_auditores
  FOR SELECT
  USING (
    auditor_id = auth.uid()
  );

-- Visualizadores: pueden ver todas las evaluaciones (solo lectura)
DROP POLICY IF EXISTS visualizadores_ver_evaluaciones ON evaluaciones_auditores;
CREATE POLICY visualizadores_ver_evaluaciones ON evaluaciones_auditores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE auth_user_id = auth.uid() AND rol = 'visualizador'
    )
  );

-- =====================================================
-- 10. VISTA: Resumen de evaluaciones
-- =====================================================

-- Asegurar que existen las columnas necesarias (si las tablas ya existían)
ALTER TABLE encuestas_auditores 
ADD COLUMN IF NOT EXISTS dependencia_id BIGINT;

ALTER TABLE evaluaciones_auditores 
ADD COLUMN IF NOT EXISTS informe_auditoria_id BIGINT;

ALTER TABLE evaluaciones_auditores 
ADD COLUMN IF NOT EXISTS dependencia_auditada TEXT;

ALTER TABLE evaluaciones_auditores 
ADD COLUMN IF NOT EXISTS dependencia_id BIGINT;

ALTER TABLE evaluaciones_auditores 
ADD COLUMN IF NOT EXISTS archivos_esperados INTEGER DEFAULT 0;

ALTER TABLE evaluaciones_auditores 
ADD COLUMN IF NOT EXISTS archivos_cargados INTEGER DEFAULT 0;

-- Eliminar vista si existe (para recrearla con nueva estructura)
DROP VIEW IF EXISTS vista_resumen_evaluaciones;

CREATE OR REPLACE VIEW vista_resumen_evaluaciones AS
SELECT 
  e.id,
  e.auditor_id,
  e.informe_auditoria_id,
  e.periodo,
  e.anio,
  u.nombre as auditor_nombre,
  u.apellido as auditor_apellido,
  u.email as auditor_correo,
  u.rol as auditor_rol,
  -- Usar la dependencia directamente de la tabla evaluaciones_auditores
  e.dependencia_auditada as auditor_dependencia_nombre,
  -- Información del informe de auditoría vinculado
  ia.fecha_auditoria,
  e.nota_archivos,
  e.archivos_esperados,
  e.archivos_cargados,
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
LEFT JOIN informes_auditoria ia ON e.informe_auditoria_id = ia.id
ORDER BY u.apellido ASC, u.nombre ASC, e.anio DESC, e.periodo DESC, e.dependencia_auditada;

COMMENT ON VIEW vista_resumen_evaluaciones IS 'Vista consolidada de evaluaciones con información del auditor y calificación cualitativa';

-- =====================================================
-- 11. AGREGAR FOREIGN KEYS (después de crear tablas)
-- =====================================================

-- Foreign keys para encuestas_auditores
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
    -- Agregar FK auditor solo si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_encuestas_auditor' 
      AND table_name = 'encuestas_auditores'
    ) THEN
      ALTER TABLE encuestas_auditores 
        ADD CONSTRAINT fk_encuestas_auditor 
        FOREIGN KEY (auditor_id) REFERENCES usuarios(auth_user_id) ON DELETE SET NULL;
    END IF;
    
    -- Agregar FK importador solo si no existe
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_encuestas_importador' 
      AND table_name = 'encuestas_auditores'
    ) THEN
      ALTER TABLE encuestas_auditores 
        ADD CONSTRAINT fk_encuestas_importador 
        FOREIGN KEY (importado_por) REFERENCES usuarios(auth_user_id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Foreign keys para rubricas_evaluacion
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_rubricas_creator' 
      AND table_name = 'rubricas_evaluacion'
    ) THEN
      ALTER TABLE rubricas_evaluacion 
        ADD CONSTRAINT fk_rubricas_creator 
        FOREIGN KEY (created_by) REFERENCES usuarios(auth_user_id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Foreign keys para evaluaciones_auditores
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_eval_auditor' 
      AND table_name = 'evaluaciones_auditores'
    ) THEN
      ALTER TABLE evaluaciones_auditores 
        ADD CONSTRAINT fk_eval_auditor 
        FOREIGN KEY (auditor_id) REFERENCES usuarios(auth_user_id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_eval_evaluador' 
      AND table_name = 'evaluaciones_auditores'
    ) THEN
      ALTER TABLE evaluaciones_auditores 
        ADD CONSTRAINT fk_eval_evaluador 
        FOREIGN KEY (evaluado_por) REFERENCES usuarios(auth_user_id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planes_auditoria') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_eval_auditoria' 
      AND table_name = 'evaluaciones_auditores'
    ) THEN
      ALTER TABLE evaluaciones_auditores 
        ADD CONSTRAINT fk_eval_auditoria 
        FOREIGN KEY (auditoria_id) REFERENCES planes_auditoria(id) ON DELETE SET NULL;
    END IF;
  END IF;
  
  -- FK a rubrica (tabla creada en este script)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_eval_rubrica' 
    AND table_name = 'evaluaciones_auditores'
  ) THEN
    ALTER TABLE evaluaciones_auditores 
      ADD CONSTRAINT fk_eval_rubrica 
      FOREIGN KEY (rubrica_id) REFERENCES rubricas_evaluacion(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================

-- Verificación de tablas creadas
SELECT 
  'Tablas creadas exitosamente:' as mensaje,
  COUNT(*) as total_tablas
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('encuestas_auditores', 'rubricas_evaluacion', 'evaluaciones_auditores');
