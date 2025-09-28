-- =====================================================
-- 🔧 FIX AUDIT_LOGS - AGREGAR COLUMNAS FALTANTES
-- =====================================================

-- Verificar estructura actual de audit_logs
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Agregar columnas faltantes si no existen
DO $$ 
BEGIN
    -- Agregar columna severity si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'severity'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN severity TEXT;
    END IF;

    -- Agregar columna description si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'description'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN description TEXT;
    END IF;

    -- Agregar columna metadata si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'metadata'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;

    -- Agregar columna ip_address si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'ip_address'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN ip_address TEXT;
    END IF;

    -- Agregar columna user_agent si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'user_agent'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN user_agent TEXT;
    END IF;

    -- Agregar columna organization_id si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'organization_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN organization_id UUID;
    END IF;

    -- Agregar columna timestamp si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'timestamp'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Agregar columna success si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'success'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN success BOOLEAN DEFAULT true;
    END IF;

    -- Agregar columna error_message si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'error_message'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN error_message TEXT;
    END IF;

    -- Agregar columna created_at si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_logs' 
        AND column_name = 'created_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.audit_logs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Agregar constraints si no existen
DO $$
BEGIN
    -- Agregar constraint de severity si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%audit_logs_severity%'
    ) THEN
        ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_severity_check 
        CHECK (severity IN ('low', 'medium', 'high', 'critical'));
    END IF;
END $$;

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON public.audit_logs(organization_id);

-- Habilitar RLS si no está habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = 'audit_logs' 
        AND relrowsecurity = true
    ) THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Eliminar políticas existentes si existen (para evitar conflictos)
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Crear políticas de seguridad
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'admin')
        )
    );

CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);

-- Verificar estructura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;
