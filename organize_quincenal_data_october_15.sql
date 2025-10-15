-- =====================================================
-- 📊 ORGANIZACIÓN DE DATOS QUINCENALES - 15 OCTUBRE 2025
-- =====================================================
-- Fecha: 15 de octubre 2025, 6:41 PM Colombia
-- Hora de corte: 17:00 Colombia (ya pasó)
-- Acción: Cierre automático de quincena 1 (días 1-15)
-- =====================================================

-- 1. VERIFICAR DATOS DE LA QUINCENA CERRADA (1-15 OCTUBRE)
-- =====================================================

-- Verificar valores archivados en calculator_history para la quincena 1
SELECT 
  'QUINCENA 1 (1-15 OCTUBRE) - DATOS ARCHIVADOS' as seccion,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_activas,
  COUNT(DISTINCT platform_id) as plataformas_activas,
  SUM(value) as total_valores,
  MIN(period_date) as fecha_inicio,
  MAX(period_date) as fecha_fin
FROM calculator_history 
WHERE period_date >= '2025-10-01' 
  AND period_date <= '2025-10-15';

-- Detalle por modelo de la quincena cerrada
SELECT 
  'DETALLE POR MODELO - QUINCENA 1' as seccion,
  u.name as modelo,
  u.email,
  COUNT(ch.id) as registros_archivados,
  SUM(ch.value) as total_valores,
  COUNT(DISTINCT ch.platform_id) as plataformas_activas
FROM calculator_history ch
JOIN auth.users u ON u.id = ch.model_id
WHERE ch.period_date >= '2025-10-01' 
  AND ch.period_date <= '2025-10-15'
GROUP BY u.id, u.name, u.email
ORDER BY total_valores DESC;

-- 2. VERIFICAR QUE MODEL_VALUES ESTÉ LIMPIO PARA NUEVO PERÍODO
-- =====================================================

-- Verificar valores actuales (deben estar en 0 o vacíos)
SELECT 
  'VALORES ACTUALES - DEBEN ESTAR LIMPIOS' as seccion,
  COUNT(*) as registros_actuales,
  COUNT(DISTINCT model_id) as modelos_con_valores,
  SUM(value) as total_valores_actuales
FROM model_values 
WHERE period_date = '2025-10-15';

-- Detalle de valores actuales por modelo
SELECT 
  'DETALLE VALORES ACTUALES' as seccion,
  u.name as modelo,
  u.email,
  COUNT(mv.id) as registros_actuales,
  SUM(mv.value) as total_valores_actuales
FROM model_values mv
JOIN auth.users u ON u.id = mv.model_id
WHERE mv.period_date = '2025-10-15'
GROUP BY u.id, u.name, u.email
ORDER BY total_valores_actuales DESC;

-- 3. VERIFICAR ESTADÍSTICAS QUINCENALES
-- =====================================================

-- Verificar si se crearon estadísticas quincenales
SELECT 
  'ESTADÍSTICAS QUINCENALES CREADAS' as seccion,
  COUNT(*) as total_estadisticas,
  COUNT(DISTINCT model_id) as modelos_con_estadisticas,
  COUNT(DISTINCT platform_id) as plataformas_con_estadisticas,
  SUM(daily_avg_usd) as promedio_diario_total,
  SUM(total_usd_modelo) as total_usd_modelo_quincena
FROM platform_quincenal_stats 
WHERE quincena = '2025-10-1'  -- Quincena 1 de octubre
  AND period_start = '2025-10-01'
  AND period_end = '2025-10-15';

-- 4. VERIFICAR GANANCIAS DIARIAS ARCHIVADAS
-- =====================================================

-- Verificar ganancias diarias de la quincena cerrada
SELECT 
  'GANANCIAS DIARIAS ARCHIVADAS' as seccion,
  COUNT(*) as total_ganancias_diarias,
  COUNT(DISTINCT model_id) as modelos_con_ganancias,
  SUM(earnings_amount) as total_ganancias_quincena,
  AVG(earnings_amount) as promedio_ganancias_por_dia
FROM daily_earnings 
WHERE earnings_date >= '2025-10-01' 
  AND earnings_date <= '2025-10-15';

-- 5. VERIFICAR TOTALES CONSOLIDADOS
-- =====================================================

-- Verificar totales consolidados de la quincena
SELECT 
  'TOTALES CONSOLIDADOS QUINCENA 1' as seccion,
  COUNT(*) as total_registros_totales,
  COUNT(DISTINCT model_id) as modelos_con_totales,
  SUM(total_usd_bruto) as total_usd_bruto_quincena,
  SUM(total_usd_modelo) as total_usd_modelo_quincena,
  SUM(total_cop_modelo) as total_cop_modelo_quincena
FROM calculator_totals 
WHERE period_date >= '2025-10-01' 
  AND period_date <= '2025-10-15';

-- 6. RESUMEN DE ORGANIZACIÓN
-- =====================================================

-- Crear vista resumen de la organización
CREATE OR REPLACE VIEW quincenal_organization_summary AS
SELECT 
  'RESUMEN ORGANIZACIÓN QUINCENA 1' as titulo,
  '2025-10-01 a 2025-10-15' as periodo,
  '15 de octubre 2025, 17:00 Colombia' as hora_cierre,
  (SELECT COUNT(*) FROM calculator_history WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15') as registros_archivados,
  (SELECT COUNT(DISTINCT model_id) FROM calculator_history WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15') as modelos_archivadas,
  (SELECT COUNT(*) FROM model_values WHERE period_date = '2025-10-15') as valores_actuales_limpios,
  (SELECT COUNT(*) FROM platform_quincenal_stats WHERE quincena = '2025-10-1') as estadisticas_quincenales,
  'Próximo cierre: 30 octubre 2025, 17:00 Colombia' as proximo_cierre;

-- Mostrar resumen
SELECT * FROM quincenal_organization_summary;

-- 7. VERIFICAR INTEGRIDAD DE DATOS
-- =====================================================

-- Verificar que no haya inconsistencias
SELECT 
  'VERIFICACIÓN DE INTEGRIDAD' as seccion,
  CASE 
    WHEN (SELECT COUNT(*) FROM model_values WHERE period_date = '2025-10-15' AND value > 0) = 0 
    THEN '✅ Valores actuales limpios correctamente'
    ELSE '❌ Aún hay valores en model_values para el día 15'
  END as estado_valores_actuales,
  CASE 
    WHEN (SELECT COUNT(*) FROM calculator_history WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15') > 0 
    THEN '✅ Datos archivados correctamente'
    ELSE '❌ No se encontraron datos archivados'
  END as estado_archivo,
  CASE 
    WHEN (SELECT COUNT(*) FROM platform_quincenal_stats WHERE quincena = '2025-10-1') > 0 
    THEN '✅ Estadísticas quincenales creadas'
    ELSE '⚠️ No se encontraron estadísticas quincenales'
  END as estado_estadisticas;

-- 8. LIMPIAR DATOS TEMPORALES SI ES NECESARIO
-- =====================================================

-- Solo ejecutar si hay valores residuales en model_values para el día 15
-- (Esto debería estar vacío después del cierre automático)
/*
DELETE FROM model_values 
WHERE period_date = '2025-10-15' 
  AND value > 0;
*/

-- 9. PREPARAR PARA PRÓXIMA QUINCENA
-- =====================================================

-- Verificar que el sistema esté listo para la quincena 2 (16-31 octubre)
SELECT 
  'PREPARACIÓN QUINCENA 2' as seccion,
  '2025-10-16 a 2025-10-31' as proximo_periodo,
  '30 de octubre 2025, 17:00 Colombia' as proximo_cierre,
  (SELECT COUNT(*) FROM calculator_config WHERE active = true) as configuraciones_activas,
  (SELECT COUNT(*) FROM calculator_platforms WHERE active = true) as plataformas_activas;

-- Comentarios finales
COMMENT ON VIEW quincenal_organization_summary IS 'Resumen de la organización de datos de la quincena 1 (1-15 octubre 2025)';
