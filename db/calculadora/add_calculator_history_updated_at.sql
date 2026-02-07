-- =====================================================
-- Añadir columna updated_at a calculator_history
-- =====================================================
-- Problema: La API de edición de historial enviaba updated_at
-- y la tabla no tenía la columna → error en schema cache.
-- Solución 1 (ya aplicada en código): no enviar updated_at.
-- Solución 2 (opcional): añadir la columna y luego la API
-- puede volver a enviarla si quieres registrar última edición.
-- =====================================================

ALTER TABLE calculator_history
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN calculator_history.updated_at IS 'Última actualización del registro (edición manual o recálculo).';

-- Refrescar schema en Supabase/PostgREST para que el schema cache la reconozca
NOTIFY pgrst, 'reload schema';
