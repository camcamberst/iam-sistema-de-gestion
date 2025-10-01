-- =====================================================
-- 📋 CREAR ESQUEMA DE ANTICIPOS
-- =====================================================
-- Estado: Implementación inicial
-- Descripción: Tabla para gestionar solicitudes de anticipos de modelos

-- Crear tabla anticipos
CREATE TABLE IF NOT EXISTS anticipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  
  -- Datos de la solicitud
  monto_solicitado numeric(18,2) NOT NULL,
  porcentaje_solicitado numeric(5,2) NOT NULL, -- Porcentaje del COP Modelo disponible
  monto_disponible numeric(18,2) NOT NULL, -- COP Modelo disponible al momento de la solicitud
  
  -- Medio de pago
  medio_pago text NOT NULL CHECK (medio_pago IN ('nequi', 'daviplata', 'cuenta_bancaria')),
  
  -- Datos para NEQUI/DAVIPLATA
  nombre_beneficiario text,
  numero_telefono text,
  
  -- Datos para cuenta bancaria
  nombre_titular text,
  banco text,
  banco_otro text, -- Si banco = 'otros'
  tipo_cuenta text CHECK (tipo_cuenta IN ('ahorros', 'corriente')),
  numero_cuenta text,
  documento_titular text,
  
  -- Estado y gestión
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'realizado', 'cancelado')),
  comentarios_admin text,
  comentarios_rechazo text,
  
  -- Auditoría
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES public.users(id),
  realized_at timestamptz,
  realized_by uuid REFERENCES public.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.users(id)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_anticipos_model_id ON anticipos(model_id);
CREATE INDEX IF NOT EXISTS idx_anticipos_period_id ON anticipos(period_id);
CREATE INDEX IF NOT EXISTS idx_anticipos_estado ON anticipos(estado);
CREATE INDEX IF NOT EXISTS idx_anticipos_created_at ON anticipos(created_at);
CREATE INDEX IF NOT EXISTS idx_anticipos_model_period ON anticipos(model_id, period_id);

-- Crear tabla periods si no existe
CREATE TABLE IF NOT EXISTS periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- "Enero 2024 - Período 1", "Enero 2024 - Período 2"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Crear índice para periods
CREATE INDEX IF NOT EXISTS idx_periods_active ON periods(is_active);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON periods(start_date, end_date);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_anticipos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER trigger_update_anticipos_updated_at
  BEFORE UPDATE ON anticipos
  FOR EACH ROW
  EXECUTE FUNCTION update_anticipos_updated_at();

-- RLS (Row Level Security)
ALTER TABLE anticipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;

-- Políticas para anticipos
CREATE POLICY "Modelos pueden ver sus propios anticipos" ON anticipos
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Modelos pueden crear sus propios anticipos" ON anticipos
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Modelos pueden actualizar sus propios anticipos pendientes" ON anticipos
  FOR UPDATE USING (auth.uid() = model_id AND estado = 'pendiente');

CREATE POLICY "Admins pueden ver anticipos de su grupo" ON anticipos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.users u2 ON u1.group_id = u2.group_id
      WHERE u1.id = auth.uid() 
      AND u2.id = anticipos.model_id
      AND u1.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins pueden ver todos los anticipos" ON anticipos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Políticas para periods
CREATE POLICY "Todos pueden ver periods activos" ON periods
  FOR SELECT USING (is_active = true);

CREATE POLICY "Solo super admins pueden gestionar periods" ON periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Insertar períodos actuales (ejemplo)
INSERT INTO periods (name, start_date, end_date, is_active) VALUES
  ('Diciembre 2024 - Período 1', '2024-12-01', '2024-12-15', true),
  ('Diciembre 2024 - Período 2', '2024-12-16', '2024-12-31', false)
ON CONFLICT DO NOTHING;

-- Comentarios en la tabla
COMMENT ON TABLE anticipos IS 'Solicitudes de anticipos de modelos';
COMMENT ON COLUMN anticipos.model_id IS 'ID del modelo que solicita el anticipo';
COMMENT ON COLUMN anticipos.period_id IS 'ID del período (1-15 o 16-fin de mes)';
COMMENT ON COLUMN anticipos.monto_solicitado IS 'Monto solicitado en COP';
COMMENT ON COLUMN anticipos.porcentaje_solicitado IS 'Porcentaje del COP Modelo disponible';
COMMENT ON COLUMN anticipos.monto_disponible IS 'COP Modelo disponible al momento de la solicitud';
COMMENT ON COLUMN anticipos.medio_pago IS 'Medio de pago: nequi, daviplata, cuenta_bancaria';
COMMENT ON COLUMN anticipos.estado IS 'Estado: pendiente, aprobado, rechazado, realizado, cancelado';
COMMENT ON COLUMN anticipos.comentarios_admin IS 'Comentarios del admin al aprobar';
COMMENT ON COLUMN anticipos.comentarios_rechazo IS 'Comentarios del admin al rechazar';
