// =====================================================
// 🔐 AUTENTICACIÓN MODERNA - SMART HOME AUTH
// =====================================================
// Eliminando credenciales hardcodeadas
// Implementando Supabase Auth real
// =====================================================

import { supabase } from './supabase';
import { setUserOnline, setUserOffline } from './chat/status-manager';
import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia' | 'superadmin_aff';
  organization_id: string;
  groups: Array<{
    id: string;
    name: string;
    is_manager: boolean;
  }>;
  is_active: boolean;
  last_login?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// =====================================================
// 🔐 FUNCIONES DE AUTENTICACIÓN MODERNAS
// =====================================================

/**
 * 🚀 Login moderno con Supabase Auth
 * Elimina credenciales hardcodeadas
 */
export async function modernLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    console.log('🔐 [AUTH] Iniciando login moderno:', { email: credentials.email });

    // Helper: signIn con timeout para evitar que se cuelgue si Supabase está throttled
    const signInWithTimeout = (timeoutMs: number) => {
      return Promise.race([
        supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        )
      ]);
    };

    // Intento 1: timeout de 10 segundos
    let authData: any;
    let authError: any;
    try {
      const result = await signInWithTimeout(10000);
      authData = result.data;
      authError = result.error;
    } catch (e: any) {
      if (e.message === 'TIMEOUT') {
        console.warn('⏱️ [AUTH] Timeout en primer intento, reintentando...');
        // Intento 2: un reintento con 10s más
        try {
          const result = await signInWithTimeout(10000);
          authData = result.data;
          authError = result.error;
        } catch (e2: any) {
          if (e2.message === 'TIMEOUT') {
            console.error('⏱️ [AUTH] Timeout en segundo intento');
            return {
              success: false,
              error: 'Estamos realizando mantenimiento y actualización del sistema. Intenta de nuevo en unos minutos.'
            };
          }
          throw e2;
        }
      } else {
        throw e;
      }
    }

    if (authError) {
      console.error('❌ [AUTH] Error de autenticación:', authError.message);
      return {
        success: false,
        error: 'Credenciales inválidas'
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }

    console.log('✅ [AUTH] Usuario autenticado en Supabase:', authData.user.id);

    // 2. Obtener perfil del usuario (sin join para evitar 406 con .single())
    const { data: baseProfile, error: baseError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, last_login, organization_id')
      .eq('id', authData.user.id)
      .single();

    if (baseError) {
      console.error('❌ [AUTH] Error obteniendo perfil base:', baseError.message);
      return {
        success: false,
        error: 'Error obteniendo perfil de usuario'
      };
    }

    // 2.1. Obtener grupos del usuario por separado
    const { data: groupsData, error: groupsError } = await supabase
      .from('user_groups')
      .select('is_manager, groups(id, name)')
      .eq('user_id', authData.user.id);

    if (!baseProfile) {
      return {
        success: false,
        error: 'Perfil de usuario no encontrado'
      };
    }

    if (!baseProfile.is_active) {
      return {
        success: false,
        error: 'Usuario inactivo'
      };
    }

    // 3. Actualizar último login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authData.user.id);

    // 4. Formatear respuesta
    const user: AuthUser = {
      id: baseProfile.id,
      email: authData.user.email!,
      name: baseProfile.name,
      role: baseProfile.role,
      organization_id: baseProfile.organization_id,
      groups: (groupsData || []).map((ug: any) => ({
        id: ug.groups?.id,
        name: ug.groups?.name,
        is_manager: ug.is_manager
      })),
      is_active: baseProfile.is_active,
      last_login: baseProfile.last_login
    };

    console.log('✅ [AUTH] Login exitoso:', {
      id: user.id,
      email: user.email,
      role: user.role,
      groups: user.groups.length
    });

    // 🚀 Marcar usuario como en línea en el chat
    try {
      await setUserOnline(user.id);
      console.log('📊 [AUTH] Usuario marcado como en línea en el chat');
    } catch (error) {
      console.error('❌ [AUTH] Error marcando usuario como en línea:', error);
      // No fallar el login por este error
    }

    return {
      success: true,
      user
    };

  } catch (error) {
    console.error('❌ [AUTH] Error general:', error);
    return {
      success: false,
      error: 'Error interno del servidor'
    };
  }
}

/**
 * 🚪 Logout moderno
 */
export async function modernLogout(): Promise<void> {
  try {
    // Obtener usuario actual antes del logout
    const { data: { user } } = await supabase.auth.getUser();
    
    // Hacer logout de Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ [AUTH] Error en logout:', error.message);
    }

    // 🚪 Marcar usuario como offline en el chat
    if (user) {
      try {
        await setUserOffline(user.id);
        console.log('📊 [AUTH] Usuario marcado como offline en el chat');
      } catch (error) {
        console.error('❌ [AUTH] Error marcando usuario como offline:', error);
        // No fallar el logout por este error
      }
    }
  } catch (error) {
    console.error('❌ [AUTH] Error general en logout:', error);
  }
}

/**
 * 👤 Obtener usuario actual
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    const { data: baseProfile, error: baseError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, last_login, organization_id')
      .eq('id', user.id)
      .single();

    if (baseError || !baseProfile) {
      return null;
    }

    const { data: groupsData } = await supabase
      .from('user_groups')
      .select('is_manager, groups(id, name)')
      .eq('user_id', user.id);

    return {
      id: baseProfile.id,
      email: user.email!,
      name: baseProfile.name,
      role: baseProfile.role,
      organization_id: baseProfile.organization_id,
      groups: (groupsData || []).map((ug: any) => ({
        id: ug.groups?.id,
        name: ug.groups?.name,
        is_manager: ug.is_manager
      })),
      is_active: baseProfile.is_active,
      last_login: baseProfile.last_login
    };

  } catch (error) {
    console.error('❌ [AUTH] Error obteniendo usuario actual:', error);
    return null;
  }
}

/**
 * 🔒 Verificar permisos de usuario
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  // Super admin tiene todos los permisos
  if (user.role === 'super_admin') {
    return true;
  }

  // Admin tiene permisos administrativos
  if (user.role === 'admin' && permission.startsWith('admin.')) {
    return true;
  }

  // Modelo tiene permisos de modelo
  if (user.role === 'modelo' && permission.startsWith('modelo.')) {
    return true;
  }

  return false;
}

/**
 * 🏢 Verificar si usuario pertenece a organización
 */
export function belongsToOrganization(user: AuthUser, organizationId: string): boolean {
  return user.organization_id === organizationId;
}

/**
 * 👥 Verificar si usuario pertenece a grupo
 */
export function belongsToGroup(user: AuthUser, groupName: string): boolean {
  return user.groups.some(group => group.name === groupName);
}

/**
 * 👑 Verificar si usuario es manager de grupo
 */
export function isManagerOfGroup(user: AuthUser, groupName: string): boolean {
  return user.groups.some(group => group.name === groupName && group.is_manager);
}

// =====================================================
// 🎯 UTILIDADES DE AUTENTICACIÓN
// =====================================================

/**
 * 🔄 Refrescar sesión
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    return !error && !!data.session;
  } catch (error) {
    console.error('❌ [AUTH] Error refrescando sesión:', error);
    return false;
  }
}

/**
 * 📊 Obtener estadísticas de usuario
 */
export async function getUserStats(userId: string): Promise<{
  total_groups: number;
  manager_groups: number;
  is_active: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        is_active,
        user_groups!inner(
          is_manager
        )
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { total_groups: 0, manager_groups: 0, is_active: false };
    }

    const total_groups = data.user_groups.length;
    const manager_groups = data.user_groups.filter((ug: any) => ug.is_manager).length;

    return {
      total_groups,
      manager_groups,
      is_active: data.is_active
    };

  } catch (error) {
    console.error('❌ [AUTH] Error obteniendo estadísticas:', error);
    return { total_groups: 0, manager_groups: 0, is_active: false };
  }
}

// =====================================================
// ✅ AUTENTICACIÓN MODERNA COMPLETADA
// =====================================================
// ✅ Sin credenciales hardcodeadas
// ✅ Supabase Auth real
// ✅ Perfiles completos
// ✅ Permisos granulares
// ✅ Seguridad robusta
// =====================================================
