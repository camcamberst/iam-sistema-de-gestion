-- =====================================================
-- SISTEMA AURORA PIN (CONTACTOS DE CHAT)
-- =====================================================

-- 1. FUNCIÓN PARA GENERAR UN PIN HEXADECIMAL DE 8 CARACTERES
CREATE OR REPLACE FUNCTION generate_aurora_pin()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := '0123456789ABCDEF';
  result VARCHAR(8) := '';
  i INTEGER := 0;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. AGREGAR LA COLUMNA AURORA_PIN A LA TABLA DE USUARIOS
-- Asumiendo que la tabla principal se llama "users". Si se llama "profiles", cámbialo aquí.
ALTER TABLE users ADD COLUMN IF NOT EXISTS aurora_pin VARCHAR(8) UNIQUE;

-- 3. ASIGNAR PIN A USUARIOS EXISTENTES
UPDATE users SET aurora_pin = generate_aurora_pin() WHERE aurora_pin IS NULL;

-- 4. CREAR TABLA DE CONTACTOS POR PIN
CREATE TABLE IF NOT EXISTS chat_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- 5. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_users_aurora_pin ON users(aurora_pin);
CREATE INDEX IF NOT EXISTS idx_chat_contacts_user_id ON chat_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_contacts_contact_id ON chat_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_chat_contacts_status ON chat_contacts(status);

-- 6. POLÍTICAS DE SEGURIDAD (RLS) PARA CHAT_CONTACTS
ALTER TABLE chat_contacts ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propios contactos y solicitudes (tanto enviadas como recibidas)
CREATE POLICY "Users can view their own contacts" ON chat_contacts
FOR SELECT USING (
  user_id = auth.uid() OR contact_id = auth.uid()
);

-- Los usuarios pueden crear solicitudes donde ellos sean el remitente
CREATE POLICY "Users can create contact requests" ON chat_contacts
FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Los usuarios pueden actualizar las solicitudes que recibieron (para aceptar o bloquear)
-- o pueden actualizar las suyas propias (para cancelar)
CREATE POLICY "Users can update their contacts" ON chat_contacts
FOR UPDATE USING (
  user_id = auth.uid() OR contact_id = auth.uid()
);

-- Superadmins pueden ver todos los contactos (para auditoría)
CREATE POLICY "Super admins can view all contacts" ON chat_contacts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- ✅ CONFIRMACIÓN
SELECT 'Sistema Aurora PIN inicializado correctamente' as status;
