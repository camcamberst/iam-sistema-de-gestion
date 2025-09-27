-- =====================================================
-- 🔧 CORRECCIONES ESPECÍFICAS - NO REEMPLAZAR EXISTENTE
-- =====================================================
-- Solo ejecutar las correcciones necesarias
-- NO reemplazar tablas existentes
-- =====================================================

-- 1. 🧹 CREAR TABLAS FALTANTES (Solo si no existen)
-- =====================================================

-- Crear tabla organizations si no existe
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Crear tabla audit_logs si no existe
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 🔧 CORREGIR CONSTRAINT DE ROL EN TABLA USERS
-- =====================================================
-- Eliminar constraint existente si tiene 'chatter'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Crear nuevo constraint solo con los 3 roles correctos
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('super_admin', 'admin', 'modelo'));

-- 3. 🌱 INSERTAR DATOS INICIALES (Solo si no existen)
-- =====================================================

-- Insertar organización principal si no existe
INSERT INTO organizations (id, name, description) VALUES 
('00000000-0000-0000-0000-000000000001', 'AIM Sistema Principal', 'Organización principal del sistema')
ON CONFLICT (id) DO NOTHING;

-- Insertar grupos si no existen
INSERT INTO groups (organization_id, name, description) VALUES 
('00000000-0000-0000-0000-000000000001', 'Cabecera', 'Grupo Cabecera'),
('00000000-0000-0000-0000-000000000001', 'Diamante', 'Grupo Diamante'),
('00000000-0000-0000-0000-000000000001', 'Sede MP', 'Sede MP'),
('00000000-0000-0000-0000-000000000001', 'Victoria', 'Grupo Victoria'),
('00000000-0000-0000-0000-000000000001', 'Terrazas', 'Grupo Terrazas'),
('00000000-0000-0000-0000-000000000001', 'Satélite', 'Grupo Satélite'),
('00000000-0000-0000-0000-000000000001', 'Otros', 'Otros grupos')
ON CONFLICT (organization_id, name) DO NOTHING;

-- 4. 🔐 HABILITAR RLS EN TABLAS EXISTENTES
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. 🛡️ CREAR POLÍTICAS RLS (Solo si no existen)
-- =====================================================

-- Política para organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' 
    AND policyname = 'Users can view their organization'
  ) THEN
    CREATE POLICY "Users can view their organization" ON organizations
      FOR SELECT USING (
        id IN (
          SELECT organization_id FROM users 
          WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Política para users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can view users in their organization'
  ) THEN
    CREATE POLICY "Users can view users in their organization" ON users
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM users 
          WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Política para groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'groups' 
    AND policyname = 'Users can view groups in their organization'
  ) THEN
    CREATE POLICY "Users can view groups in their organization" ON groups
      FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM users 
          WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- Política para user_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_groups' 
    AND policyname = 'Users can view user_groups in their organization'
  ) THEN
    CREATE POLICY "Users can view user_groups in their organization" ON user_groups
      FOR SELECT USING (
        user_id IN (
          SELECT id FROM users 
          WHERE organization_id IN (
            SELECT organization_id FROM users 
            WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- 6. 📊 CREAR ÍNDICES (Solo si no existen)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_groups_organization ON groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_user ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 7. 🔄 CREAR TRIGGERS (Solo si no existen)
-- =====================================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers solo si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_organizations_updated_at'
  ) THEN
    CREATE TRIGGER update_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- =====================================================
-- ✅ CORRECCIONES COMPLETADAS
-- =====================================================
-- ✅ Constraint de rol corregido (sin 'chatter')
-- ✅ Tablas faltantes creadas
-- ✅ RLS habilitado
-- ✅ Políticas creadas
-- ✅ Índices creados
-- ✅ Triggers creados
-- ✅ Datos iniciales insertados
-- =====================================================
