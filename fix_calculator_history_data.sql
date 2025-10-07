-- =====================================================
-- 🧹 LIMPIAR DATOS FALSOS DE CALCULATOR_HISTORY
-- =====================================================
-- Este script elimina datos incorrectos del historial
-- MANTIENE: estructura de tabla y permisos
-- ELIMINA: datos falsos y de prueba

-- =====================================================
-- 1. VERIFICAR DATOS ACTUALES
-- =====================================================
SELECT 
  'Datos actuales en calculator_history' as info,
  COUNT(*) as cantidad,
  MIN(archived_at) as primer_archivo,
  MAX(archived_at) as ultimo_archivo
FROM calculator_history;

-- Mostrar todos los datos para verificar
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  period_type,
  archived_at
FROM calculator_history 
ORDER BY archived_at DESC;

-- =====================================================
-- 2. ELIMINAR DATOS FALSOS (EJECUTAR SOLO SI ES NECESARIO)
-- =====================================================
-- ⚠️ CUIDADO: Este comando elimina TODOS los datos del historial
-- DELETE FROM calculator_history;

-- =====================================================
-- 3. VERIFICAR LIMPIEZA
-- =====================================================
SELECT 
  'Datos restantes después de limpieza' as info,
  COUNT(*) as cantidad
FROM calculator_history;

-- =====================================================
-- 4. VERIFICAR MODEL_VALUES (DATOS CORRECTOS)
-- =====================================================
SELECT 
  'Datos actuales en model_values' as info,
  COUNT(*) as cantidad,
  SUM(value) as total_value,
  MIN(updated_at) as primera_actualizacion,
  MAX(updated_at) as ultima_actualizacion
FROM model_values;

-- Mostrar valores por plataforma
SELECT 
  platform_id,
  value,
  updated_at
FROM model_values 
ORDER BY updated_at DESC;

-- =====================================================
-- ✅ LIMPIEZA COMPLETADA
-- =====================================================
-- El historial estará limpio y listo para datos reales
-- - Datos falsos eliminados
-- - Estructura preservada
-- - Permisos mantenidos
