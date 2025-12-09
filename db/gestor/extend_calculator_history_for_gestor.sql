-- =====================================================
-- 📊 EXTENDER CALCULATOR_HISTORY PARA GESTOR
-- =====================================================
-- Agregar campos opcionales para el flujo de auditoría del gestor
-- sin afectar la funcionalidad existente
-- =====================================================

-- Agregar columnas opcionales para el flujo del gestor
-- Estas columnas son NULL por defecto, así que no afectan datos existentes

-- 1. Estado del registro (para auditoría)
ALTER TABLE calculator_history 
ADD COLUMN IF NOT EXISTS estado TEXT CHECK (
  estado IS NULL OR estado IN ('pendiente_auditoria', 'en_auditoria', 'auditado', 'rechazado', 'corregido')
);

-- 2. Quién registró el valor (gestor)
ALTER TABLE calculator_history 
ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Quién auditó el registro (admin)
ALTER TABLE calculator_history 
ADD COLUMN IF NOT EXISTS auditado_por UUID REFERENCES users(id) ON DELETE SET NULL;

-- 4. Fecha de auditoría
ALTER TABLE calculator_history 
ADD COLUMN IF NOT EXISTS auditado_at TIMESTAMPTZ;

-- 5. Notas de auditoría
ALTER TABLE calculator_history 
ADD COLUMN IF NOT EXISTS notas_auditoria TEXT;

-- 6. Sede/Grupo (opcional, para facilitar consultas)
ALTER TABLE calculator_history 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- Índices para optimizar consultas del gestor
CREATE INDEX IF NOT EXISTS idx_calculator_history_estado ON calculator_history(estado) WHERE estado IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calculator_history_registrado_por ON calculator_history(registrado_por) WHERE registrado_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calculator_history_group_id ON calculator_history(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calculator_history_group_periodo ON calculator_history(group_id, period_date, period_type) WHERE group_id IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN calculator_history.estado IS 'Estado del registro para auditoría: pendiente_auditoria, en_auditoria, auditado, rechazado, corregido. NULL para registros históricos normales.';
COMMENT ON COLUMN calculator_history.registrado_por IS 'ID del gestor que registró el ingreso exacto. NULL para valores archivados automáticamente.';
COMMENT ON COLUMN calculator_history.auditado_por IS 'ID del admin que auditó el registro. NULL si aún no ha sido auditado.';
COMMENT ON COLUMN calculator_history.auditado_at IS 'Fecha y hora cuando se auditó el registro.';
COMMENT ON COLUMN calculator_history.notas_auditoria IS 'Notas del admin durante la auditoría.';
COMMENT ON COLUMN calculator_history.group_id IS 'ID del grupo/sede al que pertenece el modelo. Facilita consultas por sede.';

-- Actualizar RLS para permitir acceso del gestor
-- (Las políticas existentes ya deberían cubrir esto, pero verificamos)

-- Política adicional: Gestores pueden ver y crear registros con estado
-- (Esto se puede hacer si es necesario, pero las políticas existentes pueden ser suficientes)

