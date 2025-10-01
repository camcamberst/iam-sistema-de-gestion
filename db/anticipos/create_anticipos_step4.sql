-- =====================================================
-- 📋 PASO 4: Configurar RLS y políticas
-- =====================================================

-- RLS (Row Level Security)
ALTER TABLE anticipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;

-- Políticas para anticipos
CREATE POLICY "Modelos pueden ver sus propios anticipos" ON anticipos
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Modelos pueden crear sus propios anticipos" ON anticipos
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Modelos pueden actualizar sus propios anticipos pendientes" ON anticipos
  FOR UPDATE USING (auth.uid() = model_id AND estado = 'pendiente');

CREATE POLICY "Admins pueden ver anticipos de su grupo" ON anticipos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u1.group_id = u2.group_id
      WHERE u1.id = auth.uid() 
      AND u2.id = anticipos.model_id
      AND u1.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins pueden ver todos los anticipos" ON anticipos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
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

