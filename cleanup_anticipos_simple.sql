-- Script SIMPLE para limpiar todos los datos de anticipos de prueba
-- ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE

-- 1. Verificar datos actuales
SELECT 'ANTICIPOS' as tabla, COUNT(*) as registros FROM anticipos;
SELECT 'ANTICIPOS_HISTORY' as tabla, COUNT(*) as registros FROM anticipos_history;
SELECT 'ANTICIPOS_CONFIG' as tabla, COUNT(*) as registros FROM anticipos_config;

-- 2. ELIMINAR TODOS LOS DATOS (DESCOMENTAR LAS SIGUIENTES LÍNEAS PARA EJECUTAR)

-- DELETE FROM anticipos_history;
-- DELETE FROM anticipos;
-- DELETE FROM anticipos_config;

-- 3. Verificar limpieza
-- SELECT 'ANTICIPOS' as tabla, COUNT(*) as registros FROM anticipos;
-- SELECT 'ANTICIPOS_HISTORY' as tabla, COUNT(*) as registros FROM anticipos_history;
-- SELECT 'ANTICIPOS_CONFIG' as tabla, COUNT(*) as registros FROM anticipos_config;
