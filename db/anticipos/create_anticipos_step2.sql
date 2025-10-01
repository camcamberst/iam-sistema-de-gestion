-- =====================================================
-- 📋 PASO 2: Crear tabla anticipos
-- =====================================================

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

