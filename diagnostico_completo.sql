-- =====================================================
-- 🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA
-- =====================================================
-- Script para diagnosticar el estado actual de la base de datos
-- =====================================================

-- 1. VERIFICAR ESTRUCTURA DE TABLA groups
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA groups:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- 2. VERIFICAR ESTRUCTURA DE TABLA organizations
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA organizations:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'organizations'
ORDER BY ordinal_position;

-- 3. VERIFICAR ESTRUCTURA DE TABLA users
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA users:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. VERIFICAR ESTRUCTURA DE TABLA user_groups
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA user_groups:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_groups'
ORDER BY ordinal_position;

-- 5. VERIFICAR DATOS EXISTENTES
-- =====================================================

SELECT 'DATOS EN organizations:' as info;
SELECT COUNT(*) as total_organizations FROM public.organizations;

SELECT 'DATOS EN groups:' as info;
SELECT COUNT(*) as total_groups FROM public.groups;

SELECT 'DATOS EN users:' as info;
SELECT COUNT(*) as total_users FROM public.users;

SELECT 'DATOS EN user_groups:' as info;
SELECT COUNT(*) as total_user_groups FROM public.user_groups;

-- 6. VERIFICAR RLS
-- =====================================================

SELECT 'ESTADO DE RLS:' as info;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'groups', 'user_groups', 'organizations', 'audit_logs')
ORDER BY tablename;

-- 7. VERIFICAR TRIGGERS
-- =====================================================

SELECT 'TRIGGERS EN auth.users:' as info;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
ORDER BY trigger_name;
