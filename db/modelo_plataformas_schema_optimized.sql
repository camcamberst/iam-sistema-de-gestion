-- =====================================================
-- PORTAFOLIO MODELOS - ESTRUCTURA DE BASE DE DATOS OPTIMIZADA
-- =====================================================
-- Usa la tabla calculator_platforms existente en lugar de crear plataformas_catalogo
-- Estados: disponible, solicitada, pendiente, entregada, desactivada, inviable
-- =====================================================

-- 🌐 TABLA PRINCIPAL: MODELO PLATAFORMAS
CREATE TABLE IF NOT EXISTS modelo_plataformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'desactivada', 'inviable')) DEFAULT 'disponible',
  
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
  
  -- Constraints
  UNIQUE(model_id, platform_id)
);

-- 📊 HISTORIAL DE CAMBIOS DE ESTADO
CREATE TABLE IF NOT EXISTS modelo_plataformas_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_plataforma_id UUID REFERENCES modelo_plataformas(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- 🔧 ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_model_id ON modelo_plataformas(model_id);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_status ON modelo_plataformas(status);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_platform_id ON modelo_plataformas(platform_id);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_requested_by ON modelo_plataformas(requested_by);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_history_modelo ON modelo_plataformas_history(modelo_plataforma_id);

-- =====================================================
-- 🔐 RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS
ALTER TABLE modelo_plataformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelo_plataformas_history ENABLE ROW LEVEL SECURITY;

-- Políticas para modelo_plataformas
CREATE POLICY "Super admins can manage all modelo_plataformas" ON modelo_plataformas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage modelo_plataformas of their groups" ON modelo_plataformas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN user_groups mg ON ug.group_id = mg.group_id
      WHERE u.id = auth.uid() 
      AND u.raw_user_meta_data->>'role' = 'admin'
      AND mg.user_id = modelo_plataformas.model_id
    )
  );

CREATE POLICY "Models can view their own modelo_plataformas" ON modelo_plataformas
  FOR SELECT USING (model_id = auth.uid());

-- Políticas para historial (mismas que tabla principal)
CREATE POLICY "Super admins can view all history" ON modelo_plataformas_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
    )
  );

CREATE POLICY "Admins can view history of their groups" ON modelo_plataformas_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN modelo_plataformas mp ON mp.id = modelo_plataformas_history.modelo_plataforma_id
      JOIN user_groups mg ON ug.group_id = mg.group_id
      WHERE u.id = auth.uid() 
      AND u.raw_user_meta_data->>'role' = 'admin'
      AND mg.user_id = mp.model_id
    )
  );

-- =====================================================
-- 🔄 TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para modelo_plataformas
CREATE TRIGGER update_modelo_plataformas_updated_at 
  BEFORE UPDATE ON modelo_plataformas 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para registrar cambios de estado
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO modelo_plataformas_history (
      modelo_plataforma_id,
      from_status,
      to_status,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para historial de cambios
CREATE TRIGGER log_modelo_plataformas_status_change
  AFTER UPDATE ON modelo_plataformas
  FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- =====================================================
-- 📊 VISTA DETALLADA PARA CONSULTAS
-- =====================================================

CREATE OR REPLACE VIEW modelo_plataformas_detailed AS
SELECT 
  mp.id,
  mp.model_id,
  u.name as model_name,
  u.email as model_email,
  mp.platform_id,
  cp.name as platform_name,
  cp.id as platform_code, -- Usar el ID como código
  mp.status,
  mp.requested_at,
  mp.delivered_at,
  mp.confirmed_at,
  mp.deactivated_at,
  mp.reverted_at,
  
  -- Información de quién hizo cada acción
  req.name as requested_by_name,
  del.name as delivered_by_name,
  conf.name as confirmed_by_name,
  deact.name as deactivated_by_name,
  rev.name as reverted_by_name,
  
  -- Metadatos
  mp.notes,
  mp.revert_reason,
  mp.is_initial_config,
  mp.calculator_sync,
  mp.calculator_activated_at,
  
  -- Información del grupo de la modelo
  g.name as group_name,
  g.id as group_id,
  
  -- Timestamps
  mp.created_at,
  mp.updated_at
FROM modelo_plataformas mp
JOIN auth.users u ON mp.model_id = u.id
LEFT JOIN calculator_platforms cp ON mp.platform_id = cp.id
LEFT JOIN auth.users req ON mp.requested_by = req.id
LEFT JOIN auth.users del ON mp.delivered_by = del.id
LEFT JOIN auth.users conf ON mp.confirmed_by = conf.id
LEFT JOIN auth.users deact ON mp.deactivated_by = deact.id
LEFT JOIN auth.users rev ON mp.reverted_by = rev.id
LEFT JOIN user_groups ug ON mp.model_id = ug.user_id
LEFT JOIN groups g ON ug.group_id = g.id;

-- =====================================================
-- 🔧 FUNCIONES AUXILIARES
-- =====================================================

-- Función para inicializar plataformas de una modelo
CREATE OR REPLACE FUNCTION initialize_model_platforms(
  p_model_id UUID,
  p_platform_ids TEXT[],
  p_requested_by UUID
)
RETURNS VOID AS $$
DECLARE
  platform_id TEXT;
BEGIN
  FOREACH platform_id IN ARRAY p_platform_ids
  LOOP
    INSERT INTO modelo_plataformas (
      model_id,
      platform_id,
      status,
      requested_at,
      delivered_at,
      confirmed_at,
      requested_by,
      delivered_by,
      confirmed_by,
      is_initial_config,
      calculator_sync,
      calculator_activated_at
    ) VALUES (
      p_model_id,
      platform_id,
      'entregada',
      now(),
      now(),
      now(),
      p_requested_by,
      p_requested_by,
      p_model_id,
      true,
      true,
      now()
    )
    ON CONFLICT (model_id, platform_id) 
    DO UPDATE SET
      status = 'entregada',
      is_initial_config = true,
      calculator_sync = true,
      updated_at = now();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Función para cambiar estado de plataforma
CREATE OR REPLACE FUNCTION change_platform_status(
  p_model_id UUID,
  p_platform_id TEXT,
  p_new_status TEXT,
  p_changed_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  platform_record modelo_plataformas%ROWTYPE;
BEGIN
  -- Obtener registro actual
  SELECT * INTO platform_record
  FROM modelo_plataformas
  WHERE model_id = p_model_id AND platform_id = p_platform_id;
  
  IF NOT FOUND THEN
    -- Crear nuevo registro si no existe
    INSERT INTO modelo_plataformas (
      model_id,
      platform_id,
      status,
      requested_by,
      notes
    ) VALUES (
      p_model_id,
      p_platform_id,
      p_new_status,
      p_changed_by,
      p_reason
    );
  ELSE
    -- Actualizar registro existente
    UPDATE modelo_plataformas SET
      status = p_new_status,
      notes = COALESCE(p_reason, notes),
      delivered_at = CASE WHEN p_new_status = 'entregada' THEN now() ELSE delivered_at END,
      delivered_by = CASE WHEN p_new_status = 'entregada' THEN p_changed_by ELSE delivered_by END,
      deactivated_at = CASE WHEN p_new_status = 'desactivada' THEN now() ELSE deactivated_at END,
      deactivated_by = CASE WHEN p_new_status = 'desactivada' THEN p_changed_by ELSE deactivated_by END,
      reverted_at = CASE WHEN platform_record.status = 'inviable' AND p_new_status != 'inviable' THEN now() ELSE reverted_at END,
      reverted_by = CASE WHEN platform_record.status = 'inviable' AND p_new_status != 'inviable' THEN p_changed_by ELSE reverted_by END,
      revert_reason = CASE WHEN platform_record.status = 'inviable' AND p_new_status != 'inviable' THEN p_reason ELSE revert_reason END,
      updated_at = now()
    WHERE model_id = p_model_id AND platform_id = p_platform_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 🔄 FUNCIÓN PARA SINCRONIZAR PLATAFORMAS EXISTENTES
-- =====================================================

-- Función para sincronizar plataformas activas en calculator_config con modelo_plataformas
CREATE OR REPLACE FUNCTION sync_existing_calculator_platforms()
RETURNS TEXT AS $$
DECLARE
  config_record RECORD;
  platform_id TEXT;
  synced_count INTEGER := 0;
BEGIN
  -- Iterar sobre todas las configuraciones de calculadora
  FOR config_record IN 
    SELECT model_id, enabled_platforms, admin_id
    FROM calculator_config 
    WHERE active = true
  LOOP
    -- Iterar sobre las plataformas habilitadas (array JSON)
    FOR platform_id IN 
      SELECT jsonb_array_elements_text(config_record.enabled_platforms)
    LOOP
      -- Insertar o actualizar en modelo_plataformas
      INSERT INTO modelo_plataformas (
        model_id,
        platform_id,
        status,
        requested_at,
        delivered_at,
        confirmed_at,
        requested_by,
        delivered_by,
        confirmed_by,
        is_initial_config,
        calculator_sync,
        calculator_activated_at
      ) VALUES (
        config_record.model_id,
        platform_id,
        'entregada',
        now(),
        now(),
        now(),
        config_record.admin_id,
        config_record.admin_id,
        config_record.model_id,
        true,
        true,
        now()
      )
      ON CONFLICT (model_id, platform_id) 
      DO UPDATE SET
        status = CASE 
          WHEN modelo_plataformas.status = 'inviable' THEN modelo_plataformas.status 
          ELSE 'entregada' 
        END,
        is_initial_config = true,
        calculator_sync = true,
        calculator_activated_at = COALESCE(modelo_plataformas.calculator_activated_at, now()),
        updated_at = now();
      
      synced_count := synced_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN 'Sincronizadas ' || synced_count || ' plataformas existentes';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 🎯 EJECUTAR SINCRONIZACIÓN INICIAL
-- =====================================================

-- Ejecutar la sincronización de plataformas existentes
SELECT sync_existing_calculator_platforms();
