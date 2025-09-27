-- PARTE 2 ULTRA SIMPLE: SIN DEPENDENCIAS
-- =====================================================

-- 6. 💰 PRODUCTOS Y VENTAS (SIN organization_id)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('producto', 'paquete')),
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  model_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. 💸 MOVIMIENTOS DE CAJA (SIN organization_id)
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 🏢 COSTOS OPERATIVOS (SIN organization_id)
CREATE TABLE operating_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  period TEXT NOT NULL CHECK (period IN ('mensual', 'semanal', 'unico')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 🌱 DATOS INICIALES (SEED) - SOLO GRUPOS
-- =====================================================

-- Crear grupos por defecto (SIN organization_id)
INSERT INTO groups (name, description) VALUES 
('Cabecera', 'Grupo Cabecera'),
('Diamante', 'Grupo Diamante'),
('Sede MP', 'Sede MP'),
('Victoria', 'Grupo Victoria'),
('Terrazas', 'Grupo Terrazas'),
('Satélite', 'Grupo Satélite'),
('Otros', 'Otros grupos');

-- =====================================================
-- 📊 ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_groups_user ON user_groups(user_id);
CREATE INDEX idx_user_groups_group ON user_groups(group_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_cash_movements_created_at ON cash_movements(created_at);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
