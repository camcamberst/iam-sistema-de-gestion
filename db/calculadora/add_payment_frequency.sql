-- =====================================================
-- AGREGAR CAMPO payment_frequency A calculator_platforms
-- =====================================================
-- Este campo indica si la plataforma paga mensualmente o quincenalmente
-- Valores: 'quincenal' (default) | 'mensual'
-- =====================================================

-- 1. Agregar columna payment_frequency
ALTER TABLE calculator_platforms 
ADD COLUMN IF NOT EXISTS payment_frequency TEXT 
DEFAULT 'quincenal' 
CHECK (payment_frequency IN ('quincenal', 'mensual'));

-- 2. Crear índice para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_calculator_platforms_payment_frequency 
ON calculator_platforms(payment_frequency);

-- 3. Comentario en la columna
COMMENT ON COLUMN calculator_platforms.payment_frequency IS 
'Frecuencia de pago: quincenal (default) o mensual. Las plataformas mensuales requieren restar P1 de P2 en el período 16-31.';
