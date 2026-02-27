-- =====================================================
-- MIGRACIÓN: Agregar estado 'reversado' a anticipos
-- =====================================================
-- Permite que un admin revierta una aprobación sin
-- afectar el facturado de la modelo (el anticipo
-- reversado queda excluido de los cálculos de deducción).

-- 1. Eliminar el CHECK constraint actual de 'estado'
ALTER TABLE anticipos
  DROP CONSTRAINT IF EXISTS anticipos_estado_check;

-- 2. Crear el nuevo CHECK con 'reversado' incluido
ALTER TABLE anticipos
  ADD CONSTRAINT anticipos_estado_check
  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'realizado', 'cancelado', 'confirmado', 'reversado'));

-- 3. Agregar columnas de auditoría para la reversión
ALTER TABLE anticipos
  ADD COLUMN IF NOT EXISTS reversed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by  uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS motivo_reversa text;

-- Comentarios
COMMENT ON COLUMN anticipos.reversed_at    IS 'Fecha en que se reversó la aprobación';
COMMENT ON COLUMN anticipos.reversed_by    IS 'Admin que ejecutó la reversión';
COMMENT ON COLUMN anticipos.motivo_reversa IS 'Motivo de la reversión ingresado por el admin';
COMMENT ON COLUMN anticipos.estado         IS 'Estado: pendiente, aprobado, rechazado, realizado, cancelado, confirmado, reversado';
