-- =====================================================
-- 🔧 CORREGIR FÓRMULA DE SUPERFOON EN BASE DE DATOS
-- =====================================================
-- Problema: Superfoon debe ser EUR, no USD
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
