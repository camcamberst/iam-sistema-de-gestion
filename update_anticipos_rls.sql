-- Actualizar políticas RLS para incluir las nuevas columnas
-- (Esto se ejecutará automáticamente si las políticas ya existen)

-- Verificar políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'anticipos'
ORDER BY policyname;
