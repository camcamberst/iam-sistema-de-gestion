-- =====================================================
-- PORTAFOLIO MODELOS - ESTRUCTURA DE BASE DE DATOS
-- =====================================================
-- Tabla para gestión de plataformas por modelo
-- Estados: disponible, solicitada, pendiente, entregada, desactivada, inviable
-- =====================================================

-- 🌐 TABLA PRINCIPAL: MODELO PLATAFORMAS
CREATE TABLE IF NOT EXISTS modelo_plataformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_name VARCHAR(100) NOT NULL,
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
  UNIQUE(model_id, platform_name)
);

-- 📋 CATÁLOGO DE PLATAFORMAS DISPONIBLES
CREATE TABLE IF NOT EXISTS plataformas_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(10) NOT NULL UNIQUE, -- LIV, CAM, MOD, etc.
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_platform ON modelo_plataformas(platform_name);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_requested_by ON modelo_plataformas(requested_by);
CREATE INDEX IF NOT EXISTS idx_plataformas_catalogo_active ON plataformas_catalogo(is_active);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_history_modelo ON modelo_plataformas_history(modelo_plataforma_id);

-- =====================================================
-- 🔐 RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS
ALTER TABLE modelo_plataformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataformas_catalogo ENABLE ROW LEVEL SECURITY;
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

-- Políticas para plataformas_catalogo (todos pueden leer)
CREATE POLICY "Everyone can read plataformas_catalogo" ON plataformas_catalogo
  FOR SELECT USING (true);

CREATE POLICY "Only super_admins can manage plataformas_catalogo" ON plataformas_catalogo
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'super_admin'
    )
  );

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
  mp.platform_name,
  pc.code as platform_code,
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
LEFT JOIN plataformas_catalogo pc ON mp.platform_name = pc.name
LEFT JOIN auth.users req ON mp.requested_by = req.id
LEFT JOIN auth.users del ON mp.delivered_by = del.id
LEFT JOIN auth.users conf ON mp.confirmed_by = conf.id
LEFT JOIN auth.users deact ON mp.deactivated_by = deact.id
LEFT JOIN auth.users rev ON mp.reverted_by = rev.id
LEFT JOIN user_groups ug ON mp.model_id = ug.user_id
LEFT JOIN groups g ON ug.group_id = g.id;

-- =====================================================
-- 📋 DATOS INICIALES - CATÁLOGO DE PLATAFORMAS
-- =====================================================

INSERT INTO plataformas_catalogo (name, code, description) VALUES
('LIVECREATOR', 'LIV', 'Plataforma LiveCreator'),
('CAMCONTACTS', 'CAM', 'Plataforma CamContacts'),
('MODELKA', 'MOD', 'Plataforma Modelka'),
('777', '777', 'Plataforma 777'),
('MDH', 'MDH', 'Plataforma MDH'),
('VX', 'VX', 'Plataforma VX'),
('BIG7', 'BIG7', 'Plataforma Big7'),
('SUPERFOON', 'SUP', 'Plataforma Superfoon'),
('ADULTWORK', 'AW', 'Plataforma AdultWork'),
('SECRETFRIENDS', 'SF', 'Plataforma SecretFriends'),
('SKYPRIVATE', 'SKY', 'Plataforma SkyPrivate'),
('MONDO', 'MON', 'Plataforma Mondo'),
('IMLIVE', 'IML', 'Plataforma ImLive'),
('XMODELS', 'XM', 'Plataforma XModels'),
('DIRTYFANS', 'DF', 'Plataforma DirtyFans'),
('JASMIN', 'JAS', 'Plataforma Jasmin'),
('DXLIVE', 'DX', 'Plataforma DXLive'),
('BABESTATION', 'BS', 'Plataforma BabeStation'),
('HEGRE', 'HEG', 'Plataforma Hegre'),
('MYFREECAMS', 'MFC', 'Plataforma MyFreeCams'),
('STRIPCHAT', 'SC', 'Plataforma StripChat'),
('CHATURBATE', 'CB', 'Plataforma Chaturbate')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 🔧 FUNCIONES AUXILIARES
-- =====================================================

-- Función para inicializar plataformas de una modelo
CREATE OR REPLACE FUNCTION initialize_model_platforms(
  p_model_id UUID,
  p_platforms TEXT[],
  p_requested_by UUID
)
RETURNS VOID AS $$
DECLARE
  platform_name TEXT;
BEGIN
  FOREACH platform_name IN ARRAY p_platforms
  LOOP
    INSERT INTO modelo_plataformas (
      model_id,
      platform_name,
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
      platform_name,
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
    ON CONFLICT (model_id, platform_name) 
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
  p_platform_name TEXT,
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
  WHERE model_id = p_model_id AND platform_name = p_platform_name;
  
  IF NOT FOUND THEN
    -- Crear nuevo registro si no existe
    INSERT INTO modelo_plataformas (
      model_id,
      platform_name,
      status,
      requested_by,
      notes
    ) VALUES (
      p_model_id,
      p_platform_name,
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
    WHERE model_id = p_model_id AND platform_name = p_platform_name;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
