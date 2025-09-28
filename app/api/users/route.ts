// =====================================================
// 👥 API ULTRA SIMPLE DE USUARIOS - VERSIÓN MÍNIMA
// =====================================================
// Solo operaciones básicas sin complejidades
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// 📋 GET - Obtener usuarios (VERSIÓN MÍNIMA)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('👥 [API] Obteniendo usuarios (VERSIÓN MÍNIMA)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener usuarios básicos
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Usuarios obtenidos:', users?.length || 0);

    // Obtener grupos para cada usuario
    const usersWithGroups = await Promise.all(
      (users || []).map(async (user) => {
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
          ...user,
          groups: userGroups?.map((ug: any) => ({
            id: ug.groups.id,
            name: ug.groups.name
          })) || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithGroups
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// =====================================================
// ➕ POST - Crear usuario (VERSIÓN MÍNIMA)
// =====================================================

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [API] Creando usuario (VERSIÓN MÍNIMA)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { email, password, name, role, group_ids } = body;

    // Validación básica
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'Datos faltantes' },
        { status: 400 }
      );
    }

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      console.error('❌ [API] Error Auth:', authError);
      return NextResponse.json(
        { success: false, error: 'Error creando usuario en Auth' },
        { status: 500 }
      );
    }

    // 2. Crear perfil básico
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        name,
        email,
        role,
        is_active: true
      });

    if (profileError) {
      console.error('❌ [API] Error perfil:', profileError);
      return NextResponse.json(
        { success: false, error: 'Error creando perfil' },
        { status: 500 }
      );
    }

    // 3. Asignar grupos si se proporcionaron
    let assignedGroups: Array<{ id: string; name: string }> = [];
    if (group_ids && group_ids.length > 0) {
      const userGroups = group_ids.map((groupId: string) => ({
        user_id: authData.user.id,
        group_id: groupId,
        is_manager: false
      }));

      const { data: groupsData, error: groupsError } = await supabase
        .from('user_groups')
        .insert(userGroups)
        .select(`
          groups!inner(
            id,
            name
          )
        `);

      if (groupsError) {
        console.error('❌ [API] Error asignando grupos:', groupsError);
        // No fallar la creación del usuario por esto
      } else {
        assignedGroups = groupsData?.map((ug: any) => ({
          id: ug.groups.id,
          name: ug.groups.name
        })) || [];
      }
    }

    console.log('✅ [API] Usuario creado:', authData.user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        name,
        email,
        role,
        is_active: true,
        groups: assignedGroups // Grupos reales asignados
      }
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// =====================================================
// ✏️ PUT - Editar usuario (VERSIÓN MÍNIMA)
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ [API] Editando usuario (VERSIÓN MÍNIMA)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { id, name, email, role, is_active } = body;

    if (!id || !name || !email || !role) {
      return NextResponse.json(
        { success: false, error: 'Datos faltantes' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('users')
      .update({
        name,
        email,
        role,
        is_active: is_active !== undefined ? is_active : true
      })
      .eq('id', id);

    if (error) {
      console.error('❌ [API] Error actualizando:', error);
      return NextResponse.json(
        { success: false, error: 'Error actualizando usuario' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Usuario actualizado:', id);

    return NextResponse.json({
      success: true,
      user: { 
        id, 
        name, 
        email, 
        role, 
        is_active,
        groups: [] // Campo requerido por la interfaz
      }
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// =====================================================
// 🗑️ DELETE - Eliminar usuario (VERSIÓN MÍNIMA)
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando usuario (VERSIÓN MÍNIMA)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    // Eliminar de tabla users
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('❌ [API] Error eliminando:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando usuario' },
        { status: 500 }
      );
    }

    // Eliminar de Auth
    await supabase.auth.admin.deleteUser(userId);

    console.log('✅ [API] Usuario eliminado:', userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}