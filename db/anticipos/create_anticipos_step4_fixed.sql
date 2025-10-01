-- =====================================================
-- 📋 PASO 4 CORREGIDO: Configurar RLS y políticas (sin group_id)
-- =====================================================

-- RLS (Row Level Security)
ALTER TABLE anticipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para anticipos (sin dependencia de group_id)
CREATE POLICY "Modelos pueden ver sus propios anticipos" ON anticipos
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Modelos pueden crear sus propios anticipos" ON anticipos
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Modelos pueden actualizar sus propios anticipos pendientes" ON anticipos
  FOR UPDATE USING (auth.uid() = model_id AND estado = 'pendiente');

-- Política simplificada para admins (sin group_id por ahora)
CREATE POLICY "Admins pueden ver todos los anticipos" ON anticipos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins pueden gestionar anticipos" ON anticipos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Políticas para periods
CREATE POLICY "Todos pueden ver periods activos" ON periods
  FOR SELECT USING (is_active = true);

CREATE POLICY "Solo super admins pueden gestionar periods" ON periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

