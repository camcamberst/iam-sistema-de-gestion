-- 🛡️ PREVENIR FUTURAS DIFERENCIAS DE FECHAS
-- Crear función para obtener fecha de calculadora de forma consistente

-- 1. Crear función para obtener fecha de calculadora
CREATE OR REPLACE FUNCTION get_calculator_date()
RETURNS DATE AS $$
BEGIN
  -- Siempre usar Europa Central para calculadora
  RETURN (NOW() AT TIME ZONE 'Europe/Berlin')::date;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear función para obtener fecha del sistema (Colombia)
CREATE OR REPLACE FUNCTION get_system_date()
RETURNS DATE AS $$
BEGIN
  -- Usar Colombia para sistema general
  RETURN (NOW() AT TIME ZONE 'America/Bogota')::date;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear trigger para asegurar que model_values siempre use fecha de calculadora
CREATE OR REPLACE FUNCTION ensure_calculator_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Forzar que period_date siempre use fecha de Europa Central
  NEW.period_date = get_calculator_date();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Aplicar trigger a tabla model_values
DROP TRIGGER IF EXISTS trigger_ensure_calculator_date ON model_values;
CREATE TRIGGER trigger_ensure_calculator_date
  BEFORE INSERT OR UPDATE ON model_values
  FOR EACH ROW
  EXECUTE FUNCTION ensure_calculator_date();

-- 5. Verificar que las funciones funcionan correctamente
SELECT 
  'Funciones creadas' as estado,
  get_calculator_date() as fecha_calculadora,
  get_system_date() as fecha_sistema,
  get_calculator_date() - get_system_date() as diferencia_dias;
