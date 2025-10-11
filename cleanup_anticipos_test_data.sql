-- Script para limpiar todos los datos de anticipos de prueba
-- ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE

-- 1. Verificar qué datos de anticipos existen actualmente
SELECT 
    'Anticipos' as tabla,
    COUNT(*) as registros
FROM anticipos
UNION ALL
SELECT 
    'Anticipos History' as tabla,
    COUNT(*) as registros
FROM anticipos_history
UNION ALL
SELECT 
    'Anticipos Config' as tabla,
    COUNT(*) as registros
FROM anticipos_config;

-- 2. Verificar algunos registros de ejemplo antes de eliminar
SELECT 
    'ANTICIPOS - Ejemplos:' as info,
    id,
    model_id,
    amount,
    status,
    created_at
FROM anticipos
LIMIT 5;

SELECT 
    'ANTICIPOS_HISTORY - Ejemplos:' as info,
    id,
    anticipo_id,
    old_status,
    new_status,
    created_at
FROM anticipos_history
LIMIT 5;

SELECT 
    'ANTICIPOS_CONFIG - Ejemplos:' as info,
    id,
    model_id,
    max_advance_percentage,
    created_at
FROM anticipos_config
LIMIT 5;

-- 3. ELIMINAR TODOS LOS DATOS DE ANTICIPOS (DESCOMENTAR PARA EJECUTAR)
-- ⚠️ CUIDADO: Esta acción elimina TODOS los datos de anticipos

-- Eliminar historial de anticipos primero (por las foreign keys)
-- DELETE FROM anticipos_history;

-- Eliminar anticipos principales
-- DELETE FROM anticipos;

-- Eliminar configuraciones de anticipos
-- DELETE FROM anticipos_config;

-- 4. Verificar que se eliminaron todos los datos
-- SELECT 
--     'Anticipos' as tabla,
--     COUNT(*) as registros_restantes
-- FROM anticipos
-- UNION ALL
-- SELECT 
--     'Anticipos History' as tabla,
--     COUNT(*) as registros_restantes
-- FROM anticipos_history
-- UNION ALL
-- SELECT 
--     'Anticipos Config' as tabla,
--     COUNT(*) as registros_restantes
-- FROM anticipos_config;

-- 5. Reiniciar secuencias (opcional, para que los IDs empiecen desde 1)
-- ALTER SEQUENCE anticipos_id_seq RESTART WITH 1;
-- ALTER SEQUENCE anticipos_history_id_seq RESTART WITH 1;
-- ALTER SEQUENCE anticipos_config_id_seq RESTART WITH 1;
