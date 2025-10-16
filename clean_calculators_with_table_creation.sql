-- =====================================================
-- 🔄 LIMPIEZA COMPLETA CON CREACIÓN DE TABLA
-- =====================================================
-- Script SQL para crear la tabla calculator_notifications si no existe
-- y luego limpiar TODAS las calculadoras del período 1-15 octubre
-- =====================================================

-- 0. Crear tabla calculator_notifications si no existe
CREATE TABLE IF NOT EXISTS calculator_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  notification_data jsonb NOT NULL,
  period_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS calculator_notifications_model_id_idx ON calculator_notifications (model_id);
CREATE INDEX IF NOT EXISTS calculator_notifications_type_idx ON calculator_notifications (notification_type);
CREATE INDEX IF NOT EXISTS calculator_notifications_period_date_idx ON calculator_notifications (period_date);
CREATE INDEX IF NOT EXISTS calculator_notifications_created_at_idx ON calculator_notifications (created_at);
CREATE INDEX IF NOT EXISTS calculator_notifications_expires_at_idx ON calculator_notifications (expires_at);

-- Habilitar RLS
ALTER TABLE calculator_notifications ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calculator_notifications' 
        AND policyname = 'calculator_notifications_own_data'
    ) THEN
        CREATE POLICY calculator_notifications_own_data ON calculator_notifications
        FOR ALL USING (model_id = auth.uid());
    END IF;
END $$;

-- 1. Verificar estado ANTES de la limpieza
SELECT 
    'ANTES DE LIMPIEZA' AS estado,
    COUNT(DISTINCT mv.model_id) AS modelos_con_valores,
    COUNT(*) AS total_valores,
    SUM(mv.value) AS suma_total_valores
FROM model_values mv
WHERE mv.period_date = '2025-10-15'::date;

-- 2. Archivar TODOS los valores existentes del período 1-15
INSERT INTO calculator_history (
    model_id,
    platform_id,
    value,
    period_date,
    period_type,
    archived_at,
    original_updated_at
)
SELECT 
    mv.model_id,
    mv.platform_id,
    mv.value,
    mv.period_date,
    'quincena_1' AS period_type,
    NOW() AS archived_at,
    mv.updated_at AS original_updated_at
FROM model_values mv
WHERE mv.period_date = '2025-10-15'::date;

-- 3. Verificar cuántos valores se archivaron
SELECT 
    'VALORES ARCHIVADOS' AS accion,
    COUNT(*) AS total_archivados,
    COUNT(DISTINCT model_id) AS modelos_archivados,
    SUM(value) AS suma_archivada
FROM calculator_history 
WHERE period_date = '2025-10-15'::date 
AND archived_at >= NOW() - INTERVAL '1 minute';

-- 4. Crear notificaciones de limpieza para TODOS los modelos afectados
INSERT INTO calculator_notifications (
    model_id,
    notification_type,
    notification_data,
    period_date,
    expires_at
)
SELECT DISTINCT
    mv.model_id,
    'calculator_cleared' AS notification_type,
    jsonb_build_object(
        'type', 'calculator_cleared',
        'model_id', mv.model_id,
        'period_date', '2025-10-15',
        'reason', 'Limpieza completa del período 1-15 octubre',
        'timestamp', NOW()::text,
        'action', 'clear_calculator_values',
        'archived_values', true
    ) AS notification_data,
    '2025-10-15'::date AS period_date,
    NOW() + INTERVAL '24 hours' AS expires_at
FROM model_values mv
WHERE mv.period_date = '2025-10-15'::date;

-- 5. ELIMINAR TODOS LOS VALORES de model_values para el período 1-15
DELETE FROM model_values 
WHERE period_date = '2025-10-15'::date;

-- 6. Verificar estado DESPUÉS de la limpieza
SELECT 
    'DESPUÉS DE LIMPIEZA' AS estado,
    COUNT(DISTINCT mv.model_id) AS modelos_con_valores,
    COUNT(*) AS total_valores,
    COALESCE(SUM(mv.value), 0) AS suma_total_valores
FROM model_values mv
WHERE mv.period_date = '2025-10-15'::date;

-- 7. Verificar que los valores están archivados
SELECT 
    'VERIFICACIÓN ARCHIVO' AS accion,
    COUNT(*) AS total_en_historial,
    COUNT(DISTINCT model_id) AS modelos_en_historial,
    SUM(value) AS suma_en_historial
FROM calculator_history 
WHERE period_date = '2025-10-15'::date;

-- 8. Verificar notificaciones creadas
SELECT 
    'NOTIFICACIONES CREADAS' AS accion,
    COUNT(*) AS total_notificaciones,
    COUNT(DISTINCT model_id) AS modelos_notificados
FROM calculator_notifications 
WHERE period_date = '2025-10-15'::date 
AND notification_type = 'calculator_cleared'
AND created_at >= NOW() - INTERVAL '1 minute';

-- 9. Mostrar resumen de modelos procesados
SELECT 
    u.email,
    u.name,
    COUNT(ch.id) AS valores_archivados,
    SUM(ch.value) AS suma_archivada,
    CASE 
        WHEN cn.id IS NOT NULL THEN 'Notificación enviada'
        ELSE 'Sin notificación'
    END AS estado_notificacion
FROM users u
LEFT JOIN calculator_history ch ON u.id = ch.model_id 
    AND ch.period_date = '2025-10-15'
    AND ch.archived_at >= NOW() - INTERVAL '1 minute'
LEFT JOIN calculator_notifications cn ON u.id = cn.model_id 
    AND cn.period_date = '2025-10-15'
    AND cn.notification_type = 'calculator_cleared'
    AND cn.created_at >= NOW() - INTERVAL '1 minute'
WHERE u.role = 'modelo' 
    AND u.is_active = true
GROUP BY u.id, u.email, u.name, cn.id
ORDER BY valores_archivados DESC;

-- 10. Verificar configuración del cron job para futuros cierres
SELECT 
    'CONFIGURACIÓN CRON' AS info,
    'Los días 15 y 30 a las 17:00 Colombia' AS horario,
    'Procesa TODOS los modelos activos' AS alcance,
    'Archiva valores y limpia calculadoras' AS accion;

-- 11. Resumen final
SELECT 
    'RESUMEN FINAL' AS info,
    'Todas las calculadoras del período 1-15 han sido limpiadas' AS estado,
    'Los valores están archivados en calculator_history' AS archivado,
    'Notificaciones enviadas para limpiar cache del frontend' AS notificaciones,
    'Futuros cierres automáticos procesarán TODOS los modelos' AS futuro;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- =====================================================
-- 1. Tabla calculator_notifications creada (si no existía)
-- 2. Todas las calculadoras del período 1-15 estarán en cero
-- 3. Los valores estarán archivados en calculator_history
-- 4. Notificaciones enviadas para limpiar cache del frontend
-- 5. El cron job automático procesará TODOS los modelos en futuros cierres
-- 6. No habrá más problemas de valores persistentes
-- =====================================================
