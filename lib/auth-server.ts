// =====================================================
// 🔐 AUTENTICACIÓN SERVER-SIDE PARA APIS
// =====================================================
// Middleware para autenticación en APIs del servidor
// =====================================================

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { AuthUser } from './auth-modern';
import { createClient } from '@supabase/supabase-js';

/**
 * 🔐 Obtener usuario autenticado usando Supabase SSR
 */
export async function getServerUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // 🔍 DEBUG: Log all headers
    console.log('🔍 [SERVER AUTH DEBUG] All headers:', Object.fromEntries(request.headers.entries()));
    
    // Crear cliente Supabase SSR
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', options);
          },
        },
      }
    );

    // Obtener usuario autenticado usando SSR
    console.log('🔍 [SERVER AUTH DEBUG] Getting user with SSR...');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    console.log('🔍 [SERVER AUTH DEBUG] SSR response:', { user: user?.id, error: error?.message });
    
    if (error || !user) {
      console.log('❌ [SERVER AUTH] No authenticated user:', error?.message);
      return null;
    }

    // Obtener perfil del usuario desde public.users
    const { data: profileData, error: profileError } = await supabase
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
