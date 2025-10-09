-- =====================================================
-- NUEVA ARQUITECTURA: ROOM ASSIGNMENTS
-- =====================================================
-- Tabla limpia para asignaciones de modelos a rooms/jornadas
-- Reemplaza modelo_assignments con lógica simplificada
-- =====================================================

-- 1. 🏗️ TABLA PRINCIPAL
CREATE TABLE room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES group_rooms(id) ON DELETE CASCADE,
  jornada VARCHAR(10) NOT NULL CHECK (jornada IN ('MAÑANA', 'TARDE', 'NOCHE')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES users(id),
  
  -- CONSTRAINT CLAVE: Una modelo por jornada GLOBAL
  -- (no puede estar en TARDE en Room1 Y Room2 simultáneamente)
  UNIQUE(model_id, jornada)
);

-- 2. 🔧 ÍNDICES PARA RENDIMIENTO
CREATE INDEX idx_room_assignments_model_id ON room_assignments(model_id);
CREATE INDEX idx_room_assignments_room_id ON room_assignments(room_id);
CREATE INDEX idx_room_assignments_jornada ON room_assignments(jornada);
CREATE INDEX idx_room_assignments_room_jornada ON room_assignments(room_id, jornada);

-- 3. 🔐 RLS (ROW LEVEL SECURITY)
ALTER TABLE room_assignments ENABLE ROW LEVEL SECURITY;

-- Política: Super admins pueden gestionar todas las asignaciones
CREATE POLICY "Super admins can manage all room assignments" ON room_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Política: Admins pueden gestionar asignaciones de sus grupos
CREATE POLICY "Admins can manage room assignments in their groups" ON room_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      JOIN group_rooms gr ON ug.group_id = gr.group_id
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
      AND gr.id = room_assignments.room_id
    )
  );

-- Política: Modelos pueden ver sus propias asignaciones
CREATE POLICY "Models can view their own room assignments" ON room_assignments
  FOR SELECT USING (model_id = auth.uid());

-- 4. 📊 FUNCIÓN PARA VALIDAR REGLAS DE NEGOCIO
CREATE OR REPLACE FUNCTION validate_room_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que no haya más de 2 modelos en el mismo room+jornada
  IF (
    SELECT COUNT(*) 
    FROM room_assignments 
    WHERE room_id = NEW.room_id 
    AND jornada = NEW.jornada
    AND id != COALESCE(NEW.id, gen_random_uuid())
  ) >= 2 THEN
    RAISE EXCEPTION 'Máximo 2 modelos permitidas por room y jornada';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 🔄 TRIGGER PARA VALIDACIÓN
CREATE TRIGGER validate_room_assignment_trigger
  BEFORE INSERT OR UPDATE ON room_assignments
  FOR EACH ROW EXECUTE FUNCTION validate_room_assignment();

-- 6. 📋 VISTA PARA CONSULTAS COMPLEJAS
CREATE VIEW room_assignments_detailed AS
SELECT 
  ra.id,
  ra.model_id,
  ra.room_id,
  ra.jornada,
  ra.assigned_at,
  ra.assigned_by,
  u.name as model_name,
  u.email as model_email,
  gr.room_name,
  g.name as group_name,
  g.id as group_id
FROM room_assignments ra
JOIN users u ON ra.model_id = u.id
JOIN group_rooms gr ON ra.room_id = gr.id
JOIN groups g ON gr.group_id = g.id
ORDER BY ra.assigned_at DESC;

-- 7. ✅ VERIFICACIÓN DE IMPLEMENTACIÓN
-- Verificar que la tabla se creó correctamente
SELECT 
  'room_assignments' as tabla,
  COUNT(*) as registros
FROM room_assignments;

-- Verificar constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'room_assignments'::regclass;
