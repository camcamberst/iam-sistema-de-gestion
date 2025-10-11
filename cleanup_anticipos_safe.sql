-- Script SEGURO para limpiar datos de anticipos
-- Primero verifica qué tablas existen y luego limpia solo las que están disponibles

-- 1. Verificar qué tablas de anticipos existen
SELECT 
    'TABLAS DE ANTICIPOS ENCONTRADAS:' as info,
    table_name
FROM information_schema.tables 
WHERE table_name LIKE '%anticipo%'
   OR table_name LIKE '%advance%'
   OR table_name LIKE '%loan%'
ORDER BY table_name;

-- 2. Verificar datos en cada tabla que existe
-- (Ejecutar solo si la tabla existe)

-- Si existe la tabla 'anticipos':
-- SELECT 'ANTICIPOS' as tabla, COUNT(*) as registros FROM anticipos;

-- Si existe la tabla 'anticipos_config':
-- SELECT 'ANTICIPOS_CONFIG' as tabla, COUNT(*) as registros FROM anticipos_config;

-- Si existe la tabla 'anticipos_history':
-- SELECT 'ANTICIPOS_HISTORY' as tabla, COUNT(*) as registros FROM anticipos_history;

-- 3. LIMPIEZA SEGURA (DESCOMENTAR SOLO LAS TABLAS QUE EXISTAN)

-- Para tabla 'anticipos':
-- DELETE FROM anticipos;

-- Para tabla 'anticipos_config':
-- DELETE FROM anticipos_config;

-- Para tabla 'anticipos_history':
-- DELETE FROM anticipos_history;

-- 4. Verificar limpieza
-- SELECT 'ANTICIPOS' as tabla, COUNT(*) as registros FROM anticipos;
-- SELECT 'ANTICIPOS_CONFIG' as tabla, COUNT(*) as registros FROM anticipos_config;
-- SELECT 'ANTICIPOS_HISTORY' as tabla, COUNT(*) as registros FROM anticipos_history;
