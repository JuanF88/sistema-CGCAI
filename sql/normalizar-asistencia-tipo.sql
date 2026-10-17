-- ============================================================================
-- Una sola forma de escribir el tipo de asistencia
-- ============================================================================
-- El selector del informe ofrece «Digital» y «Físico», pero en la base quedó
-- un informe guardado como «FÍSICO», en mayúsculas, de cuando el formulario
-- convertía los textos al salir del campo. Al no coincidir con ninguna opción,
-- el desplegable no podía pintar su etiqueta y enseñaba «Selecciona el tipo»,
-- como si nadie hubiera elegido nada. El dato estaba bien; fallaba la pantalla.
--
-- La aplicación ya lo tolera —`src/features/auditorias/lib/asistencia.js` casa
-- el valor guardado con su opción ignorando tildes y mayúsculas—, así que esto
-- NO es obligatorio para que se vea bien. Se ejecuta para que la columna tenga
-- una sola forma de escribirse y cualquier consulta directa, exportación o
-- informe futuro no tenga que repetir la normalización.
--
-- Es idempotente: pasarlo dos veces no cambia nada la segunda.
--
-- Deliberadamente NO se añade un CHECK. La columna admite texto libre y hay 5
-- informes con NULL, que es un estado legítimo —el auditor todavía no lo ha
-- indicado—; un CHECK con lista cerrada obligaría a decidir qué hacer con
-- ellos y a tocarlo cada vez que se añada un tipo de asistencia.
-- ============================================================================

BEGIN;

-- Cualquier variante de mayúsculas o tildes queda en su forma canónica.
UPDATE informes_auditoria
   SET asistencia_tipo = 'Físico'
 WHERE asistencia_tipo IS NOT NULL
   AND asistencia_tipo <> 'Físico'
   AND upper(translate(btrim(asistencia_tipo), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) = 'FISICO';

UPDATE informes_auditoria
   SET asistencia_tipo = 'Digital'
 WHERE asistencia_tipo IS NOT NULL
   AND asistencia_tipo <> 'Digital'
   AND upper(btrim(asistencia_tipo)) = 'DIGITAL';

-- Una cadena vacía no es un tipo: es «sin indicar», igual que NULL.
UPDATE informes_auditoria
   SET asistencia_tipo = NULL
 WHERE asistencia_tipo IS NOT NULL
   AND btrim(asistencia_tipo) = '';

COMMIT;

-- Comprobación: solo deben quedar 'Digital', 'Físico' y NULL.
SELECT COALESCE(asistencia_tipo, '(sin indicar)') AS tipo,
       count(*) AS informes
  FROM informes_auditoria
 GROUP BY 1
 ORDER BY 2 DESC;
