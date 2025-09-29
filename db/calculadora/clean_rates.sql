-- =====================================================
-- 🧹 LIMPIAR TODAS LAS TASAS EXISTENTES
-- =====================================================
-- Eliminar todas las tasas para empezar limpio
-- =====================================================

-- 1. Eliminar todas las tasas existentes
DELETE FROM rates;

-- 2. Verificar que la tabla esté vacía
SELECT COUNT(*) as total_rates FROM rates;

-- 3. Insertar tasas por defecto para personalización
INSERT INTO rates (
  scope,
  kind,
  value_raw,
  adjustment,
  value_effective,
  source,
  author_id,
  valid_from,
  valid_to,
  period_base,
  created_at
) VALUES 
-- USD → COP (Tasa por defecto para personalizar)
(
  'global',
  'USD_COP',
  4000.00,
  -200.00,
  3800.00,
  'manual',
  null,
  now(),
  null,
  false,
  now()
),
-- EUR → USD (Tasa por defecto para personalizar)
(
  'global',
  'EUR_USD',
  1.10,
  0.00,
  1.10,
  'manual',
  null,
  now(),
  null,
  false,
  now()
),
-- GBP → USD (Tasa por defecto para personalizar)
(
  'global',
  'GBP_USD',
  1.25,
  0.00,
  1.25,
  'manual',
  null,
  now(),
  null,
  false,
  now()
);

-- 4. Verificar las tasas por defecto insertadas
SELECT 
  kind,
  scope,
  value_effective,
  source,
  valid_from
FROM rates 
ORDER BY kind;
