BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS tipo_personal text NULL,
  ADD COLUMN IF NOT EXISTS dependencia_id bigint NULL,
  ADD COLUMN IF NOT EXISTS estudios text NULL,
  ADD COLUMN IF NOT EXISTS tipo_estudio text NULL,
  ADD COLUMN IF NOT EXISTS celular text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_tipo_personal_check'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_tipo_personal_check
      CHECK (
        tipo_personal IS NULL
        OR lower(btrim(tipo_personal)) = ANY (
          ARRAY['ops', 'docente', 'administrativo', 'otro']
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_tipo_estudio_check'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_tipo_estudio_check
      CHECK (
        tipo_estudio IS NULL
        OR lower(btrim(tipo_estudio)) = ANY (
          ARRAY[
            'profesional',
            'magister',
            'magíster',
            'profesional especializado',
            'profecional especializado',
            'doctor'
          ]
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_dependencia_id_fkey'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_dependencia_id_fkey
      FOREIGN KEY (dependencia_id)
      REFERENCES public.dependencias (dependencia_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS usuarios_dependencia_id_idx
  ON public.usuarios USING btree (dependencia_id);

COMMENT ON COLUMN public.usuarios.tipo_personal IS 'Tipo de usuario: ops, docente, administrativo u otro.';
COMMENT ON COLUMN public.usuarios.dependencia_id IS 'Organismo / Area Universitaria. Referencia a public.dependencias.';
COMMENT ON COLUMN public.usuarios.estudios IS 'Descripcion libre de estudios del usuario.';
COMMENT ON COLUMN public.usuarios.tipo_estudio IS 'Nivel de estudio principal del usuario.';
COMMENT ON COLUMN public.usuarios.celular IS 'Numero de celular del usuario.';

COMMIT;

-- Ejemplo de carga posterior de datos:
-- UPDATE public.usuarios
-- SET
--   tipo_personal = 'ops',
--   dependencia_id = 12,
--   estudios = 'Contaduria Publica',
--   tipo_estudio = 'profesional',
--   celular = '3001234567'
-- WHERE usuario_id = 1;