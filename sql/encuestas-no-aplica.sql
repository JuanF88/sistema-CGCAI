-- ============================================================================
-- ENCUESTAS DE AUDITORES: «No aplica» deja de contar en la nota (desde 2026)
-- ============================================================================
--
-- Hasta ahora la nota de una encuesta era la suma de las 10 preguntas entre
-- 10, siempre. Como «No aplica» se guarda como 0, cada «No aplica» restaba:
-- nueve «Excelente» y un «No aplica» daban 4.50 en vez de 5.00.
--
-- Desde 2026 la nota es el promedio de las preguntas calificadas (las que no
-- son «No aplica»). Hasta 2025 se deja como estaba, igual que la rúbrica: esas
-- notas ya se cerraron con la regla anterior.
--
-- Qué hace:
--   1. Crea la función del promedio sin «No aplica».
--   2. El disparador que calcula `nota_calculada` usa una u otra según `anio`.
--   3. Recalcula las encuestas de 2026 en adelante.
--
-- No recalcula la nota de encuesta de las evaluaciones (`nota_encuesta`): eso
-- lo hace el importador al volver a subir el Excel del periodo.
--
-- Se puede ejecutar más de una vez.
-- ============================================================================

CREATE OR REPLACE FUNCTION calcular_nota_encuesta_sin_no_aplica(
  p1 INTEGER, p2 INTEGER, p3 INTEGER, p4 INTEGER, p5 INTEGER,
  p6 INTEGER, p7 INTEGER, p8 INTEGER, p9 INTEGER, p10 INTEGER
) RETURNS NUMERIC AS $$
  -- NULL si todas son «No aplica»: no hay nada que promediar.
  SELECT ROUND(AVG(v)::NUMERIC, 2)
    FROM unnest(ARRAY[p1, p2, p3, p4, p5, p6, p7, p8, p9, p10]) AS v
   WHERE v > 0;
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION calcular_nota_encuesta_sin_no_aplica IS
  'Nota de encuesta desde 2026: promedio de las preguntas calificadas; «No aplica» (0) no cuenta.';

CREATE OR REPLACE FUNCTION trigger_calcular_nota_encuesta()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.anio, 0) >= 2026 THEN
    NEW.nota_calculada := calcular_nota_encuesta_sin_no_aplica(
      NEW.pregunta_1, NEW.pregunta_2, NEW.pregunta_3, NEW.pregunta_4, NEW.pregunta_5,
      NEW.pregunta_6, NEW.pregunta_7, NEW.pregunta_8, NEW.pregunta_9, NEW.pregunta_10
    );
  ELSE
    -- Regla anterior, hasta 2025: suma entre 10.
    NEW.nota_calculada := calcular_nota_encuesta(
      NEW.pregunta_1, NEW.pregunta_2, NEW.pregunta_3, NEW.pregunta_4, NEW.pregunta_5,
      NEW.pregunta_6, NEW.pregunta_7, NEW.pregunta_8, NEW.pregunta_9, NEW.pregunta_10
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El disparador ya existe y apunta a esta función; se recrea por si acaso.
DROP TRIGGER IF EXISTS before_insert_update_encuesta ON encuestas_auditores;
CREATE TRIGGER before_insert_update_encuesta
  BEFORE INSERT OR UPDATE ON encuestas_auditores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calcular_nota_encuesta();

COMMENT ON COLUMN encuestas_auditores.nota_calculada IS
  'Hasta 2025: suma de las 10 preguntas entre 10. Desde 2026: promedio de las calificadas, sin «No aplica».';

-- Recalcular las de 2026 en adelante: el UPDATE dispara el cálculo nuevo.
UPDATE encuestas_auditores
   SET nota_calculada = nota_calculada
 WHERE anio >= 2026;

-- Comprobación: las encuestas con algún «No aplica» deben haber subido.
SELECT auditor_nombre, evaluador_nombre, fecha_respuesta::date AS fecha,
       (pregunta_1 = 0)::int + (pregunta_2 = 0)::int + (pregunta_3 = 0)::int +
       (pregunta_4 = 0)::int + (pregunta_5 = 0)::int + (pregunta_6 = 0)::int +
       (pregunta_7 = 0)::int + (pregunta_8 = 0)::int + (pregunta_9 = 0)::int +
       (pregunta_10 = 0)::int AS no_aplica,
       nota_calculada
  FROM encuestas_auditores
 WHERE anio >= 2026
   AND 0 IN (pregunta_1, pregunta_2, pregunta_3, pregunta_4, pregunta_5,
             pregunta_6, pregunta_7, pregunta_8, pregunta_9, pregunta_10)
 ORDER BY fecha_respuesta;
