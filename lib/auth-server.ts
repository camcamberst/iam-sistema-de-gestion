// =====================================================
// 🔐 AUTENTICACIÓN SERVER-SIDE PARA APIS
// =====================================================
// Middleware para autenticación en APIs del servidor
// =====================================================

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AuthUser } from './auth-modern';

// Cliente de Supabase para server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * 🔐 Obtener usuario autenticado desde cookies (Supabase SSR)
 */
export async function getServerUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Obtener token de cookies de Supabase
    const cookieStore = request.cookies;
    const accessToken = cookieStore.get('sb-access-token')?.value;
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;
    
    if (!accessToken) {
      console.log('❌ [SERVER AUTH] No access token in cookies');
      return null;
    }

    // Verificar token con Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log('❌ [SERVER AUTH] Invalid token:', error?.message);
      return null;
    }

    // Obtener perfil del usuario desde public.users
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        name,
        email,
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
      console.log('❌ [SERVER AUTH] Profile not found:', profileError?.message);
      return null;
    }

    if (!profileData.is_active) {
      console.log('❌ [SERVER AUTH] User inactive');
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
    console.error('❌ [SERVER AUTH] Error:', error);
    return null;
  }
}

/**
 * 🔒 Verificar permisos de usuario
 */
export function hasServerPermission(user: AuthUser, permission: string): boolean {
  // Super admin tiene todos los permisos
  if (user.role === 'super_admin') {
    return true;
  }

  // Admin tiene permisos de gestión
  if (user.role === 'admin') {
    return permission.startsWith('admin.');
  }

  // Modelo tiene permisos limitados
  if (user.role === 'modelo') {
    return permission.startsWith('modelo.');
  }

  return false;
}

/**
 * 🛡️ Middleware de autenticación para APIs
 */
export async function requireAuth(
  request: NextRequest,
  requiredPermission?: string
): Promise<{ user: AuthUser } | { error: Response }> {
  const user = await getServerUser(request);
  
  if (!user) {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  if (requiredPermission && !hasServerPermission(user, requiredPermission)) {
    return {
      error: new Response(
        JSON.stringify({ success: false, error: 'Sin permisos' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  return { user };
}
