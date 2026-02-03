-- =====================================================
-- 🛡️ P2 ENERO 2026 — Verificar y asegurar datos
-- =====================================================
-- Ejecuta en Supabase: SQL Editor → pega y ejecuta por bloques.
--
-- 1. VERIFICAR (bloque 1): solo SELECT — no modifica nada. Ejecuta siempre.
-- 2. OPCIONAL INSERTAR (bloque 2): descomenta y ejecuta si quieres que el SQL
--    copie de model_values → calculator_history (sin borrar model_values).
-- 3. Verificar después (bloque 3): descomenta tras el INSERT para comprobar.
-- =====================================================

-- =====================================================
-- 1. VERIFICAR (solo SELECT — no modifica nada)
-- =====================================================

-- 1.1 Conteos en model_values para P2 enero
SELECT
  'model_values (P2 enero)' AS tabla,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) AS modelos_con_datos
FROM model_values
WHERE period_date = '2026-01-16'::date;

-- 1.2 Conteos en calculator_totals para P2 enero
SELECT
  'calculator_totals (P2 enero)' AS tabla,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) AS modelos
FROM calculator_totals
WHERE period_date = '2026-01-16'::date;

-- 1.3 Conteos en calculator_history para P2 enero (16-31)
SELECT
  'calculator_history (P2 enero 16-31)' AS tabla,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) FILTER (WHERE platform_id != '__CONSOLIDATED_TOTAL__') AS modelos_archivados
FROM calculator_history
WHERE period_date = '2026-01-16'::date
  AND period_type = '16-31';

-- 1.4 Modelos que tienen datos en model_values pero NO en calculator_history (P2 enero)
SELECT
  mv.model_id,
  u.name AS modelo_nombre,
  u.email AS modelo_email,
  COUNT(mv.id) AS registros_en_model_values
FROM model_values mv
LEFT JOIN users u ON u.id = mv.model_id
WHERE mv.period_date = '2026-01-16'::date
  AND NOT EXISTS (
    SELECT 1 FROM calculator_history ch
    WHERE ch.model_id = mv.model_id
      AND ch.period_date = '2026-01-16'::date
      AND ch.period_type = '16-31'
      AND ch.platform_id != '__CONSOLIDATED_TOTAL__'
  )
GROUP BY mv.model_id, u.name, u.email
ORDER BY registros_en_model_values DESC;

-- =====================================================
-- 2. OPCIONAL: Insertar en calculator_history lo que falte
-- =====================================================
-- Solo ejecuta este bloque si quieres que el SQL copie
-- de model_values a calculator_history (sin borrar model_values).
-- Si prefieres usar la app "Archivar P2 enero a historial", no ejecutes esto.
-- =====================================================

/*
-- 2.1 Insertar registros por plataforma (solo los que no existen)
WITH
  admin_user AS (
    SELECT id FROM users
    WHERE role IN ('super_admin', 'admin')
    LIMIT 1
  ),
  batch AS (
    SELECT gen_random_uuid() AS bid
  )
INSERT INTO calculator_history (
  model_id,
  period_date,
  period_type,
  platform_id,
  value,
  estado,
  created_by,
  batch_id,
  metadata
)
SELECT
  mv.model_id,
  '2026-01-16'::date,
  '16-31',
  mv.platform_id,
  mv.value,
  'auditado',
  (SELECT id FROM admin_user),
  (SELECT bid FROM batch),
  jsonb_build_object(
    'archived_at', now(),
    'source', 'sql_verificar_p2_enero',
    'original_created_at', mv.created_at,
    'original_updated_at', mv.updated_at
  )
FROM model_values mv
CROSS JOIN admin_user
CROSS JOIN batch
WHERE mv.period_date = '2026-01-16'::date
  AND NOT EXISTS (
    SELECT 1 FROM calculator_history ch
    WHERE ch.model_id = mv.model_id
      AND ch.platform_id = mv.platform_id
      AND ch.period_date = '2026-01-16'::date
      AND ch.period_type = '16-31'
  );

-- 2.2 Insertar totales consolidados (__CONSOLIDATED_TOTAL__) por modelo que tenga model_values pero no tenga aún el consolidado
WITH
  admin_user AS (
    SELECT id FROM users
    WHERE role IN ('super_admin', 'admin')
    LIMIT 1
  ),
  batch AS (
    SELECT gen_random_uuid() AS bid
  ),
  modelos_con_valores AS (
    SELECT DISTINCT model_id
    FROM model_values
    WHERE period_date = '2026-01-16'::date
  ),
  totales AS (
    SELECT
      ct.model_id,
      ct.total_usd,
      ct.total_usd_bruto,
      ct.total_usd_modelo,
      ct.total_cop_modelo
    FROM calculator_totals ct
    INNER JOIN modelos_con_valores m ON m.model_id = ct.model_id
    WHERE ct.period_date = '2026-01-16'::date
  )
INSERT INTO calculator_history (
  model_id,
  period_date,
  period_type,
  platform_id,
  value,
  estado,
  created_by,
  batch_id,
  metadata
)
SELECT
  t.model_id,
  '2026-01-16'::date,
  '16-31',
  '__CONSOLIDATED_TOTAL__',
  COALESCE(t.total_usd, 0),
  'auditado',
  (SELECT id FROM admin_user),
  (SELECT bid FROM batch),
  jsonb_build_object(
    'archived_at', now(),
    'source', 'sql_verificar_p2_enero',
    'is_consolidated', true
  )
FROM totales t
WHERE NOT EXISTS (
  SELECT 1 FROM calculator_history ch
  WHERE ch.model_id = t.model_id
    AND ch.period_date = '2026-01-16'::date
    AND ch.period_type = '16-31'
    AND ch.platform_id = '__CONSOLIDATED_TOTAL__'
);
*/

-- =====================================================
-- 3. Verificar de nuevo tras el INSERT (si lo ejecutaste)
-- =====================================================
-- Descomenta y ejecuta después del bloque 2 para comprobar.

/*
SELECT
  'calculator_history (P2 enero 16-31) después' AS tabla,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) FILTER (WHERE platform_id != '__CONSOLIDATED_TOTAL__') AS modelos_archivados
FROM calculator_history
WHERE period_date = '2026-01-16'::date
  AND period_type = '16-31';
*/
