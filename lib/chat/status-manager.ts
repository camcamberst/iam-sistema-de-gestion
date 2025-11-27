// =====================================================
// 📊 GESTOR DE ESTADO DE CHAT
// =====================================================
// Maneja el estado "en línea" basado en login/logout
// =====================================================

import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase - se crea dinámicamente según el contexto
// En servidor (API routes): usa SERVICE_ROLE_KEY
// En cliente (componentes): usa ANON_KEY
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  
  // Si estamos en el servidor (API route), usar SERVICE_ROLE_KEY
  if (typeof window === 'undefined') {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  // Si estamos en el cliente, usar ANON_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * 🔄 Actualizar estado de chat del usuario
 * @param userId - ID del usuario
 * @param isOnline - Estado en línea (true/false)
 */
export async function updateChatStatus(userId: string, isOnline: boolean): Promise<void> {
  try {
    console.log(`📊 [CHAT-STATUS] Actualizando estado de usuario ${userId}: ${isOnline ? 'EN LÍNEA' : 'OFFLINE'}`);

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('chat_user_status')
      .upsert({
        user_id: userId,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ [CHAT-STATUS] Error actualizando estado:', error);
    } else {
      console.log(`✅ [CHAT-STATUS] Estado actualizado exitosamente: ${isOnline ? 'EN LÍNEA' : 'OFFLINE'}`);
    }
  } catch (error) {
    console.error('❌ [CHAT-STATUS] Error general:', error);
  }
}

/**
 * 🚀 Marcar usuario como en línea (al hacer login)
 * @param userId - ID del usuario
 */
export async function setUserOnline(userId: string): Promise<void> {
  await updateChatStatus(userId, true);
}

/**
 * 🚪 Marcar usuario como offline (al hacer logout)
 * @param userId - ID del usuario
 */
export async function setUserOffline(userId: string): Promise<void> {
  await updateChatStatus(userId, false);
}

/**
 * 🧹 Limpiar estado de usuarios inactivos (más de 1 minuto)
 * Función de mantenimiento para limpiar estados obsoletos
 */
export async function cleanupInactiveUsers(): Promise<void> {
  try {
    // Esta función solo se llama desde API routes (servidor)
    // Usar cliente del servidor con SERVICE_ROLE_KEY
    const supabase = getSupabaseClient();
    
    // Verificar usuarios que no han enviado heartbeat en más de 2 minutos
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    // Primero obtener el conteo de usuarios que serán actualizados
    // Verificamos tanto updated_at como last_seen para mayor precisión
    const { count } = await supabase
      .from('chat_user_status')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true)
      .or(`updated_at.lt.${twoMinutesAgo},last_seen.lt.${twoMinutesAgo}`);

    // Luego actualizar los usuarios que no han enviado heartbeat recientemente
    const { error } = await supabase
      .from('chat_user_status')
      .update({ is_online: false })
      .eq('is_online', true)
      .or(`updated_at.lt.${twoMinutesAgo},last_seen.lt.${twoMinutesAgo}`);

    if (error) {
      console.error('❌ [CHAT-STATUS] Error limpiando usuarios inactivos:', error);
    } else {
      if (count && count > 0) {
        console.log(`✅ [CHAT-STATUS] ${count} usuarios inactivos (>2 min) marcados como offline`);
      }
    }
  } catch (error) {
    console.error('❌ [CHAT-STATUS] Error en limpieza:', error);
  }
}

/**
 * 💓 Actualizar heartbeat del usuario (mantener estado activo)
 * @param userId - ID del usuario
 */
export async function updateUserHeartbeat(userId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('chat_user_status')
      .upsert({
        user_id: userId,
        is_online: true,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ [CHAT-STATUS] Error actualizando heartbeat:', error);
    }
  } catch (error) {
    console.error('❌ [CHAT-STATUS] Error en heartbeat:', error);
  }
}
