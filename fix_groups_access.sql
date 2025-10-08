-- Habilitar acceso a la tabla groups para el service role
-- Esto permite que la API acceda a la tabla groups

-- Crear política para permitir acceso completo al service role
CREATE POLICY "Enable all access for service role" ON "public"."groups"
AS PERMISSIVE FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Alternativamente, si queremos ser más específicos:
-- CREATE POLICY "Enable read access for service role" ON "public"."groups"
-- AS PERMISSIVE FOR SELECT
-- TO service_role
-- USING (true);

-- CREATE POLICY "Enable insert access for service role" ON "public"."groups"
-- AS PERMISSIVE FOR INSERT
-- TO service_role
-- WITH CHECK (true);

-- CREATE POLICY "Enable update access for service role" ON "public"."groups"
-- AS PERMISSIVE FOR UPDATE
-- TO service_role
-- USING (true)
-- WITH CHECK (true);

-- Verificar que las políticas se crearon correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'groups';
