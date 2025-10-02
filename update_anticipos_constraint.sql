-- Eliminar constraint existente
ALTER TABLE anticipos DROP CONSTRAINT IF EXISTS anticipos_estado_check;

-- Crear nueva constraint que incluya 'confirmado'
ALTER TABLE anticipos 
ADD CONSTRAINT anticipos_estado_check 
CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'realizado', 'confirmado', 'cancelado'));

-- Verificar que la constraint se aplicó correctamente
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.anticipos'::regclass 
AND contype = 'c'
AND conname = 'anticipos_estado_check';
