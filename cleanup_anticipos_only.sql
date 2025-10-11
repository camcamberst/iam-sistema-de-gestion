-- Script para limpiar SOLO la tabla 'anticipos' (única tabla que existe)

-- 1. Verificar datos actuales en la tabla 'anticipos'
SELECT 
    'ANTICIPOS - Datos actuales:' as info,
    COUNT(*) as total_registros
FROM anticipos;

-- 2. Ver algunos ejemplos de los datos antes de eliminar
SELECT 
    'ANTICIPOS - Ejemplos:' as info,
    id,
    model_id,
    amount,
    status,
    created_at
FROM anticipos
LIMIT 5;

-- 3. ELIMINAR TODOS LOS DATOS DE LA TABLA 'ANTICIPOS'
-- ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE
-- Descomenta la siguiente línea para ejecutar:

-- DELETE FROM anticipos;

-- 4. Verificar que se eliminaron todos los datos
-- SELECT 
--     'ANTICIPOS - Después de limpieza:' as info,
--     COUNT(*) as registros_restantes
-- FROM anticipos;

-- 5. Reiniciar secuencia (opcional, para que los IDs empiecen desde 1)
-- ALTER SEQUENCE anticipos_id_seq RESTART WITH 1;
