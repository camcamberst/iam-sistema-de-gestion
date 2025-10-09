-- =====================================================
-- MIGRACIÓN DE DATOS: modelo_assignments → room_assignments
-- =====================================================
-- Migra datos limpios eliminando duplicados y conflictos
-- Mantiene solo asignaciones válidas según nuevas reglas
-- =====================================================

-- 1. 🧹 ANÁLISIS PREVIO
-- Verificar estado actual de modelo_assignments
SELECT 
  'Estado actual de modelo_assignments' as descripcion,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN is_active = true THEN 1 END) as activos,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactivos
FROM modelo_assignments;

-- Detectar duplicados (mismo modelo + jornada)
SELECT 
  'Duplicados por modelo+jornada' as descripcion,
  model_id,
  jornada,
  COUNT(*) as duplicados
FROM modelo_assignments
WHERE is_active = true
GROUP BY model_id, jornada
HAVING COUNT(*) > 1
ORDER BY duplicados DESC;

-- 2. 🔄 MIGRACIÓN DE DATOS LIMPIOS
-- Insertar solo asignaciones válidas (sin duplicados)
INSERT INTO room_assignments (model_id, room_id, jornada, assigned_at, assigned_by)
SELECT DISTINCT ON (ma.model_id, ma.jornada)
  ma.model_id,
  ma.room_id,
  ma.jornada,
  ma.assigned_at,
  ma.assigned_by
FROM modelo_assignments ma
WHERE ma.is_active = true
  AND ma.model_id IS NOT NULL
  AND ma.room_id IS NOT NULL
  AND ma.jornada IS NOT NULL
  AND ma.jornada IN ('MAÑANA', 'TARDE', 'NOCHE')
ORDER BY ma.model_id, ma.jornada, ma.assigned_at DESC; -- Mantener el más reciente

-- 3. 📊 VERIFICACIÓN POST-MIGRACIÓN
-- Comparar registros migrados
SELECT 
  'Comparación de registros' as descripcion,
  (SELECT COUNT(*) FROM modelo_assignments WHERE is_active = true) as origen_activos,
  (SELECT COUNT(*) FROM room_assignments) as destino_migrados,
  (SELECT COUNT(*) FROM modelo_assignments WHERE is_active = true) - 
  (SELECT COUNT(*) FROM room_assignments) as diferencia;

-- Verificar que no hay duplicados en destino
SELECT 
  'Verificación de duplicados en room_assignments' as descripcion,
  model_id,
  jornada,
  COUNT(*) as duplicados
FROM room_assignments
GROUP BY model_id, jornada
HAVING COUNT(*) > 1;

-- Verificar límite de 2 modelos por room+jornada
SELECT 
  'Verificación límite 2 modelos por room+jornada' as descripcion,
  room_id,
  jornada,
  COUNT(*) as modelos_asignadas
FROM room_assignments
GROUP BY room_id, jornada
HAVING COUNT(*) > 2
ORDER BY modelos_asignadas DESC;

-- 4. 🎯 ESTADÍSTICAS FINALES
-- Resumen de la migración
SELECT 
  'Resumen final de room_assignments' as descripcion,
  COUNT(*) as total_asignaciones,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT room_id) as rooms_con_asignaciones,
  COUNT(DISTINCT jornada) as jornadas_activas
FROM room_assignments;

-- Distribución por jornada
SELECT 
  'Distribución por jornada' as descripcion,
  jornada,
  COUNT(*) as asignaciones,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT room_id) as rooms_diferentes
FROM room_assignments
GROUP BY jornada
ORDER BY jornada;

-- 5. 📋 VISTA DE ASIGNACIONES DETALLADAS
-- Verificar que la vista funciona correctamente
SELECT 
  'Prueba de vista room_assignments_detailed' as descripcion,
  COUNT(*) as registros_en_vista
FROM room_assignments_detailed;

-- Mostrar algunas asignaciones de ejemplo
SELECT 
  model_name,
  room_name,
  group_name,
  jornada,
  assigned_at
FROM room_assignments_detailed
ORDER BY assigned_at DESC
LIMIT 10;
