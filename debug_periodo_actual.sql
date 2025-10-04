-- =====================================================
-- 🔍 DEBUG: VERIFICAR PERÍODO ACTUAL Y ANTICIPOS
-- =====================================================

-- 1. VERIFICAR PERÍODO ACTUAL (lo que usa la aplicación)
-- =====================================================
SELECT 
  'PERIODO ACTUAL APLICACION' as analisis,
  p.id as periodo_id,
  p.name as periodo_nombre,
  p.start_date,
  p.end_date,
  CURRENT_DATE as fecha_actual,
  EXTRACT(DAY FROM CURRENT_DATE) as dia_actual,
  CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 15 THEN 'Período 1 (1-15)'
    ELSE 'Período 2 (16-fin de mes)'
  END as periodo_esperado
FROM periods p
WHERE p.start_date <= CURRENT_DATE 
  AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
ORDER BY p.start_date DESC
LIMIT 1;

-- 2. VERIFICAR ANTICIPOS DEL PERÍODO ACTUAL
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
  COUNT(CASE WHEN a.estado = 'confirmado' THEN 1 END) as confirmados,
  SUM(CASE WHEN a.estado = 'confirmado' THEN a.monto_solicitado ELSE 0 END) as total_confirmado,
  STRING_AGG(
    CASE WHEN a.estado = 'confirmado' THEN 
      a.id || ':' || a.monto_solicitado || ':' || a.realized_at 
    END, 
    ' | '
  ) as detalles_confirmados
FROM periodo_actual pa
LEFT JOIN anticipos a ON pa.id = a.period_id
GROUP BY pa.id, pa.name, pa.start_date;

-- 3. VERIFICAR ANTICIPOS POR MODELO EN PERÍODO ACTUAL
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
  'ANTICIPOS POR MODELO PERIODO ACTUAL' as analisis,
  u.name as modelo_nombre,
  u.email as modelo_email,
  a.estado,
  a.monto_solicitado,
  a.created_at,
  a.realized_at,
  pa.name as periodo_nombre,
  pa.id as periodo_id
FROM periodo_actual pa
LEFT JOIN anticipos a ON pa.id = a.period_id
LEFT JOIN users u ON a.model_id = u.id
WHERE u.role = 'modelo'
ORDER BY u.name, a.estado;

-- 4. VERIFICAR TODOS LOS PERÍODOS Y SUS ANTICIPOS
-- =====================================================
SELECT 
  'TODOS LOS PERIODOS' as analisis,
  p.id as periodo_id,
  p.name as periodo_nombre,
  p.start_date,
  p.end_date,
  COUNT(a.id) as total_anticipos,
  COUNT(CASE WHEN a.estado = 'confirmado' THEN 1 END) as confirmados,
  SUM(CASE WHEN a.estado = 'confirmado' THEN a.monto_solicitado ELSE 0 END) as total_confirmado
FROM periods p
LEFT JOIN anticipos a ON p.id = a.period_id
GROUP BY p.id, p.name, p.start_date, p.end_date
ORDER BY p.start_date DESC;
