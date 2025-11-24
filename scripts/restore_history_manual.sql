-- 🚑 SCRIPT SQL DE RESTAURACIÓN DE HISTORIAL
-- Ejecutar esto en el SQL Editor de Supabase

-- 1. Insertar registros recuperados de calculator_totals (15 Nov) hacia calculator_history
-- Usamos ON CONFLICT DO NOTHING para evitar duplicados si se corre varias veces

INSERT INTO calculator_history (
    model_id,
    platform_id,
    value,
    period_date,
    period_type,
    archived_at,
    rate_eur_usd,
    rate_gbp_usd,
    rate_usd_cop,
    platform_percentage,
    value_usd_bruto,
    value_usd_modelo,
    value_cop_modelo
)
SELECT 
    model_id,
    'TOTAL_RECUPERADO' as platform_id, -- ID especial
    total_usd_bruto as value,
    '2025-11-01' as period_date, -- Fecha de inicio del periodo P1 Nov
    '1-15' as period_type,
    NOW() as archived_at,
    1.01 as rate_eur_usd,
    1.20 as rate_gbp_usd,
    3900 as rate_usd_cop,
    100 as platform_percentage,
    total_usd_bruto,
    total_usd_modelo,
    total_cop_modelo
FROM calculator_totals
WHERE period_date = '2025-11-15' -- Buscar el cierre del día 15
AND total_usd_modelo > 0 -- Solo si hay valores
AND NOT EXISTS (
    SELECT 1 FROM calculator_history 
    WHERE calculator_history.model_id = calculator_totals.model_id 
    AND calculator_history.period_date = '2025-11-01'
    AND calculator_history.platform_id = 'TOTAL_RECUPERADO'
);

-- 2. Verificar cuántos se insertaron
SELECT COUNT(*) as registros_restaurados 
FROM calculator_history 
WHERE platform_id = 'TOTAL_RECUPERADO' AND period_date = '2025-11-01';



