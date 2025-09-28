-- =====================================================
-- 🔍 DIAGNÓSTICO PARTE 1: ESTRUCTURA DE TABLAS
-- =====================================================
-- Script para verificar estructura de tablas principales
-- =====================================================

-- 1. ESTRUCTURA DE TABLA groups
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA groups:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- 2. ESTRUCTURA DE TABLA organizations
-- =====================================================

SELECT 'ESTRUCTURA DE TABLA organizations:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'organizations'
ORDER BY ordinal_position;
