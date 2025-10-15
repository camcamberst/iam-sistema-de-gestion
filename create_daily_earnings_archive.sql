-- =====================================================
-- ARCHIVO DIARIO DE GANANCIAS - SISTEMA DE GESTIÓN AIM
-- =====================================================

-- 1. Crear tabla de historial de ganancias diarias
CREATE TABLE IF NOT EXISTS daily_earnings_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earnings_date DATE NOT NULL,
  earnings_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índice para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_daily_earnings_history_model_date 
ON daily_earnings_history(model_id, earnings_date);

-- 3. Función para archivar ganancias diarias
CREATE OR REPLACE FUNCTION archive_daily_earnings()
RETURNS void AS $$
DECLARE
  yesterday_date DATE;
  archived_count INTEGER;
BEGIN
  -- Obtener la fecha de ayer
  yesterday_date := CURRENT_DATE - INTERVAL '1 day';
  
  -- Insertar en historial las ganancias de ayer
  INSERT INTO daily_earnings_history (model_id, earnings_date, earnings_amount)
  SELECT model_id, earnings_date, earnings_amount
  FROM daily_earnings
  WHERE earnings_date = yesterday_date;
  
  -- Contar registros archivados
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Eliminar las ganancias de ayer de la tabla principal
  DELETE FROM daily_earnings
  WHERE earnings_date = yesterday_date;
  
  -- Log del proceso
  RAISE NOTICE 'Archivadas % ganancias del día %', archived_count, yesterday_date;
  
END;
$$ LANGUAGE plpgsql;

-- 4. Función para reiniciar ganancias del día actual
CREATE OR REPLACE FUNCTION reset_today_earnings()
RETURNS void AS $$
DECLARE
  today_date DATE;
  reset_count INTEGER;
BEGIN
  -- Obtener la fecha de hoy
  today_date := CURRENT_DATE;
  
  -- Eliminar ganancias del día actual (reiniciar)
  DELETE FROM daily_earnings
  WHERE earnings_date = today_date;
  
  -- Contar registros eliminados
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Log del proceso
  RAISE NOTICE 'Reiniciadas % ganancias del día %', reset_count, today_date;
  
END;
$$ LANGUAGE plpgsql;

-- 5. Función combinada: archivar ayer y reiniciar hoy
CREATE OR REPLACE FUNCTION daily_earnings_maintenance()
RETURNS void AS $$
BEGIN
  -- Archivar ganancias de ayer
  PERFORM archive_daily_earnings();
  
  -- Reiniciar ganancias de hoy
  PERFORM reset_today_earnings();
  
  RAISE NOTICE 'Mantenimiento diario de ganancias completado a las %', NOW();
  
END;
$$ LANGUAGE plpgsql;

-- 6. Habilitar RLS en la tabla de historial
ALTER TABLE daily_earnings_history ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS para la tabla de historial
CREATE POLICY "Models can view own daily earnings history" ON daily_earnings_history
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Admins can view all daily earnings history" ON daily_earnings_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- 8. Crear función para consultar historial de ganancias
CREATE OR REPLACE FUNCTION get_daily_earnings_history(
  p_model_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  model_id UUID,
  model_name TEXT,
  earnings_date DATE,
  earnings_amount DECIMAL(10,2),
  archived_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    deh.model_id,
    COALESCE(u.name, u.email) as model_name,
    deh.earnings_date,
    deh.earnings_amount,
    deh.archived_at
  FROM daily_earnings_history deh
  JOIN auth.users u ON u.id = deh.model_id
  WHERE 
    (p_model_id IS NULL OR deh.model_id = p_model_id)
    AND (p_start_date IS NULL OR deh.earnings_date >= p_start_date)
    AND (p_end_date IS NULL OR deh.earnings_date <= p_end_date)
  ORDER BY deh.earnings_date DESC, deh.model_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Comentarios para documentación
COMMENT ON TABLE daily_earnings_history IS 'Historial de ganancias diarias archivadas';
COMMENT ON FUNCTION archive_daily_earnings() IS 'Archiva las ganancias del día anterior al historial';
COMMENT ON FUNCTION reset_today_earnings() IS 'Reinicia las ganancias del día actual';
COMMENT ON FUNCTION daily_earnings_maintenance() IS 'Función combinada: archiva ayer y reinicia hoy';
COMMENT ON FUNCTION get_daily_earnings_history(UUID, DATE, DATE) IS 'Consulta el historial de ganancias diarias con filtros opcionales';
