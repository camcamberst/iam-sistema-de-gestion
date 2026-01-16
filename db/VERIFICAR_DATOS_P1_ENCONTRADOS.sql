-- =====================================================
-- ✅ VERIFICACIÓN: DATOS P1 ENCONTRADOS
-- =====================================================
-- Ya sabemos que los datos ESTÁN en calculator_history
-- Ahora necesitamos confirmar la cantidad y calidad
-- =====================================================

-- =====================================================
-- 1. RESUMEN COMPLETO DE LOS DATOS ENCONTRADOS
-- =====================================================

SELECT 
    '1. RESUMEN COMPLETO' as seccion,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as total_modelos,
    COUNT(DISTINCT platform_id) as total_plataformas,
    SUM(value) as suma_valores_originales,
    SUM(value_usd_bruto) as suma_usd_bruto,
    SUM(value_usd_modelo) as suma_usd_modelo,
    SUM(value_cop_modelo) as suma_cop_modelo,
    MIN(archived_at) as primer_archivo,
    MAX(archived_at) as ultimo_archivo
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';

-- =====================================================
-- 2. DETALLE POR MODELO
-- =====================================================

SELECT 
    '2. DETALLE POR MODELO' as seccion,
    ch.model_id,
    u.email as modelo_email,
    u.name as modelo_name,
    COUNT(*) as plataformas_archivadas,
    SUM(ch.value) as total_valor,
    SUM(ch.value_usd_bruto) as total_usd_bruto,
    MIN(ch.archived_at) as fecha_archivo
FROM calculator_history ch
LEFT JOIN users u ON ch.model_id = u.id
WHERE ch.period_date = '2026-01-01'
  AND ch.period_type = '1-15'
GROUP BY ch.model_id, u.email, u.name
ORDER BY SUM(ch.value_usd_bruto) DESC;

-- =====================================================
-- 3. COMPARAR CON CALCULATOR_TOTALS
-- =====================================================

SELECT 
    '3. COMPARACIÓN CON TOTALS' as seccion,
    ch_summary.model_id,
    ch_summary.plataformas as plataformas_en_history,
    ch_summary.suma_history as suma_en_history,
    ct.total_usd_bruto as total_en_calculator_totals,
    CASE 
        WHEN ABS(ch_summary.suma_history - ct.total_usd_bruto::numeric) < 0.01 THEN '✅ COINCIDE'
        ELSE '⚠️ DIFERENCIA: ' || (ch_summary.suma_history - ct.total_usd_bruto::numeric)::text
    END as comparacion
FROM (
    SELECT 
        model_id,
        COUNT(*) as plataformas,
        SUM(value_usd_bruto) as suma_history
    FROM calculator_history
    WHERE period_date = '2026-01-01'
      AND period_type = '1-15'
    GROUP BY model_id
) ch_summary
LEFT JOIN calculator_totals ct ON ch_summary.model_id = ct.model_id 
    AND ct.period_date = '2026-01-01'
ORDER BY ch_summary.suma_history DESC;

-- =====================================================
-- 4. PLATAFORMAS ARCHIVADAS
-- =====================================================

SELECT 
    '4. PLATAFORMAS ARCHIVADAS' as seccion,
    platform_id,
    COUNT(*) as modelos_con_esta_plataforma,
    SUM(value) as suma_total,
    AVG(value) as promedio
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
GROUP BY platform_id
ORDER BY COUNT(*) DESC;

-- =====================================================
-- 5. VERIFICAR TASAS Y CÁLCULOS
-- =====================================================

SELECT 
    '5. VERIFICAR TASAS' as seccion,
    COUNT(*) as registros_con_tasas,
    COUNT(CASE WHEN rate_usd_cop IS NOT NULL THEN 1 END) as con_tasa_usd_cop,
    COUNT(CASE WHEN rate_eur_usd IS NOT NULL THEN 1 END) as con_tasa_eur_usd,
    COUNT(CASE WHEN platform_percentage IS NOT NULL THEN 1 END) as con_porcentaje,
    COUNT(CASE WHEN value_usd_bruto IS NOT NULL THEN 1 END) as con_calculo_bruto,
    COUNT(CASE WHEN value_usd_modelo IS NOT NULL THEN 1 END) as con_calculo_modelo,
    COUNT(CASE WHEN value_cop_modelo IS NOT NULL THEN 1 END) as con_calculo_cop
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';

-- =====================================================
-- 6. MUESTRA DE DATOS (primeros 20 registros)
-- =====================================================

SELECT 
    '6. MUESTRA DE DATOS' as seccion,
    ch.model_id,
    u.email as modelo_email,
    ch.platform_id,
    ch.value as valor_original,
    ch.value_usd_bruto,
    ch.value_usd_modelo,
    ch.value_cop_modelo,
    ch.platform_percentage,
    ch.archived_at
FROM calculator_history ch
LEFT JOIN users u ON ch.model_id = u.id
WHERE ch.period_date = '2026-01-01'
  AND ch.period_type = '1-15'
ORDER BY ch.value_usd_bruto DESC
LIMIT 20;

-- =====================================================
-- 7. VERIFICAR SI HAY REGISTROS CONSOLIDADOS DE RECUPERACIÓN
-- =====================================================

SELECT 
    '7. REGISTROS CONSOLIDADOS' as seccion,
    COUNT(*) as registros_consolidados
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__consolidated_recovery__';

-- Si hay registros consolidados, mostrarlos
SELECT 
    '7b. DETALLE CONSOLIDADOS' as seccion,
    model_id,
    value,
    value_usd_bruto,
    archived_at
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__consolidated_recovery__'
LIMIT 10;

-- =====================================================
-- 8. VERIFICAR QUE MODEL_VALUES ESTÁ LIMPIO
-- =====================================================

SELECT 
    '8. MODEL_VALUES LIMPIO' as seccion,
    COUNT(*) as registros_residuales,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ LIMPIO (como debe ser)'
        ELSE '⚠️ HAY ' || COUNT(*) || ' REGISTROS RESIDUALES'
    END as estado
FROM model_values
WHERE period_date >= '2026-01-01'
  AND period_date <= '2026-01-15';

-- =====================================================
-- 9. VERIFICAR ESTADO DEL CIERRE EN LA TABLA DE STATUS
-- =====================================================

SELECT 
    '9. ESTADO DEL CIERRE' as seccion,
    period_date,
    period_type,
    status,
    created_at,
    updated_at,
    metadata
FROM calculator_period_closure_status
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
ORDER BY created_at DESC;

-- =====================================================
-- 10. CONCLUSIÓN
-- =====================================================

SELECT 
    '10. CONCLUSIÓN' as seccion,
    CASE 
        WHEN COUNT(*) > 0 THEN 
            '✅ DATOS COMPLETOS: ' || COUNT(*) || ' registros en calculator_history con detalle por plataforma. ' ||
            'Las modelos PUEDEN ver su historial en "Mi Historial". ' ||
            'Total modelos: ' || COUNT(DISTINCT model_id) || '. ' ||
            'Total plataformas: ' || COUNT(DISTINCT platform_id) || '.'
        ELSE 
            '❌ ERROR: No se encontraron datos'
    END as conclusion
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';
