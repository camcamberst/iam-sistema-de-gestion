-- Crear tabla para almacenar ganancias diarias
CREATE TABLE IF NOT EXISTS daily_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earnings_date DATE NOT NULL DEFAULT CURRENT_DATE,
  earnings_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, earnings_date)
);

-- Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_daily_earnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_earnings_updated_at
  BEFORE UPDATE ON daily_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_earnings_updated_at();

-- Habilitar RLS
ALTER TABLE daily_earnings ENABLE ROW LEVEL SECURITY;

-- Política para modelos (solo pueden ver sus propios datos)
CREATE POLICY "Models can view own daily earnings" ON daily_earnings
  FOR SELECT USING (auth.uid() = model_id);

-- Política para admins (pueden ver todos los datos)
CREATE POLICY "Admins can view all daily earnings" ON daily_earnings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Política para insertar/actualizar (solo admins y el propio modelo)
CREATE POLICY "Users can insert/update own daily earnings" ON daily_earnings
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Users can update own daily earnings" ON daily_earnings
  FOR UPDATE USING (auth.uid() = model_id);
