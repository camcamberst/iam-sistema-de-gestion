-- =====================================================
-- 💰 CREAR ESQUEMA DE AHORROS
-- =====================================================
-- Estado: Implementación inicial
-- Descripción: Sistema completo de ahorro para modelos
-- =====================================================

-- Tabla: Solicitudes de ahorro por período
CREATE TABLE IF NOT EXISTS model_savings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_date date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('1-15', '16-31')),
  
  -- Datos del ahorro
  neto_pagar_base numeric(18,2) NOT NULL, -- NETO A PAGAR del período (base de cálculo)
  monto_ahorrado numeric(18,2) NOT NULL, -- Monto en COP que se ahorrará
  porcentaje_ahorrado numeric(5,2) NOT NULL, -- Porcentaje del neto_pagar usado
  tipo_solicitud text NOT NULL CHECK (tipo_solicitud IN ('monto', 'porcentaje')), -- Si fue por monto fijo o porcentaje
  
  -- Estado y gestión
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'cancelado')),
  comentarios_admin text,
  comentarios_rechazo text,
  monto_ajustado numeric(18,2), -- Monto ajustado por admin (si difiere del solicitado)
  
  -- Auditoría
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id),
  rejected_at timestamptz,
  rejected_by uuid REFERENCES public.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.users(id),
  
  -- Constraint: Solo una solicitud activa por modelo/período
  UNIQUE(model_id, period_date, period_type)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_savings_model_id ON model_savings(model_id);
CREATE INDEX IF NOT EXISTS idx_savings_period ON model_savings(period_date, period_type);
CREATE INDEX IF NOT EXISTS idx_savings_estado ON model_savings(estado);
CREATE INDEX IF NOT EXISTS idx_savings_created_at ON model_savings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_savings_model_period ON model_savings(model_id, period_date, period_type);

-- Tabla: Retiros de ahorro
CREATE TABLE IF NOT EXISTS savings_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Datos del retiro
  monto_solicitado numeric(18,2) NOT NULL,
  porcentaje_retiro numeric(5,2) NOT NULL, -- Porcentaje del total ahorrado
  
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
  
  -- Tiempo de procesamiento
  tiempo_procesamiento text, -- '48h' o '3dias' según porcentaje
  fecha_aprobacion_estimada timestamptz, -- Fecha estimada de pago
  
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

-- Índices para retiros
CREATE INDEX IF NOT EXISTS idx_withdrawals_model_id ON savings_withdrawals(model_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_estado ON savings_withdrawals(estado);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON savings_withdrawals(created_at DESC);

-- Tabla: Ajustes manuales de ahorro (por admin)
CREATE TABLE IF NOT EXISTS savings_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  savings_id uuid REFERENCES model_savings(id) ON DELETE SET NULL, -- Si el ajuste es sobre una solicitud específica
  
  -- Datos del ajuste
  tipo_ajuste text NOT NULL CHECK (tipo_ajuste IN ('correccion', 'bono', 'deduccion', 'otro')),
  concepto text NOT NULL, -- Descripción del ajuste
  monto numeric(18,2) NOT NULL, -- Monto positivo (suma) o negativo (resta)
  
  -- Auditoría
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.users(id), -- Admin que hizo el ajuste
  comentarios text -- Comentarios adicionales del admin
);

-- Índices para ajustes
CREATE INDEX IF NOT EXISTS idx_adjustments_model_id ON savings_adjustments(model_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_savings_id ON savings_adjustments(savings_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_created_at ON savings_adjustments(created_at DESC);

-- Tabla: Metas de ahorro (opcional)
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Datos de la meta
  nombre_meta text NOT NULL,
  monto_meta numeric(18,2) NOT NULL,
  fecha_limite date,
  
  -- Estado
  estado text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'completada', 'cancelada')),
  monto_actual numeric(18,2) DEFAULT 0, -- Se calcula dinámicamente, pero se puede cachear
  
  -- Auditoría
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- Índices para metas
CREATE INDEX IF NOT EXISTS idx_goals_model_id ON savings_goals(model_id);
CREATE INDEX IF NOT EXISTS idx_goals_estado ON savings_goals(estado);

-- Funciones para actualizar updated_at
CREATE OR REPLACE FUNCTION update_savings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_withdrawals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_update_savings_updated_at
  BEFORE UPDATE ON model_savings
  FOR EACH ROW
  EXECUTE FUNCTION update_savings_updated_at();

CREATE TRIGGER trigger_update_withdrawals_updated_at
  BEFORE UPDATE ON savings_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_withdrawals_updated_at();

CREATE TRIGGER trigger_update_goals_updated_at
  BEFORE UPDATE ON savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_goals_updated_at();

-- RLS (Row Level Security)
ALTER TABLE model_savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- Políticas para model_savings
CREATE POLICY "Modelos pueden ver sus propios ahorros" ON model_savings
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Modelos pueden crear sus propios ahorros" ON model_savings
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Modelos pueden actualizar sus ahorros pendientes" ON model_savings
  FOR UPDATE USING (auth.uid() = model_id AND estado = 'pendiente');

CREATE POLICY "Modelos pueden cancelar sus ahorros pendientes" ON model_savings
  FOR UPDATE USING (auth.uid() = model_id AND estado = 'pendiente');

CREATE POLICY "Admins pueden ver ahorros de su grupo" ON model_savings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.user_groups ug1 ON u1.id = ug1.user_id
      JOIN public.user_groups ug2 ON ug1.group_id = ug2.group_id
      JOIN public.users u2 ON ug2.user_id = u2.id
      WHERE u1.id = auth.uid() 
      AND u2.id = model_savings.model_id
      AND u1.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins pueden gestionar todos los ahorros" ON model_savings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Políticas para savings_withdrawals
CREATE POLICY "Modelos pueden ver sus propios retiros" ON savings_withdrawals
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Modelos pueden crear sus propios retiros" ON savings_withdrawals
  FOR INSERT WITH CHECK (auth.uid() = model_id);

CREATE POLICY "Modelos pueden actualizar sus retiros pendientes" ON savings_withdrawals
  FOR UPDATE USING (auth.uid() = model_id AND estado = 'pendiente');

CREATE POLICY "Admins pueden ver retiros de su grupo" ON savings_withdrawals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.user_groups ug1 ON u1.id = ug1.user_id
      JOIN public.user_groups ug2 ON ug1.group_id = ug2.group_id
      JOIN public.users u2 ON ug2.user_id = u2.id
      WHERE u1.id = auth.uid() 
      AND u2.id = savings_withdrawals.model_id
      AND u1.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins pueden gestionar todos los retiros" ON savings_withdrawals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Políticas para savings_adjustments
CREATE POLICY "Modelos pueden ver sus propios ajustes" ON savings_adjustments
  FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Solo admins pueden crear ajustes" ON savings_adjustments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins pueden ver ajustes de su grupo" ON savings_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.user_groups ug1 ON u1.id = ug1.user_id
      JOIN public.user_groups ug2 ON ug1.group_id = ug2.group_id
      JOIN public.users u2 ON ug2.user_id = u2.id
      WHERE u1.id = auth.uid() 
      AND u2.id = savings_adjustments.model_id
      AND u1.role IN ('admin', 'super_admin')
    )
  );

-- Políticas para savings_goals
CREATE POLICY "Modelos pueden gestionar sus propias metas" ON savings_goals
  FOR ALL USING (auth.uid() = model_id);

CREATE POLICY "Admins pueden ver metas de su grupo" ON savings_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u1
      JOIN public.user_groups ug1 ON u1.id = ug1.user_id
      JOIN public.user_groups ug2 ON ug1.group_id = ug2.group_id
      JOIN public.users u2 ON ug2.user_id = u2.id
      WHERE u1.id = auth.uid() 
      AND u2.id = savings_goals.model_id
      AND u1.role IN ('admin', 'super_admin')
    )
  );

-- Comentarios en las tablas
COMMENT ON TABLE model_savings IS 'Solicitudes de ahorro de modelos por período';
COMMENT ON TABLE savings_withdrawals IS 'Retiros de ahorro solicitados por modelos';
COMMENT ON TABLE savings_adjustments IS 'Ajustes manuales de ahorro realizados por admins';
COMMENT ON TABLE savings_goals IS 'Metas de ahorro personalizadas de modelos';

COMMENT ON COLUMN model_savings.neto_pagar_base IS 'NETO A PAGAR del período (base de cálculo)';
COMMENT ON COLUMN model_savings.monto_ahorrado IS 'Monto en COP que se ahorrará';
COMMENT ON COLUMN model_savings.porcentaje_ahorrado IS 'Porcentaje del neto_pagar usado';
COMMENT ON COLUMN model_savings.monto_ajustado IS 'Monto ajustado por admin (si difiere del solicitado)';
COMMENT ON COLUMN savings_withdrawals.tiempo_procesamiento IS 'Tiempo estimado: 48h (<50%) o 3dias (>50%)';
COMMENT ON COLUMN savings_adjustments.monto IS 'Monto positivo (suma) o negativo (resta) al saldo';
