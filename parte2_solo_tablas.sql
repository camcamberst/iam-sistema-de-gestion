-- PARTE 2 SIMPLIFICADA: SOLO TABLAS Y DATOS
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
