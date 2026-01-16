-- =====================================================
-- 🔒 SISTEMA DE CIERRE MANUAL DE PERÍODOS - FASE 1
-- =====================================================
-- Este script implementa el sistema de cierre manual seguro
-- que reemplaza el cron automático fallido de Vercel.
--
-- COMPONENTES:
-- 1. Tabla archived_model_values (Soft Delete)
-- 2. Tabla period_closure_locks (Anti-concurrencia)
-- 3. Tabla period_closure_audit_log (Auditoría completa)
-- 4. Funciones auxiliares
-- =====================================================

-- =====================================================
-- 1. TABLA PARA DATOS ARCHIVADOS (Soft Delete)
-- =====================================================
-- Esta tabla es una copia espejo de model_values pero con
-- campos adicionales para auditoría y gestión de archivo.
-- Los datos se MUEVEN aquí cuando se ejecuta la limpieza,
-- no se eliminan físicamente.
-- =====================================================

CREATE TABLE IF NOT EXISTS archived_model_values (
  -- Campos originales de model_values
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL,
  platform_id text NOT NULL,
  value numeric(18,2) NOT NULL DEFAULT 0,
  period_date date NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  
  -- Campos adicionales para soft delete
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid NOT NULL, -- Admin que ejecutó el cierre
  archive_batch_id uuid NOT NULL, -- ID del batch de archivado
  period_type text NOT NULL, -- '1-15' o '16-31'
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  
  -- Metadata adicional
  original_table text NOT NULL DEFAULT 'model_values',
  archive_reason text DEFAULT 'manual_period_closure',
  can_restore boolean NOT NULL DEFAULT true,
  restored_at timestamptz,
  restored_by uuid
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS archived_model_values_model_id_idx ON archived_model_values (model_id);
CREATE INDEX IF NOT EXISTS archived_model_values_platform_id_idx ON archived_model_values (platform_id);
CREATE INDEX IF NOT EXISTS archived_model_values_period_idx ON archived_model_values (period_date);
CREATE INDEX IF NOT EXISTS archived_model_values_batch_idx ON archived_model_values (archive_batch_id);
CREATE INDEX IF NOT EXISTS archived_model_values_archived_at_idx ON archived_model_values (archived_at);
CREATE INDEX IF NOT EXISTS archived_model_values_period_type_idx ON archived_model_values (period_type, period_year, period_month);

-- Constraint para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS archived_model_values_unique 
  ON archived_model_values (model_id, platform_id, period_date, archive_batch_id);

-- =====================================================
-- 2. TABLA PARA SISTEMA DE BLOQUEO (Anti-concurrencia)
-- =====================================================
-- Evita que múltiples admins ejecuten el cierre simultáneamente
-- =====================================================

CREATE TABLE IF NOT EXISTS period_closure_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date date NOT NULL,
  period_type text NOT NULL, -- '1-15' o '16-31'
  operation_type text NOT NULL, -- 'archive' o 'cleanup'
  locked_by uuid NOT NULL, -- Admin que tiene el lock
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, -- Lock expira en 30 minutos
  status text NOT NULL DEFAULT 'active', -- 'active', 'completed', 'failed', 'expired'
  
  -- Metadata
  admin_email text,
  admin_name text,
  progress_percent integer DEFAULT 0,
  models_processed integer DEFAULT 0,
  models_total integer DEFAULT 0,
  
  -- Timestamps
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);

-- Índices
CREATE INDEX IF NOT EXISTS period_closure_locks_period_idx ON period_closure_locks (period_date, period_type);
CREATE INDEX IF NOT EXISTS period_closure_locks_status_idx ON period_closure_locks (status);
CREATE INDEX IF NOT EXISTS period_closure_locks_locked_by_idx ON period_closure_locks (locked_by);

-- Función para limpiar locks expirados automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
  UPDATE period_closure_locks
  SET status = 'expired'
  WHERE status = 'active' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. TABLA PARA AUDITORÍA COMPLETA
-- =====================================================
-- Registra TODAS las operaciones del sistema de cierre
-- =====================================================

CREATE TABLE IF NOT EXISTS period_closure_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  
  -- Operación
  operation_type text NOT NULL, -- 'archive_start', 'archive_complete', 'cleanup_start', etc.
  period_date date NOT NULL,
  period_type text NOT NULL,
  batch_id uuid, -- Relacionado con archive_batch_id
  
  -- Usuario
  user_id uuid NOT NULL,
  user_email text,
  user_role text,
  user_group_id uuid,
  
  -- Detalles
  details jsonb DEFAULT '{}'::jsonb,
  models_affected integer DEFAULT 0,
  records_affected integer DEFAULT 0,
  
  -- Resultado
  status text NOT NULL, -- 'success', 'failed', 'partial'
  error_message text,
  execution_time_ms integer,
  
  -- Metadata
  ip_address text,
  user_agent text
);

-- Índices
CREATE INDEX IF NOT EXISTS period_closure_audit_log_timestamp_idx ON period_closure_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS period_closure_audit_log_operation_idx ON period_closure_audit_log (operation_type);
CREATE INDEX IF NOT EXISTS period_closure_audit_log_user_idx ON period_closure_audit_log (user_id);
CREATE INDEX IF NOT EXISTS period_closure_audit_log_period_idx ON period_closure_audit_log (period_date, period_type);
CREATE INDEX IF NOT EXISTS period_closure_audit_log_batch_idx ON period_closure_audit_log (batch_id);

-- =====================================================
-- 4. FUNCIONES AUXILIARES
-- =====================================================

-- Función para adquirir lock de operación
CREATE OR REPLACE FUNCTION acquire_period_closure_lock(
  p_period_date date,
  p_period_type text,
  p_operation_type text,
  p_user_id uuid,
  p_user_email text,
  p_user_name text
)
RETURNS jsonb AS $$
DECLARE
  v_lock_id uuid;
  v_existing_lock record;
BEGIN
  -- Limpiar locks expirados primero
  PERFORM cleanup_expired_locks();
  
  -- Verificar si ya existe un lock activo
  SELECT * INTO v_existing_lock
  FROM period_closure_locks
  WHERE period_date = p_period_date
    AND period_type = p_period_type
    AND operation_type = p_operation_type
    AND status = 'active'
    AND expires_at > now()
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'locked',
      'locked_by', v_existing_lock.admin_email,
      'locked_at', v_existing_lock.locked_at,
      'expires_at', v_existing_lock.expires_at
    );
  END IF;
  
  -- Crear nuevo lock
  INSERT INTO period_closure_locks (
    period_date,
    period_type,
    operation_type,
    locked_by,
    expires_at,
    admin_email,
    admin_name,
    status
  ) VALUES (
    p_period_date,
    p_period_type,
    p_operation_type,
    p_user_id,
    now() + interval '30 minutes',
    p_user_email,
    p_user_name,
    'active'
  )
  RETURNING id INTO v_lock_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'lock_id', v_lock_id,
    'expires_at', now() + interval '30 minutes'
  );
END;
$$ LANGUAGE plpgsql;

-- Función para liberar lock
CREATE OR REPLACE FUNCTION release_period_closure_lock(
  p_lock_id uuid,
  p_status text DEFAULT 'completed',
  p_failure_reason text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  UPDATE period_closure_locks
  SET 
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END,
    failed_at = CASE WHEN p_status = 'failed' THEN now() ELSE NULL END,
    failure_reason = p_failure_reason
  WHERE id = p_lock_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar progreso del lock
CREATE OR REPLACE FUNCTION update_lock_progress(
  p_lock_id uuid,
  p_models_processed integer,
  p_models_total integer
)
RETURNS void AS $$
BEGIN
  UPDATE period_closure_locks
  SET 
    models_processed = p_models_processed,
    models_total = p_models_total,
    progress_percent = CASE 
      WHEN p_models_total > 0 THEN (p_models_processed::numeric / p_models_total::numeric * 100)::integer
      ELSE 0
    END
  WHERE id = p_lock_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VISTA PARA REPORTES DE CIERRE
-- =====================================================

CREATE OR REPLACE VIEW period_closure_status AS
SELECT 
  pl.period_date,
  pl.period_type,
  pl.operation_type,
  pl.status,
  pl.locked_by,
  pl.admin_email,
  pl.locked_at,
  pl.completed_at,
  pl.progress_percent,
  pl.models_processed,
  pl.models_total,
  EXTRACT(EPOCH FROM (COALESCE(pl.completed_at, now()) - pl.locked_at)) as duration_seconds,
  
  -- Contar registros archivados
  (SELECT COUNT(*) 
   FROM archived_model_values amv 
   WHERE amv.period_date = pl.period_date 
     AND amv.period_type = pl.period_type
  ) as records_archived,
  
  -- Contar registros activos restantes
  (SELECT COUNT(*) 
   FROM model_values mv 
   WHERE mv.period_date = pl.period_date
  ) as records_remaining
  
FROM period_closure_locks pl
ORDER BY pl.locked_at DESC;

-- =====================================================
-- 6. PERMISOS RLS (Row Level Security)
-- =====================================================

-- Los admins pueden ver logs de su grupo
ALTER TABLE period_closure_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON period_closure_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'admin_aff', 'superadmin_aff')
    )
  );

-- Los admins pueden ver locks activos
ALTER TABLE period_closure_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view locks" ON period_closure_locks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'admin_aff', 'superadmin_aff')
    )
  );

-- Los admins pueden ver datos archivados de su grupo
ALTER TABLE archived_model_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view archived data" ON archived_model_values
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'admin_aff', 'superadmin_aff')
    )
  );

-- =====================================================
-- 7. FUNCIÓN PARA VERIFICAR ESTADO DEL SISTEMA
-- =====================================================

CREATE OR REPLACE FUNCTION get_period_closure_system_status()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'active_locks', (
      SELECT COUNT(*) 
      FROM period_closure_locks 
      WHERE status = 'active' AND expires_at > now()
    ),
    'total_archived_records', (
      SELECT COUNT(*) FROM archived_model_values
    ),
    'archived_size_mb', (
      SELECT pg_size_pretty(pg_total_relation_size('archived_model_values'))
    ),
    'last_archive_date', (
      SELECT MAX(archived_at) FROM archived_model_values
    ),
    'recent_operations', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'operation', operation_type,
          'period', period_date,
          'status', status,
          'timestamp', timestamp
        )
      )
      FROM (
        SELECT * FROM period_closure_audit_log 
        ORDER BY timestamp DESC 
        LIMIT 10
      ) recent
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ✅ SCRIPT COMPLETADO
-- =====================================================
-- Este script crea todas las tablas y funciones necesarias
-- para el sistema de cierre manual seguro.
--
-- PRÓXIMOS PASOS:
-- 1. Ejecutar este script en Supabase
-- 2. Crear endpoints API para archivado y limpieza
-- 3. Crear UI en Dashboard Sedes
-- =====================================================
