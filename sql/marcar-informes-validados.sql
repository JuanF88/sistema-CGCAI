-- ============================================================
-- TRES INFORMES CON SU PDF FIRMADO PERO SIN LA MARCA `validado`
--
-- Los informes 255, 266 y 267 tienen su PDF de validación en el bucket
-- `validaciones` desde el 28 de enero de 2026 —subidos en la misma carga
-- masiva, con siete segundos de diferencia entre ellos— pero se quedaron con
-- `validado = false` en la base.
--
-- De los 13 archivos de esa carga, 10 sí quedaron marcados. Es decir: no es un
-- fallo del sistema de hoy —los informes de 2026 se validan bien—, sino un
-- residuo de aquella subida.
--
-- Comprobado archivo por archivo antes de escribir esto:
--
--   #255  Auditoria_255_...pdf   subido 2026-01-28 16:12:07
--   #266  Auditoria_266_...pdf   subido 2026-01-28 16:12:13
--   #267  Auditoria_267_...pdf   subido 2026-01-28 16:12:14
--
-- La marca importa para los contadores, el filtro «Validado» y la malla de
-- Inicio. Para las alertas ya da igual: desde el arreglo de
-- `isProcessCompleted`, el PDF por sí solo basta para dar el paso por hecho.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente y no toca ninguna otra
-- fila.
-- ============================================================

UPDATE informes_auditoria
   SET validado = true
 WHERE id IN (255, 266, 267)
   AND validado IS DISTINCT FROM true;

-- Comprobaciones:
--   Los tres, que deben salir con `validado = true`:
--     SELECT id, fecha_auditoria, validado FROM informes_auditoria
--      WHERE id IN (255, 266, 267) ORDER BY id;
--
--   Y el recuento general de validados:
--     SELECT validado, count(*) FROM informes_auditoria GROUP BY validado;
