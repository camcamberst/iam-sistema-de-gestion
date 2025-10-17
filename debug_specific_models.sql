-- =====================================================
-- DEBUG: INVESTIGAR MODELOS ESPECÍFICOS CON VALORES EN 0
-- =====================================================

-- 1. Verificar datos en calculator_history para octubre 16, 2025
SELECT 
    'calculator_history' as tabla,
    ch.model_id,
    u.email,
    ch.platform_id,
    ch.value,
    ch.period_date,
    ch.period_type,
    ch.archived_at
FROM calculator_history ch
JOIN users u ON ch.model_id = u.id
WHERE u.email IN ('angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com')
  AND ch.period_date = '2025-10-16'
ORDER BY u.email, ch.platform_id;

-- 2. Verificar datos en calculator_totals para octubre 16, 2025
SELECT 
    'calculator_totals' as tabla,
    ct.model_id,
    u.email,
    ct.total_usd_bruto,
    ct.total_usd_modelo,
    ct.total_cop_modelo,
    ct.period_date,
    ct.updated_at
FROM calculator_totals ct
JOIN users u ON ct.model_id = u.id
WHERE u.email IN ('angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com')
  AND ct.period_date = '2025-10-16'
ORDER BY u.email;

-- 3. Verificar datos en model_values para octubre 16, 2025
SELECT 
    'model_values' as tabla,
    mv.model_id,
    u.email,
    mv.platform_id,
    mv.value,
    mv.period_date,
    mv.updated_at
FROM model_values mv
JOIN users u ON mv.model_id = u.id
WHERE u.email IN ('angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com')
  AND mv.period_date = '2025-10-16'
ORDER BY u.email, mv.platform_id;

-- 4. Verificar si hay datos en otros períodos para estos modelos
SELECT 
    'calculator_history_otros_periodos' as tabla,
    ch.model_id,
    u.email,
    ch.platform_id,
    ch.value,
    ch.period_date,
    ch.period_type,
    ch.archived_at
FROM calculator_history ch
JOIN users u ON ch.model_id = u.id
WHERE u.email IN ('angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com')
  AND ch.period_date >= '2025-10-01'
ORDER BY u.email, ch.period_date, ch.platform_id;

-- 5. Verificar si hay datos en calculator_totals en otros períodos
SELECT 
    'calculator_totals_otros_periodos' as tabla,
    ct.model_id,
    u.email,
    ct.total_usd_bruto,
    ct.total_usd_modelo,
    ct.total_cop_modelo,
    ct.period_date,
    ct.updated_at
FROM calculator_totals ct
JOIN users u ON ct.model_id = u.id
WHERE u.email IN ('angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com')
  AND ct.period_date >= '2025-10-01'
ORDER BY u.email, ct.period_date;

-- 6. Verificar si hay datos en model_values en otros períodos
SELECT 
    'model_values_otros_periodos' as tabla,
    mv.model_id,
    u.email,
    mv.platform_id,
    mv.value,
    mv.period_date,
    mv.updated_at
FROM model_values mv
JOIN users u ON mv.model_id = u.id
WHERE u.email IN ('angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com')
  AND mv.period_date >= '2025-10-01'
ORDER BY u.email, mv.period_date, mv.platform_id;
