-- LIMPIEZA COMPLETA DEL SISTEMA DE CHATBOT ACTUAL
-- =====================================================
-- Este script elimina todas las tablas, funciones, triggers e índices
-- relacionados con el sistema de chatbot actual

-- 🧹 ELIMINAR TRIGGERS PRIMERO
DROP TRIGGER IF EXISTS trigger_update_chat_session_activity ON chat_messages;
DROP TRIGGER IF EXISTS trigger_update_support_ticket_updated_at ON support_tickets;

-- 🧹 ELIMINAR FUNCIONES
DROP FUNCTION IF EXISTS cleanup_old_chat_sessions();
DROP FUNCTION IF EXISTS update_chat_session_activity();
DROP FUNCTION IF EXISTS update_support_ticket_updated_at();

-- 🧹 ELIMINAR TABLAS (en orden de dependencias)
DROP TABLE IF EXISTS admin_notifications CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;

-- 🧹 ELIMINAR ÍNDICES (por si quedan algunos)
DROP INDEX IF EXISTS idx_chat_sessions_user_id;
DROP INDEX IF EXISTS idx_chat_sessions_active;
DROP INDEX IF EXISTS idx_chat_messages_session_id;
DROP INDEX IF EXISTS idx_chat_messages_created_at;
DROP INDEX IF EXISTS idx_support_tickets_status;
DROP INDEX IF EXISTS idx_support_tickets_assigned_to;
DROP INDEX IF EXISTS idx_admin_notifications_admin_id;
DROP INDEX IF EXISTS idx_admin_notifications_unread;

-- ✅ CONFIRMACIÓN
SELECT 'Limpieza del sistema de chatbot completada exitosamente' as status;
