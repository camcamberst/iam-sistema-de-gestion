-- =====================================================
-- 🔍 DIAGNÓSTICO PARTE 3: DATOS Y RLS
-- =====================================================
-- Script para verificar datos existentes y estado de RLS
-- =====================================================

-- 1. DATOS EXISTENTES
-- =====================================================

SELECT 'DATOS EN organizations:' as info;
SELECT COUNT(*) as total_organizations FROM public.organizations;

SELECT 'DATOS EN groups:' as info;
SELECT COUNT(*) as total_groups FROM public.groups;

SELECT 'DATOS EN users:' as info;
SELECT COUNT(*) as total_users FROM public.users;

SELECT 'DATOS EN user_groups:' as info;
SELECT COUNT(*) as total_user_groups FROM public.user_groups;

-- 2. ESTADO DE RLS
-- =====================================================

SELECT 'ESTADO DE RLS:' as info;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'groups', 'user_groups', 'organizations', 'audit_logs')
ORDER BY tablename;
