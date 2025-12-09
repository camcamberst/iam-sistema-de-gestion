-- =====================================================
-- 🔐 CORREGIR PERMISOS RLS PARA GESTOR
-- =====================================================
-- Asegurar que el gestor pueda leer user_groups y users
-- =====================================================

-- 1. Verificar y corregir políticas de user_groups para gestor
-- Si no existe una política para gestor, crear una

-- Política: Gestores pueden leer user_groups
DROP POLICY IF EXISTS "Gestores can read user_groups" ON user_groups;
CREATE POLICY "Gestores can read user_groups" ON user_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'gestor'
    )
  );

-- 2. Verificar y corregir políticas de users para gestor
-- Política: Gestores pueden leer usuarios (especialmente modelos)
DROP POLICY IF EXISTS "Gestores can read users" ON users;
CREATE POLICY "Gestores can read users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'gestor'
    )
  );

-- 3. Verificar y corregir políticas de groups para gestor
-- Política: Gestores pueden leer grupos
DROP POLICY IF EXISTS "Gestores can read groups" ON groups;
CREATE POLICY "Gestores can read groups" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'gestor'
    )
  );

-- 4. Verificar y corregir políticas de calculator_history para gestor
-- Política: Gestores pueden leer y escribir en calculator_history
DROP POLICY IF EXISTS "Gestores can manage calculator_history" ON calculator_history;
CREATE POLICY "Gestores can manage calculator_history" ON calculator_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'gestor'
    )
  );

-- 5. Verificar y corregir políticas de calculator_platforms para gestor
-- (Debería tener acceso de lectura público, pero verificamos)
DROP POLICY IF EXISTS "Gestores can read calculator_platforms" ON calculator_platforms;
CREATE POLICY "Gestores can read calculator_platforms" ON calculator_platforms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'gestor'
    )
    OR active = true  -- También acceso público para plataformas activas
  );

-- Nota: Si las políticas ya existen con otros nombres, puede que necesites
-- ajustar los nombres o eliminar las políticas conflictivas primero.

