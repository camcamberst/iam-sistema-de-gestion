-- REVERTIR POLÍTICAS RLS PROBLEMÁTICAS
-- Este script elimina solo las políticas que causan recursión infinita

-- Eliminar políticas problemáticas en users
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

-- Eliminar políticas problemáticas en chat_messages
DROP POLICY IF EXISTS "Admins can view all messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can insert messages" ON chat_messages;

-- Eliminar políticas problemáticas en chat_sessions
DROP POLICY IF EXISTS "Admins can view all chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Admins can insert sessions" ON chat_sessions;
