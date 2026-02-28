-- =====================================================
-- 🗄️  AIM SEXSHOP — Supabase Storage bucket
-- =====================================================
-- Ejecutar en el SQL Editor de Supabase

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-products',
  'shop-products',
  true,
  5242880,   -- 5 MB por imagen
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política: cualquier usuario autenticado puede leer
CREATE POLICY "Public read shop images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-products');

-- Política: admins y super_admins pueden subir/eliminar imágenes
CREATE POLICY "Admins upload shop images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'shop-products'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin','super_admin')
    )
  );

CREATE POLICY "Admins delete shop images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'shop-products'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin','super_admin')
    )
  );
