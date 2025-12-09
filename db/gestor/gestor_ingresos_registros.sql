-- =====================================================
-- 📊 TABLA DE REGISTROS DE INGRESOS DEL GESTOR
-- =====================================================
-- Esta tabla almacena los ingresos EXACTOS registrados por el gestor
-- al finalizar cada período, basándose en la estructura del Excel "CocoStats"
-- =====================================================

-- Tabla principal: Registro de ingresos por modelo, plataforma y período
CREATE TABLE IF NOT EXISTS gestor_ingresos_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación del modelo
  model_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Identificación de la sede
  sede_id UUID REFERENCES sedes(id) ON DELETE SET NULL,
  
  -- Período del registro
  periodo_date DATE NOT NULL,
  periodo_type TEXT NOT NULL CHECK (periodo_type IN ('1-15', '16-31')),
  
  -- Plataforma (referencia a calculator_platforms)
  platform_id TEXT NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  
  -- Valores ingresados (exactos del gestor)
  -- Para plataformas con tokens/puntos: valor en tokens/puntos
  -- Para plataformas con USD/EUR/GBP: valor en la moneda correspondiente
  valor_ingresado NUMERIC(18,6) NOT NULL DEFAULT 0,
  
  -- Estado del registro
  estado TEXT NOT NULL DEFAULT 'pendiente_auditoria' CHECK (
    estado IN ('pendiente_auditoria', 'en_auditoria', 'auditado', 'rechazado', 'corregido')
  ),
  
  -- Auditoría
  registrado_por UUID NOT NULL REFERENCES users(id), -- Gestor que registró
  auditado_por UUID REFERENCES users(id), -- Admin que auditó
  auditado_at TIMESTAMPTZ,
  notas_auditoria TEXT, -- Notas del admin durante la auditoría
  
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: Un solo registro por modelo/plataforma/período
  UNIQUE(model_id, platform_id, periodo_date, periodo_type)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_model_id ON gestor_ingresos_registros(model_id);
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_sede_id ON gestor_ingresos_registros(sede_id);
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_periodo ON gestor_ingresos_registros(periodo_date, periodo_type);
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_platform_id ON gestor_ingresos_registros(platform_id);
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_estado ON gestor_ingresos_registros(estado);
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_registrado_por ON gestor_ingresos_registros(registrado_por);

-- Índice compuesto para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_gestor_ingresos_sede_periodo ON gestor_ingresos_registros(sede_id, periodo_date, periodo_type);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_gestor_ingresos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gestor_ingresos_updated_at
  BEFORE UPDATE ON gestor_ingresos_registros
  FOR EACH ROW
  EXECUTE FUNCTION update_gestor_ingresos_updated_at();

-- RLS (Row Level Security)
ALTER TABLE gestor_ingresos_registros ENABLE ROW LEVEL SECURITY;

-- Política: Gestores pueden ver y crear registros
CREATE POLICY gestor_ingresos_gestor_access ON gestor_ingresos_registros
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'gestor'
    )
  );

-- Política: Admins pueden ver y auditar registros de sus grupos/sedes
CREATE POLICY gestor_ingresos_admin_access ON gestor_ingresos_registros
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Política: Modelos pueden ver sus propios registros (solo lectura)
CREATE POLICY gestor_ingresos_modelo_read ON gestor_ingresos_registros
  FOR SELECT USING (model_id = auth.uid());

-- Comentarios para documentación
COMMENT ON TABLE gestor_ingresos_registros IS 'Registros de ingresos exactos registrados por el gestor al finalizar cada período';
COMMENT ON COLUMN gestor_ingresos_registros.model_id IS 'ID del modelo al que pertenece el ingreso';
COMMENT ON COLUMN gestor_ingresos_registros.sede_id IS 'ID de la sede donde trabaja el modelo';
COMMENT ON COLUMN gestor_ingresos_registros.periodo_date IS 'Fecha del período (usualmente el día 1 o 16 del mes)';
COMMENT ON COLUMN gestor_ingresos_registros.periodo_type IS 'Tipo de período: 1-15 (primera quincena) o 16-31 (segunda quincena)';
COMMENT ON COLUMN gestor_ingresos_registros.platform_id IS 'ID de la plataforma (referencia a calculator_platforms)';
COMMENT ON COLUMN gestor_ingresos_registros.valor_ingresado IS 'Valor exacto ingresado por el gestor (en la moneda/tokens de la plataforma)';
COMMENT ON COLUMN gestor_ingresos_registros.estado IS 'Estado del registro: pendiente_auditoria, en_auditoria, auditado, rechazado, corregido';
COMMENT ON COLUMN gestor_ingresos_registros.registrado_por IS 'ID del gestor que registró el ingreso';
COMMENT ON COLUMN gestor_ingresos_registros.auditado_por IS 'ID del admin que auditó el registro';
COMMENT ON COLUMN gestor_ingresos_registros.notas_auditoria IS 'Notas del admin durante la auditoría';

