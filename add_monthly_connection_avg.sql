-- Agregar columnas para promedio acumulado de conexión mensual
-- Tabla: public.users

-- Agregar columna para almacenar el promedio mensual de conexión
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS monthly_connection_avg DECIMAL(5,2) DEFAULT 0.00;

-- Agregar columna para almacenar la fecha del último cálculo
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_avg_calculation_date DATE DEFAULT NULL;

-- Agregar columna para almacenar el mes/año del último cálculo
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_avg_month VARCHAR(7) DEFAULT NULL; -- Formato: "2025-01"

-- Agregar comentarios para documentar las columnas
COMMENT ON COLUMN public.users.monthly_connection_avg IS 'Promedio acumulado de conexión mensual (porcentaje)';
COMMENT ON COLUMN public.users.last_avg_calculation_date IS 'Fecha del último cálculo del promedio mensual';
COMMENT ON COLUMN public.users.last_avg_month IS 'Mes/año del último cálculo (formato YYYY-MM)';

-- Crear función para calcular y actualizar el promedio mensual
CREATE OR REPLACE FUNCTION update_monthly_connection_avg(p_model_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    current_month VARCHAR(7);
    current_date_str DATE;
    days_in_month INTEGER;
    days_with_activity INTEGER;
    monthly_avg DECIMAL(5,2);
BEGIN
    -- Obtener mes actual en formato YYYY-MM
    current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
    current_date_str := CURRENT_DATE;
    
    -- Obtener días del mes actual
    days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', CURRENT_DATE) + INTERVAL '1 MONTH - 1 DAY'));
    
    -- Contar días con actividad en el mes actual
    SELECT COUNT(DISTINCT period_date) INTO days_with_activity
    FROM calculator_history 
    WHERE model_id = p_model_id 
    AND DATE_TRUNC('MONTH', period_date::DATE) = DATE_TRUNC('MONTH', CURRENT_DATE);
    
    -- Calcular promedio (considerando 13 días de trabajo por quincena, 26 días por mes)
    monthly_avg := CASE 
        WHEN days_in_month > 0 THEN ROUND((days_with_activity::DECIMAL / 26) * 100, 2)
        ELSE 0
    END;
    
    -- Actualizar el registro del usuario
    UPDATE public.users 
    SET 
        monthly_connection_avg = monthly_avg,
        last_avg_calculation_date = current_date_str,
        last_avg_month = current_month
    WHERE id = p_model_id;
    
    RETURN monthly_avg;
END;
$$ LANGUAGE plpgsql;

-- Crear función para obtener el promedio mensual (con actualización automática si es necesario)
CREATE OR REPLACE FUNCTION get_monthly_connection_avg(p_model_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    current_month VARCHAR(7);
    last_calculated_month VARCHAR(7);
    monthly_avg DECIMAL(5,2);
BEGIN
    -- Obtener mes actual
    current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
    
    -- Obtener último mes calculado
    SELECT last_avg_month INTO last_calculated_month
    FROM public.users 
    WHERE id = p_model_id;
    
    -- Si no se ha calculado este mes, calcularlo
    IF last_calculated_month IS NULL OR last_calculated_month != current_month THEN
        monthly_avg := update_monthly_connection_avg(p_model_id);
    ELSE
        -- Obtener el promedio ya calculado
        SELECT monthly_connection_avg INTO monthly_avg
        FROM public.users 
        WHERE id = p_model_id;
    END IF;
    
    RETURN COALESCE(monthly_avg, 0);
END;
$$ LANGUAGE plpgsql;

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
AND column_name IN ('monthly_connection_avg', 'last_avg_calculation_date', 'last_avg_month')
ORDER BY column_name;
