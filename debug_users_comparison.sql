-- Comparación de datos entre Laura Patricia y Elizabeth

-- 1. Datos básicos de usuarios
SELECT '=== DATOS BÁSICOS DE USUARIOS ===' as info;

SELECT 
  'Laura Patricia' as nombre,
  id,
  name,
  email,
  role,
  is_active,
  created_at
FROM users 
WHERE id = 'f0217a65-4ec6-4c9a-b935-758bc2a6831f'

UNION ALL

SELECT 
  'Elizabeth' as nombre,
  id,
  name,
  email,
  role,
  is_active,
  created_at
FROM users 
WHERE id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7';

-- 2. Grupos asignados
SELECT '=== GRUPOS ASIGNADOS ===' as info;

SELECT 
  'Laura Patricia' as nombre,
  ug.user_id,
  g.name as grupo_name,
  ug.is_manager
FROM user_groups ug
JOIN groups g ON ug.group_id = g.id
WHERE ug.user_id = 'f0217a65-4ec6-4c9a-b935-758bc2a6831f'

UNION ALL

SELECT 
  'Elizabeth' as nombre,
  ug.user_id,
  g.name as grupo_name,
  ug.is_manager
FROM user_groups ug
JOIN groups g ON ug.group_id = g.id
WHERE ug.user_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7';

-- 3. Asignaciones de modelo
SELECT '=== ASIGNACIONES DE MODELO ===' as info;

SELECT 
  'Laura Patricia' as nombre,
  ma.*,
  gr.room_name,
  g.name as grupo_name
FROM modelo_assignments ma
LEFT JOIN group_rooms gr ON ma.room_id = gr.id
LEFT JOIN groups g ON ma.group_id = g.id
WHERE ma.model_id = 'f0217a65-4ec6-4c9a-b935-758bc2a6831f'

UNION ALL

SELECT 
  'Elizabeth' as nombre,
  ma.*,
  gr.room_name,
  g.name as grupo_name
FROM modelo_assignments ma
LEFT JOIN group_rooms gr ON ma.room_id = gr.id
LEFT JOIN groups g ON ma.group_id = g.id
WHERE ma.model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7';

-- 4. Estados de jornada
SELECT '=== ESTADOS DE JORNADA ===' as info;

SELECT 
  'Laura Patricia' as nombre,
  js.*,
  gr.room_name,
  g.name as grupo_name
FROM jornada_states js
LEFT JOIN group_rooms gr ON js.room_id = gr.id
LEFT JOIN groups g ON js.group_id = g.id
WHERE js.model_id = 'f0217a65-4ec6-4c9a-b935-758bc2a6831f'

UNION ALL

SELECT 
  'Elizabeth' as nombre,
  js.*,
  gr.room_name,
  g.name as grupo_name
FROM jornada_states js
LEFT JOIN group_rooms gr ON js.room_id = gr.id
LEFT JOIN groups g ON js.group_id = g.id
WHERE js.model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7';
