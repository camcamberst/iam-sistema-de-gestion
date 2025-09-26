// =====================================================
// 👥 API MODERNA DE GESTIÓN DE USUARIOS
// =====================================================
// Endpoint moderno para CRUD de usuarios con Supabase
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, hasPermission } from '../../../lib/auth-modern';

// =====================================================
// 📋 GET - Obtener usuarios
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('👥 [API] Obteniendo lista de usuarios');
    
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!hasPermission(currentUser, 'admin.users.read')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      );
    }

    // Obtener usuarios de la organización
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        name,
        email:auth.users!inner(email),
        role,
        is_active,
        last_login,
        created_at,
        user_groups!inner(
          groups!inner(
            id,
            name
          )
        )
      `)
      .eq('organization_id', currentUser.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error obteniendo usuarios:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    // Formatear respuesta
    const formattedUsers = users?.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at,
      groups: user.user_groups.map((ug: any) => ({
        id: ug.groups.id,
        name: ug.groups.name
      }))
    })) || [];

    console.log('✅ [API] Usuarios obtenidos:', formattedUsers.length);

    return NextResponse.json({
      success: true,
      users: formattedUsers
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// ➕ POST - Crear usuario
// =====================================================

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [API] Creando nuevo usuario');
    
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!hasPermission(currentUser, 'admin.users.create')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para crear usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password, name, role, group_ids } = body;

    // Validar datos
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'Datos requeridos faltantes' },
        { status: 400 }
      );
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (authError) {
      console.error('❌ [API] Error creando usuario en Auth:', authError);
      return NextResponse.json(
        { success: false, error: 'Error creando usuario' },
        { status: 500 }
      );
    }

    // Crear perfil en user_profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user!.id,
        organization_id: currentUser.organization_id,
        name,
        role,
        is_active: true
      });

    if (profileError) {
      console.error('❌ [API] Error creando perfil:', profileError);
      return NextResponse.json(
        { success: false, error: 'Error creando perfil' },
        { status: 500 }
      );
    }

    // Asignar grupos si se proporcionaron
    if (group_ids && group_ids.length > 0) {
      const userGroups = group_ids.map((groupId: string) => ({
        user_id: authData.user!.id,
        group_id: groupId,
        is_manager: false
      }));

      const { error: groupsError } = await supabase
        .from('user_groups')
        .insert(userGroups);

      if (groupsError) {
        console.error('❌ [API] Error asignando grupos:', groupsError);
        // No fallar la creación del usuario por esto
      }
    }

    console.log('✅ [API] Usuario creado exitosamente:', {
      id: authData.user!.id,
      email,
      name,
      role
    });

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user!.id,
        email,
        name,
        role,
        is_active: true
      }
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// =====================================================
// 🚫 MÉTODOS NO PERMITIDOS
// =====================================================

export async function PUT() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Método no permitido' },
    { status: 405 }
  );
}
