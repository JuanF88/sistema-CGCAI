-- ============================================================================
-- ¿Hay algo en la base que impida guardar «Físico»?
-- ============================================================================
-- Todo lo que sigue es de LECTURA. No cambia ni una fila.
--
-- Contexto, para que el resultado se pueda interpretar:
--
-- El selector del informe devolvía a «Selecciona el tipo» después de elegir
-- «Físico», y el guardado siguiente dejaba la columna en NULL. La causa
-- estaba en el navegador, no aquí: al reabrir el informe, el selector de
-- Radix recibía «Físico» antes de tener registradas sus opciones, se vaciaba
-- solo y avisaba con un valor vacío que el formulario tomaba por una elección
-- del auditor; el guardado automático escribía ese NULL. Ver
-- `src/components/ui/select.jsx`.
--
-- Dos hechos que ya apuntaban a que la base NO lo rechaza:
--
--   · El registro de actividad del 19 de octubre de 2026 tiene nueve cambios
--     `NULL -> 'Físico'` que se escribieron correctamente (y otros tantos de
--     vuelta a NULL, que son los que escribía el formulario al reabrirse).
--   · Hoy mismo hay 23 informes guardados con 'Físico'.
--
-- Un CHECK, un dominio o un trigger que rechazara el valor haría imposibles
-- las dos cosas. Aun así, conviene verlo con los ojos: lo que esto descarta
-- es que quede alguna regla a medio aplicar de las migraciones anteriores.
--
-- Los bloques 1 a 7 se pueden correr de una vez. El 8 va aparte.
-- ============================================================================


-- ── 1 · La columna ──────────────────────────────────────────────────────────
-- Se espera: data_type = text, is_nullable = YES, sin default.
-- Si saliera un `USER-DEFINED` el tipo sería un enum o un dominio, y entonces
-- importan los bloques 2 y 3.

SELECT column_name,
       data_type,
       udt_name,
       character_maximum_length,
       is_nullable,
       column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'informes_auditoria'
   AND column_name = 'asistencia_tipo';


-- ── 2 · Restricciones de la tabla, con su texto ─────────────────────────────
-- CHECK, NOT NULL, claves y exclusiones. Lo que hay que buscar es cualquier
-- CHECK cuyo texto mencione `asistencia_tipo`.

SELECT con.conname                        AS restriccion,
       CASE con.contype
         WHEN 'c' THEN 'CHECK'
         WHEN 'f' THEN 'clave foránea'
         WHEN 'p' THEN 'clave primaria'
         WHEN 'u' THEN 'único'
         WHEN 'x' THEN 'exclusión'
         ELSE con.contype::text
       END                                AS tipo,
       pg_get_constraintdef(con.oid)      AS definicion
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
 WHERE nsp.nspname = 'public'
   AND rel.relname = 'informes_auditoria'
 ORDER BY con.contype, con.conname;


-- ── 3 · ¿Es la columna un enum o un dominio con reglas? ─────────────────────
-- Si el bloque 1 dijo `text`, esto no devuelve nada y es la respuesta correcta.

SELECT t.typname                                   AS tipo,
       t.typtype                                   AS clase,   -- b=base, e=enum, d=dominio
       pg_catalog.format_type(t.oid, NULL)         AS nombre_completo,
       (SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
          FROM pg_enum e WHERE e.enumtypid = t.oid) AS valores_del_enum,
       (SELECT string_agg(pg_get_constraintdef(c.oid), ' ; ')
          FROM pg_constraint c WHERE c.contypid = t.oid)       AS reglas_del_dominio
  FROM pg_attribute a
  JOIN pg_class rel ON rel.oid = a.attrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
 WHERE nsp.nspname = 'public'
   AND rel.relname = 'informes_auditoria'
   AND a.attname = 'asistencia_tipo'
   AND t.typtype <> 'b';


-- ── 4 · Triggers de la tabla ────────────────────────────────────────────────
-- Un trigger BEFORE UPDATE podría reescribir el valor sin que nadie se entere.
-- Se espera solo el del registro de actividad (`sql/registro-actividad.sql`).

SELECT tg.tgname                                   AS trigger,
       CASE WHEN tg.tgenabled = 'D' THEN 'DESACTIVADO' ELSE 'activo' END AS estado,
       pg_get_triggerdef(tg.oid)                   AS definicion
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
 WHERE nsp.nspname = 'public'
   AND rel.relname = 'informes_auditoria'
   AND NOT tg.tgisinternal
 ORDER BY tg.tgname;


-- ── 5 · El cuerpo de las funciones de esos triggers ─────────────────────────
-- Para leer si alguna toca `asistencia_tipo`. Son pocas y cortas.

SELECT p.proname                                   AS funcion,
       pg_get_functiondef(p.oid)                   AS cuerpo
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_proc p ON p.oid = tg.tgfoid
 WHERE nsp.nspname = 'public'
   AND rel.relname = 'informes_auditoria'
   AND NOT tg.tgisinternal
 ORDER BY p.proname;


-- ── 6 · Seguridad a nivel de fila ───────────────────────────────────────────
-- Una política de UPDATE con WITH CHECK puede rechazar una fila sin decir por
-- qué. Ojo: la aplicación escribe este informe con la llave de servicio, que
-- se salta RLS; esto importa para quien escriba con la llave pública.

SELECT rel.relname                                 AS tabla,
       rel.relrowsecurity                          AS rls_activada,
       rel.relforcerowsecurity                     AS rls_forzada
  FROM pg_class rel
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
 WHERE nsp.nspname = 'public'
   AND rel.relname = 'informes_auditoria';

SELECT policyname                                  AS politica,
       cmd                                         AS para,
       roles,
       qual                                        AS usando,
       with_check                                  AS con_comprobacion
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename = 'informes_auditoria'
 ORDER BY cmd, policyname;

-- Permisos por columna: si a un rol le falta UPDATE sobre `asistencia_tipo`,
-- su escritura falla aunque la tenga sobre el resto de la tabla.
SELECT grantee                                     AS rol,
       privilege_type                              AS permiso
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'informes_auditoria'
   AND column_name = 'asistencia_tipo'
 ORDER BY grantee, privilege_type;


-- ── 7 · Qué hay guardado ahora mismo ────────────────────────────────────────
-- Y cómo está escrito: los puntos de código delatan una tilde compuesta
-- (i + acento, dos caracteres) frente a la normal (í, uno solo), que es otra
-- forma de que el selector no encuentre su opción.

SELECT COALESCE(asistencia_tipo, '(sin indicar)')  AS tipo,
       count(*)                                    AS informes,
       length(asistencia_tipo)                     AS caracteres,
       octet_length(asistencia_tipo)               AS bytes,
       to_hex(ascii(substr(asistencia_tipo, 2, 1))) AS segundo_caracter_hex
  FROM informes_auditoria
 GROUP BY 1, 3, 4, 5
 ORDER BY 2 DESC;

-- «Físico» correcto: 6 caracteres, 7 bytes, segundo carácter ed (í).
-- Si sale 7 caracteres y 8 bytes, la tilde está compuesta: avísame y lo
-- normalizo.

-- Los que están sin indicar, para saber a quién le falta.
SELECT i.id,
       i.fecha_auditoria,
       d.nombre                                    AS dependencia,
       (i.objetivo IS NOT NULL)                    AS tiene_objetivo
  FROM informes_auditoria i
  LEFT JOIN dependencias d ON d.dependencia_id = i.dependencia_id
 WHERE i.asistencia_tipo IS NULL
 ORDER BY i.id;


-- ============================================================================
-- ── 8 · La prueba de fuego ──────────────────────────────────────────────────
-- ============================================================================
-- Esto escribe «Físico» de verdad y DESHACE el cambio. Córrelo solo, en una
-- ejecución aparte, y comprueba que termina en ROLLBACK.
--
--   · Si devuelve la fila con 'Físico', la base acepta el valor y el problema
--     nunca estuvo aquí.
--   · Si falla, el mensaje de error dice exactamente qué regla lo impide.
--
-- Se usa el informe de id más bajo que esté sin indicar; si no hay ninguno,
-- no toca nada.

BEGIN;

UPDATE informes_auditoria
   SET asistencia_tipo = 'Físico'
 WHERE id = (SELECT min(id) FROM informes_auditoria WHERE asistencia_tipo IS NULL)
RETURNING id, asistencia_tipo;

ROLLBACK;

-- Y la comprobación de que no quedó nada: debe seguir en NULL.
SELECT id, asistencia_tipo
  FROM informes_auditoria
 WHERE id = (SELECT min(id) FROM informes_auditoria WHERE asistencia_tipo IS NULL);


-- ============================================================================
-- Si quieres devolverle el tipo a los informes que lo perdieron, es un UPDATE
-- a mano, y deliberadamente va comentado: solo tú sabes cuáles fueron
-- presenciales. El registro de actividad no puede decirlo porque guarda los
-- cambios sin el `registro_id` del informe —está pendiente reejecutar
-- `sql/registro-actividad.sql`, que arregla justo eso—.
--
-- UPDATE informes_auditoria SET asistencia_tipo = 'Físico' WHERE id IN (355, 356);
-- ============================================================================
