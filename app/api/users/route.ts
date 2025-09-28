// =====================================================
// 👥 API SIMPLE DE GESTIÓN DE USUARIOS
// =====================================================
// Endpoint simple para CRUD de usuarios con autenticación directa
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '../../../lib/security/audit';

/**
 * 🔐 Autenticación simple y directa
 */
async function authenticateUser(request: NextRequest) {
  try {
    // Obtener token del Authorization header
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');
    
    if (!accessToken) {
      return { success: false, error: 'No autenticado' };
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verificar token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      return { success: false, error: 'Token inválido' };
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Perfil no encontrado' };
    }

    if (!profile.is_active) {
      return { success: false, error: 'Usuario inactivo' };
    }

    return { success: true, user: profile };
  } catch (error) {
    console.error('❌ [AUTH] Error:', error);
    return { success: false, error: 'Error de autenticación' };
  }
}

// =====================================================
// 📋 GET - Obtener usuarios
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('👥 [API] Obteniendo lista de usuarios');
    
    // Autenticación simple
    const authResult = await authenticateUser(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const currentUser = authResult.user;

    // Verificar permisos
    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
        { status: 403 }
      );
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Obtener usuarios
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
      .eq('organization_id', currentUser.organization_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error obteniendo usuarios:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    // Obtener grupos para cada usuario
    const formattedUsers = await Promise.all(
      (users || []).map(async (u) => {
        const { data: userGroups } = await supabase
          .from('user_groups')
          .select(`
            groups!inner(
              id,
              name
            )
          `)
          .eq('user_id', u.id);

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          is_active: u.is_active,
          last_login: u.last_login,
          created_at: u.created_at,
          groups: userGroups?.map((ug: any) => ({
            id: ug.groups.id,
            name: ug.groups.name,
          })) || [],
        };
      })
    );

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
    
    // Autenticación simple
    const authResult = await authenticateUser(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const currentUser = authResult.user;

    // Verificar permisos
    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
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

    // Crear cliente Supabase admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (authError || !authData.user) {
      console.error('❌ [API] Error creando usuario en Auth:', authError);
      return NextResponse.json(
        { success: false, error: 'Error creando usuario' },
        { status: 500 }
      );
    }

    // Crear perfil en tabla users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        name,
        email,
        role,
        is_active: true,
        organization_id: currentUser.organization_id
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
        user_id: authData.user.id,
        group_id: groupId,
        is_manager: false
      }));

      const { error: groupsError } = await supabaseAdmin
        .from('user_groups')
        .insert(userGroups);

      if (groupsError) {
        console.error('❌ [API] Error asignando grupos:', groupsError);
        // No fallar la creación del usuario por esto
      }
    }

    console.log('✅ [API] Usuario creado exitosamente:', authData.user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        name,
        email,
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
// ✏️ PUT - Actualizar usuario
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ [API] Editando usuario');
    
    // Autenticación simple
    const authResult = await authenticateUser(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const currentUser = authResult.user;

    // Verificar permisos
    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
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

    // Crear cliente Supabase admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Actualizar usuario
    const { error: updateError } = await supabaseAdmin
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
      await supabaseAdmin
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

        const { error: groupsError } = await supabaseAdmin
          .from('user_groups')
          .insert(userGroups);

        if (groupsError) {
          console.error('❌ [API] Error actualizando grupos:', groupsError);
          // No fallar la actualización del usuario por esto
        }
      }
    }

    console.log('✅ [API] Usuario actualizado exitosamente:', id);

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

// =====================================================
// 🗑️ DELETE - Eliminar usuario
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando usuario');
    
    // Autenticación simple
    const authResult = await authenticateUser(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const currentUser = authResult.user;

    // Verificar permisos
    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos' },
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

    // Crear cliente Supabase admin
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener información del usuario antes de eliminarlo
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('name, email, role')
      .eq('id', userId)
      .single();

    // Eliminar grupos del usuario
    await supabaseAdmin
      .from('user_groups')
      .delete()
      .eq('user_id', userId);

    // Eliminar usuario de tabla users
    const { error: deleteError } = await supabaseAdmin
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

    // Eliminar usuario de auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('❌ [API] Error eliminando usuario de Auth:', authDeleteError);
      // No fallar la eliminación por esto, el usuario ya fue eliminado de la tabla users
    }

    console.log('✅ [API] Usuario eliminado exitosamente:', userId);

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