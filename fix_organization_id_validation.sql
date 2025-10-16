-- =====================================================
-- 🔧 CORRECCIÓN: Validación para organization_id
-- =====================================================
-- Prevenir que futuros modelos tengan organization_id null
-- =====================================================

-- 1. Función para validar organization_id en usuarios
CREATE OR REPLACE FUNCTION validate_user_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el usuario es un modelo y no tiene organization_id, asignar el del grupo
  IF NEW.role = 'modelo' AND NEW.organization_id IS NULL THEN
    -- Buscar el organization_id del primer grupo del usuario
    SELECT g.organization_id INTO NEW.organization_id
    FROM user_groups ug
    JOIN groups g ON ug.group_id = g.id
    WHERE ug.user_id = NEW.id
    LIMIT 1;
    
    -- Si aún no tiene organization_id, usar la organización por defecto
    IF NEW.organization_id IS NULL THEN
      SELECT id INTO NEW.organization_id 
      FROM organizations 
      WHERE name = 'Agencia Innova' 
      LIMIT 1;
    END IF;
    
    -- Log de la corrección
    RAISE NOTICE '🔧 [TRIGGER] Corrigiendo organization_id para modelo %: null → %', NEW.email, NEW.organization_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Crear trigger para INSERT
DROP TRIGGER IF EXISTS trg_validate_user_organization_id_ins ON users;
CREATE TRIGGER trg_validate_user_organization_id_ins
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_organization_id();

-- 3. Crear trigger para UPDATE
DROP TRIGGER IF EXISTS trg_validate_user_organization_id_upd ON users;
CREATE TRIGGER trg_validate_user_organization_id_upd
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_organization_id();

-- 4. Corregir el modelo existente con organization_id null
UPDATE users 
SET organization_id = (
  SELECT g.organization_id
  FROM user_groups ug
  JOIN groups g ON ug.group_id = g.id
  WHERE ug.user_id = users.id
  LIMIT 1
)
WHERE role = 'modelo' 
  AND organization_id IS NULL
  AND id IN (
    SELECT ug.user_id
    FROM user_groups ug
    JOIN groups g ON ug.group_id = g.id
    WHERE g.organization_id IS NOT NULL
  );

-- 5. Verificar la corrección
SELECT 
  u.id,
  u.email,
  u.name,
  u.organization_id,
  g.name as group_name,
  o.name as organization_name
FROM users u
LEFT JOIN user_groups ug ON u.id = ug.user_id
LEFT JOIN groups g ON ug.group_id = g.id
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE u.role = 'modelo'
ORDER BY u.email;
