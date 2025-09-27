-- =====================================================
-- 🔒 CORRECCIÓN DE RLS Y SEGURIDAD
-- =====================================================
-- Script para habilitar RLS y crear políticas de seguridad
-- Sin afectar la funcionalidad existente
-- =====================================================

-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

-- Habilitar RLS en users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en groups  
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en user_groups
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. CREAR POLÍTICAS DE SEGURIDAD
-- =====================================================

-- Política para users: Los usuarios pueden ver su propio perfil y admins pueden ver todos
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    USING (
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Política para users: Solo admins pueden insertar usuarios
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Política para users: Solo admins pueden actualizar usuarios
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Política para users: Solo super_admin puede eliminar usuarios
CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Política para groups: Todos los usuarios autenticados pueden ver grupos
CREATE POLICY "groups_select_policy" ON public.groups
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Política para groups: Solo admins pueden gestionar grupos
CREATE POLICY "groups_insert_policy" ON public.groups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "groups_update_policy" ON public.groups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "groups_delete_policy" ON public.groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Política para user_groups: Los usuarios pueden ver sus propias asignaciones
CREATE POLICY "user_groups_select_policy" ON public.user_groups
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Política para user_groups: Solo admins pueden gestionar asignaciones
CREATE POLICY "user_groups_insert_policy" ON public.user_groups
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "user_groups_update_policy" ON public.user_groups
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "user_groups_delete_policy" ON public.user_groups
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Política para organizations: Solo admins pueden ver organizaciones
CREATE POLICY "organizations_select_policy" ON public.organizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- Política para audit_logs: Solo admins pueden ver auditoría
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

-- 3. CREAR FUNCIÓN PARA AUDITORÍA AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id,
        action,
        severity,
        description,
        organization_id,
        success,
        metadata
    ) VALUES (
        auth.uid(),
        TG_OP,
        'medium',
        'Operación en tabla ' || TG_TABLE_NAME,
        (SELECT organization_id FROM public.users WHERE id = auth.uid()),
        true,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP
        )
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CREAR TRIGGERS DE AUDITORÍA
-- =====================================================

-- Trigger para auditoría en users
CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- Trigger para auditoría en groups
CREATE TRIGGER groups_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- Trigger para auditoría en user_groups
CREATE TRIGGER user_groups_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.user_groups
    FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

-- 5. VERIFICAR CONFIGURACIÓN
-- =====================================================

-- Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'groups', 'user_groups', 'organizations', 'audit_logs');

-- Verificar políticas creadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
