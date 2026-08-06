-- ============================================================
-- USO DE LA REVISIÓN CON IA
--
-- Una fila por cada vez que alguien pulsa «Revisar con IA» en el formulario
-- del informe. Sirve para dos cosas a la vez:
--
--   1. Poner un tope por auditoría (diez revisiones). Cada llamada al modelo
--      se paga, así que sin techo una sola auditoría puede gastar lo que cien.
--   2. Saber cuánto se usa y cuánto cuesta: revisiones, tokens y medias, que
--      es lo que se ve en Estadísticas → Uso IA.
--
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS ia_revisiones (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- De qué auditoría se pidió la revisión. En CASCADE: el registro no tiene
  -- sentido sin la auditoría, y no es un dato que haya que conservar aparte.
  informe_id      bigint NOT NULL REFERENCES informes_auditoria(id) ON DELETE CASCADE,

  -- Quién la pidió. SET NULL: si el usuario se da de baja, el consumo sigue
  -- contando para la auditoría aunque ya no se sepa de quién fue.
  usuario_id      bigint REFERENCES usuarios(usuario_id) ON DELETE SET NULL,

  -- ok        → el modelo respondió y el auditor vio su revisión
  -- error     → se intentó y falló (clave, modelo, tiempo agotado, formato…)
  -- bloqueada → se pulsó con el cupo agotado; no se llegó a llamar al modelo
  estado          text NOT NULL DEFAULT 'ok'
                       CHECK (estado IN ('ok', 'error', 'bloqueada')),
  codigo_error    text,

  modelo          text,
  tokens_entrada  integer NOT NULL DEFAULT 0,
  tokens_salida   integer NOT NULL DEFAULT 0,
  duracion_ms     integer,

  -- Los veredictos de esa revisión: [{"campo":"objetivo","veredicto":"parcial"}].
  -- Se guardan para poder ver si la IA sirve de algo —cuántas revisiones
  -- terminan en «alineado»— sin guardar ni un texto del informe.
  veredictos      jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Qué consume cupo: lo que salió bien y lo que falló DESPUÉS de que el
  -- modelo escribiera algo (una respuesta vacía o ilegible ya está pagada).
  -- Una clave mal puesta o el modelo caído no gastan nada y no cuentan: sería
  -- castigar al auditor por una avería del sistema.
  consume_cupo    boolean NOT NULL
                  GENERATED ALWAYS AS (estado = 'ok' OR tokens_salida > 0) STORED,

  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ia_revisiones IS
  'Una fila por pulsación de «Revisar con IA»: sostiene el tope por auditoría y el panel de uso.';
COMMENT ON COLUMN ia_revisiones.consume_cupo IS
  'Si cuenta para el tope de la auditoría. Falso cuando el fallo fue del sistema y no costó tokens.';

-- El índice del tope: la consulta que se hace en cada pulsación es
-- «cuántas consumen cupo en esta auditoría», y así se resuelve solo con él.
CREATE INDEX IF NOT EXISTS ia_revisiones_informe_idx
  ON ia_revisiones (informe_id)
  WHERE consume_cupo;

-- El del panel, que siempre ordena y agrupa por fecha.
CREATE INDEX IF NOT EXISTS ia_revisiones_fecha_idx
  ON ia_revisiones (created_at DESC);

-- ------------------------------------------------------------
-- RLS: nadie por la clave pública
--
-- La tabla se escribe y se lee solo desde el servidor con service-role, que se
-- salta RLS. Sin políticas, cualquier cliente con la clave anónima ve una
-- tabla vacía y no puede insertar: el auditor no debe poder consultar —ni
-- mucho menos falsear— su propio consumo.
-- ------------------------------------------------------------
ALTER TABLE ia_revisiones ENABLE ROW LEVEL SECURITY;

-- Comprobaciones:
--   Consumo por auditoría, con el cupo restante sobre diez:
--     SELECT informe_id,
--            count(*) FILTER (WHERE consume_cupo) AS usadas,
--            10 - count(*) FILTER (WHERE consume_cupo) AS restantes
--       FROM ia_revisiones GROUP BY informe_id ORDER BY usadas DESC;
--
--   Gasto total y media por revisión:
--     SELECT count(*) AS revisiones,
--            sum(tokens_entrada + tokens_salida) AS tokens,
--            round(avg(tokens_entrada + tokens_salida)) AS media
--       FROM ia_revisiones WHERE estado = 'ok';
