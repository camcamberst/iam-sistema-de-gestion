-- Script para crear el usuario AIM Botty en la base de datos
-- =============================================================
-- Ejecutar este script en Supabase SQL Editor

-- Paso 1: Crear usuario en auth.users manualmente
-- Ir a Supabase Dashboard > Authentication > Users
-- Crear nuevo usuario con:
--   Email: aim-botty@agencia-innova.com
--   Password: generar contraseña segura (no se usará para login)
--   Copiar el UUID generado

-- Paso 2: Insertar en tabla users
INSERT INTO public.users (
  id,
  email,
  name,
  role,
  is_active,
  organization_id,
  created_at,
  updated_at
) VALUES (
  'f91c0968-b587-46cf-9036-05a4ec795c7f'::uuid,
  'aim-botty@agencia-innova.com',
  'AIM Botty',
  'bot',
  true,
  (SELECT id FROM organizations LIMIT 1),
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = 'AIM Botty',
  role = 'bot',
  is_active = true;

-- Paso 3: Marcar como siempre en línea
INSERT INTO public.chat_user_status (
  user_id,
  is_online,
  last_seen,
  status_message,
  updated_at
) VALUES (
  'f91c0968-b587-46cf-9036-05a4ec795c7f'::uuid,
  true,
  NOW(),
  '¡Hola! Soy tu asistente virtual 🤖',
  NOW()
) ON CONFLICT (user_id) DO UPDATE SET
  is_online = true,
  status_message = '¡Hola! Soy tu asistente virtual 🤖',
  updated_at = NOW();

-- Paso 4: Verificar creación
SELECT 
  id,
  email,
  name,
  role,
  is_active
FROM public.users
WHERE email = 'aim-botty@agencia-innova.com';
