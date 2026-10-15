-- ============================================================================
-- Control manual de ejecución de la auditoría
-- ============================================================================
-- Todas las demás columnas de la malla de Inicio se deducen: existe el archivo
-- en Storage, o están los campos del informe. Si la auditoría **se hizo** no
-- se deduce de nada: puede haberse ejecutado sin que haya llegado todavía el
-- listado de asistencia, y puede haber documentos cargados de una auditoría
-- que se reprogramó. Es un sí o un no que marca a mano quien lo sabe.
--
-- `ejecutada_at` guarda cuándo se marcó, que es la fecha que se muestra en la
-- celda y la que sale en el Excel. No es la fecha de la auditoría —esa ya está
-- en `fecha_auditoria`—, sino la de la confirmación.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

ALTER TABLE public.informes_auditoria
  ADD COLUMN IF NOT EXISTS ejecutada boolean NOT NULL DEFAULT false;

ALTER TABLE public.informes_auditoria
  ADD COLUMN IF NOT EXISTS ejecutada_at timestamptz;

COMMENT ON COLUMN public.informes_auditoria.ejecutada IS
  'Control manual: la auditoría se llevó a cabo. No se deduce de los documentos.';

COMMENT ON COLUMN public.informes_auditoria.ejecutada_at IS
  'Cuándo se marcó como ejecutada (no es la fecha de la auditoría).';

-- Coherencia entre las dos: marcada implica fecha, y sin marcar implica sin
-- fecha. Evita que quede una fecha huérfana al desmarcar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'informes_auditoria_ejecutada_check'
  ) THEN
    ALTER TABLE public.informes_auditoria
      ADD CONSTRAINT informes_auditoria_ejecutada_check
      CHECK (
        (ejecutada IS TRUE AND ejecutada_at IS NOT NULL)
        OR (ejecutada IS FALSE AND ejecutada_at IS NULL)
      );
  END IF;
END $$;

-- Para contar las ejecutadas del año sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS informes_auditoria_ejecutada_idx
  ON public.informes_auditoria USING btree (ejecutada);

-- Comprobación: debe devolver las dos columnas nuevas.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'informes_auditoria'
  AND column_name IN ('ejecutada', 'ejecutada_at')
ORDER BY column_name;
