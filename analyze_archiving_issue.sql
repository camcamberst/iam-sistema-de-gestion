-- =====================================================
-- 🔍 ANÁLISIS DE PROBLEMA DE ARCHIVADO - 15 OCTUBRE 2025
-- =====================================================
-- Script para analizar por qué algunos modelos no tienen valores archivados
-- en el cierre automático de quincena
-- =====================================================

-- 1. VERIFICAR MODELOS CON CONFIGURACIÓN ACTIVA
-- =====================================================

SELECT 
  'MODELOS CON CONFIGURACIÓN ACTIVA' as seccion,
  COUNT(*) as total_configuraciones,
  COUNT(DISTINCT model_id) as modelos_unicos
FROM calculator_config 
WHERE active = true;

-- Detalle de configuraciones activas
SELECT 
  'DETALLE CONFIGURACIONES ACTIVAS' as seccion,
  cc.model_id,
  u.name as modelo,
  u.email,
  cc.active,
  cc.enabled_platforms,
  cc.percentage_override,
  cc.min_quota_override
FROM calculator_config cc
JOIN auth.users u ON u.id = cc.model_id
WHERE cc.active = true
ORDER BY u.name;

-- 2. VERIFICAR VALORES EN MODEL_VALUES PARA LA FECHA DE CIERRE
-- =====================================================

SELECT 
  'VALORES EN MODEL_VALUES PARA 2025-10-15' as seccion,
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as modelos_con_valores,
  SUM(value) as suma_total_valores
FROM model_values 
WHERE period_date = '2025-10-15';

-- Detalle por modelo de valores en model_values
SELECT 
  'DETALLE VALORES POR MODELO - MODEL_VALUES' as seccion,
  mv.model_id,
  u.name as modelo,
  u.email,
  COUNT(mv.id) as cantidad_valores,
  SUM(mv.value) as suma_valores,
  STRING_AGG(DISTINCT mv.platform_id, ', ') as plataformas
FROM model_values mv
JOIN auth.users u ON u.id = mv.model_id
WHERE mv.period_date = '2025-10-15'
GROUP BY mv.model_id, u.name, u.email
ORDER BY suma_valores DESC;

-- 3. VERIFICAR VALORES ARCHIVADOS EN CALCULATOR_HISTORY
-- =====================================================

SELECT 
  'VALORES ARCHIVADOS EN CALCULATOR_HISTORY' as seccion,
  COUNT(*) as total_archivados,
  COUNT(DISTINCT model_id) as modelos_archivados,
  SUM(value) as suma_total_archivados
FROM calculator_history 
WHERE period_date >= '2025-10-01' 
  AND period_date <= '2025-10-15';

-- Detalle por modelo de valores archivados
SELECT 
  'DETALLE VALORES ARCHIVADOS POR MODELO' as seccion,
  ch.model_id,
  u.name as modelo,
  u.email,
  COUNT(ch.id) as cantidad_archivados,
  SUM(ch.value) as suma_archivados,
  STRING_AGG(DISTINCT ch.platform_id, ', ') as plataformas,
  MIN(ch.archived_at) as primer_archivo,
  MAX(ch.archived_at) as ultimo_archivo
FROM calculator_history ch
JOIN auth.users u ON u.id = ch.model_id
WHERE ch.period_date >= '2025-10-01' 
  AND ch.period_date <= '2025-10-15'
GROUP BY ch.model_id, u.name, u.email
ORDER BY suma_archivados DESC;

-- 4. COMPARAR MODELOS CON CONFIGURACIÓN VS MODELOS CON VALORES
-- =====================================================

-- Modelos con configuración pero sin valores
SELECT 
  'MODELOS CON CONFIG PERO SIN VALORES' as seccion,
  cc.model_id,
  u.name as modelo,
  u.email,
  cc.active as config_activa,
  COALESCE(mv_count.valores_count, 0) as valores_en_model_values,
  COALESCE(ch_count.archivados_count, 0) as valores_archivados
FROM calculator_config cc
JOIN auth.users u ON u.id = cc.model_id
LEFT JOIN (
  SELECT model_id, COUNT(*) as valores_count
  FROM model_values 
  WHERE period_date = '2025-10-15'
  GROUP BY model_id
) mv_count ON mv_count.model_id = cc.model_id
LEFT JOIN (
  SELECT model_id, COUNT(*) as archivados_count
  FROM calculator_history 
  WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15'
  GROUP BY model_id
) ch_count ON ch_count.model_id = cc.model_id
WHERE cc.active = true
ORDER BY valores_en_model_values DESC, valores_archivados DESC;

-- 5. IDENTIFICAR MODELOS QUE DEBERÍAN HABER SIDO ARCHIVADOS
-- =====================================================

-- Modelos con valores en model_values pero sin archivado
SELECT 
  'MODELOS CON VALORES NO ARCHIVADOS' as seccion,
  mv.model_id,
  u.name as modelo,
  u.email,
  COUNT(mv.id) as valores_no_archivados,
  SUM(mv.value) as suma_no_archivada,
  STRING_AGG(DISTINCT mv.platform_id, ', ') as plataformas_no_archivadas,
  CASE 
    WHEN cc.active IS NULL THEN 'Sin configuración'
    WHEN cc.active = true THEN 'Configuración activa'
    ELSE 'Configuración inactiva'
  END as estado_configuracion
FROM model_values mv
JOIN auth.users u ON u.id = mv.model_id
LEFT JOIN calculator_config cc ON cc.model_id = mv.model_id
WHERE mv.period_date = '2025-10-15'
  AND NOT EXISTS (
    SELECT 1 FROM calculator_history ch 
    WHERE ch.model_id = mv.model_id 
      AND ch.period_date >= '2025-10-01' 
      AND ch.period_date <= '2025-10-15'
  )
GROUP BY mv.model_id, u.name, u.email, cc.active
ORDER BY suma_no_archivada DESC;

-- 6. VERIFICAR INTEGRIDAD DE DATOS
-- =====================================================

-- Resumen de integridad
SELECT 
  'RESUMEN DE INTEGRIDAD' as seccion,
  (SELECT COUNT(*) FROM calculator_config WHERE active = true) as configuraciones_activas,
  (SELECT COUNT(DISTINCT model_id) FROM model_values WHERE period_date = '2025-10-15') as modelos_con_valores,
  (SELECT COUNT(DISTINCT model_id) FROM calculator_history WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15') as modelos_archivados,
  (SELECT COUNT(*) FROM model_values WHERE period_date = '2025-10-15') as total_valores_hoy,
  (SELECT COUNT(*) FROM calculator_history WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15') as total_archivados;

-- 7. VERIFICAR ERRORES EN EL PROCESO DE ARCHIVADO
-- =====================================================

-- Verificar si hay valores duplicados o problemas de integridad
SELECT 
  'VERIFICACIÓN DE DUPLICADOS' as seccion,
  model_id,
  platform_id,
  period_date,
  COUNT(*) as duplicados
FROM calculator_history 
WHERE period_date >= '2025-10-01' 
  AND period_date <= '2025-10-15'
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1
ORDER BY duplicados DESC;

-- 8. ANÁLISIS DE CAUSAS POSIBLES
-- =====================================================

-- Crear vista de análisis de causas
CREATE OR REPLACE VIEW archiving_analysis AS
SELECT 
  u.id as model_id,
  u.name as modelo,
  u.email,
  CASE WHEN cc.active = true THEN 'Sí' ELSE 'No' END as tiene_config_activa,
  COALESCE(mv_count.valores_count, 0) as valores_en_model_values,
  COALESCE(ch_count.archivados_count, 0) as valores_archivados,
  CASE 
    WHEN cc.active IS NULL THEN 'Sin configuración'
    WHEN cc.active = false THEN 'Configuración inactiva'
    WHEN mv_count.valores_count IS NULL OR mv_count.valores_count = 0 THEN 'Sin valores para archivar'
    WHEN ch_count.archivados_count IS NULL OR ch_count.archivados_count = 0 THEN 'Valores no archivados'
    WHEN mv_count.valores_count = ch_count.archivados_count THEN 'Archivado correctamente'
    ELSE 'Archivado parcial'
  END as estado_archivado,
  CASE 
    WHEN cc.active IS NULL THEN 'Modelo no tiene configuración de calculadora'
    WHEN cc.active = false THEN 'Modelo tiene configuración inactiva'
    WHEN mv_count.valores_count IS NULL OR mv_count.valores_count = 0 THEN 'Modelo no tenía valores para archivar'
    WHEN ch_count.archivados_count IS NULL OR ch_count.archivados_count = 0 THEN 'ERROR: Valores no fueron archivados'
    WHEN mv_count.valores_count = ch_count.archivados_count THEN 'OK: Todos los valores archivados'
    ELSE 'ADVERTENCIA: Archivado parcial'
  END as explicacion
FROM auth.users u
LEFT JOIN calculator_config cc ON cc.model_id = u.id
LEFT JOIN (
  SELECT model_id, COUNT(*) as valores_count
  FROM model_values 
  WHERE period_date = '2025-10-15'
  GROUP BY model_id
) mv_count ON mv_count.model_id = u.id
LEFT JOIN (
  SELECT model_id, COUNT(*) as archivados_count
  FROM calculator_history 
  WHERE period_date >= '2025-10-01' AND period_date <= '2025-10-15'
  GROUP BY model_id
) ch_count ON ch_count.model_id = u.id
WHERE u.role = 'modelo'
ORDER BY 
  CASE 
    WHEN ch_count.archivados_count IS NULL OR ch_count.archivados_count = 0 THEN 1
    WHEN mv_count.valores_count != ch_count.archivados_count THEN 2
    ELSE 3
  END,
  u.name;

-- Mostrar análisis completo
SELECT * FROM archiving_analysis;

-- 9. RECOMENDACIONES BASADAS EN EL ANÁLISIS
-- =====================================================

SELECT 
  'RECOMENDACIONES' as seccion,
  CASE 
    WHEN (SELECT COUNT(*) FROM archiving_analysis WHERE estado_archivado = 'Valores no archivados') > 0 
    THEN 'CRÍTICO: Ejecutar archivado manual para modelos con valores no archivados'
    ELSE 'OK: No hay modelos con valores no archivados'
  END as recomendacion_1,
  CASE 
    WHEN (SELECT COUNT(*) FROM calculator_config WHERE active = true) = 0 
    THEN 'CRÍTICO: No hay configuraciones activas'
    ELSE 'OK: Hay configuraciones activas'
  END as recomendacion_2,
  CASE 
    WHEN (SELECT COUNT(*) FROM model_values WHERE period_date = '2025-10-15') = 0 
    THEN 'INFO: No había valores para archivar'
    ELSE 'OK: Había valores para archivar'
  END as recomendacion_3;

-- Comentarios finales
COMMENT ON VIEW archiving_analysis IS 'Análisis completo del estado de archivado de modelos en el cierre de quincena del 15 octubre 2025';
