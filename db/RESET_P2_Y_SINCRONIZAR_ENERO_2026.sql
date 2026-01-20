-- 🔄 RESET COMPLETO: Limpiar P2 + Sincronizar calculator_totals
-- Este script hace 2 cosas:
-- 1. Limpia model_values de P2
-- 2. Limpia calculator_totals de P2 para sincronizar con el resumen de facturación

-- ==========================================
-- PASO 1: Ver qué hay actualmente en P2
-- ==========================================
SELECT 
  'Valores actuales en P2 (model_values)' as tipo,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  COUNT(DISTINCT platform_id) as plataformas,
  ROUND(SUM(value)::numeric, 2) as suma_total
FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

SELECT 
  'Totales actuales en P2 (calculator_totals)' as tipo,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  ROUND(SUM(total_usd_bruto)::numeric, 2) as suma_usd_bruto,
  ROUND(SUM(total_usd_modelo)::numeric, 2) as suma_usd_modelo,
  ROUND(SUM(total_cop_modelo)::numeric, 0) as suma_cop_modelo
FROM calculator_totals
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 2: ELIMINAR VALORES DE P2 EN model_values
-- ==========================================
DELETE FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 3: ELIMINAR TOTALES DE P2 EN calculator_totals
-- ==========================================
-- IMPORTANTE: También eliminamos los totales para que el resumen
-- de facturación no muestre datos desincronizados

DELETE FROM calculator_totals
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 4: Verificar limpieza completa
-- ==========================================
SELECT 
  'Valores P2 después de limpieza (model_values)' as tipo,
  COUNT(*) as registros
FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';
-- Debe devolver: 0

SELECT 
  'Totales P2 después de limpieza (calculator_totals)' as tipo,
  COUNT(*) as registros
FROM calculator_totals
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';
-- Debe devolver: 0

-- ==========================================
-- PASO 5: Verificar que P1 sigue intacto
-- ==========================================
SELECT 
  'Valores de P1 (sin cambios - model_values)' as tipo,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  ROUND(SUM(value)::numeric, 2) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-15';

SELECT 
  'Totales de P1 (sin cambios - calculator_totals)' as tipo,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  ROUND(SUM(total_usd_bruto)::numeric, 2) as suma_usd_bruto,
  ROUND(SUM(total_usd_modelo)::numeric, 2) as suma_usd_modelo
FROM calculator_totals
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-15';

-- ==========================================
-- RESULTADO ESPERADO:
-- ==========================================
-- model_values P2: 0 registros
-- calculator_totals P2: 0 registros
-- model_values P1: ~2000 registros (sin cambios)
-- calculator_totals P1: ~34 registros (sin cambios)

SELECT '✅ P2 RESETEADO COMPLETAMENTE - Calculadora y Resumen de Facturación sincronizados' as resultado;
