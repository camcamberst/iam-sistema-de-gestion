-- =====================================================
-- PASO 1: CREAR TABLA modelo_plataformas
-- =====================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS modelo_plataformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'confirmada', 'desactivada', 'inviable')) DEFAULT 'disponible',
  
  -- Timestamps del flujo
  requested_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ,
  
  -- Referencias de usuarios
  requested_by UUID REFERENCES auth.users(id),
  delivered_by UUID REFERENCES auth.users(id),
  confirmed_by UUID REFERENCES auth.users(id),
  deactivated_by UUID REFERENCES auth.users(id),
  reverted_by UUID REFERENCES auth.users(id),
  
  -- Metadatos
  notes TEXT,
  revert_reason TEXT,
  is_initial_config BOOLEAN DEFAULT false,
  calculator_sync BOOLEAN DEFAULT false,
  calculator_activated_at TIMESTAMPTZ,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(model_id, platform_id)
);

-- Habilitar RLS
ALTER TABLE modelo_plataformas ENABLE ROW LEVEL SECURITY;

-- Crear índices básicos
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_model_id ON modelo_plataformas(model_id);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_status ON modelo_plataformas(status);

SELECT 'Paso 1 completado: Tabla modelo_plataformas creada' as status;
