-- =====================================================
-- 📊 PLATAFORMAS COMPLETAS (25 plataformas)
-- Actualizar tabla calculator_platforms con todas las plataformas
-- =====================================================

-- Limpiar plataformas existentes
DELETE FROM calculator_platforms;

-- Insertar todas las 25 plataformas
INSERT INTO calculator_platforms (id, name, description, currency, token_rate, discount_factor, tax_rate, direct_payout) VALUES

-- EUR→USD→COP (8 plataformas)
('big7', 'BIG7', 'EUR a USD con 16% impuesto', 'EUR', NULL, NULL, 0.16, FALSE),
('mondo', 'MONDO', 'EUR a USD con factor 0.78', 'EUR', NULL, 0.78, NULL, FALSE),
('modelka', 'MODELKA', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('xmodels', 'XMODELS', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('777', '777', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('vx', 'VX', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('livecreator', 'LIVECREATOR', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('mow', 'MOW', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),

-- USD→USD→COP (9 plataformas)
('cmd', 'CMD', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('camlust', 'CAMLUST', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('skypvt', 'SKYPVT', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('livejasmin', 'LIVEJASMIN', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('mdh', 'MDH', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('imlive', 'IMLIVE', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('hegre', 'HEGRE', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('dirtyfans', 'DIRTYFANS', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('camcontacts', 'CAMCONTACTS', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),

-- GBP→USD→COP (2 plataformas)
('aw', 'AW', 'GBP a USD con factor 0.677', 'GBP', NULL, 0.677, NULL, FALSE),
('babestation', 'BABESTATION', 'GBP a USD', 'GBP', NULL, NULL, NULL, FALSE),

-- Tokens→USD→COP (4 plataformas)
('chaturbate', 'Chaturbate', 'Tokens a USD (100 tokens = 5 USD)', 'USD', 0.05, NULL, NULL, FALSE),
('myfreecams', 'MyFreeCams', 'Tokens a USD (100 tokens = 5 USD)', 'USD', 0.05, NULL, NULL, FALSE),
('stripchat', 'Stripchat', 'Tokens a USD (100 tokens = 5 USD)', 'USD', 0.05, NULL, NULL, FALSE),
('dxlive', 'DX Live', 'Puntos a USD (100 pts = 60 USD)', 'USD', 0.60, NULL, NULL, FALSE),

-- Créditos→USD→COP (1 plataforma)
('secretfriends', 'SECRETFRIENDS', 'Créditos con factor 0.5', 'USD', NULL, 0.5, NULL, FALSE),

-- Pago directo (1 plataforma)
('superfoon', 'SUPERFOON', 'Pago directo 100%', 'USD', NULL, NULL, NULL, TRUE);

-- Verificar que se insertaron todas las plataformas
SELECT COUNT(*) as total_platforms FROM calculator_platforms;
SELECT id, name, currency, discount_factor, tax_rate, direct_payout FROM calculator_platforms ORDER BY name;
