-- =====================================================
-- 🔧 FIX: Verificar y poblar tabla calculator_platforms
-- =====================================================

-- 1. Verificar si la tabla existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms') 
    THEN 'Tabla calculator_platforms existe'
    ELSE 'Tabla calculator_platforms NO existe'
  END as tabla_status;

-- 2. Verificar cuántas plataformas hay
SELECT COUNT(*) as total_platforms FROM calculator_platforms;

-- 3. Ver las plataformas existentes
SELECT id, name, currency, active FROM calculator_platforms ORDER BY name;

-- 4. Si no hay plataformas, insertar las 25 plataformas completas
INSERT INTO calculator_platforms (id, name, description, currency, token_rate, discount_factor, tax_rate, direct_payout, active) VALUES

-- EUR→USD→COP (8 plataformas)
('big7', 'BIG7', 'EUR a USD con 16% impuesto', 'EUR', NULL, NULL, 0.16, FALSE, TRUE),
('mondo', 'MONDO', 'EUR a USD con factor 0.78', 'EUR', NULL, 0.78, NULL, FALSE, TRUE),
('modelka', 'MODELKA', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE, TRUE),
('xmodels', 'XMODELS', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE, TRUE),
('777', '777', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE, TRUE),
('vx', 'VX', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE, TRUE),
('livecreator', 'LIVECREATOR', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE, TRUE),
('mow', 'MOW', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE, TRUE),

-- USD→USD→COP (9 plataformas)
('cmd', 'CMD', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE, TRUE),
('camlust', 'CAMLUST', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE, TRUE),
('skypvt', 'SKYPVT', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE, TRUE),
('livejasmin', 'LIVEJASMIN', 'USD directo', 'USD', NULL, NULL, NULL, FALSE, TRUE),
('mdh', 'MDH', 'USD directo', 'USD', NULL, NULL, NULL, FALSE, TRUE),
('imlive', 'IMLIVE', 'USD directo', 'USD', NULL, NULL, NULL, FALSE, TRUE),
('hegre', 'HEGRE', 'USD directo', 'USD', NULL, NULL, NULL, FALSE, TRUE),
('dirtyfans', 'DIRTYFANS', 'USD directo', 'USD', NULL, NULL, NULL, FALSE, TRUE),
('camcontacts', 'CAMCONTACTS', 'USD directo', 'USD', NULL, NULL, NULL, FALSE, TRUE),

-- GBP→USD→COP (2 plataformas)
('aw', 'AW', 'GBP a USD con factor 0.677', 'GBP', NULL, 0.677, NULL, FALSE, TRUE),
('babestation', 'BABESTATION', 'GBP a USD', 'GBP', NULL, NULL, NULL, FALSE, TRUE),

-- Tokens→USD→COP (4 plataformas)
('chaturbate', 'Chaturbate', 'Tokens a USD (5 centavos por token)', 'USD', 0.05, NULL, NULL, FALSE, TRUE),
('myfreecams', 'MyFreeCams', 'Tokens a USD (5 centavos por token)', 'USD', 0.05, NULL, NULL, FALSE, TRUE),
('stripchat', 'Stripchat', 'Tokens a USD (5 centavos por token)', 'USD', 0.05, NULL, NULL, FALSE, TRUE),
('dxlive', 'DX Live', 'Puntos a USD (60 centavos por 100 pts)', 'USD', 0.60, NULL, NULL, FALSE, TRUE),

-- Créditos→USD→COP (2 plataformas)
('secretfriends', 'SECRETFRIENDS', 'Créditos con factor 0.5', 'USD', NULL, 0.5, NULL, FALSE, TRUE),
('superfoon', 'SUPERFOON', 'Pago directo 100%', 'USD', NULL, NULL, NULL, TRUE, TRUE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  currency = EXCLUDED.currency,
  token_rate = EXCLUDED.token_rate,
  discount_factor = EXCLUDED.discount_factor,
  tax_rate = EXCLUDED.tax_rate,
  direct_payout = EXCLUDED.direct_payout,
  active = EXCLUDED.active;

-- 5. Verificar resultado final
SELECT COUNT(*) as total_platforms_after FROM calculator_platforms WHERE active = true;
SELECT id, name, currency FROM calculator_platforms WHERE active = true ORDER BY name;
