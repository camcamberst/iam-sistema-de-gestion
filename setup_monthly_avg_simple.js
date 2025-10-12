// Script simple para configurar promedio mensual usando SQL directo
// Este script debe ejecutarse manualmente en el SQL Editor de Supabase

console.log(`
🔄 CONFIGURACIÓN DE PROMEDIO MENSUAL DE CONEXIÓN
================================================

Ejecuta los siguientes comandos SQL en el SQL Editor de Supabase:

1. Agregar columnas a la tabla users:
------------------------------------
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS monthly_connection_avg DECIMAL(5,2) DEFAULT 0.00;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_avg_calculation_date DATE DEFAULT NULL;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_avg_month VARCHAR(7) DEFAULT NULL;

2. Agregar comentarios:
---------------------
COMMENT ON COLUMN public.users.monthly_connection_avg IS 'Promedio acumulado de conexión mensual (porcentaje)';
COMMENT ON COLUMN public.users.last_avg_calculation_date IS 'Fecha del último cálculo del promedio mensual';
COMMENT ON COLUMN public.users.last_avg_month IS 'Mes/año del último cálculo (formato YYYY-MM)';

3. Crear función update_monthly_connection_avg:
---------------------------------------------
CREATE OR REPLACE FUNCTION update_monthly_connection_avg(p_model_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    current_month VARCHAR(7);
    current_date_str DATE;
    days_in_month INTEGER;
    days_with_activity INTEGER;
    monthly_avg DECIMAL(5,2);
BEGIN
    current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
    current_date_str := CURRENT_DATE;
    
    days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', CURRENT_DATE) + INTERVAL '1 MONTH - 1 DAY'));
    
    SELECT COUNT(DISTINCT period_date) INTO days_with_activity
    FROM calculator_history 
    WHERE model_id = p_model_id 
    AND DATE_TRUNC('MONTH', period_date::DATE) = DATE_TRUNC('MONTH', CURRENT_DATE);
    
    monthly_avg := CASE 
        WHEN days_in_month > 0 THEN ROUND((days_with_activity::DECIMAL / 26) * 100, 2)
        ELSE 0
    END;
    
    UPDATE public.users 
    SET 
        monthly_connection_avg = monthly_avg,
        last_avg_calculation_date = current_date_str,
        last_avg_month = current_month
    WHERE id = p_model_id;
    
    RETURN monthly_avg;
END;
$$ LANGUAGE plpgsql;

4. Crear función get_monthly_connection_avg:
------------------------------------------
CREATE OR REPLACE FUNCTION get_monthly_connection_avg(p_model_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    current_month VARCHAR(7);
    last_calculated_month VARCHAR(7);
    monthly_avg DECIMAL(5,2);
BEGIN
    current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
    
    SELECT last_avg_month INTO last_calculated_month
    FROM public.users 
    WHERE id = p_model_id;
    
    IF last_calculated_month IS NULL OR last_calculated_month != current_month THEN
        monthly_avg := update_monthly_connection_avg(p_model_id);
    ELSE
        SELECT monthly_connection_avg INTO monthly_avg
        FROM public.users 
        WHERE id = p_model_id;
    END IF;
    
    RETURN COALESCE(monthly_avg, 0);
END;
$$ LANGUAGE plpgsql;

5. Verificar estructura:
---------------------
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
AND column_name IN ('monthly_connection_avg', 'last_avg_calculation_date', 'last_avg_month')
ORDER BY column_name;

✅ Una vez ejecutados estos comandos, el sistema estará listo para usar el promedio acumulado mensual.
`);

console.log('📋 Instrucciones completadas. Ejecuta los comandos SQL en Supabase.');
