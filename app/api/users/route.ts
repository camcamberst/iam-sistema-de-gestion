// =====================================================
// 👥 API MODERNA DE GESTIÓN DE USUARIOS
// =====================================================
// Endpoint moderno para CRUD de usuarios con Supabase
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser, hasPermission } from '../../../lib/auth-modern';
import { createAuditLog } from '../../../lib/security/audit';
import { securityMiddleware } from '../../../lib/security/middleware';

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

    // Obtener usuarios de la tabla 'users' (no 'user_profiles')
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        last_login,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error obteniendo usuarios:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    // Obtener grupos por separado para cada usuario
    const formattedUsers = await Promise.all(
      (users || []).map(async (user) => {
        // Obtener grupos del usuario
        const { data: userGroups } = await supabase
          .from('user_groups')
          .select(`
            groups!inner(
              id,
              name
            )
          `)
          .eq('user_id', user.id);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          last_login: user.last_login,
          created_at: user.created_at,
          groups: userGroups?.map((ug: any) => ({
            id: ug.groups.id,
            name: ug.groups.name
          })) || []
        };
      })
    );

    console.log('✅ [API] Usuarios obtenidos:', formattedUsers.length);

    // Crear log de auditoría
    await createAuditLog({
      user_id: currentUser.id,
      action: 'admin.users.read',
      severity: 'low',
      description: 'Lista de usuarios obtenida',
      organization_id: currentUser.organization_id,
      success: true
    });

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

    // Crear perfil en tabla 'users' (no 'user_profiles')
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user!.id,
        name,
        email,
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

    // Crear log de auditoría
    await createAuditLog({
      user_id: currentUser.id,
      action: 'user.create',
      severity: 'medium',
      description: `Usuario creado: ${name} (${email})`,
      organization_id: currentUser.organization_id,
      success: true,
      metadata: {
        created_user_id: authData.user!.id,
        created_user_role: role,
        assigned_groups: group_ids || []
      }
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

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ [API] Editando usuario');
    
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!hasPermission(currentUser, 'admin.users.update')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para editar usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, email, role, is_active, group_ids } = body;

    // Validar datos
    if (!id || !name || !email || !role) {
      return NextResponse.json(
        { success: false, error: 'Datos requeridos faltantes' },
        { status: 400 }
      );
    }

    // Actualizar usuario en tabla users
    const { error: updateError } = await supabase
      .from('users')
      .update({
        name,
        email,
        role,
        is_active: is_active !== undefined ? is_active : true
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [API] Error actualizando usuario:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error actualizando usuario' },
        { status: 500 }
      );
    }

    // Actualizar grupos si se proporcionaron
    if (group_ids !== undefined) {
      // Eliminar grupos existentes
      await supabase
        .from('user_groups')
        .delete()
        .eq('user_id', id);

      // Agregar nuevos grupos
      if (group_ids.length > 0) {
        const userGroups = group_ids.map((groupId: string) => ({
          user_id: id,
          group_id: groupId,
          is_manager: false
        }));

        const { error: groupsError } = await supabase
          .from('user_groups')
          .insert(userGroups);

        if (groupsError) {
          console.error('❌ [API] Error actualizando grupos:', groupsError);
          // No fallar la actualización del usuario por esto
        }
      }
    }

    console.log('✅ [API] Usuario actualizado exitosamente:', { id, name, email, role });

    // Crear log de auditoría
    await createAuditLog({
      user_id: currentUser.id,
      action: 'admin.users.update',
      severity: 'medium',
      description: `Usuario actualizado: ${name} (${email})`,
      organization_id: currentUser.organization_id,
      success: true,
      metadata: {
        updated_user_id: id,
        updated_user_role: role,
        assigned_groups: group_ids || []
      }
    });

    return NextResponse.json({
      success: true,
      user: {
        id,
        name,
        email,
        role,
        is_active: is_active !== undefined ? is_active : true
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

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando usuario');
    
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!hasPermission(currentUser, 'admin.users.delete')) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para eliminar usuarios' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID de usuario requerido' },
        { status: 400 }
      );
    }

    // Obtener información del usuario antes de eliminarlo
    const { data: userData } = await supabase
      .from('users')
      .select('name, email, role')
      .eq('id', userId)
      .single();

    // Eliminar grupos del usuario
    await supabase
      .from('user_groups')
      .delete()
      .eq('user_id', userId);

    // Eliminar usuario de tabla users
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('❌ [API] Error eliminando usuario:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando usuario' },
        { status: 500 }
      );
    }

    // Eliminar usuario de auth.users (requiere admin)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('❌ [API] Error eliminando usuario de Auth:', authDeleteError);
      // No fallar la eliminación por esto, el usuario ya fue eliminado de la tabla users
    }

    console.log('✅ [API] Usuario eliminado exitosamente:', userId);

    // Crear log de auditoría
    await createAuditLog({
      user_id: currentUser.id,
      action: 'admin.users.delete',
      severity: 'high',
      description: `Usuario eliminado: ${userData?.name} (${userData?.email})`,
      organization_id: currentUser.organization_id,
      success: true,
      metadata: {
        deleted_user_id: userId,
        deleted_user_role: userData?.role
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
