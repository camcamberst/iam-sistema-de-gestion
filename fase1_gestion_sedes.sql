-- =====================================================
-- FASE 1: GESTIÓN SEDES - BASE DE DATOS
-- =====================================================
-- Implementación segura sin impacto en funcionalidad existente
-- Punto de retorno: commit aeed79a
-- =====================================================

-- 🏗️ NUEVAS TABLAS PARA GESTIÓN SEDES

-- 1. 📊 SEDES (equivalente a grupos pero con funcionalidad extendida)
CREATE TABLE sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name)
);

-- 2. 🏠 ROOMS POR SEDE
CREATE TABLE sede_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID REFERENCES sedes(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sede_id, room_name)
);

-- 3. 👥 ASIGNACIONES DE MODELOS (jornada y room)
CREATE TABLE modelo_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id) ON DELETE CASCADE,
  room_id UUID REFERENCES sede_rooms(id) ON DELETE CASCADE,
  jornada VARCHAR(20) CHECK (jornada IN ('MAÑANA', 'TARDE', 'NOCHE')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(model_id, sede_id, room_id, jornada)
);

-- 4. 🌐 SOLICITUDES DE PLATAFORMAS
CREATE TABLE plataforma_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('SOLICITADA', 'ENTREGADA', 'FALLIDA', 'PENDIENTE')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  requested_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(model_id, platform_id)
);

-- 5. 📋 ESTADOS DE JORNADAS (disponible, ocupada, no disponible)
CREATE TABLE jornada_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID REFERENCES sedes(id) ON DELETE CASCADE,
  room_id UUID REFERENCES sede_rooms(id) ON DELETE CASCADE,
  jornada VARCHAR(20) CHECK (jornada IN ('MAÑANA', 'TARDE', 'NOCHE')),
  state VARCHAR(20) CHECK (state IN ('DISPONIBLE', 'OCUPADA', 'NO_DISPONIBLE')),
  model_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(sede_id, room_id, jornada)
);

-- =====================================================
-- 🔧 ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX idx_sede_rooms_sede_id ON sede_rooms(sede_id);
CREATE INDEX idx_modelo_assignments_model_id ON modelo_assignments(model_id);
CREATE INDEX idx_modelo_assignments_sede_id ON modelo_assignments(sede_id);
CREATE INDEX idx_modelo_assignments_room_id ON modelo_assignments(room_id);
CREATE INDEX idx_plataforma_requests_model_id ON plataforma_requests(model_id);
CREATE INDEX idx_plataforma_requests_status ON plataforma_requests(status);
CREATE INDEX idx_jornada_states_sede_room ON jornada_states(sede_id, room_id);

-- =====================================================
-- 🔐 RLS (ROW LEVEL SECURITY)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sede_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelo_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_states ENABLE ROW LEVEL SECURITY;

-- Políticas para sedes
CREATE POLICY "Super admins can manage all sedes" ON sedes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage sedes in their groups" ON sedes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
      AND g.name = sedes.name
    )
  );

-- Políticas para rooms
CREATE POLICY "Users can view rooms in their sedes" ON sede_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      JOIN sedes s ON g.name = s.name
      WHERE u.id = auth.uid() 
      AND s.id = sede_rooms.sede_id
    )
  );

CREATE POLICY "Admins can manage rooms in their sedes" ON sede_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      JOIN sedes s ON g.name = s.name
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin')
      AND s.id = sede_rooms.sede_id
    )
  );

-- Políticas para asignaciones
CREATE POLICY "Users can view their own assignments" ON modelo_assignments
  FOR SELECT USING (model_id = auth.uid());

CREATE POLICY "Admins can manage assignments in their sedes" ON modelo_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      JOIN sedes s ON g.name = s.name
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin')
      AND s.id = modelo_assignments.sede_id
    )
  );

-- Políticas para solicitudes de plataformas
CREATE POLICY "Users can view their own platform requests" ON plataforma_requests
  FOR SELECT USING (model_id = auth.uid());

CREATE POLICY "Admins can manage platform requests in their sedes" ON plataforma_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      JOIN sedes s ON g.name = s.name
      JOIN modelo_assignments ma ON s.id = ma.sede_id
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin')
      AND ma.model_id = plataforma_requests.model_id
    )
  );

-- Políticas para estados de jornadas
CREATE POLICY "Users can view jornada states in their sedes" ON jornada_states
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      JOIN sedes s ON g.name = s.name
      WHERE u.id = auth.uid() 
      AND s.id = jornada_states.sede_id
    )
  );

CREATE POLICY "Admins can manage jornada states in their sedes" ON jornada_states
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN groups g ON ug.group_id = g.id
      JOIN sedes s ON g.name = s.name
      WHERE u.id = auth.uid() 
      AND u.role IN ('admin', 'super_admin')
      AND s.id = jornada_states.sede_id
    )
  );

-- =====================================================
-- 📊 DATOS INICIALES
-- =====================================================

-- Crear sede "Sede MP" basada en el Excel
INSERT INTO sedes (name, description) VALUES 
('Sede MP', 'Sede principal con 9 rooms');

-- Obtener el ID de la sede creada
DO $$
DECLARE
    sede_mp_id UUID;
BEGIN
    SELECT id INTO sede_mp_id FROM sedes WHERE name = 'Sede MP';
    
    -- Crear 9 rooms para Sede MP
    INSERT INTO sede_rooms (sede_id, room_name) VALUES 
    (sede_mp_id, 'ROOM01'),
    (sede_mp_id, 'ROOM02'),
    (sede_mp_id, 'ROOM03'),
    (sede_mp_id, 'ROOM04'),
    (sede_mp_id, 'ROOM05'),
    (sede_mp_id, 'ROOM06'),
    (sede_mp_id, 'ROOM07'),
    (sede_mp_id, 'ROOM08'),
    (sede_mp_id, 'ROOM09');
    
    -- Inicializar estados de jornadas como DISPONIBLE
    INSERT INTO jornada_states (sede_id, room_id, jornada, state)
    SELECT 
        sede_mp_id,
        sr.id,
        j.jornada,
        'DISPONIBLE'
    FROM sede_rooms sr
    CROSS JOIN (
        SELECT 'MAÑANA' as jornada
        UNION SELECT 'TARDE'
        UNION SELECT 'NOCHE'
    ) j
    WHERE sr.sede_id = sede_mp_id;
END $$;

-- =====================================================
-- 🔄 TRIGGERS PARA MANTENER CONSISTENCIA
-- =====================================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sedes_updated_at BEFORE UPDATE ON sedes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sede_rooms_updated_at BEFORE UPDATE ON sede_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para sincronizar estados de jornadas con asignaciones
CREATE OR REPLACE FUNCTION sync_jornada_states()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Actualizar estado a OCUPADA cuando se asigna una modelo
        UPDATE jornada_states 
        SET 
            state = 'OCUPADA',
            model_id = NEW.model_id,
            updated_at = now(),
            updated_by = NEW.assigned_by
        WHERE sede_id = NEW.sede_id 
        AND room_id = NEW.room_id 
        AND jornada = NEW.jornada
        AND is_active = true;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Actualizar estado a DISPONIBLE cuando se desasigna una modelo
        UPDATE jornada_states 
        SET 
            state = 'DISPONIBLE',
            model_id = NULL,
            updated_at = now()
        WHERE sede_id = OLD.sede_id 
        AND room_id = OLD.room_id 
        AND jornada = OLD.jornada;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER sync_jornada_states_trigger
    AFTER INSERT OR UPDATE OR DELETE ON modelo_assignments
    FOR EACH ROW EXECUTE FUNCTION sync_jornada_states();

-- =====================================================
-- ✅ VERIFICACIÓN DE IMPLEMENTACIÓN
-- =====================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    'sedes' as tabla,
    COUNT(*) as registros
FROM sedes
UNION ALL
SELECT 
    'sede_rooms' as tabla,
    COUNT(*) as registros
FROM sede_rooms
UNION ALL
SELECT 
    'modelo_assignments' as tabla,
    COUNT(*) as registros
FROM modelo_assignments
UNION ALL
SELECT 
    'plataforma_requests' as tabla,
    COUNT(*) as registros
FROM plataforma_requests
UNION ALL
SELECT 
    'jornada_states' as tabla,
    COUNT(*) as registros
FROM jornada_states;

-- Verificar rooms creados para Sede MP
SELECT 
    s.name as sede,
    sr.room_name,
    sr.is_active
FROM sedes s
JOIN sede_rooms sr ON s.id = sr.sede_id
WHERE s.name = 'Sede MP'
ORDER BY sr.room_name;

-- Verificar estados de jornadas inicializados
SELECT 
    s.name as sede,
    sr.room_name,
    js.jornada,
    js.state
FROM sedes s
JOIN sede_rooms sr ON s.id = sr.sede_id
JOIN jornada_states js ON sr.id = js.room_id
WHERE s.name = 'Sede MP'
ORDER BY sr.room_name, js.jornada;
