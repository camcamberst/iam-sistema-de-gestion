-- Verificar que AIM Botty está configurado correctamente
-- =============================================================

-- 1. Verificar usuario
SELECT 
  id,
  email,
  name,
  role,
  is_active,
  organization_id
FROM public.users
WHERE id = 'f91c0968-b587-46cf-9036-05a4ec795c7f'::uuid;

-- 2. Verificar estado en línea
SELECT 
  user_id,
  is_online,
  last_seen,
  status_message
FROM public.chat_user_status
WHERE user_id = 'f91c0968-b587-46cf-9036-05a4ec795c7f'::uuid;

-- 3. Verificar que el bot puede ser encontrado en chat_users
-- (Este debería aparecer cuando cualquier usuario cargue la lista de contactos)



