-- 🔍 VERIFICACIÓN DEL ESTADO ACTUAL DEL SISTEMA
-- Confirmar que las correcciones anteriores siguen funcionando

-- 1. Verificar que no hay configuraciones con NULL o 0
SELECT 
    'CONFIGURACIONES CON PROBLEMAS' as seccion,
    COUNT(*) as total_problemas
FROM calculator_config 
WHERE group_percentage IS NULL OR group_percentage = 0;

-- 2. Verificar configuración de Elizabeth (debe estar en 60%)
SELECT 
    'CONFIGURACIÓN DE ELIZABETH' as seccion,
    cc.group_percentage,
    cc.percentage_override,
    cc.active
FROM calculator_config cc
JOIN auth.users u ON cc.model_id = u.id
WHERE u.email = 'maiteflores@tuemailya.com';

-- 3. Verificar todas las configuraciones activas
SELECT 
    'TODAS LAS CONFIGURACIONES ACTIVAS' as seccion,
    u.email,
    cc.group_percentage,
    cc.percentage_override,
    cc.active,
    cc.created_at
FROM calculator_config cc
JOIN auth.users u ON cc.model_id = u.id
WHERE cc.active = true
ORDER BY cc.created_at DESC;

-- 4. Verificar si hay modelos con valores guardados
SELECT 
    'MODELOS CON VALORES GUARDADOS' as seccion,
    u.email,
    COUNT(DISTINCT mv.period_date) as periodos_con_datos,
    MAX(mv.period_date) as ultimo_periodo,
    COUNT(mv.id) as total_valores
FROM model_values mv
JOIN auth.users u ON mv.model_id = u.id
GROUP BY u.email
ORDER BY ultimo_periodo DESC;
