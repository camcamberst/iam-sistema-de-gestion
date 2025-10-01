-- =====================================================
-- 🧹 SCRIPT DE LIMPIEZA DE DATOS DE PRUEBA
-- =====================================================
-- Este script elimina datos de prueba de anticipos y calculadora
-- MANTIENE: usuarios, períodos, configuración de plataformas
-- ELIMINA: anticipos, valores de calculadora

-- =====================================================
-- 1. ELIMINAR ANTICIPOS DE PRUEBA
-- =====================================================
DELETE FROM anticipos 
WHERE created_at >= '2025-09-30'::date;

-- =====================================================
-- 2. ELIMINAR VALORES DE CALCULADORA DE PRUEBA
-- =====================================================
DELETE FROM model_values 
WHERE created_at >= '2025-09-30'::date;

-- =====================================================
-- 3. VERIFICAR LIMPIEZA
-- =====================================================
-- Verificar que no quedan anticipos
SELECT 
  'Anticipos restantes' as tabla,
  COUNT(*) as cantidad
FROM anticipos;

-- Verificar que no quedan valores de calculadora
SELECT 
  'Valores calculadora restantes' as tabla,
  COUNT(*) as cantidad
FROM model_values;

-- =====================================================
-- 4. MOSTRAR ESTRUCTURA LIMPIA
-- =====================================================
-- Mostrar períodos disponibles
SELECT 
  'Períodos disponibles' as info,
  COUNT(*) as cantidad
FROM periods;

-- Mostrar plataformas configuradas
SELECT 
  'Plataformas configuradas' as info,
  COUNT(*) as cantidad
FROM calculator_platforms;

-- Mostrar usuarios activos
SELECT 
  'Usuarios activos' as info,
  COUNT(*) as cantidad
FROM users;

-- =====================================================
-- ✅ LIMPIEZA COMPLETADA
-- =====================================================
-- El sistema está listo para nuevas pruebas
-- - Anticipos eliminados
-- - Valores de calculadora limpiados
-- - Estructura preservada
