import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET: Obtener usuarios disponibles para chat
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Obtener información del usuario actual
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    let availableUsers: any[] = [];

    if (currentUser.role === 'super_admin') {
      // Super admin puede ver todos los usuarios
      const { data: allUsers, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login
        `)
        .neq('id', user.id)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error obteniendo usuarios:', error);
        return NextResponse.json({ error: 'Error obteniendo usuarios' }, { status: 500 });
      }

      availableUsers = allUsers || [];
    } else if (currentUser.role === 'admin') {
      // Admin puede ver super admin y usuarios de su mismo grupo
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = userGroups?.map((g: any) => g.group_id) || [];

      // Obtener super admin
      const { data: superAdmin } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login
        `)
        .eq('role', 'super_admin')
        .eq('is_active', true)
        .single();

      // Obtener usuarios del mismo grupo
      let groupUsers: any[] = [];
      if (groupIds.length > 0) {
        const { data: usersInGroups } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login)
          `)
          .in('group_id', groupIds)
          .neq('user_id', user.id);

        groupUsers = usersInGroups?.map((ug: any) => ug.users).filter(Boolean) || [];
      }

      availableUsers = [
        ...(superAdmin ? [superAdmin] : []),
        ...groupUsers
      ];
    } else if (currentUser.role === 'modelo') {
      // Modelo puede ver admin de su mismo grupo
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = userGroups?.map((g: any) => g.group_id) || [];

      if (groupIds.length > 0) {
        const { data: adminsInGroups } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login)
          `)
          .in('group_id', groupIds)
          .eq('users.role', 'admin')
          .eq('users.is_active', true);

        availableUsers = adminsInGroups?.map((ug: any) => ug.users).filter(Boolean) || [];
      }
    }

    // Obtener estados en línea de los usuarios
    const userIds = availableUsers.map((u: any) => u.id);
    const { data: userStatuses } = await supabase
      .from('chat_user_status')
      .select('user_id, is_online, last_seen, status_message')
      .in('user_id', userIds);

    // Combinar información de usuarios con estados
    const usersWithStatus = availableUsers.map((user: any) => {
      const status = userStatuses?.find((s: any) => s.user_id === user.id);
      return {
        ...user,
        is_online: status?.is_online || false,
        last_seen: status?.last_seen || user.last_login,
        status_message: status?.status_message || null
      };
    });

    return NextResponse.json({ 
      success: true, 
      users: usersWithStatus 
    });

  } catch (error) {
    console.error('Error en GET /api/chat/users:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Actualizar estado del usuario
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { is_online, status_message } = body;

    // Actualizar estado del usuario
    const { error } = await supabase
      .from('chat_user_status')
      .upsert({
        user_id: user.id,
        is_online: is_online !== undefined ? is_online : true,
        last_seen: new Date().toISOString(),
        status_message: status_message || null,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error actualizando estado:', error);
      return NextResponse.json({ error: 'Error actualizando estado' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Estado actualizado correctamente' 
    });

  } catch (error) {
    console.error('Error en POST /api/chat/users:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
