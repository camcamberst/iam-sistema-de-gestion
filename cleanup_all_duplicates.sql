-- Script para limpiar TODOS los duplicados en modelo_assignments
-- Este script elimina duplicados manteniendo solo la asignación más reciente

-- 1. Ver todas las asignaciones actuales
SELECT 
    id,
    model_id,
    room_id,
    jornada,
    assigned_at,
    is_active,
    ROW_NUMBER() OVER (
        PARTITION BY room_id, jornada, model_id 
        ORDER BY assigned_at DESC
    ) as rn
FROM modelo_assignments 
WHERE is_active = true
ORDER BY room_id, jornada, assigned_at DESC;

-- 2. Identificar duplicados (solo para visualización)
SELECT 
    room_id,
    jornada,
    model_id,
    COUNT(*) as total_duplicates
FROM modelo_assignments 
WHERE is_active = true
GROUP BY room_id, jornada, model_id
HAVING COUNT(*) > 1
ORDER BY total_duplicates DESC;

-- 3. ELIMINAR DUPLICADOS (MANTENER SOLO EL MÁS RECIENTE)
-- ⚠️ EJECUTAR CON PRECAUCIÓN - ESTE COMANDO ELIMINA DATOS
DELETE FROM modelo_assignments 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY room_id, jornada, model_id 
                   ORDER BY assigned_at DESC
               ) as rn
        FROM modelo_assignments
        WHERE is_active = true
    ) t
    WHERE rn > 1
);

-- 4. Verificar resultado después de la limpieza
SELECT 
    room_id,
    jornada,
    COUNT(*) as assignments_per_jornada
FROM modelo_assignments 
WHERE is_active = true
GROUP BY room_id, jornada
ORDER BY room_id, jornada;

-- 5. Verificar que no hay duplicados restantes
SELECT 
    room_id,
    jornada,
    model_id,
    COUNT(*) as duplicates_remaining
FROM modelo_assignments 
WHERE is_active = true
GROUP BY room_id, jornada, model_id
HAVING COUNT(*) > 1;
