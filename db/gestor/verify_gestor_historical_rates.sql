-- =====================================================
-- 🔍 VERIFICAR TABLA gestor_historical_rates
-- =====================================================

-- 1. Verificar que la tabla existe
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'gestor_historical_rates';

-- 2. Verificar estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'gestor_historical_rates'
ORDER BY ordinal_position;

-- 3. Verificar índices
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'gestor_historical_rates';

-- 4. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'gestor_historical_rates';

-- 5. Verificar si hay datos guardados
SELECT 
    id,
    group_id,
    period_date,
    period_type,
    rate_usd_cop,
    rate_eur_usd,
    rate_gbp_usd,
    configurado_por,
    aplicado_at,
    created_at,
    updated_at
FROM gestor_historical_rates
ORDER BY created_at DESC
LIMIT 10;

