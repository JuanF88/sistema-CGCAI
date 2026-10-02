-- ============================================================================
-- Bucket «planesdemejora»: quién puede leer, subir y reemplazar
-- ============================================================================
-- El bucket es nuevo, y un bucket público solo abre la LECTURA: para subir,
-- reemplazar o borrar sigue haciendo falta una política en `storage.objects`.
-- Sin esto la subida se rechaza con «new row violates row-level security
-- policy», aunque el archivo sea correcto.
--
-- Quién sube: el administrador y el auditor. El plan lo trabaja la dependencia
-- auditada, pero no entra al sistema: lo devuelve al auditor, que es quien lo
-- carga en su auditoría.
--
-- Por qué también DELETE: el plan se admite en Excel o en PDF, y la extensión
-- va en el nombre del archivo. Al reemplazar un plan cambiando de formato, la
-- versión anterior se queda con otro nombre, así que hay que poder borrarla o
-- quedarían dos planes para la misma auditoría.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

-- Lectura: cualquiera que haya entrado al sistema. El informe y sus hallazgos
-- ya se ven con los permisos de cada rol; el plan no añade nada más sensible.
DROP POLICY IF EXISTS "Autenticados pueden ver planes de mejora" ON storage.objects;
CREATE POLICY "Autenticados pueden ver planes de mejora"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'planesdemejora');

-- Subida
DROP POLICY IF EXISTS "Admin y auditor pueden subir planes de mejora" ON storage.objects;
CREATE POLICY "Admin y auditor pueden subir planes de mejora"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'planesdemejora' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.rol IN ('admin', 'auditor')
  )
);

-- Reemplazo (el `upsert` de la subida pasa por aquí cuando el archivo ya está)
DROP POLICY IF EXISTS "Admin y auditor pueden reemplazar planes de mejora" ON storage.objects;
CREATE POLICY "Admin y auditor pueden reemplazar planes de mejora"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'planesdemejora' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.rol IN ('admin', 'auditor')
  )
)
WITH CHECK (
  bucket_id = 'planesdemejora' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.rol IN ('admin', 'auditor')
  )
);

-- Borrado: solo para limpiar la versión en el otro formato al reemplazar.
DROP POLICY IF EXISTS "Admin y auditor pueden borrar planes de mejora" ON storage.objects;
CREATE POLICY "Admin y auditor pueden borrar planes de mejora"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'planesdemejora' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
      AND u.rol IN ('admin', 'auditor')
  )
);

-- Comprobación: debe devolver cuatro filas (SELECT, INSERT, UPDATE, DELETE).
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname ILIKE '%planes de mejora%'
ORDER BY cmd;
