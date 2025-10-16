-- =====================================================
-- 🔍 DIAGNÓSTICO DE VALORES EN CALCULATOR_HISTORY
-- =====================================================
-- Verificar qué valores están almacenados en el historial
-- y comparar con los valores reales del período
-- =====================================================

-- 1. Verificar todos los registros en calculator_history
SELECT 
    'TODOS LOS REGISTROS EN CALCULATOR_HISTORY' AS info,
    COUNT(*) AS total_registros,
    COUNT(DISTINCT model_id) AS modelos_unicos,
    COUNT(DISTINCT period_type) AS tipos_periodo,
    SUM(value) AS suma_total_valores,
    MIN(value) AS valor_minimo,
    MAX(value) AS valor_maximo,
    AVG(value) AS valor_promedio
FROM calculator_history;

-- 2. Verificar registros por período
SELECT 
    'REGISTROS POR PERÍODO' AS info,
    period_type,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS suma_valores,
    AVG(value) AS promedio_valor
FROM calculator_history
GROUP BY period_type
ORDER BY period_type;

-- 3. Verificar registros por modelo específico (el que aparece en la imagen)
SELECT 
    'REGISTROS POR MODELO ESPECÍFICO' AS info,
    model_id,
    period_type,
    COUNT(*) AS registros,
    SUM(value) AS suma_valores,
    AVG(value) AS promedio_valor,
    MIN(period_date) AS fecha_minima,
    MAX(period_date) AS fecha_maxima
FROM calculator_history
GROUP BY model_id, period_type
ORDER BY model_id, period_type;

-- 4. Verificar valores individuales por plataforma para el período 1-15
SELECT 
    'VALORES INDIVIDUALES PERÍODO 1-15' AS info,
    model_id,
    platform_id,
    value,
    period_date,
    archived_at
FROM calculator_history
WHERE period_type = '1-15'
ORDER BY model_id, platform_id, period_date;

-- 5. Verificar si hay valores en model_values para comparar
SELECT 
    'VALORES ACTUALES EN MODEL_VALUES' AS info,
    COUNT(*) AS total_registros,
    COUNT(DISTINCT model_id) AS modelos_unicos,
    SUM(value) AS suma_total_valores
FROM model_values
WHERE period_date >= '2025-10-01'::date
AND period_date <= '2025-10-31'::date;

-- 6. Verificar valores en calculator_totals para comparar
SELECT 
    'VALORES EN CALCULATOR_TOTALS' AS info,
    COUNT(*) AS total_registros,
    COUNT(DISTINCT model_id) AS modelos_unicos,
    SUM(total_usd_modelo) AS suma_usd_modelo,
    SUM(total_cop_modelo) AS suma_cop_modelo
FROM calculator_totals
WHERE period_date >= '2025-10-01'::date
AND period_date <= '2025-10-31'::date;

