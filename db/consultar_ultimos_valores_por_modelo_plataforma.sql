-- =====================================================
-- Últimos valores registrados por modelo y plataforma
-- =====================================================
-- Una fila por (modelo, plataforma): la más reciente por updated_at.
-- Ejecuta en Supabase SQL Editor.
-- =====================================================

-- Opción 1: DISTINCT ON — una fila por (model_id, platform_id), todos los días
SELECT DISTINCT ON (mv.model_id, mv.platform_id)
  mv.model_id,
  u.name AS modelo_nombre,
  u.email AS modelo_email,
  mv.platform_id,
  mv.value,
  mv.period_date,
  mv.updated_at AS ultima_actualizacion
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
ORDER BY mv.model_id, mv.platform_id, mv.updated_at DESC NULLS LAST;

-- Opción 2: Con cantidad de registros históricos por (modelo, plataforma)
SELECT DISTINCT ON (mv.model_id, mv.platform_id)
  mv.model_id,
  u.name AS modelo_nombre,
  mv.platform_id,
  mv.value AS ultimo_valor,
  mv.period_date AS ultimo_period_date,
  mv.updated_at AS ultima_actualizacion,
  cnt.total_registros
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
LEFT JOIN (
  SELECT model_id, platform_id, COUNT(*) AS total_registros
  FROM model_values
  GROUP BY model_id, platform_id
) cnt ON cnt.model_id = mv.model_id AND cnt.platform_id = mv.platform_id
ORDER BY mv.model_id, mv.platform_id, mv.updated_at DESC NULLS LAST;

-- =====================================================
-- Últimos valores SOLO dentro del P2 de enero (16–31 ene)
-- =====================================================
-- Una fila por (modelo, plataforma): la más reciente por updated_at
-- entre los registros con period_date entre 2026-01-16 y 2026-01-31.
-- =====================================================

-- Opción 3: Últimos por (modelo, plataforma) solo en P2 enero
SELECT DISTINCT ON (mv.model_id, mv.platform_id)
  mv.model_id,
  u.name AS modelo_nombre,
  u.email AS modelo_email,
  mv.platform_id,
  mv.value,
  mv.period_date,
  mv.updated_at AS ultima_actualizacion
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
WHERE mv.period_date >= '2026-01-16'::date
  AND mv.period_date <= '2026-01-31'::date
ORDER BY mv.model_id, mv.platform_id, mv.updated_at DESC NULLS LAST;

-- Opción 4: Igual que 3 + cantidad de registros en P2 enero por (modelo, plataforma)
SELECT DISTINCT ON (mv.model_id, mv.platform_id)
  mv.model_id,
  u.name AS modelo_nombre,
  mv.platform_id,
  mv.value AS ultimo_valor,
  mv.period_date AS ultimo_period_date,
  mv.updated_at AS ultima_actualizacion,
  cnt.registros_p2_enero
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
LEFT JOIN (
  SELECT model_id, platform_id, COUNT(*) AS registros_p2_enero
  FROM model_values
  WHERE period_date >= '2026-01-16'::date AND period_date <= '2026-01-31'::date
  GROUP BY model_id, platform_id
) cnt ON cnt.model_id = mv.model_id AND cnt.platform_id = mv.platform_id
WHERE mv.period_date >= '2026-01-16'::date
  AND mv.period_date <= '2026-01-31'::date
ORDER BY mv.model_id, mv.platform_id, mv.updated_at DESC NULLS LAST;
