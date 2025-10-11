-- Script FINAL para limpiar la tabla 'anticipos' con estructura correcta

-- 1. Verificar datos actuales
SELECT 
    'ANTICIPOS - Datos actuales:' as info,
    COUNT(*) as total_registros
FROM anticipos;

-- 2. Ver algunos ejemplos de los datos antes de eliminar
SELECT 
    id,
    model_id,
    monto_solicitado,
    porcentaje_solicitado,
    estado,
    medio_pago,
    created_at
FROM anticipos
LIMIT 5;

-- 3. Ver todos los datos (opcional, para revisar antes de eliminar)
-- SELECT * FROM anticipos;

-- 4. ELIMINAR TODOS LOS DATOS DE LA TABLA 'ANTICIPOS'
-- ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE
-- Descomenta la siguiente línea para ejecutar:

-- DELETE FROM anticipos;

-- 5. Verificar que se eliminaron todos los datos
-- SELECT 
--     'ANTICIPOS - Después de limpieza:' as info,
--     COUNT(*) as registros_restantes
-- FROM anticipos;

-- 6. Reiniciar secuencia (opcional, para que los IDs empiecen desde 1)
-- ALTER SEQUENCE anticipos_id_seq RESTART WITH 1;
