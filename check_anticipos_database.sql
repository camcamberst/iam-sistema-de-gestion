-- =====================================================
-- 🔍 VERIFICAR ANTICIPOS EN LA BASE DE DATOS
-- =====================================================

-- 1. Verificar si existen anticipos
SELECT 'ANTICIPOS EXISTENTES:' as info;
SELECT COUNT(*) as total_anticipos FROM anticipos;

-- 2. Mostrar todos los anticipos con detalles
SELECT 'DETALLES DE ANTICIPOS:' as info;
SELECT 
  id,
  monto_solicitado,
  estado,
  created_at,
  model_id
FROM anticipos 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Verificar usuarios que han hecho solicitudes
SELECT 'USUARIOS CON ANTICIPOS:' as info;
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  COUNT(a.id) as total_anticipos
FROM users u
LEFT JOIN anticipos a ON u.id = a.model_id
GROUP BY u.id, u.name, u.email, u.role
HAVING COUNT(a.id) > 0
ORDER BY total_anticipos DESC;

-- 4. Verificar estados de anticipos
SELECT 'ESTADOS DE ANTICIPOS:' as info;
SELECT 
  estado,
  COUNT(*) as cantidad
FROM anticipos 
GROUP BY estado
ORDER BY cantidad DESC;

-- 5. Verificar si hay problemas con las relaciones
SELECT 'RELACIONES ANTICIPOS-USERS:' as info;
SELECT 
  a.id as anticipo_id,
  a.estado,
  a.model_id,
  u.name as modelo_name,
  u.role as modelo_role
FROM anticipos a
LEFT JOIN users u ON a.model_id = u.id
ORDER BY a.created_at DESC
LIMIT 5;
