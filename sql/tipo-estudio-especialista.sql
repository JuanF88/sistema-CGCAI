-- ============================================================================
-- «Profesional especializado» pasa a llamarse «Especialista»
-- ============================================================================
-- El desplegable de usuarios ya ofrece «Especialista», pero la base sigue con
-- un CHECK que solo admite la lista antigua: al guardar responde
--
--   23514  new row for relation "usuarios" violates check constraint
--          "usuarios_tipo_estudio_check"
--
-- Así que hay que tocar las tres cosas y en este orden: quitar el CHECK,
-- renombrar lo que ya está guardado, y volver a ponerlo con la lista nueva.
-- Al revés no se puede: el UPDATE no pasaría su propio CHECK.
--
-- También se renombra la variante con la errata («profecional»), que estaba
-- admitida en el CHECK anterior.
--
-- No se añade «especialista» *junto a* la antigua a propósito: con las dos
-- vivas, los usuarios guardados con la antigua no coinciden con ninguna opción
-- del desplegable y su nivel se ve en blanco aunque esté registrado.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

-- 1. Fuera el CHECK, para poder renombrar.
ALTER TABLE public.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_estudio_check;

-- 2. Lo ya guardado. Al 2026-10-02 son 4 usuarios con «profesional
--    especializado» y ninguno con la errata, pero se cubren las dos.
UPDATE public.usuarios
SET tipo_estudio = 'especialista'
WHERE lower(btrim(tipo_estudio)) IN ('profesional especializado', 'profecional especializado');

-- 3. El CHECK con la lista nueva.
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_tipo_estudio_check
  CHECK (
    tipo_estudio IS NULL
    OR lower(btrim(tipo_estudio)) = ANY (
      ARRAY[
        'profesional',
        'magister',
        'magíster',
        'especialista',
        'doctor'
      ]
    )
  );

-- Comprobación: no debe quedar ninguna fila con la etiqueta antigua, y
-- «especialista» debe aparecer con las que se renombraron.
SELECT COALESCE(tipo_estudio, '(sin definir)') AS tipo_estudio, COUNT(*) AS usuarios
FROM public.usuarios
GROUP BY tipo_estudio
ORDER BY usuarios DESC;
