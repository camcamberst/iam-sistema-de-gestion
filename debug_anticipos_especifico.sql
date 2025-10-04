-- =====================================================
-- 🔍 ANÁLISIS ESPECÍFICO DEL PROBLEMA "YA PAGADOS"
-- =====================================================

-- CONSULTA 1: Verificar anticipos realizados en el período actual
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
  'ANTICIPOS REALIZADOS PERIODO ACTUAL' as resultado,
  pa.name as periodo,
  pa.start_date,
  COUNT(a.id) as total_anticipos,
  SUM(a.monto_solicitado) as total_monto,
  STRING_AGG(
    u.name || ' (' || a.monto_solicitado || ' COP)', 
    ', '
  ) as detalles
FROM periodo_actual pa
LEFT JOIN anticipos a ON pa.id = a.period_id AND a.estado = 'realizado'
LEFT JOIN users u ON a.model_id = u.id
GROUP BY pa.id, pa.name, pa.start_date;

-- CONSULTA 2: Verificar si hay anticipos realizados para modelos específicas
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
  'ANTICIPOS POR MODELO EN PERIODO ACTUAL' as resultado,
  u.name as modelo,
  u.email,
  a.estado,
  a.monto_solicitado,
  a.created_at,
  a.realized_at,
  pa.name as periodo
FROM periodo_actual pa
LEFT JOIN anticipos a ON pa.id = a.period_id
LEFT JOIN users u ON a.model_id = u.id
WHERE u.role = 'modelo'
ORDER BY u.name, a.estado;

-- CONSULTA 3: Verificar todos los estados de anticipos
-- =====================================================
SELECT 
  'DISTRIBUCION DE ESTADOS' as resultado,
  estado,
  COUNT(*) as cantidad,
  SUM(monto_solicitado) as total_monto,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as porcentaje
FROM anticipos
GROUP BY estado
ORDER BY cantidad DESC;

-- CONSULTA 4: Verificar anticipos por fecha de realización
-- =====================================================
SELECT 
  'ANTICIPOS POR FECHA REALIZACION' as resultado,
  DATE(a.realized_at) as fecha_realizacion,
  COUNT(*) as cantidad,
  SUM(a.monto_solicitado) as total_monto,
  STRING_AGG(u.name, ', ') as modelos
FROM anticipos a
JOIN users u ON a.model_id = u.id
WHERE a.estado = 'realizado'
  AND a.realized_at IS NOT NULL
GROUP BY DATE(a.realized_at)
ORDER BY fecha_realizacion DESC
LIMIT 10;

-- CONSULTA 5: Verificar si hay problemas con period_id
-- =====================================================
SELECT 
  'VERIFICACION PERIOD_ID' as resultado,
  a.period_id,
  p.name as periodo_nombre,
  p.start_date,
  COUNT(a.id) as anticipos_count,
  COUNT(CASE WHEN a.estado = 'realizado' THEN 1 END) as realizados_count
FROM anticipos a
LEFT JOIN periods p ON a.period_id = p.id
GROUP BY a.period_id, p.name, p.start_date
ORDER BY p.start_date DESC;

-- CONSULTA 6: Verificar modelos sin anticipos realizados
-- =====================================================
SELECT 
  'MODELOS SIN ANTICIPOS REALIZADOS' as resultado,
  u.name as modelo,
  u.email,
  COUNT(a.id) as total_anticipos,
  COUNT(CASE WHEN a.estado = 'realizado' THEN 1 END) as realizados,
  MAX(a.created_at) as ultimo_anticipo
FROM users u
LEFT JOIN anticipos a ON u.id = a.model_id
WHERE u.role = 'modelo'
GROUP BY u.id, u.name, u.email
HAVING COUNT(CASE WHEN a.estado = 'realizado' THEN 1 END) = 0
ORDER BY u.name;

-- CONSULTA 7: Verificar el endpoint específico que usa la aplicación
-- =====================================================
-- Esta consulta simula exactamente lo que hace el endpoint mi-calculadora-real
WITH periodo_actual AS (
  SELECT p.id, p.name, p.start_date, p.end_date
  FROM periods p
  WHERE p.start_date <= CURRENT_DATE 
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
  ORDER BY p.start_date DESC
  LIMIT 1
),
anticipos_realizados AS (
  SELECT 
    a.model_id,
    SUM(a.monto_solicitado) as total_pagado
  FROM anticipos a
  CROSS JOIN periodo_actual pa
  WHERE a.period_id = pa.id
    AND a.estado = 'realizado'
  GROUP BY a.model_id
)
SELECT 
  'SIMULACION ENDPOINT MI-CALCULADORA-REAL' as resultado,
  u.name as modelo,
  u.email,
  COALESCE(ar.total_pagado, 0) as anticipos_pagados,
  pa.name as periodo,
  pa.start_date
FROM users u
CROSS JOIN periodo_actual pa
LEFT JOIN anticipos_realizados ar ON u.id = ar.model_id
WHERE u.role = 'modelo'
ORDER BY anticipos_pagados DESC, u.name;
