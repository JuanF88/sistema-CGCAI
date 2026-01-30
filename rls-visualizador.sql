-- ============================================================
-- POLÍTICAS RLS PARA ROL VISUALIZADOR
-- Agregar acceso de solo lectura a todas las tablas relevantes
-- ============================================================

-- 1. USUARIOS - Permitir lectura a visualizador
-- NOTA: Para evitar recursión infinita, la política de usuarios debe permitir
-- que todos los usuarios autenticados lean la tabla. Las restricciones de acceso
-- se manejan a nivel de aplicación (endpoints API)
DROP POLICY IF EXISTS "Visualizadores pueden leer usuarios" ON usuarios;
CREATE POLICY "Visualizadores pueden leer usuarios"
ON usuarios FOR SELECT
TO authenticated
USING (true);  -- Permitir a todos los autenticados (evita recursión)

-- 2. DEPENDENCIAS - Permitir lectura a visualizador
DROP POLICY IF EXISTS "Visualizadores pueden leer dependencias" ON dependencias;
CREATE POLICY "Visualizadores pueden leer dependencias"
ON dependencias FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- 3. INFORMES_AUDITORIA - Permitir lectura a visualizador
DROP POLICY IF EXISTS "Visualizadores pueden leer informes" ON informes_auditoria;
CREATE POLICY "Visualizadores pueden leer informes"
ON informes_auditoria FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- 4. FORTALEZAS - Permitir lectura a visualizador
DROP POLICY IF EXISTS "Visualizadores pueden leer fortalezas" ON fortalezas;
CREATE POLICY "Visualizadores pueden leer fortalezas"
ON fortalezas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- 5. OPORTUNIDADES_MEJORA - Permitir lectura a visualizador
DROP POLICY IF EXISTS "Visualizadores pueden leer oportunidades" ON oportunidades_mejora;
CREATE POLICY "Visualizadores pueden leer oportunidades"
ON oportunidades_mejora FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- 6. NO_CONFORMIDADES - Permitir lectura a visualizador
DROP POLICY IF EXISTS "Visualizadores pueden leer no_conformidades" ON no_conformidades;
CREATE POLICY "Visualizadores pueden leer no_conformidades"
ON no_conformidades FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- 7. PLANES_AUDITORIA_INFORME - Permitir lectura a visualizador
DROP POLICY IF EXISTS "Visualizadores pueden leer planes" ON planes_auditoria_informe;
CREATE POLICY "Visualizadores pueden leer planes"
ON planes_auditoria_informe FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- 8. STORAGE BUCKETS - Permitir lectura de archivos a visualizador
-- Planes
DROP POLICY IF EXISTS "Visualizadores pueden ver planes" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver planes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'planes' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- Asistencias
DROP POLICY IF EXISTS "Visualizadores pueden ver asistencias" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver asistencias"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'asistencias' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- Evaluaciones
DROP POLICY IF EXISTS "Visualizadores pueden ver evaluaciones" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver evaluaciones"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'evaluaciones' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- Actas
DROP POLICY IF EXISTS "Visualizadores pueden ver actas" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver actas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'actas' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- Actas de Compromiso
DROP POLICY IF EXISTS "Visualizadores pueden ver actascompromiso" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver actascompromiso"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'actascompromiso' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- Novedades
DROP POLICY IF EXISTS "Visualizadores pueden ver novedades" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver novedades"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'novedades' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- Validaciones
DROP POLICY IF EXISTS "Visualizadores pueden ver validaciones" ON storage.objects;
CREATE POLICY "Visualizadores pueden ver validaciones"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'validaciones' AND
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_user_id = auth.uid()
    AND u.rol = 'visualizador'
  )
);

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Para verificar que las políticas se crearon correctamente:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE policyname LIKE '%Visualizador%'
-- ORDER BY tablename, policyname;
