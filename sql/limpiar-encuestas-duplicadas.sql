-- ============================================================================
-- ENCUESTAS DE AUDITORES: borrar las copias repetidas de 2026-S2
-- ============================================================================
--
-- 27 encuestas (del 31 de agosto al 5 de octubre) están dos veces:
--   · una cargada el 20 de octubre, con la hora con milisegundos
--     (08:40:28.352) y la dependencia con el nombre oficial en mayúsculas;
--   · otra cargada el 9 de noviembre, con la hora al segundo (08:40:28) y la
--     dependencia como la escribió el evaluado.
--
-- El importador reconocía una encuesta ya cargada por auditor + evaluador +
-- hora EXACTA. Por los milisegundos, el cargue del 9 de noviembre no reconoció
-- las del 20 de octubre y las insertó otra vez. El importador ya compara con
-- un segundo de margen y redondea la hora, así que no volverá a pasar.
--
-- Se borra la copia con milisegundos y se conserva la otra, que es la que
-- coincide con el Excel. Mismo auditor, mismo evaluador, menos de un segundo
-- de diferencia y la misma nota: es la misma respuesta del formulario.
--
-- ⚠️ Borra datos. Ejecuta primero el paso 1 y comprueba que salen 27 filas.
-- Cada borrado queda en el Registro de Actividad con todos sus valores.
-- ============================================================================

-- 1) VER lo que se va a borrar (no cambia nada). Deben salir 27 filas, cada
--    una junto a la copia que se queda.
SELECT copia.id               AS id_que_se_borra,
       copia.auditor_nombre,
       copia.evaluador_nombre,
       copia.fecha_respuesta  AS hora_copia,
       queda.fecha_respuesta  AS hora_que_queda,
       copia.dependencia_auditada AS dependencia_copia,
       queda.dependencia_auditada AS dependencia_que_queda,
       copia.nota_calculada   AS nota_copia,
       queda.nota_calculada   AS nota_que_queda
  FROM encuestas_auditores copia
  JOIN encuestas_auditores queda
    ON queda.id <> copia.id
   AND queda.auditor_nombre   = copia.auditor_nombre
   AND queda.evaluador_nombre = copia.evaluador_nombre
   AND abs(extract(epoch FROM queda.fecha_respuesta - copia.fecha_respuesta)) < 1
   AND queda.fecha_respuesta  = date_trunc('second', queda.fecha_respuesta)
 WHERE copia.periodo = '2026-S2'
   AND copia.fecha_respuesta <> date_trunc('second', copia.fecha_respuesta)
 ORDER BY copia.fecha_respuesta;

-- 2) BORRAR. Ejecútalo solo si el paso 1 dio 27 filas y las parejas tienen
--    la misma nota. Devuelve lo borrado.
DELETE FROM encuestas_auditores copia
 WHERE copia.periodo = '2026-S2'
   AND copia.fecha_respuesta <> date_trunc('second', copia.fecha_respuesta)
   AND EXISTS (
         SELECT 1 FROM encuestas_auditores queda
          WHERE queda.id <> copia.id
            AND queda.auditor_nombre   = copia.auditor_nombre
            AND queda.evaluador_nombre = copia.evaluador_nombre
            AND abs(extract(epoch FROM queda.fecha_respuesta - copia.fecha_respuesta)) < 1
            AND queda.fecha_respuesta  = date_trunc('second', queda.fecha_respuesta)
       )
RETURNING copia.id, copia.auditor_nombre, copia.evaluador_nombre, copia.fecha_respuesta;

-- 3) Comprobación: 2026-S2 debe quedar con 33 encuestas (34 cuando se vuelva
--    a subir el Excel con la fila de OCI).
SELECT count(*) AS encuestas_2026_s2 FROM encuestas_auditores WHERE periodo = '2026-S2';
