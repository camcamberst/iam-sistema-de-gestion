-- =====================================================
-- DIAGNÓSTICO: DISPONIBILIDAD DE ROOMS Y JORNADAS
-- =====================================================
-- Ejecuta en Supabase SQL Editor. Ejecuta cada bloque POR SEPARADO.
-- Si una tabla no existe, esa consulta fallará; las demás pueden ejecutarse.
-- =====================================================

-- -----------------------------------------------------
-- 1. VERIFICAR EXISTENCIA DE TABLAS
-- -----------------------------------------------------
SELECT table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as columnas
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('room_assignments', 'jornada_states', 'modelo_assignments', 'group_rooms', 'groups')
ORDER BY table_name;


-- -----------------------------------------------------
-- 2. ESTRUCTURA DE jornada_states (si existe)
-- -----------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jornada_states'
ORDER BY ordinal_position;


-- -----------------------------------------------------
-- 3. CONTEO DE REGISTROS POR TABLA
-- -----------------------------------------------------
SELECT 'room_assignments' as tabla, COUNT(*) as total_registros FROM room_assignments;

-- Ejecutar por separado si modelo_assignments existe:
-- SELECT 'modelo_assignments' as tabla, COUNT(*) FROM modelo_assignments WHERE is_active = true;

-- Ejecutar por separado si jornada_states existe:
-- SELECT 'jornada_states' as tabla, COUNT(*) FROM jornada_states;


-- -----------------------------------------------------
-- 4. ROOM_ASSIGNMENTS: asignaciones actuales con sede y room
-- -----------------------------------------------------
SELECT 
  g.name as sede_nombre,
  gr.room_name,
  ra.jornada,
  u.name as modelo_nombre,
  ra.assigned_at
FROM room_assignments ra
JOIN group_rooms gr ON ra.room_id = gr.id
JOIN groups g ON gr.group_id = g.id
JOIN users u ON ra.model_id = u.id
ORDER BY g.name, gr.room_name, ra.jornada;


-- -----------------------------------------------------
-- 5. MODELO_ASSIGNMENTS: (omitir si la tabla no existe)
-- -----------------------------------------------------
/*
SELECT g.name as sede_nombre, gr.room_name, ma.jornada, u.name as modelo_nombre, ma.assigned_at
FROM modelo_assignments ma
JOIN group_rooms gr ON ma.room_id = gr.id
JOIN groups g ON gr.group_id = g.id
JOIN users u ON ma.model_id = u.id
WHERE ma.is_active = true
ORDER BY g.name, gr.room_name, ma.jornada;
*/

-- -----------------------------------------------------
-- 6. QUERY QUE CALCULA DISPONIBILIDAD (solo room_assignments)
-- Devuelve por cada (sede, room, jornada): disponible si count < 2
-- -----------------------------------------------------
WITH conteo_por_slot AS (
  SELECT room_id, jornada, COUNT(*) as asignaciones
  FROM room_assignments
  GROUP BY room_id, jornada
),
slots AS (
  SELECT g.id as group_id, g.name as sede_nombre, gr.id as room_id, gr.room_name, j.jornada
  FROM groups g
  JOIN group_rooms gr ON gr.group_id = g.id
  CROSS JOIN (SELECT unnest(ARRAY['MAÑANA','TARDE','NOCHE'])::text as jornada) j
  WHERE g.name NOT IN ('Otros', 'Satélites')
)
SELECT 
  s.sede_nombre,
  s.room_name,
  s.jornada,
  COALESCE(c.asignaciones, 0) as asignaciones,
  CASE WHEN COALESCE(c.asignaciones, 0) >= 2 THEN 'Ocupado' ELSE 'Disponible' END as estado
FROM slots s
LEFT JOIN conteo_por_slot c ON c.room_id = s.room_id AND c.jornada = s.jornada
ORDER BY s.sede_nombre, s.room_name, s.jornada;


-- -----------------------------------------------------
-- 7. RESUMEN POR SEDE: slots disponibles vs ocupados
-- -----------------------------------------------------
WITH slots_totales AS (
  SELECT 
    g.id, g.name,
    COUNT(*) * 3 as total_slots  -- 3 jornadas por room
  FROM groups g
  JOIN group_rooms gr ON gr.group_id = g.id
  WHERE g.name NOT IN ('Otros', 'Satélites')
  GROUP BY g.id, g.name
),
ocupados AS (
  SELECT 
    gr.group_id,
    COUNT(*) as count_ocupados
  FROM room_assignments ra
  JOIN group_rooms gr ON ra.room_id = gr.id
  GROUP BY gr.group_id
)
SELECT 
  st.name as sede,
  st.total_slots as total_slots,
  COALESCE(o.count_ocupados, 0) as slots_ocupados,
  st.total_slots - COALESCE(o.count_ocupados, 0) as slots_disponibles
FROM slots_totales st
LEFT JOIN ocupados o ON o.group_id = st.id
ORDER BY st.name;


-- -----------------------------------------------------
-- 8. JORNADA_STATES: verificar si existe y tiene datos
-- (Descomenta si la tabla existe)
-- -----------------------------------------------------
/*
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'jornada_states';

SELECT * FROM jornada_states LIMIT 20;
*/
