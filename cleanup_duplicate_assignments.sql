-- Script para limpiar asignaciones duplicadas en modelo_assignments
-- Solo mantener la asignación más reciente para cada combinación de room_id + jornada + model_id

-- 1. Ver asignaciones actuales para ROOM01
SELECT 
    id,
    model_id,
    room_id,
    jornada,
    assigned_at,
    is_active
FROM modelo_assignments 
WHERE room_id = '17227f3e-9150-428e-a8a8-cca92ee6978c'
ORDER BY jornada, assigned_at DESC;

-- 2. Identificar duplicados (comentado para seguridad)
-- DELETE FROM modelo_assignments 
-- WHERE id IN (
--     SELECT id FROM (
--         SELECT id,
--                ROW_NUMBER() OVER (
--                    PARTITION BY room_id, jornada, model_id 
--                    ORDER BY assigned_at DESC
--                ) as rn
--         FROM modelo_assignments
--         WHERE room_id = '17227f3e-9150-428e-a8a8-cca92ee6978c'
--     ) t
--     WHERE rn > 1
-- );

-- 3. Verificar que solo quede una asignación por jornada
-- SELECT 
--     jornada,
--     COUNT(*) as total_assignments
-- FROM modelo_assignments 
-- WHERE room_id = '17227f3e-9150-428e-a8a8-cca92ee6978c'
--   AND is_active = true
-- GROUP BY jornada;
