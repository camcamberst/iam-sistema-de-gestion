-- Agregar columnas faltantes para el estado 'confirmado'
ALTER TABLE anticipos 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_anticipos_confirmed_at ON anticipos(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_anticipos_confirmed_by ON anticipos(confirmed_by);

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'anticipos'
AND column_name IN ('confirmed_at', 'confirmed_by')
ORDER BY column_name;
