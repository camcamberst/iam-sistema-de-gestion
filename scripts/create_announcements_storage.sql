-- =====================================================
-- 📦 STORAGE BUCKET PARA IMÁGENES DE ANUNCIOS
-- =====================================================
-- Crear bucket en Supabase Storage para almacenar
-- imágenes de las publicaciones del corcho informativo
-- =====================================================

-- Crear bucket para imágenes de anuncios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcement-images',
  'announcement-images',
  true,
  5242880, -- 5MB máximo
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Permitir lectura pública de imágenes
CREATE POLICY "lectura_publica_announcement_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcement-images');

-- Policy: Permitir subida de imágenes solo a admins y super_admins
CREATE POLICY "admins_subir_announcement_images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'announcement-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Permitir actualización de imágenes solo a admins y super_admins
CREATE POLICY "admins_actualizar_announcement_images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'announcement-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Permitir eliminación de imágenes solo a admins y super_admins
CREATE POLICY "admins_eliminar_announcement_images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'announcement-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );


