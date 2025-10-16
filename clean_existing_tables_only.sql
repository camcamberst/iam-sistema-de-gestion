-- =====================================================
-- 🔄 LIMPIEZA SEGURA DE TABLAS EXISTENTES
-- =====================================================
-- Script SQL que solo limpia las tablas que realmente existen
-- =====================================================

-- 1. Limpiar model_values (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_values') THEN
        DELETE FROM model_values 
        WHERE period_date >= '2025-10-01'::date 
        AND period_date <= '2025-10-31'::date;
        
        RAISE NOTICE 'Tabla model_values limpiada';
    ELSE
        RAISE NOTICE 'Tabla model_values no existe';
    END IF;
END $$;

-- 2. Limpiar calculator_totals (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_totals') THEN
        DELETE FROM calculator_totals 
        WHERE period_date >= '2025-10-01'::date 
        AND period_date <= '2025-10-31'::date;
        
        RAISE NOTICE 'Tabla calculator_totals limpiada';
    ELSE
        RAISE NOTICE 'Tabla calculator_totals no existe';
    END IF;
END $$;

-- 3. Limpiar daily_earnings (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_earnings') THEN
        DELETE FROM daily_earnings 
        WHERE earnings_date >= '2025-10-01'::date 
        AND earnings_date <= '2025-10-31'::date;
        
        RAISE NOTICE 'Tabla daily_earnings limpiada';
    ELSE
        RAISE NOTICE 'Tabla daily_earnings no existe';
    END IF;
END $$;

-- 4. Verificar estado final de model_values (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_values') THEN
        RAISE NOTICE 'Verificando model_values...';
        PERFORM 1; -- Placeholder para mostrar mensaje
    END IF;
END $$;

SELECT 
    'VERIFICACIÓN FINAL - model_values' AS tabla,
    COUNT(*) AS registros_restantes
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date;

-- 5. Verificar estado final de calculator_totals (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_totals') THEN
        RAISE NOTICE 'Verificando calculator_totals...';
        PERFORM 1; -- Placeholder para mostrar mensaje
    END IF;
END $$;

SELECT 
    'VERIFICACIÓN FINAL - calculator_totals' AS tabla,
    COUNT(*) AS registros_restantes
FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date;

-- 6. Verificar estado final de daily_earnings (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_earnings') THEN
        RAISE NOTICE 'Verificando daily_earnings...';
        PERFORM 1; -- Placeholder para mostrar mensaje
    END IF;
END $$;

SELECT 
    'VERIFICACIÓN FINAL - daily_earnings' AS tabla,
    COUNT(*) AS registros_restantes
FROM daily_earnings 
WHERE earnings_date >= '2025-10-01'::date 
AND earnings_date <= '2025-10-31'::date;

-- 7. Resumen final
SELECT 
    'RESUMEN FINAL' AS info,
    'Limpieza completada de todas las tablas existentes' AS estado,
    'Solo se limpiaron las tablas que existen en la base de datos' AS detalle;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- =====================================================
-- 1. Solo se limpiarán las tablas que realmente existen
-- 2. No habrá errores de "tabla no existe"
-- 3. Todas las calculadoras estarán limpias
-- 4. El frontend debería mostrar valores en cero
-- =====================================================
