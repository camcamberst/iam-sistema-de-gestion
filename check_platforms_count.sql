-- =====================================================
-- 🔍 VERIFICAR CANTIDAD DE PLATAFORMAS
-- =====================================================

-- 1. Contar plataformas en calculator_platforms
SELECT COUNT(*) as total_platforms FROM calculator_platforms;

-- 2. Listar todas las plataformas
SELECT id, name, currency FROM calculator_platforms ORDER BY id;

-- 3. Verificar si hay 25 plataformas específicas
SELECT 
  CASE 
    WHEN COUNT(*) = 25 THEN 'CORRECTO: 25 plataformas'
    ELSE 'INCORRECTO: ' || COUNT(*) || ' plataformas (deberían ser 25)'
  END as status
FROM calculator_platforms;
