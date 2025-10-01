-- 🔍 DIAGNÓSTICO COMPLETO DE LILLYSKY
-- Verificar configuración, valores guardados y períodos

-- 1. Verificar configuración de lillysky
SELECT 
    'CONFIGURACIÓN DE LILLYSKY' as seccion,
    cc.model_id,
    u.email,
    cc.group_percentage,
    cc.percentage_override,
    cc.active,
    cc.created_at as config_created
FROM calculator_config cc
JOIN auth.users u ON cc.model_id = u.id
WHERE u.email = 'lillysky@tuemailya.com';

-- 2. Verificar valores guardados de lillysky (últimos 7 días)
SELECT 
    'VALORES GUARDADOS DE LILLYSKY' as seccion,
    mv.platform_id,
    p.name as platform_name,
    mv.value,
    mv.period_date,
    mv.created_at,
    mv.updated_at
FROM model_values mv
JOIN auth.users u ON mv.model_id = u.id
LEFT JOIN calculator_platforms p ON mv.platform_id = p.id
WHERE u.email = 'lillysky@tuemailya.com'
    AND mv.period_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY mv.period_date DESC, mv.created_at DESC;

-- 3. Verificar períodos disponibles para lillysky
SELECT 
    'PERÍODOS DISPONIBLES' as seccion,
    DISTINCT period_date,
    COUNT(*) as total_valores,
    MIN(created_at) as primer_valor,
    MAX(created_at) as ultimo_valor
FROM model_values mv
JOIN auth.users u ON mv.model_id = u.id
WHERE u.email = 'lillysky@tuemailya.com'
GROUP BY period_date
ORDER BY period_date DESC;

-- 4. Verificar si hay datos de HOY
SELECT 
    'DATOS DE HOY' as seccion,
    COUNT(*) as valores_hoy,
    STRING_AGG(DISTINCT platform_id::text, ', ') as platforms_con_datos
FROM model_values mv
JOIN auth.users u ON mv.model_id = u.id
WHERE u.email = 'lillysky@tuemailya.com'
    AND mv.period_date = CURRENT_DATE;

-- 5. Verificar último período con datos
SELECT 
    'ÚLTIMO PERÍODO CON DATOS' as seccion,
    MAX(period_date) as ultimo_periodo,
    COUNT(*) as total_valores_ultimo_periodo
FROM model_values mv
JOIN auth.users u ON mv.model_id = u.id
WHERE u.email = 'lillysky@tuemailya.com';
