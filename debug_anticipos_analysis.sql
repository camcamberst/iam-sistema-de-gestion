-- =====================================================
-- 🔍 ANÁLISIS COMPLETO DE ANTICIPOS - DEBUG
-- =====================================================

-- 1. VERIFICAR SI EXISTEN ANTICIPOS EN LA BASE DE DATOS
-- =====================================================
SELECT 
  'ANTICIPOS EXISTENTES' as analisis,
  COUNT(*) as total_anticipos,
  COUNT(CASE WHEN estado = 'realizado' THEN 1 END) as realizados,
  COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as pendientes,
  COUNT(CASE WHEN estado = 'aprobado' THEN 1 END) as aprobados,
  COUNT(CASE WHEN estado = 'rechazado' THEN 1 END) as rechazados,
  COUNT(CASE WHEN estado = 'cancelado' THEN 1 END) as cancelados
FROM anticipos;

-- 2. VERIFICAR ANTICIPOS POR MODELO (reemplazar 'MODEL_ID_AQUI' con el ID real)
-- =====================================================
SELECT 
  'ANTICIPOS POR MODELO' as analisis,
  u.name as modelo_nombre,
  u.email as modelo_email,
  a.estado,
  COUNT(*) as cantidad,
  SUM(a.monto_solicitado) as total_monto
FROM anticipos a
JOIN users u ON a.model_id = u.id
WHERE u.role = 'modelo'
GROUP BY u.id, u.name, u.email, a.estado
ORDER BY u.name, a.estado;

-- 3. VERIFICAR ANTICIPOS POR PERÍODO
-- =====================================================
SELECT 
  'ANTICIPOS POR PERIODO' as analisis,
  p.name as periodo_nombre,
  p.start_date,
  p.end_date,
  COUNT(a.id) as total_anticipos,
  COUNT(CASE WHEN a.estado = 'realizado' THEN 1 END) as realizados,
  SUM(CASE WHEN a.estado = 'realizado' THEN a.monto_solicitado ELSE 0 END) as total_realizado
FROM periods p
LEFT JOIN anticipos a ON p.id = a.period_id
GROUP BY p.id, p.name, p.start_date, p.end_date
ORDER BY p.start_date DESC;

-- 4. VERIFICAR ANTICIPOS REALIZADOS EN PERÍODOS RECIENTES
-- =====================================================
SELECT 
  'ANTICIPOS REALIZADOS RECIENTES' as analisis,
  a.id,
  a.monto_solicitado,
  a.estado,
  a.created_at,
  a.realized_at,
  u.name as modelo_nombre,
  p.name as periodo_nombre,
  p.start_date as periodo_inicio
FROM anticipos a
JOIN users u ON a.model_id = u.id
JOIN periods p ON a.period_id = p.id
WHERE a.estado = 'realizado'
ORDER BY a.realized_at DESC, a.created_at DESC
LIMIT 10;

-- 5. VERIFICAR PERÍODO ACTUAL (Colombia)
-- =====================================================
SELECT 
  'PERIODO ACTUAL' as analisis,
  p.id as periodo_id,
  p.name as periodo_nombre,
  p.start_date,
  p.end_date,
  CURRENT_DATE as fecha_actual,
  EXTRACT(DAY FROM CURRENT_DATE) as dia_actual
FROM periods p
WHERE p.start_date <= CURRENT_DATE 
  AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
ORDER BY p.start_date DESC
LIMIT 1;

-- 6. VERIFICAR ANTICIPOS DEL PERÍODO ACTUAL
-- =====================================================
WITH periodo_actual AS (
  SELECT p.id, p.name, p.start_date, p.end_date
  FROM periods p
  WHERE p.start_date <= CURRENT_DATE 
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
  ORDER BY p.start_date DESC
  LIMIT 1
)
SELECT 
  'ANTICIPOS PERIODO ACTUAL' as analisis,
  pa.name as periodo_nombre,
  pa.start_date,
  COUNT(a.id) as total_anticipos,
  COUNT(CASE WHEN a.estado = 'realizado' THEN 1 END) as realizados,
  SUM(CASE WHEN a.estado = 'realizado' THEN a.monto_solicitado ELSE 0 END) as total_realizado,
  STRING_AGG(DISTINCT a.estado, ', ') as estados_presentes
FROM periodo_actual pa
LEFT JOIN anticipos a ON pa.id = a.period_id
GROUP BY pa.id, pa.name, pa.start_date;

-- 7. VERIFICAR ANTICIPOS POR MODELO EN PERÍODO ACTUAL
-- =====================================================
WITH periodo_actual AS (
  SELECT p.id, p.name, p.start_date, p.end_date
  FROM periods p
  WHERE p.start_date <= CURRENT_DATE 
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
  ORDER BY p.start_date DESC
  LIMIT 1
)
SELECT 
  'ANTICIPOS MODELO PERIODO ACTUAL' as analisis,
  u.name as modelo_nombre,
  u.email as modelo_email,
  a.estado,
  a.monto_solicitado,
  a.created_at,
  a.realized_at,
  pa.name as periodo_nombre
FROM periodo_actual pa
LEFT JOIN anticipos a ON pa.id = a.period_id
LEFT JOIN users u ON a.model_id = u.id
WHERE u.role = 'modelo'
ORDER BY u.name, a.estado;

-- 8. VERIFICAR ESTRUCTURA DE LA TABLA ANTICIPOS
-- =====================================================
SELECT 
  'ESTRUCTURA TABLA ANTICIPOS' as analisis,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'anticipos' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. VERIFICAR ÍNDICES Y CONSTRAINTS
-- =====================================================
SELECT 
  'CONSTRAINTS ANTICIPOS' as analisis,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'anticipos'::regclass;

-- 10. RESUMEN EJECUTIVO
-- =====================================================
SELECT 
  'RESUMEN EJECUTIVO' as analisis,
  (SELECT COUNT(*) FROM anticipos) as total_anticipos,
  (SELECT COUNT(*) FROM anticipos WHERE estado = 'realizado') as anticipos_realizados,
  (SELECT COUNT(*) FROM users WHERE role = 'modelo') as total_modelos,
  (SELECT COUNT(*) FROM periods) as total_periodos,
  (SELECT COUNT(*) FROM periods WHERE start_date <= CURRENT_DATE AND (end_date IS NULL OR end_date >= CURRENT_DATE)) as periodos_activos;
