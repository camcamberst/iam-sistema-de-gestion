// =====================================================
// 🏢 API SIMPLE DE GESTIÓN DE GRUPOS
// =====================================================
// Endpoint simple para CRUD de grupos con autenticación directa
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
// 📋 GET - Obtener grupos
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo lista de grupos');
    
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

    // Obtener grupos con miembros
    const { data: groups, error } = await supabase
      .from('groups')
      .select(`
        id,
        name,
        description,
        created_at,
        user_groups!inner(
          user_id,
          is_manager,
          users!inner(
            id,
            name,
            email,
            role
          )
        )
      `)
      .eq('organization_id', currentUser.organization_id)
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error obteniendo grupos:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo grupos' },
        { status: 500 }
      );
    }

    // Formatear grupos con miembros
    const formattedGroups = (groups || []).map((group: any) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      members: group.user_groups.map((ug: any) => ({
        id: ug.users.id,
        name: ug.users.name,
        email: ug.users.email,
        role: ug.users.role,
        is_manager: ug.is_manager
      }))
    }));

    console.log('✅ [API] Grupos obtenidos:', formattedGroups.length);

    return NextResponse.json({
      success: true,
      groups: formattedGroups
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
// ➕ POST - Crear grupo
// =====================================================

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [API] Creando nuevo grupo');
    
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
    const { name, description, member_ids } = body;

    // Validar datos
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Nombre del grupo requerido' },
        { status: 400 }
      );
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Crear grupo
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({
        name,
        description: description || '',
        organization_id: currentUser.organization_id
      })
      .select()
      .single();

    if (groupError) {
      console.error('❌ [API] Error creando grupo:', groupError);
      return NextResponse.json(
        { success: false, error: 'Error creando grupo' },
        { status: 500 }
      );
    }

    // Asignar miembros si se proporcionaron
    if (member_ids && member_ids.length > 0) {
      const groupMembers = member_ids.map((memberId: string) => ({
        group_id: groupData.id,
        user_id: memberId,
        is_manager: false
      }));

      const { error: membersError } = await supabase
        .from('user_groups')
        .insert(groupMembers);

      if (membersError) {
        console.error('❌ [API] Error asignando miembros:', membersError);
        // No fallar la creación del grupo por esto
      }
    }

    console.log('✅ [API] Grupo creado exitosamente:', groupData.id);

    return NextResponse.json({
      success: true,
      group: {
        id: groupData.id,
        name: groupData.name,
        description: groupData.description
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
// ✏️ PUT - Actualizar grupo
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ [API] Editando grupo');
    
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
    const { id, name, description, member_ids } = body;

    // Validar datos
    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'ID y nombre del grupo requeridos' },
        { status: 400 }
      );
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Actualizar grupo
    const { error: updateError } = await supabase
      .from('groups')
      .update({
        name,
        description: description || ''
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [API] Error actualizando grupo:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error actualizando grupo' },
        { status: 500 }
      );
    }

    // Actualizar miembros si se proporcionaron
    if (member_ids !== undefined) {
      // Eliminar miembros existentes
      await supabase
        .from('user_groups')
        .delete()
        .eq('group_id', id);

      // Agregar nuevos miembros
      if (member_ids.length > 0) {
        const groupMembers = member_ids.map((memberId: string) => ({
          group_id: id,
          user_id: memberId,
          is_manager: false
        }));

        const { error: membersError } = await supabase
          .from('user_groups')
          .insert(groupMembers);

        if (membersError) {
          console.error('❌ [API] Error actualizando miembros:', membersError);
          // No fallar la actualización del grupo por esto
        }
      }
    }

    console.log('✅ [API] Grupo actualizado exitosamente:', id);

    return NextResponse.json({
      success: true,
      group: {
        id,
        name,
        description: description || ''
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
// 🗑️ DELETE - Eliminar grupo
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando grupo');
    
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
    const groupId = searchParams.get('id');

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'ID del grupo requerido' },
        { status: 400 }
      );
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Eliminar relaciones de usuarios
    await supabase
      .from('user_groups')
      .delete()
      .eq('group_id', groupId);

    // Eliminar grupo
    const { error: deleteError } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (deleteError) {
      console.error('❌ [API] Error eliminando grupo:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando grupo' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupo eliminado exitosamente:', groupId);

    return NextResponse.json({
      success: true,
      message: 'Grupo eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}