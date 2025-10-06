// =====================================================
// 👥 API ULTRA SIMPLE - SOLO DATOS VITALES
// =====================================================
// Solo maneja: Nombre, Email, Rol, Grupos
// Sin complejidades que causen errores
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// 📋 GET - Obtener usuarios (SOLO DATOS VITALES)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('👥 [API] Obteniendo usuarios (SOLO DATOS VITALES)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Obtener usuarios con datos vitales
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        created_at,
        user_groups(
          groups!inner(
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    // Formatear usuarios con grupos
    const formattedUsers = (users || []).map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      groups: user.user_groups?.map((ug: any) => ({
        id: ug.groups.id,
        name: ug.groups.name
      })) || []
    }));

    console.log('✅ [API] Usuarios obtenidos:', formattedUsers.length);

    return NextResponse.json({
      success: true,
      users: formattedUsers
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
// ➕ POST - Crear usuario (SOLO DATOS VITALES)
// =====================================================

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [API] Creando usuario (SOLO DATOS VITALES)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    console.log('🔍 [DEBUG] Body completo recibido:', JSON.stringify(body, null, 2));
    
    const { email, password, name, role, group_ids } = body;
    console.log('🔍 [DEBUG] Datos extraídos:', { email, name, role, group_ids });

    // Validación de datos vitales
    if (!email || !password || !name || !role) {
      console.log('❌ [DEBUG] Datos faltantes:', { email: !!email, password: !!password, name: !!name, role: !!role });
      return NextResponse.json(
        { success: false, error: 'Datos vitales faltantes' },
        { status: 400 }
      );
    }

    console.log('📋 [API] Datos recibidos:', { name, email, role, group_ids });

    // 1. Crear usuario en Auth (solo datos básicos)
    console.log('🔍 [DEBUG] Creando usuario en Auth con:', { email, name, role });
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (authError || !authData.user) {
      console.error('❌ [API] Error Auth:', authError);
      return NextResponse.json(
        { success: false, error: 'Error creando usuario en Auth' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Usuario creado en Auth:', authData.user.id);
    console.log('🔍 [DEBUG] Auth user metadata:', authData.user.user_metadata);

    // 2. Crear perfil en tabla users (solo datos vitales)
    console.log('🔍 [DEBUG] Creando perfil en users con:', { id: authData.user.id, name, email, role });
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
      console.log('🔍 [DEBUG] Profile error details:', JSON.stringify(profileError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Error creando perfil' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Perfil creado en users');

    // 3. Asignar grupos (solo si se proporcionaron)
    let assignedGroups: Array<{ id: string; name: string }> = [];
    if (group_ids && group_ids.length > 0) {
      console.log('📋 [API] Asignando grupos:', group_ids);
      console.log('🔍 [DEBUG] Group IDs recibidos:', JSON.stringify(group_ids, null, 2));
      
      const userGroups = group_ids.map((groupId: string) => ({
        user_id: authData.user.id,
        group_id: groupId,
        is_manager: false
      }));

      console.log('🔍 [DEBUG] User groups a insertar:', JSON.stringify(userGroups, null, 2));

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
        console.log('🔍 [DEBUG] Groups error details:', JSON.stringify(groupsError, null, 2));
        // No fallar la creación del usuario por esto
      } else {
        assignedGroups = groupsData?.map((ug: any) => ({
          id: ug.groups.id,
          name: ug.groups.name
        })) || [];
        console.log('✅ [API] Grupos asignados:', assignedGroups.length);
        console.log('🔍 [DEBUG] Grupos asignados:', JSON.stringify(assignedGroups, null, 2));
      }
    } else {
      console.log('🔍 [DEBUG] No se proporcionaron grupos o están vacíos');
    }

    console.log('✅ [API] Usuario creado completamente:', authData.user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        name,
        email,
        role,
        is_active: true,
        groups: assignedGroups
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
// ✏️ PUT - Editar usuario (SOLO DATOS VITALES)
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ [API] Editando usuario (SOLO DATOS VITALES)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    console.log('🔍 [DEBUG] Body completo recibido en PUT:', JSON.stringify(body, null, 2));
    
    const { id, name, email, password, role, is_active, group_ids } = body;
    console.log('🔍 [DEBUG] Datos extraídos en PUT:', { id, name, email, password: !!password, role, is_active, group_ids });

    if (!id || !name || !email || !role) {
      console.log('❌ [DEBUG] Datos faltantes en PUT:', { 
        id: !!id, 
        name: !!name, 
        email: !!email, 
        role: !!role 
      });
      return NextResponse.json(
        { success: false, error: 'Datos vitales faltantes' },
        { status: 400 }
      );
    }

    // Actualizar datos vitales
    console.log('🔍 [DEBUG] Actualizando usuario con:', { id, name, email, role, is_active });
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
      console.error('❌ [API] Error actualizando:', updateError);
      console.log('🔍 [DEBUG] Update error details:', JSON.stringify(updateError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Error actualizando usuario' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Usuario actualizado exitosamente:', id);

    // Actualizar contraseña si se proporcionó
    if (password && password.trim().length >= 6) {
      console.log('🔍 [DEBUG] Actualizando contraseña para usuario:', id);
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        id,
        { password: password.trim() }
      );

      if (passwordError) {
        console.error('❌ [API] Error actualizando contraseña:', passwordError);
        // No fallar la actualización del usuario por esto, solo logear
        console.log('⚠️ [WARNING] Contraseña no actualizada, pero usuario sí');
      } else {
        console.log('✅ [API] Contraseña actualizada exitosamente');
      }
    } else if (password && password.trim().length < 6) {
      console.log('⚠️ [WARNING] Contraseña muy corta, no se actualiza');
    }

    // Actualizar grupos si se proporcionaron
    if (group_ids !== undefined) {
      console.log('🔍 [DEBUG] Actualizando grupos:', group_ids);
      console.log('🔍 [DEBUG] Group IDs recibidos en PUT:', JSON.stringify(group_ids, null, 2));
      
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

        console.log('🔍 [DEBUG] User groups a insertar en PUT:', JSON.stringify(userGroups, null, 2));

        const { error: groupsError } = await supabase
          .from('user_groups')
          .insert(userGroups);

        if (groupsError) {
          console.error('❌ [API] Error actualizando grupos:', groupsError);
          console.log('🔍 [DEBUG] Groups error details en PUT:', JSON.stringify(groupsError, null, 2));
          // No fallar la actualización del usuario por esto
        } else {
          console.log('✅ [API] Grupos actualizados exitosamente');
        }
      }
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
        groups: group_ids || []
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
// 🗑️ DELETE - Eliminar usuario (SOLO DATOS VITALES)
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando usuario (SOLO DATOS VITALES)');
    
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

    // Eliminar grupos primero
    await supabase
      .from('user_groups')
      .delete()
      .eq('user_id', userId);

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