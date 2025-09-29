-- =====================================================
-- 📊 TABLA PARA VALORES DE MODELOS
-- =====================================================
-- Tabla para almacenar los valores ingresados por las modelos
-- en la columna "VALORES" de la calculadora
-- =====================================================

-- Crear tabla model_values
CREATE TABLE IF NOT EXISTS model_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  value numeric(18,6) NOT NULL DEFAULT 0,
  period_id uuid REFERENCES calc_periods(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS model_values_model_id_idx ON model_values (model_id);
CREATE INDEX IF NOT EXISTS model_values_active_idx ON model_values (active);
CREATE INDEX IF NOT EXISTS model_values_platform_idx ON model_values (platform);
CREATE INDEX IF NOT EXISTS model_values_period_idx ON model_values (period_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_model_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_values_updated_at
  BEFORE UPDATE ON model_values
  FOR EACH ROW
  EXECUTE FUNCTION update_model_values_updated_at();

-- RLS (Row Level Security)
ALTER TABLE model_values ENABLE ROW LEVEL SECURITY;

-- Política: Las modelos solo pueden ver/editar sus propios valores
CREATE POLICY model_values_own_data ON model_values
  FOR ALL USING (model_id = auth.uid());

-- Política: Admins pueden ver valores de modelos de sus grupos
CREATE POLICY model_values_admin_access ON model_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN user_groups admin_ug ON admin_ug.group_id = ug.group_id
      WHERE u.id = model_values.model_id
      AND admin_ug.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM users admin_user
        WHERE admin_user.id = auth.uid()
        AND admin_user.role IN ('admin', 'super_admin')
      )
    )
  );

-- Política: Super Admin puede ver todos los valores
CREATE POLICY model_values_super_admin ON model_values
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Verificar que la tabla se creó correctamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'model_values'
ORDER BY ordinal_position;
