-- Script para sincronizar Portafolio de modelo existente con su configuración de calculadora
-- Ejecutar este script para crear el Portafolio de modelos que ya tienen configuración

-- 1. Verificar qué modelos tienen configuración de calculadora pero no tienen Portafolio
SELECT 
    u.id as model_id,
    u.email,
    u.name,
    cc.enabled_platforms,
    COUNT(mp.id) as portfolio_count
FROM users u
JOIN calculator_config cc ON u.id = cc.model_id
LEFT JOIN modelo_plataformas mp ON u.id = mp.model_id
WHERE u.role = 'modelo' 
    AND cc.active = true
GROUP BY u.id, u.email, u.name, cc.enabled_platforms
HAVING COUNT(mp.id) = 0
ORDER BY u.email;

-- 2. Crear Portafolio para modelos que tienen configuración pero no Portafolio
INSERT INTO modelo_plataformas (
    model_id,
    platform_id,
    status,
    is_initial_config,
    requested_at,
    delivered_at,
    requested_by,
    delivered_by,
    notes
)
SELECT 
    cc.model_id,
    platform_id,
    'entregada' as status,
    true as is_initial_config,
    cc.created_at as requested_at,
    cc.created_at as delivered_at,
    cc.admin_id as requested_by,
    cc.admin_id as delivered_by,
    'Sincronización automática de configuración existente' as notes
FROM calculator_config cc
CROSS JOIN LATERAL unnest(cc.enabled_platforms) as platform_id
WHERE cc.active = true
    AND cc.model_id NOT IN (
        SELECT DISTINCT model_id 
        FROM modelo_plataformas 
        WHERE model_id = cc.model_id
    );

-- 3. Verificar el resultado
SELECT 
    u.email,
    u.name,
    COUNT(mp.id) as portfolio_platforms,
    array_agg(mp.status) as statuses
FROM users u
JOIN modelo_plataformas mp ON u.id = mp.model_id
WHERE u.role = 'modelo'
GROUP BY u.id, u.email, u.name
ORDER BY u.email;
