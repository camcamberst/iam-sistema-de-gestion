-- =====================================================
-- 📊 CONFIGURACIÓN: PROMEDIO DIARIO QUINCENAL POR PLATAFORMA
-- =====================================================
-- Sistema de Gestión AIM - Promedio Diario Acumulado
-- =====================================================

-- 1. Crear tabla para estadísticas quincenales por plataforma
CREATE TABLE IF NOT EXISTS platform_quincenal_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id VARCHAR(50) NOT NULL,
  quincena VARCHAR(7) NOT NULL, -- Formato: "2025-01-1" o "2025-01-2"
  daily_avg_usd DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  total_days INTEGER NOT NULL DEFAULT 0,
  total_usd_modelo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Índices únicos para evitar duplicados
  UNIQUE(model_id, platform_id, quincena)
);

-- 2. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_model_id ON platform_quincenal_stats(model_id);
CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_platform_id ON platform_quincenal_stats(platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_quincena ON platform_quincenal_stats(quincena);
CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_created_at ON platform_quincenal_stats(created_at);

-- 3. Agregar comentarios para documentación
COMMENT ON TABLE platform_quincenal_stats IS 'Estadísticas quincenales de promedio diario por plataforma para cada modelo';
COMMENT ON COLUMN platform_quincenal_stats.model_id IS 'ID de la modelo';
COMMENT ON COLUMN platform_quincenal_stats.platform_id IS 'ID de la plataforma (chaturbate, onlyfans, etc.)';
COMMENT ON COLUMN platform_quincenal_stats.quincena IS 'Período quincenal en formato YYYY-MM-N (1=primera quincena, 2=segunda)';
COMMENT ON COLUMN platform_quincenal_stats.daily_avg_usd IS 'Promedio diario de USD modelo en esta quincena';
COMMENT ON COLUMN platform_quincenal_stats.total_days IS 'Total de días con actividad en esta quincena';
COMMENT ON COLUMN platform_quincenal_stats.total_usd_modelo IS 'Total de USD modelo en esta quincena';

-- 4. Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_platform_quincenal_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_platform_quincenal_stats_updated_at
  BEFORE UPDATE ON platform_quincenal_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_quincenal_stats_updated_at();

-- 5. Función para calcular estadísticas de una quincena específica
CREATE OR REPLACE FUNCTION calculate_quincenal_stats(
  p_model_id UUID,
  p_platform_id VARCHAR(50),
  p_quincena VARCHAR(7)
)
RETURNS TABLE(
  daily_avg DECIMAL(8,2),
  total_days INTEGER,
  total_usd DECIMAL(10,2)
) AS $$
DECLARE
  period_start_date DATE;
  period_end_date DATE;
  year_part INTEGER;
  month_part INTEGER;
  quincena_part INTEGER;
BEGIN
  -- Parsear quincena (formato: "2025-01-1" o "2025-01-2")
  year_part := CAST(SPLIT_PART(p_quincena, '-', 1) AS INTEGER);
  month_part := CAST(SPLIT_PART(p_quincena, '-', 2) AS INTEGER);
  quincena_part := CAST(SPLIT_PART(p_quincena, '-', 3) AS INTEGER);
  
  -- Calcular fechas del período
  IF quincena_part = 1 THEN
    period_start_date := DATE(year_part, month_part, 1);
    period_end_date := DATE(year_part, month_part, 15);
  ELSE
    period_start_date := DATE(year_part, month_part, 16);
    period_end_date := DATE(year_part, month_part, EXTRACT(DAY FROM (DATE(year_part, month_part, 1) + INTERVAL '1 MONTH - 1 DAY')));
  END IF;
  
  -- Calcular estadísticas
  RETURN QUERY
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT ch.period_date) > 0 
      THEN ROUND(SUM(ch.usd_modelo) / COUNT(DISTINCT ch.period_date), 2)
      ELSE 0.00
    END as daily_avg,
    COUNT(DISTINCT ch.period_date)::INTEGER as total_days,
    COALESCE(SUM(ch.usd_modelo), 0.00) as total_usd
  FROM calculator_history ch
  WHERE ch.model_id = p_model_id
    AND ch.platform_id = p_platform_id
    AND ch.period_date::DATE >= period_start_date
    AND ch.period_date::DATE <= period_end_date;
END;
$$ LANGUAGE plpgsql;

-- 6. Función para actualizar estadísticas de una quincena
CREATE OR REPLACE FUNCTION update_quincenal_stats(
  p_model_id UUID,
  p_platform_id VARCHAR(50),
  p_quincena VARCHAR(7)
)
RETURNS VOID AS $$
DECLARE
  stats_record RECORD;
  period_start_date DATE;
  period_end_date DATE;
  year_part INTEGER;
  month_part INTEGER;
  quincena_part INTEGER;
BEGIN
  -- Parsear quincena
  year_part := CAST(SPLIT_PART(p_quincena, '-', 1) AS INTEGER);
  month_part := CAST(SPLIT_PART(p_quincena, '-', 2) AS INTEGER);
  quincena_part := CAST(SPLIT_PART(p_quincena, '-', 3) AS INTEGER);
  
  -- Calcular fechas del período
  IF quincena_part = 1 THEN
    period_start_date := DATE(year_part, month_part, 1);
    period_end_date := DATE(year_part, month_part, 15);
  ELSE
    period_start_date := DATE(year_part, month_part, 16);
    period_end_date := DATE(year_part, month_part, EXTRACT(DAY FROM (DATE(year_part, month_part, 1) + INTERVAL '1 MONTH - 1 DAY')));
  END IF;
  
  -- Obtener estadísticas calculadas
  SELECT * INTO stats_record
  FROM calculate_quincenal_stats(p_model_id, p_platform_id, p_quincena);
  
  -- Insertar o actualizar registro
  INSERT INTO platform_quincenal_stats (
    model_id, platform_id, quincena, daily_avg_usd, 
    total_days, total_usd_modelo, period_start, period_end
  ) VALUES (
    p_model_id, p_platform_id, p_quincena, stats_record.daily_avg,
    stats_record.total_days, stats_record.total_usd, period_start_date, period_end_date
  )
  ON CONFLICT (model_id, platform_id, quincena)
  DO UPDATE SET
    daily_avg_usd = EXCLUDED.daily_avg_usd,
    total_days = EXCLUDED.total_days,
    total_usd_modelo = EXCLUDED.total_usd_modelo,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. Función para obtener promedio móvil de últimas N quincenas
CREATE OR REPLACE FUNCTION get_moving_average_daily_avg(
  p_model_id UUID,
  p_platform_id VARCHAR(50),
  p_quincenas_back INTEGER DEFAULT 4
)
RETURNS TABLE(
  current_avg DECIMAL(8,2),
  previous_avg DECIMAL(8,2),
  trend VARCHAR(1), -- '↑', '↓', '='
  quincenas_count INTEGER
) AS $$
DECLARE
  current_avg_val DECIMAL(8,2);
  previous_avg_val DECIMAL(8,2);
  trend_char VARCHAR(1);
  count_val INTEGER;
BEGIN
  -- Obtener promedio de las últimas N quincenas
  SELECT 
    ROUND(AVG(daily_avg_usd), 2),
    COUNT(*)
  INTO current_avg_val, count_val
  FROM platform_quincenal_stats
  WHERE model_id = p_model_id
    AND platform_id = p_platform_id
  ORDER BY quincena DESC
  LIMIT p_quincenas_back;
  
  -- Obtener promedio de las N quincenas anteriores (para comparar tendencia)
  SELECT ROUND(AVG(daily_avg_usd), 2)
  INTO previous_avg_val
  FROM platform_quincenal_stats
  WHERE model_id = p_model_id
    AND platform_id = p_platform_id
  ORDER BY quincena DESC
  OFFSET p_quincenas_back
  LIMIT p_quincenas_back;
  
  -- Determinar tendencia
  IF previous_avg_val IS NULL THEN
    trend_char := '=';
  ELSIF current_avg_val > previous_avg_val THEN
    trend_char := '↑';
  ELSIF current_avg_val < previous_avg_val THEN
    trend_char := '↓';
  ELSE
    trend_char := '=';
  END IF;
  
  RETURN QUERY SELECT 
    COALESCE(current_avg_val, 0.00),
    COALESCE(previous_avg_val, 0.00),
    trend_char,
    count_val;
END;
$$ LANGUAGE plpgsql;

-- 8. Políticas RLS (Row Level Security)
ALTER TABLE platform_quincenal_stats ENABLE ROW LEVEL SECURITY;

-- Política: Las modelos solo pueden ver sus propios datos
CREATE POLICY "Models can view own quincenal stats" ON platform_quincenal_stats
  FOR SELECT USING (auth.uid() = model_id);

-- Política: Solo admins pueden insertar/actualizar
CREATE POLICY "Admins can manage quincenal stats" ON platform_quincenal_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- 9. Verificar que la tabla se creó correctamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'platform_quincenal_stats'
ORDER BY ordinal_position;
