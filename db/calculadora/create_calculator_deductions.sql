-- 📉 CREAR TABLA DE DEDUCCIONES MANUALES
-- Permite a los administradores agregar descuentos adicionales al Neto a Pagar

CREATE TABLE IF NOT EXISTS calculator_deductions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('1-15', '16-31')),
  concept TEXT NOT NULL,
  amount DECIMAL(18,2) NOT NULL, -- Valor en COP a descontar
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_calculator_deductions_model_period ON calculator_deductions(model_id, period_date, period_type);

-- RLS (Row Level Security)
ALTER TABLE calculator_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas
-- 1. Modelos pueden VER sus propias deducciones
CREATE POLICY "Models can view own deductions" ON calculator_deductions
  FOR SELECT USING (auth.uid() = model_id);

-- 2. Admins pueden VER todas las deducciones
CREATE POLICY "Admins can view all deductions" ON calculator_deductions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role IN ('admin', 'super_admin')
    )
  );

-- 3. Admins pueden INSERTAR deducciones
CREATE POLICY "Admins can insert deductions" ON calculator_deductions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role IN ('admin', 'super_admin')
    )
  );

-- 4. Admins pueden ACTUALIZAR deducciones
CREATE POLICY "Admins can update deductions" ON calculator_deductions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role IN ('admin', 'super_admin')
    )
  );

-- 5. Admins pueden ELIMINAR deducciones
CREATE POLICY "Admins can delete deductions" ON calculator_deductions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() 
      AND public.users.role IN ('admin', 'super_admin')
    )
  );

-- Comentarios
COMMENT ON TABLE calculator_deductions IS 'Deducciones manuales aplicadas al pago de la modelo (ej: multas, préstamos externos)';
COMMENT ON COLUMN calculator_deductions.amount IS 'Monto en COP a descontar del neto';

