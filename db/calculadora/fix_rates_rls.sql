-- =====================================================
-- 🔧 CORREGIR POLÍTICAS RLS PARA TASAS
-- =====================================================

-- 1. ELIMINAR políticas existentes
DROP POLICY IF EXISTS "Everyone can read active rates" ON rates;
DROP POLICY IF EXISTS "Admins can manage rates" ON rates;

-- 2. CREAR políticas más permisivas
-- Política para lectura (todos pueden leer tasas activas)
CREATE POLICY "Allow read active rates" ON rates FOR SELECT USING (
  active = true AND valid_to IS NULL
);

-- Política para INSERT (temporalmente permisiva)
CREATE POLICY "Allow insert rates" ON rates FOR INSERT WITH CHECK (true);

-- Política para UPDATE (temporalmente permisiva)
CREATE POLICY "Allow update rates" ON rates FOR UPDATE USING (true);

-- Política para DELETE (temporalmente permisiva)
CREATE POLICY "Allow delete rates" ON rates FOR DELETE USING (true);

-- 3. VERIFICAR que las políticas se crearon
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'rates'
ORDER BY policyname;

-- 4. VERIFICAR que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'rates';

SELECT 'Políticas RLS corregidas exitosamente' as status;
