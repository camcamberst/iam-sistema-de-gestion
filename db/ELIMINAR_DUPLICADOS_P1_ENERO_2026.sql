-- =====================================================
-- 🧹 ELIMINAR DUPLICADOS P1 ENERO 2026
-- =====================================================
-- IMPORTANTE: Ejecutar SOLO después de confirmar cuál eliminar
-- =====================================================

-- =====================================================
-- PASO 1: VERIFICAR ANTES DE ELIMINAR (SEGURIDAD)
-- =====================================================

-- Ver cuántos registros se eliminarán
SELECT 
    'PASO 1: VERIFICACIÓN' as paso,
    platform_id,
    COUNT(*) as registros_a_eliminar,
    SUM(value_usd_bruto) as suma_total
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__CONSOLIDATED_TOTAL__'  -- O '__consolidated_recovery__' según decisión
GROUP BY platform_id;

-- Ver algunos ejemplos antes de eliminar
SELECT 
    'EJEMPLOS A ELIMINAR' as info,
    model_id,
    platform_id,
    value_usd_bruto,
    archived_at
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__CONSOLIDATED_TOTAL__'  -- O '__consolidated_recovery__' según decisión
LIMIT 5;

-- =====================================================
-- PASO 2: OPCIÓN A - ELIMINAR __CONSOLIDATED_TOTAL__
-- =====================================================
-- Usar esta opción si __consolidated_recovery__ es más reciente
-- o si queremos mantener el que tiene mejor documentación

/*
BEGIN;

-- Eliminar __CONSOLIDATED_TOTAL__
DELETE FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__CONSOLIDATED_TOTAL__';

-- Verificar que solo queda uno por modelo
SELECT 
    'VERIFICACIÓN POST-DELETE' as paso,
    COUNT(*) as registros_totales,
    COUNT(DISTINCT model_id) as modelos_unicos,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT model_id) 
        THEN '✅ CORRECTO: 1 registro por modelo'
        ELSE '❌ ERROR: Hay modelos con múltiples registros'
    END as estado
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';

-- Si todo está OK, hacer COMMIT
-- Si hay error, hacer ROLLBACK

COMMIT;
-- O en caso de error: ROLLBACK;
*/

-- =====================================================
-- PASO 3: OPCIÓN B - ELIMINAR __consolidated_recovery__
-- =====================================================
-- Usar esta opción si __CONSOLIDATED_TOTAL__ es del sistema
-- y fue creado primero por el proceso automático

/*
BEGIN;

-- Eliminar __consolidated_recovery__
DELETE FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__consolidated_recovery__';

-- Verificar que solo queda uno por modelo
SELECT 
    'VERIFICACIÓN POST-DELETE' as paso,
    COUNT(*) as registros_totales,
    COUNT(DISTINCT model_id) as modelos_unicos,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT model_id) 
        THEN '✅ CORRECTO: 1 registro por modelo'
        ELSE '❌ ERROR: Hay modelos con múltiples registros'
    END as estado
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';

COMMIT;
-- O en caso de error: ROLLBACK;
*/

-- =====================================================
-- PASO 4: VERIFICACIÓN FINAL (después del DELETE)
-- =====================================================

-- Ejecutar esto DESPUÉS de hacer el DELETE y COMMIT

SELECT 
    'VERIFICACIÓN FINAL' as paso,
    COUNT(*) as registros_totales,
    COUNT(DISTINCT model_id) as modelos_unicos,
    COUNT(DISTINCT platform_id) as plataformas_unicas,
    STRING_AGG(DISTINCT platform_id, ', ') as plataformas_restantes,
    SUM(value_usd_bruto) as suma_total_usd
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';

-- Ver detalle por modelo (debe haber solo 1 registro por modelo)
SELECT 
    'DETALLE POR MODELO' as info,
    model_id,
    COUNT(*) as registros,
    STRING_AGG(platform_id, ', ') as plataformas,
    SUM(value_usd_bruto) as total_usd
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
GROUP BY model_id
HAVING COUNT(*) > 1  -- Esto debe retornar 0 filas si está correcto
ORDER BY model_id;

-- =====================================================
-- PASO 5: ACTUALIZAR EL ESTADO DE CIERRE (OPCIONAL)
-- =====================================================

-- Actualizar metadata para reflejar la limpieza
/*
UPDATE calculator_period_closure_status
SET 
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{duplicates_cleaned}',
        'true'::jsonb
    ),
    metadata = jsonb_set(
        metadata,
        '{cleaned_at}',
        to_jsonb(NOW()::text)
    ),
    metadata = jsonb_set(
        metadata,
        '{duplicates_removed}',
        '29'::jsonb
    ),
    metadata = jsonb_set(
        metadata,
        '{platform_removed}',
        to_jsonb('__CONSOLIDATED_TOTAL__'::text)  -- O el que se eliminó
    )
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';
*/

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================

/*
ANTES DE EJECUTAR:
1. Confirma cuál platform_id eliminar basado en las fechas
2. Descomenta SOLO la opción que vayas a usar (A o B)
3. Ejecuta el BEGIN; DELETE; y la verificación
4. Si todo está OK, ejecuta COMMIT
5. Si hay error, ejecuta ROLLBACK

DESPUÉS DE EJECUTAR:
1. Verifica con PASO 4 que solo hay 29 registros
2. Verifica que cada modelo tiene solo 1 registro
3. Verifica que la suma total sigue siendo ~$12,180
4. Confirma en la interfaz que las modelos ven su historial
*/
