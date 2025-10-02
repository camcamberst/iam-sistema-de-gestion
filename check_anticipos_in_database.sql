-- Verificar anticipos en la base de datos
SELECT 
  a.id,
  a.estado,
  a.monto_solicitado,
  a.created_at,
  u.name as model_name,
  u.email as model_email,
  g.name as group_name
FROM anticipos a
LEFT JOIN users u ON a.model_id = u.id
LEFT JOIN user_groups ug ON u.id = ug.user_id
LEFT JOIN groups g ON ug.group_id = g.id
ORDER BY a.created_at DESC
LIMIT 10;

-- Verificar anticipos por estado
SELECT 
  estado,
  COUNT(*) as cantidad
FROM anticipos
GROUP BY estado;

-- Verificar anticipos por grupo
SELECT 
  g.name as group_name,
  COUNT(a.id) as anticipos_count
FROM groups g
LEFT JOIN user_groups ug ON g.id = ug.group_id
LEFT JOIN users u ON ug.user_id = u.id
LEFT JOIN anticipos a ON u.id = a.model_id
GROUP BY g.id, g.name
ORDER BY anticipos_count DESC;
