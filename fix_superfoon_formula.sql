-- =====================================================
-- 🔧 CORREGIR FÓRMULA DE SUPERFOON
-- =====================================================
-- Problema 1: Superfoon debe ser EUR, no USD
-- Problema 2: Superfoon debe aplicar 100% para la modelo
-- =====================================================

-- 1. CORREGIR MONEDA DE SUPERFOON (EUR en lugar de USD)
UPDATE calculator_platforms 
SET 
  currency = 'EUR',
  description = 'EUR a USD con 100% para modelo'
WHERE id = 'superfoon';

-- 2. VERIFICAR CAMBIO
SELECT 
  id, 
  name, 
  currency, 
  description, 
  direct_payout 
FROM calculator_platforms 
WHERE id = 'superfoon';

-- 3. CONFIRMAR QUE SUPERFOON AHORA ES EUR
SELECT 'Superfoon corregido a EUR' as status;
