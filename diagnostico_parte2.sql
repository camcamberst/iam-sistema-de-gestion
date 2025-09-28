-- =====================================================
-- 🔍 DIAGNÓSTICO PARTE 2: ESTRUCTURA DE USUARIOS
-- =====================================================
-- Script para verificar estructura de tablas de usuarios
-- =====================================================

-- 1. ESTRUCTURA DE TABLA users
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA users:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. ESTRUCTURA DE TABLA user_groups
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA user_groups:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_groups'
ORDER BY ordinal_position;
