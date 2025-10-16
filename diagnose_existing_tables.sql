-- =====================================================
-- 🔍 DIAGNÓSTICO: VERIFICAR TABLAS EXISTENTES
-- =====================================================
-- Script SQL para verificar qué tablas relacionadas con calculadoras existen
-- =====================================================

-- 1. Verificar si existe la tabla daily_earnings
SELECT 
    'VERIFICAR TABLA daily_earnings' AS accion,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_earnings') 
        THEN 'EXISTE' 
        ELSE 'NO EXISTE' 
    END AS estado;

-- 2. Verificar si existe la tabla calculator_totals
SELECT 
    'VERIFICAR TABLA calculator_totals' AS accion,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_totals') 
        THEN 'EXISTE' 
        ELSE 'NO EXISTE' 
    END AS estado;

-- 3. Verificar si existe la tabla model_values
SELECT 
    'VERIFICAR TABLA model_values' AS accion,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_values') 
        THEN 'EXISTE' 
        ELSE 'NO EXISTE' 
    END AS estado;

-- 4. Verificar si existe la tabla calculator_history
SELECT 
    'VERIFICAR TABLA calculator_history' AS accion,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_history') 
        THEN 'EXISTE' 
        ELSE 'NO EXISTE' 
    END AS estado;

-- 5. Listar TODAS las tablas que contienen 'calculator' o 'earnings' en el nombre
SELECT 
    'TABLAS RELACIONADAS CON CALCULADORAS' AS info,
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name LIKE '%calculator%' 
   OR table_name LIKE '%earnings%'
   OR table_name LIKE '%model_values%'
ORDER BY table_name;

-- 6. Verificar datos en model_values (si existe)
SELECT 
    'DATOS EN model_values' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS suma_valores
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- 7. Verificar datos en calculator_totals (si existe)
SELECT 
    'DATOS EN calculator_totals' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(total_usd_bruto) AS suma_usd_bruto,
    SUM(total_usd_modelo) AS suma_usd_modelo
FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- 8. Verificar datos en calculator_history (si existe)
SELECT 
    'DATOS EN calculator_history' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS suma_valores
FROM calculator_history 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- =====================================================
-- 🔍 DIAGNÓSTICO:
-- =====================================================
-- Este script nos dirá:
-- 1. Qué tablas existen realmente
-- 2. Qué datos hay en cada tabla
-- 3. Cuáles son las tablas que necesitamos limpiar
-- =====================================================
