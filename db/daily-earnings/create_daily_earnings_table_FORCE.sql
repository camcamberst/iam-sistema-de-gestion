-- =====================================================
-- CREAR TABLA daily_earnings - FORZAR CREACIÓN
-- =====================================================
-- Este script fuerza la creación de la tabla incluso si ya existe
-- Úsalo si el script anterior no funcionó

-- PASO 1: Eliminar tabla si existe (CUIDADO: Esto borra datos)
DROP TABLE IF EXISTS public.daily_earnings CASCADE;

-- PASO 2: Crear tabla desde cero
CREATE TABLE public.daily_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earnings_date DATE NOT NULL DEFAULT CURRENT_DATE,
  earnings_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT daily_earnings_model_date_unique UNIQUE(model_id, earnings_date)
);

-- PASO 3: Crear función para trigger
CREATE OR REPLACE FUNCTION update_daily_earnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PASO 4: Crear trigger
DROP TRIGGER IF EXISTS update_daily_earnings_updated_at ON public.daily_earnings;
CREATE TRIGGER update_daily_earnings_updated_at
  BEFORE UPDATE ON public.daily_earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_earnings_updated_at();

-- PASO 5: Habilitar RLS
ALTER TABLE public.daily_earnings ENABLE ROW LEVEL SECURITY;

-- PASO 6: Eliminar políticas existentes
DROP POLICY IF EXISTS "Models can view own daily earnings" ON public.daily_earnings;
DROP POLICY IF EXISTS "Admins can view all daily earnings" ON public.daily_earnings;
DROP POLICY IF EXISTS "Users can insert/update own daily earnings" ON public.daily_earnings;
DROP POLICY IF EXISTS "Users can update own daily earnings" ON public.daily_earnings;

-- PASO 7: Crear políticas RLS
CREATE POLICY "Models can view own daily earnings" ON public.daily_earnings
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Admins can view all daily earnings" ON public.daily_earnings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert/update own daily earnings" ON public.daily_earnings
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Users can update own daily earnings" ON public.daily_earnings
  FOR UPDATE USING (auth.uid() = model_id);

-- PASO 8: Crear índices
CREATE INDEX IF NOT EXISTS idx_daily_earnings_model_date 
ON public.daily_earnings(model_id, earnings_date);

CREATE INDEX IF NOT EXISTS idx_daily_earnings_date 
ON public.daily_earnings(earnings_date);

-- PASO 9: Otorgar permisos necesarios
GRANT SELECT, INSERT, UPDATE ON public.daily_earnings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_earnings TO service_role;

-- PASO 10: Verificar creación
SELECT 
  'VERIFICACIÓN FINAL' AS tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'daily_earnings'
    ) THEN '✅ Tabla daily_earnings creada exitosamente'
    ELSE '❌ Error: Tabla no se pudo crear'
  END AS estado;

