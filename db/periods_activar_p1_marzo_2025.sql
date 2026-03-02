-- =====================================================
-- Activar P1 de marzo 2025 (1-15 marzo)
-- Ejecutar en Supabase SQL Editor cuando inicie el período
-- =====================================================

-- 1) Desactivar todos los períodos
UPDATE periods SET is_active = false;

-- 2) Insertar P1 marzo 2025 si no existe y activarlo
INSERT INTO periods (name, start_date, end_date, is_active)
VALUES ('Marzo 2025 - Período 1', '2025-03-01', '2025-03-15', true)
ON CONFLICT DO NOTHING;

-- 3) Si ya existía el período, activarlo por fechas (por si no hay UNIQUE)
UPDATE periods
SET is_active = true
WHERE start_date = '2025-03-01' AND end_date = '2025-03-15';

-- Opcional: insertar P2 marzo (16-31) inactivo para tenerlo listo
INSERT INTO periods (name, start_date, end_date, is_active)
VALUES ('Marzo 2025 - Período 2', '2025-03-16', '2025-03-31', false)
ON CONFLICT DO NOTHING;
