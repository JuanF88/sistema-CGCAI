-- ============================================================================
-- VERIFICAR la conversión de la rúbrica 2026 (solo lee, no cambia nada)
-- ============================================================================
--
-- Usa las funciones que crea el paso 0 de `sql/convertir-rubrica-2026.sql`.
--
-- El editor de Supabase solo muestra el resultado de la última consulta, así
-- que son dos consultas para ejecutar por separado (selecciona y Run):
--   A) Resumen: una fila por revisión, con lo esperado y lo obtenido.
--   B) Detalle de cada evaluación convertida, antes y ahora.
-- ============================================================================


-- ── A) RESUMEN ──────────────────────────────────────────────────────────────

WITH ev26 AS (
  SELECT ev.*
    FROM evaluaciones_auditores ev
   WHERE CASE WHEN ev.periodo ~ '^[0-9]{4}' THEN left(ev.periodo, 4)::int END >= 2026
),
valores AS (
  SELECT ev26.id, e.key, rubrica_2026_valor(e.value) AS v
    FROM ev26
    CROSS JOIN LATERAL jsonb_each(COALESCE(ev26.rubrica_respuestas, '{}'::jsonb)) AS e
   WHERE e.key IN ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
),
cambios AS (
  SELECT c.evaluacion_id, e.key,
         rubrica_2026_valor(e.value)                       AS antes,
         rubrica_2026_valor(ev.rubrica_respuestas -> e.key) AS ahora
    FROM rubrica_conversion_2026 c
    JOIN evaluaciones_auditores ev ON ev.id = c.evaluacion_id
    CROSS JOIN LATERAL jsonb_each(COALESCE(c.respuestas_antes, '{}'::jsonb)) AS e
   WHERE e.key IN ('c1', 'c2', 'c3', 'c4', 'c5', 'c6')
),
-- La nota final que debería tener, con la misma regla que
-- `calcular_nota_final`: pesos del periodo y reparto de las fuentes ausentes.
final_esperada AS (
  SELECT ev26.id, ev26.nota_final,
         ROUND(
           ( COALESCE(ev26.nota_archivos * w.pa, 0)
           + COALESCE(ev26.nota_encuesta * w.pe, 0)
           + COALESCE(ev26.nota_rubrica  * w.pr, 0) )
           / NULLIF(
               (CASE WHEN ev26.nota_archivos IS NOT NULL THEN w.pa ELSE 0 END)
             + (CASE WHEN ev26.nota_encuesta IS NOT NULL THEN w.pe ELSE 0 END)
             + (CASE WHEN ev26.nota_rubrica  IS NOT NULL THEN w.pr ELSE 0 END), 0),
           2) AS esperada
    FROM ev26
    LEFT JOIN evaluaciones_pesos p ON p.periodo = ev26.periodo
    CROSS JOIN LATERAL (
      SELECT COALESCE(p.peso_archivos / 100.0, ev26.ponderacion_archivos, 0.33) AS pa,
             COALESCE(p.peso_encuesta / 100.0, ev26.ponderacion_encuesta, 0.33) AS pe,
             COALESCE(p.peso_rubrica  / 100.0, ev26.ponderacion_rubrica,  0.34) AS pr
    ) AS w
)
SELECT 1 AS n, 'Evaluaciones convertidas (en el respaldo)' AS revision,
       '11' AS esperado, count(*)::text AS resultado
  FROM rubrica_conversion_2026
UNION ALL
SELECT 2, 'Convertidas que no coinciden con la tabla de conversión', '0', count(*)::text
  FROM rubrica_conversion_2026 c
  JOIN evaluaciones_auditores ev ON ev.id = c.evaluacion_id
 WHERE rubrica_2026_convertir(c.respuestas_antes) <> ev.rubrica_respuestas
UNION ALL
SELECT 3, 'Criterios que quedaron por debajo de su valor anterior', '0', count(*)::text
  FROM cambios
 WHERE ahora < antes OR (antes IS NOT NULL AND ahora IS NULL)
UNION ALL
SELECT 4, 'Criterios que subieron (informativo)', '—', count(*)::text
  FROM cambios
 WHERE ahora > antes
UNION ALL
SELECT 5, 'Rúbricas 2026 que aún tienen 3.3 o 3.8 (escala anterior)', '0', count(DISTINCT id)::text
  FROM valores
 WHERE v IN (3.3, 3.8)
UNION ALL
SELECT 6, 'Rúbricas 2026 con valores fuera de la escala 1-5', '0', count(DISTINCT id)::text
  FROM valores
 WHERE v IS NOT NULL AND v NOT IN (1, 2, 3, 3.5, 4, 4.5, 5)
UNION ALL
SELECT 7, 'Rúbricas 2026 cuya nota no es el promedio de sus criterios', '0', count(*)::text
  FROM ev26
 WHERE (ev26.nota_rubrica IS NULL) <> (rubrica_2026_nota(ev26.rubrica_respuestas) IS NULL)
    OR abs(ev26.nota_rubrica - rubrica_2026_nota(ev26.rubrica_respuestas)) > 0.01
UNION ALL
SELECT 8, 'Notas finales 2026 sin recalcular', '0', count(*)::text
  FROM final_esperada
 WHERE (nota_final IS NULL) <> (esperada IS NULL)
    OR abs(nota_final - esperada) > 0.01
ORDER BY n;


-- ── B) DETALLE de las convertidas ───────────────────────────────────────────

SELECT u.nombre || ' ' || u.apellido  AS auditor,
       ev.dependencia_auditada,
       c.respuestas_antes,
       ev.rubrica_respuestas          AS respuestas_ahora,
       c.nota_rubrica_antes,
       ev.nota_rubrica                AS nota_rubrica_ahora,
       c.nota_final_antes,
       ev.nota_final                  AS nota_final_ahora
  FROM rubrica_conversion_2026 c
  JOIN evaluaciones_auditores ev ON ev.id = c.evaluacion_id
  LEFT JOIN usuarios u ON u.auth_user_id = ev.auditor_id
 ORDER BY auditor, ev.dependencia_auditada;
