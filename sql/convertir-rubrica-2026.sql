-- ============================================================================
-- RÚBRICA DE AUDITORES: pasar las calificaciones de 2026 a la escala 1-5
-- ============================================================================
--
-- Desde 2026 la rúbrica se califica de 1 a 5. Las evaluaciones de 2026 que se
-- calificaron antes del cambio tienen los valores de la escala anterior:
--
--     1 → 1    2 → 2    3 → 3    3.3 → 3.5    3.5 → 4    3.8 → 4.5    4 → 5
--
-- Por cada evaluación de 2026 en adelante: convierte las respuestas (c1 a
-- c6), recalcula la nota de rúbrica (promedio de los criterios calificados,
-- igual que la aplicación) y luego la nota final.
--
-- ⚠️ Es seguro ejecutarlo dos veces. Cada evaluación convertida se guarda
-- antes en `rubrica_conversion_2026`, y la que ya está ahí no se vuelve a
-- tocar. Sin ese control, una segunda pasada subiría otra vez los 3.5 a 4 y
-- los 4 a 5. El respaldo sirve también para deshacer (paso 4).
--
-- Una evaluación que ya tenga algún 4.5 o 5 se calificó con la escala nueva
-- y NO se convierte. Tampoco la que tenga un valor que no es de ninguna de
-- las dos escalas.
--
-- Ejecútalo cuando nadie esté calificando la rúbrica, y recarga la página de
-- Evaluación de Auditores después: una pestaña abierta con los valores viejos
-- los volvería a guardar al tocar una celda.
--
-- Pasos: 0 prepara (no cambia datos), 1 muestra, 2 convierte, 3 recalcula la
-- nota final.
-- ============================================================================


-- ── 0) PREPARAR: respaldo y funciones auxiliares (no cambia datos) ──────────

CREATE TABLE IF NOT EXISTS rubrica_conversion_2026 (
  evaluacion_id      uuid PRIMARY KEY,
  respuestas_antes   jsonb,
  nota_rubrica_antes numeric,
  nota_final_antes   numeric,
  convertida_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rubrica_conversion_2026 IS
  'Respaldo de las rúbricas 2026 convertidas de la escala 1-4 a la 1-5 (sql/convertir-rubrica-2026.sql).';

-- Valor numérico de una respuesta, venga como "3.5" o como 3.5. NULL si no es
-- un número (por ejemplo, vacía).
CREATE OR REPLACE FUNCTION rubrica_2026_valor(v jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(v) IN ('string', 'number')
     AND btrim(v #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$'
    THEN btrim(v #>> '{}')::numeric
  END
$$;

-- Equivalencia de un valor de la escala anterior en la nueva.
CREATE OR REPLACE FUNCTION rubrica_2026_nueva(n numeric) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim_scale(CASE n
    WHEN 4   THEN 5
    WHEN 3.8 THEN 4.5
    WHEN 3.5 THEN 4
    WHEN 3.3 THEN 3.5
    ELSE n               -- 1, 2 y 3 no cambian
  END)
$$;

-- Qué hacer con una evaluación según sus respuestas.
CREATE OR REPLACE FUNCTION rubrica_2026_estado(r jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN count(v) = 0                              THEN 'sin calificar'
    WHEN bool_or(v IN (4.5, 5))                    THEN 'ya en escala nueva: no se toca'
    WHEN bool_or(v NOT IN (1, 2, 3, 3.3, 3.5, 3.8, 4)) THEN 'valor desconocido: no se toca'
    ELSE 'se convierte'
  END
  FROM (
    SELECT rubrica_2026_valor(e.value) AS v
      FROM jsonb_each(COALESCE(r, '{}'::jsonb)) AS e
     WHERE e.key IN ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
  ) AS valores
$$;

-- Respuestas convertidas. Conserva el tipo (texto o número) y no toca nada
-- que no sea c1-c6. El texto queda como lo escribe la aplicación: "5", "4.5".
CREATE OR REPLACE FUNCTION rubrica_2026_convertir(r jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(
           e.key,
           CASE
             WHEN e.key NOT IN ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
               OR rubrica_2026_valor(e.value) IS NULL
               THEN e.value
             WHEN jsonb_typeof(e.value) = 'number'
               THEN to_jsonb(rubrica_2026_nueva(rubrica_2026_valor(e.value)))
             ELSE to_jsonb(rubrica_2026_nueva(rubrica_2026_valor(e.value))::text)
           END
         ), '{}'::jsonb)
    FROM jsonb_each(COALESCE(r, '{}'::jsonb)) AS e
$$;

-- Nota de rúbrica en la escala nueva: promedio de los criterios calificados.
-- NULL si no hay ninguno (lo mismo que guarda la aplicación).
CREATE OR REPLACE FUNCTION rubrica_2026_nota(r jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT ROUND(AVG(rubrica_2026_valor(e.value)), 2)
    FROM jsonb_each(COALESCE(r, '{}'::jsonb)) AS e
   WHERE e.key IN ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
     AND rubrica_2026_valor(e.value) > 0
$$;


-- ── 1) VER qué se haría (no cambia nada) ────────────────────────────────────
-- Revisa sobre todo la columna `estado`: lo que no diga «se convierte» se
-- deja como está.

SELECT ev.periodo,
       u.nombre || ' ' || u.apellido                 AS auditor,
       ev.dependencia_auditada,
       rubrica_2026_estado(ev.rubrica_respuestas)    AS estado,
       ev.rubrica_respuestas                         AS respuestas_antes,
       rubrica_2026_convertir(ev.rubrica_respuestas) AS respuestas_despues,
       ev.nota_rubrica                               AS nota_rubrica_antes,
       rubrica_2026_nota(rubrica_2026_convertir(ev.rubrica_respuestas)) AS nota_rubrica_despues
  FROM evaluaciones_auditores ev
  LEFT JOIN usuarios u ON u.auth_user_id = ev.auditor_id
 WHERE CASE WHEN ev.periodo ~ '^[0-9]{4}' THEN left(ev.periodo, 4)::int END >= 2026
   AND rubrica_2026_estado(ev.rubrica_respuestas) <> 'sin calificar'
   AND NOT EXISTS (SELECT 1 FROM rubrica_conversion_2026 c WHERE c.evaluacion_id = ev.id)
 ORDER BY estado, auditor, ev.dependencia_auditada;


-- ── 2) CONVERTIR ────────────────────────────────────────────────────────────
-- Guarda el respaldo y convierte en la misma instrucción. Devuelve lo
-- convertido, con la nota de rúbrica nueva.

WITH candidatas AS (
  SELECT ev.id, ev.rubrica_respuestas, ev.nota_rubrica, ev.nota_final
    FROM evaluaciones_auditores ev
   WHERE CASE WHEN ev.periodo ~ '^[0-9]{4}' THEN left(ev.periodo, 4)::int END >= 2026
     AND rubrica_2026_estado(ev.rubrica_respuestas) = 'se convierte'
     AND NOT EXISTS (SELECT 1 FROM rubrica_conversion_2026 c WHERE c.evaluacion_id = ev.id)
), respaldo AS (
  INSERT INTO rubrica_conversion_2026
         (evaluacion_id, respuestas_antes, nota_rubrica_antes, nota_final_antes)
  SELECT id, rubrica_respuestas, nota_rubrica, nota_final
    FROM candidatas
  RETURNING evaluacion_id
)
UPDATE evaluaciones_auditores ev
   SET rubrica_respuestas = rubrica_2026_convertir(ev.rubrica_respuestas),
       nota_rubrica       = rubrica_2026_nota(rubrica_2026_convertir(ev.rubrica_respuestas)),
       updated_at         = now()
  FROM respaldo
 WHERE ev.id = respaldo.evaluacion_id
RETURNING ev.periodo, ev.dependencia_auditada, ev.rubrica_respuestas, ev.nota_rubrica;


-- ── 2b) CONVERTIR LAS MIXTAS ────────────────────────────────────────────────
-- Las que el paso 1 marca «ya en escala nueva» pueden ser mixtas: algún 5 ya
-- puesto con la escala nueva junto a valores de la anterior (3.3, 3.8, 3.5).
-- Se convierten también: el 5 se queda en 5 y el resto pasa por la misma
-- tabla, que es lo que muestra la columna `respuestas_despues` del paso 1.
--
-- Se excluyen las que tengan un 4 o un 4.5: con la escala nueva ya en uso,
-- un 4 puede ser «Muy bueno» (nuevo) y no se puede saber si toca subirlo.

WITH candidatas AS (
  SELECT ev.id, ev.rubrica_respuestas, ev.nota_rubrica, ev.nota_final
    FROM evaluaciones_auditores ev
   WHERE CASE WHEN ev.periodo ~ '^[0-9]{4}' THEN left(ev.periodo, 4)::int END >= 2026
     AND rubrica_2026_estado(ev.rubrica_respuestas) = 'ya en escala nueva: no se toca'
     AND NOT EXISTS (
           SELECT 1 FROM jsonb_each(ev.rubrica_respuestas) AS e
            WHERE e.key IN ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
              AND rubrica_2026_valor(e.value) IN (4, 4.5)
         )
     AND NOT EXISTS (SELECT 1 FROM rubrica_conversion_2026 c WHERE c.evaluacion_id = ev.id)
), respaldo AS (
  INSERT INTO rubrica_conversion_2026
         (evaluacion_id, respuestas_antes, nota_rubrica_antes, nota_final_antes)
  SELECT id, rubrica_respuestas, nota_rubrica, nota_final
    FROM candidatas
  RETURNING evaluacion_id
)
UPDATE evaluaciones_auditores ev
   SET rubrica_respuestas = rubrica_2026_convertir(ev.rubrica_respuestas),
       nota_rubrica       = rubrica_2026_nota(rubrica_2026_convertir(ev.rubrica_respuestas)),
       updated_at         = now()
  FROM respaldo
 WHERE ev.id = respaldo.evaluacion_id
RETURNING ev.periodo, ev.dependencia_auditada, ev.rubrica_respuestas, ev.nota_rubrica;


-- ── 3) RECALCULAR la nota final de las convertidas ──────────────────────────
-- Va aparte porque dentro del paso 2 la función todavía vería la nota de
-- rúbrica anterior. Repetirlo no cambia nada.

SELECT ev.periodo,
       ev.dependencia_auditada,
       c.nota_rubrica_antes,
       ev.nota_rubrica                       AS nota_rubrica_nueva,
       c.nota_final_antes,
       calcular_nota_final(c.evaluacion_id)  AS nota_final_nueva
  FROM rubrica_conversion_2026 c
  JOIN evaluaciones_auditores ev ON ev.id = c.evaluacion_id
 ORDER BY ev.periodo, ev.dependencia_auditada;


-- ── 4) DESHACER (solo si hiciera falta; quita los guiones para ejecutarlo) ──
-- Devuelve las respuestas y la nota de rúbrica de antes, recalcula la nota
-- final y vacía el respaldo.
--
-- UPDATE evaluaciones_auditores ev
--    SET rubrica_respuestas = c.respuestas_antes,
--        nota_rubrica       = c.nota_rubrica_antes,
--        updated_at         = now()
--   FROM rubrica_conversion_2026 c
--  WHERE ev.id = c.evaluacion_id;
--
-- SELECT calcular_nota_final(evaluacion_id) FROM rubrica_conversion_2026;
--
-- DELETE FROM rubrica_conversion_2026;
