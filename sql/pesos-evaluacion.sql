-- ============================================================
-- PESOS DE LA NOTA FINAL, POR PERIODO
--
-- La nota final de un auditor sale de tres fuentes —archivos entregados,
-- encuesta de la dependencia auditada y rúbrica del evaluador— y hasta ahora
-- pesaban 33/33/34 fijo, sin forma de cambiarlo desde ninguna pantalla.
--
-- El peso se decide por **periodo** (`2026-S2`), que es como se organiza la
-- evaluación: un ciclo por semestre, alineado con el programa de auditoría.
-- Cambiar los pesos de un semestre no toca los anteriores, así que lo ya
-- calificado se queda como se calificó.
--
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente y no borra
-- ninguna nota.
-- ============================================================

CREATE TABLE IF NOT EXISTS evaluaciones_pesos (
  -- «2026-S2». Es la misma cadena que `evaluaciones_auditores.periodo`.
  periodo         text PRIMARY KEY
                  CHECK (periodo ~ '^[0-9]{4}-S[12]$'),

  -- En porcentaje entero y no en fracción: es lo que se escribe en la
  -- pantalla («40 %») y evita el polvo decimal de andar repartiendo 1,0 entre
  -- tres. Al aplicarlos se dividen entre 100.
  peso_archivos   integer NOT NULL DEFAULT 33 CHECK (peso_archivos BETWEEN 0 AND 100),
  peso_encuesta   integer NOT NULL DEFAULT 33 CHECK (peso_encuesta BETWEEN 0 AND 100),
  peso_rubrica    integer NOT NULL DEFAULT 34 CHECK (peso_rubrica  BETWEEN 0 AND 100),

  -- Que sumen 100 es lo que hace que la nota se lea como se espera. Si no se
  -- exigiera, unos pesos de 50/50/50 darían una nota «normalizada» que nadie
  -- sabría explicar en un comité.
  CONSTRAINT evaluaciones_pesos_suman_cien
    CHECK (peso_archivos + peso_encuesta + peso_rubrica = 100),

  actualizado_por uuid,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE evaluaciones_pesos IS
  'Peso de cada fuente en la nota final del auditor, por periodo de evaluación.';

-- ------------------------------------------------------------
-- RLS
--
-- Lee cualquiera del sistema —el auditor tiene derecho a saber con qué pesos
-- se le califica— y escribe solo administración.
-- ------------------------------------------------------------
ALTER TABLE evaluaciones_pesos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura de pesos de evaluación" ON evaluaciones_pesos;
CREATE POLICY "Lectura de pesos de evaluación"
ON evaluaciones_pesos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Admin gestiona pesos de evaluación" ON evaluaciones_pesos;
CREATE POLICY "Admin gestiona pesos de evaluación"
ON evaluaciones_pesos FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM usuarios u
           WHERE u.auth_user_id = auth.uid() AND lower(u.rol) = 'admin')
);

-- ============================================================
-- La nota final pasa a leer los pesos del periodo
--
-- Se sustituye `calcular_nota_final`, que es la que ya llaman los seis sitios
-- donde se recalcula (archivos, rúbrica, encuestas, alta y edición). Así no
-- hay que tocar el código de cada uno: cambian los pesos y la siguiente vez
-- que se recalcule, se aplican.
--
-- Dos comportamientos que se conservan a propósito:
--
--   1. Si falta una fuente —todavía no hay encuestas, por ejemplo—, su peso
--      no se pierde: se reparte entre las que sí hay. Con 40/30/30 y sin
--      encuesta, archivos y rúbrica pesan 40/70 y 30/70. Es lo que hacía
--      antes y es lo razonable: si no, un auditor sin encuestas tendría un
--      techo del 70 % de la nota por algo que no depende de él.
--
--   2. Los pesos aplicados se guardan en la propia evaluación
--      (`ponderacion_*`). Queda constancia de con qué se calificó, que en un
--      sistema de auditoría importa más que ahorrarse tres columnas.
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_nota_final(evaluacion_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  eval               RECORD;
  pesos              RECORD;
  p_archivos         NUMERIC;
  p_encuesta         NUMERIC;
  p_rubrica          NUMERIC;
  v_nota_final       NUMERIC;
  suma_ponderaciones NUMERIC;
  cant_notas         INTEGER := 0;
BEGIN
  SELECT * INTO eval FROM evaluaciones_auditores WHERE id = evaluacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluación no encontrada: %', evaluacion_id;
  END IF;

  -- Los pesos del periodo mandan. Si nadie los ha configurado, se usan los
  -- que ya tuviera la evaluación, que por defecto son 33/33/34.
  SELECT * INTO pesos FROM evaluaciones_pesos WHERE periodo = eval.periodo;

  IF FOUND THEN
    p_archivos := pesos.peso_archivos / 100.0;
    p_encuesta := pesos.peso_encuesta / 100.0;
    p_rubrica  := pesos.peso_rubrica  / 100.0;
  ELSE
    p_archivos := COALESCE(eval.ponderacion_archivos, 0.33);
    p_encuesta := COALESCE(eval.ponderacion_encuesta, 0.33);
    p_rubrica  := COALESCE(eval.ponderacion_rubrica,  0.34);
  END IF;

  v_nota_final       := 0;
  suma_ponderaciones := 0;

  IF eval.nota_archivos IS NOT NULL THEN
    v_nota_final       := v_nota_final + (eval.nota_archivos * p_archivos);
    suma_ponderaciones := suma_ponderaciones + p_archivos;
    cant_notas         := cant_notas + 1;
  END IF;

  IF eval.nota_encuesta IS NOT NULL THEN
    v_nota_final       := v_nota_final + (eval.nota_encuesta * p_encuesta);
    suma_ponderaciones := suma_ponderaciones + p_encuesta;
    cant_notas         := cant_notas + 1;
  END IF;

  IF eval.nota_rubrica IS NOT NULL THEN
    v_nota_final       := v_nota_final + (eval.nota_rubrica * p_rubrica);
    suma_ponderaciones := suma_ponderaciones + p_rubrica;
    cant_notas         := cant_notas + 1;
  END IF;

  -- Sin ninguna fuente no hay nota, pero los pesos aplicados se dejan escritos
  -- para que la pantalla pueda explicarlos.
  IF cant_notas = 0 THEN
    UPDATE evaluaciones_auditores
       SET nota_final           = NULL,
           ponderacion_archivos = p_archivos,
           ponderacion_encuesta = p_encuesta,
           ponderacion_rubrica  = p_rubrica
     WHERE id = evaluacion_id;
    RETURN NULL;
  END IF;

  -- Reparte el peso de las fuentes ausentes entre las presentes.
  IF suma_ponderaciones > 0 THEN
    v_nota_final := v_nota_final / suma_ponderaciones;
  END IF;

  UPDATE evaluaciones_auditores
     SET nota_final           = ROUND(v_nota_final, 2),
         ponderacion_archivos = p_archivos,
         ponderacion_encuesta = p_encuesta,
         ponderacion_rubrica  = p_rubrica
   WHERE id = evaluacion_id;

  RETURN ROUND(v_nota_final, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_nota_final IS
  'Nota final ponderada con los pesos del periodo (evaluaciones_pesos); reparte el peso de las fuentes que falten.';

-- Comprobaciones:
--   Pesos configurados:
--     SELECT * FROM evaluaciones_pesos ORDER BY periodo DESC;
--
--   Qué pesos se aplicaron y qué nota salió:
--     SELECT periodo, dependencia_auditada,
--            nota_archivos, nota_encuesta, nota_rubrica, nota_final,
--            ponderacion_archivos, ponderacion_encuesta, ponderacion_rubrica
--       FROM evaluaciones_auditores
--      ORDER BY periodo DESC, dependencia_auditada;
