-- PARTE 2: CONFIGURAR RLS Y TRIGGERS
-- =====================================================

-- 6. 💰 PRODUCTOS Y VENTAS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('producto', 'paquete')),
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  model_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. 💸 MOVIMIENTOS DE CAJA
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 🏢 COSTOS OPERATIVOS
CREATE TABLE operating_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  period TEXT NOT NULL CHECK (period IN ('mensual', 'semanal', 'unico')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 🔐 ROW LEVEL SECURITY (RLS) - SEGURIDAD MODERNA
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE operating_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 🛡️ POLÍTICAS DE SEGURIDAD
-- =====================================================

-- Organizaciones: Solo usuarios autenticados pueden ver su organización
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- Usuarios: Solo pueden ver usuarios de su organización
CREATE POLICY "Users can view users in their organization" ON users
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- Grupos: Solo usuarios de la misma organización
CREATE POLICY "Users can view groups in their organization" ON groups
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid()
    )
  );

-- User Groups: Solo usuarios de la misma organización
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

-- =====================================================
-- 🔄 TRIGGERS MODERNOS (SIMPLIFICADOS)
-- =====================================================

-- Trigger para sincronizar auth.users con users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, organization_id, name, role)
  VALUES (
    NEW.id,
    (SELECT id FROM organizations LIMIT 1), -- Primera organización por defecto
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'modelo')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 🌱 DATOS INICIALES (SEED)
-- =====================================================

-- Crear organización por defecto
INSERT INTO organizations (id, name, description) VALUES 
('00000000-0000-0000-0000-000000000001', 'AIM Sistema Principal', 'Organización principal del sistema');

-- Crear grupos por defecto
INSERT INTO groups (organization_id, name, description) VALUES 
('00000000-0000-0000-0000-000000000001', 'Cabecera', 'Grupo Cabecera'),
('00000000-0000-0000-0000-000000000001', 'Diamante', 'Grupo Diamante'),
('00000000-0000-0000-0000-000000000001', 'Sede MP', 'Sede MP'),
('00000000-0000-0000-0000-000000000001', 'Victoria', 'Grupo Victoria'),
('00000000-0000-0000-0000-000000000001', 'Terrazas', 'Grupo Terrazas'),
('00000000-0000-0000-0000-000000000001', 'Satélite', 'Grupo Satélite'),
('00000000-0000-0000-0000-000000000001', 'Otros', 'Otros grupos');

-- =====================================================
-- 📊 ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_groups_organization ON groups(organization_id);
CREATE INDEX idx_user_groups_user ON user_groups(user_id);
CREATE INDEX idx_user_groups_group ON user_groups(group_id);
CREATE INDEX idx_sales_organization ON sales(organization_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_cash_movements_organization ON cash_movements(organization_id);
CREATE INDEX idx_cash_movements_created_at ON cash_movements(created_at);
CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
