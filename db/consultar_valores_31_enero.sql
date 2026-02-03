-- =====================================================
-- Valores registrados el 31 de enero 2026
-- =====================================================
-- Ejecuta en Supabase SQL Editor.
-- =====================================================

-- 1) Resumen: cuántos registros y modelos
SELECT
  'model_values (31 ene)' AS origen,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) AS modelos,
  COUNT(DISTINCT platform_id) AS plataformas
FROM model_values
WHERE period_date = '2026-01-31'::date;

-- 2) Total por modelo (suma de value)
SELECT
  mv.model_id,
  u.name AS modelo_nombre,
  u.email AS modelo_email,
  COUNT(*) AS plataformas_con_valor,
  SUM(COALESCE(mv.value, 0)::numeric) AS total_value
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
WHERE mv.period_date = '2026-01-31'::date
GROUP BY mv.model_id, u.name, u.email
ORDER BY total_value DESC;

-- 3) Detalle por modelo y plataforma (primeros 100)
SELECT
  mv.model_id,
  u.name AS modelo_nombre,
  mv.platform_id,
  mv.value,
  mv.updated_at
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
WHERE mv.period_date = '2026-01-31'::date
ORDER BY mv.model_id, mv.platform_id
LIMIT 100;
