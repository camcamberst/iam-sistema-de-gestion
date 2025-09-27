// =====================================================
// 🔐 AUTENTICACIÓN MODERNA - SMART HOME AUTH
// =====================================================
// Eliminando credenciales hardcodeadas
// Implementando Supabase Auth real
// =====================================================

import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo';
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

    // 1. Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

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

    // 2. Obtener perfil completo del usuario
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        role,
        is_active,
        last_login,
        organization_id,
        user_groups!inner(
          group_id,
          is_manager,
          groups!inner(
            id,
            name
          )
        )
      `)
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('❌ [AUTH] Error obteniendo perfil:', profileError.message);
      return {
        success: false,
        error: 'Error obteniendo perfil de usuario'
      };
    }

    if (!profileData) {
      return {
        success: false,
        error: 'Perfil de usuario no encontrado'
      };
    }

    if (!profileData.is_active) {
      return {
        success: false,
        error: 'Usuario inactivo'
      };
    }

    // 3. Actualizar último login
    await supabase
      .from('user_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authData.user.id);

    // 4. Formatear respuesta
    const user: AuthUser = {
      id: profileData.id,
      email: authData.user.email!,
      name: profileData.name,
      role: profileData.role,
      organization_id: profileData.organization_id,
      groups: profileData.user_groups.map((ug: any) => ({
        id: ug.groups.id,
        name: ug.groups.name,
        is_manager: ug.is_manager
      })),
      is_active: profileData.is_active,
      last_login: profileData.last_login
    };

    console.log('✅ [AUTH] Login exitoso:', {
      id: user.id,
      email: user.email,
      role: user.role,
      groups: user.groups.length
    });

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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ [AUTH] Error en logout:', error.message);
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

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        role,
        is_active,
        last_login,
        organization_id,
        user_groups!inner(
          group_id,
          is_manager,
          groups!inner(
            id,
            name
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      return null;
    }

    return {
      id: profileData.id,
      email: user.email!,
      name: profileData.name,
      role: profileData.role,
      organization_id: profileData.organization_id,
      groups: profileData.user_groups.map((ug: any) => ({
        id: ug.groups.id,
        name: ug.groups.name,
        is_manager: ug.is_manager
      })),
      is_active: profileData.is_active,
      last_login: profileData.last_login
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

  // Chatter tiene permisos de chatter
  if (user.role === 'chatter' && permission.startsWith('chatter.')) {
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
      .from('user_profiles')
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
