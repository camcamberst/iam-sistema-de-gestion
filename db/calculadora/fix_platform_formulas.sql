-- =====================================================
-- 🔧 CORREGIR FÓRMULAS DE LAS 25 PLATAFORMAS
-- Actualizar las fórmulas específicas para cada plataforma
-- =====================================================

-- 1. EUR→USD→COP (8 plataformas)
UPDATE calculator_platforms SET 
  formula = 'EUR_USD * 0.84', -- 16% impuesto
  description = 'EUR a USD con 16% impuesto'
WHERE id = 'big7';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD * 0.78', -- 22% descuento
  description = 'EUR a USD con 22% descuento'
WHERE id = 'mondo';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD',
  description = 'EUR a USD directo'
WHERE id = 'modelka';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD',
  description = 'EUR a USD directo'
WHERE id = 'xmodels';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD',
  description = 'EUR a USD directo'
WHERE id = '777';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD',
  description = 'EUR a USD directo'
WHERE id = 'vx';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD',
  description = 'EUR a USD directo'
WHERE id = 'livecreator';

UPDATE calculator_platforms SET 
  formula = 'EUR_USD',
  description = 'EUR a USD directo'
WHERE id = 'mow';

-- 2. USD→USD→COP (9 plataformas)
UPDATE calculator_platforms SET 
  formula = '0.75', -- 25% descuento
  description = 'USD a USD con 25% descuento'
WHERE id = 'cmd';

UPDATE calculator_platforms SET 
  formula = '0.75', -- 25% descuento
  description = 'USD a USD con 25% descuento'
WHERE id = 'camlust';

UPDATE calculator_platforms SET 
  formula = '0.75', -- 25% descuento
  description = 'USD a USD con 25% descuento'
WHERE id = 'skypvt';

UPDATE calculator_platforms SET 
  formula = '1.0', -- Directo
  description = 'USD directo'
WHERE id = 'livejasmin';

UPDATE calculator_platforms SET 
  formula = '1.0', -- Directo
  description = 'USD directo'
WHERE id = 'mdh';

UPDATE calculator_platforms SET 
  formula = '1.0', -- Directo
  description = 'USD directo'
WHERE id = 'imlive';

UPDATE calculator_platforms SET 
  formula = '1.0', -- Directo
  description = 'USD directo'
WHERE id = 'hegre';

UPDATE calculator_platforms SET 
  formula = '1.0', -- Directo
  description = 'USD directo'
WHERE id = 'dirtyfans';

UPDATE calculator_platforms SET 
  formula = '1.0', -- Directo
  description = 'USD directo'
WHERE id = 'camcontacts';

-- 3. GBP→USD→COP (2 plataformas)
UPDATE calculator_platforms SET 
  formula = 'GBP_USD * 0.677', -- 32.3% descuento
  description = 'GBP a USD con 32.3% descuento'
WHERE id = 'aw';

UPDATE calculator_platforms SET 
  formula = 'GBP_USD',
  description = 'GBP a USD directo'
WHERE id = 'babestation';

-- 4. Tokens→USD→COP (4 plataformas)
UPDATE calculator_platforms SET 
  formula = '0.05', -- 100 tokens = 5 USD
  description = 'Tokens a USD (100 tokens = 5 USD)'
WHERE id = 'chaturbate';

UPDATE calculator_platforms SET 
  formula = '0.05', -- 100 tokens = 5 USD
  description = 'Tokens a USD (100 tokens = 5 USD)'
WHERE id = 'myfreecams';

UPDATE calculator_platforms SET 
  formula = '0.05', -- 100 tokens = 5 USD
  description = 'Tokens a USD (100 tokens = 5 USD)'
WHERE id = 'stripchat';

UPDATE calculator_platforms SET 
  formula = '0.60', -- 100 pts = 60 USD
  description = 'Puntos a USD (100 pts = 60 USD)'
WHERE id = 'dxlive';

-- 5. Créditos→USD→COP (1 plataforma)
UPDATE calculator_platforms SET 
  formula = '0.5', -- 50% descuento
  description = 'Créditos con 50% descuento'
WHERE id = 'secretfriends';

-- 6. Pago directo (1 plataforma)
UPDATE calculator_platforms SET 
  formula = '1.0', -- 100% directo
  description = 'Pago directo 100%'
WHERE id = 'superfoon';

-- Verificar que se actualizaron todas las fórmulas
SELECT id, name, formula, description FROM calculator_platforms ORDER BY name;

SELECT 'Fórmulas de plataformas actualizadas exitosamente' as status;
