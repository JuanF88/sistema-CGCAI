-- ============================================================================
-- El admin no podía modificar los hallazgos de un informe ajeno
-- ============================================================================
-- Las tres políticas de UPDATE de los hallazgos decían «creadores de informe
-- y admins», pero no lo hacían. Unían `usuarios` con `informes_auditoria` por
-- el AUTOR del informe y luego exigían que esa fila de `usuarios` fuera la de
-- quien escribe:
--
--   FROM usuarios u JOIN informes_auditoria ia ON u.usuario_id = ia.usuario_id
--   WHERE u.auth_user_id = auth.uid() AND ia.id = fortalezas.informe_id
--     AND (u.rol = 'admin' OR ia.usuario_id = u.usuario_id)
--
-- Con ese JOIN, `u` solo puede ser el autor, así que la rama `u.rol = 'admin'`
-- nunca servía para un informe de otro. Y Postgres no da error cuando RLS
-- deja fuera la fila: el UPDATE afecta a 0 filas y la aplicación cree que ha
-- guardado. Desde «Administrar Auditorías», el admin cambiaba el texto de una
-- fortaleza, veía «Guardado», y al volver a entrar estaba el texto de antes.
-- Crear y borrar sí funcionaban, porque esas políticas no miran al autor.
--
-- Aquí se separan las dos condiciones: o eres admin, o eres el autor del
-- informe al que pertenece el hallazgo.
--
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

BEGIN;

-- Los nombres largos están cortados a 63 caracteres, que es el máximo de
-- Postgres: así se llaman de verdad en la base.
DROP POLICY IF EXISTS "Creadores de informe y admins pueden actualizar fortalezas" ON fortalezas;
CREATE POLICY "Creadores de informe y admins pueden actualizar fortalezas"
  ON fortalezas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
       WHERE u.auth_user_id = auth.uid()
         AND (
           u.rol = 'admin'
           OR EXISTS (
             SELECT 1 FROM informes_auditoria ia
              WHERE ia.id = fortalezas.informe_id
                AND ia.usuario_id = u.usuario_id
           )
         )
    )
  );

DROP POLICY IF EXISTS "Creadores de informe y admins pueden actualizar oportunidades" ON oportunidades_mejora;
CREATE POLICY "Creadores de informe y admins pueden actualizar oportunidades"
  ON oportunidades_mejora FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
       WHERE u.auth_user_id = auth.uid()
         AND (
           u.rol = 'admin'
           OR EXISTS (
             SELECT 1 FROM informes_auditoria ia
              WHERE ia.id = oportunidades_mejora.informe_id
                AND ia.usuario_id = u.usuario_id
           )
         )
    )
  );

DROP POLICY IF EXISTS "Creadores de informe y admins pueden actualizar no conformidade" ON no_conformidades;
CREATE POLICY "Creadores de informe y admins pueden actualizar no conformidade"
  ON no_conformidades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
       WHERE u.auth_user_id = auth.uid()
         AND (
           u.rol = 'admin'
           OR EXISTS (
             SELECT 1 FROM informes_auditoria ia
              WHERE ia.id = no_conformidades.informe_id
                AND ia.usuario_id = u.usuario_id
           )
         )
    )
  );

COMMIT;

-- Comprobación: tiene que salir una política de UPDATE por tabla, y ninguna
-- con el JOIN de antes.
SELECT tablename AS tabla, policyname AS politica,
       CASE WHEN qual LIKE '%JOIN%' THEN 'VIEJA' ELSE 'nueva' END AS version
  FROM pg_policies
 WHERE schemaname = 'public'
   AND cmd = 'UPDATE'
   AND tablename IN ('fortalezas', 'oportunidades_mejora', 'no_conformidades')
 ORDER BY 1;
