import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID, AIM_BOTTY_NAME, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    // Obtener información del usuario actual (incluyendo affiliate_studio_id y aurora_pin)
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role, affiliate_studio_id, aurora_pin')
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
          last_login,
          avatar_url
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
      // Admin puede ver super admin, otros administradores y usuarios de su mismo grupo
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
          last_login,
          avatar_url
        `)
        .eq('role', 'super_admin')
        .eq('is_active', true)
        .single();

      // Obtener todos los administradores (incluyendo super_admin)
      const { data: allAdmins } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login,
          avatar_url
        `)
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)
        .neq('id', user.id);

      // Obtener usuarios del mismo grupo (modelos y otros)
      let groupUsers: any[] = [];
      if (groupIds.length > 0) {
        const { data: usersInGroups } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login, avatar_url)
          `)
          .in('group_id', groupIds)
          .neq('user_id', user.id);

        groupUsers = usersInGroups?.map((ug: any) => ug.users).filter(Boolean) || [];
      }

      // Combinar: super_admin, todos los admins, y usuarios del grupo
      // Evitar duplicados
      const allUsersMap = new Map<string, any>();
      
      // Agregar super admin primero
      if (superAdmin) {
        allUsersMap.set(superAdmin.id, superAdmin);
      }
      
      // Agregar todos los administradores
      allAdmins?.forEach((admin: any) => {
        allUsersMap.set(admin.id, admin);
      });
      
      // Agregar usuarios del grupo (pueden sobrescribir si ya están como admin)
      groupUsers.forEach((groupUser: any) => {
        allUsersMap.set(groupUser.id, groupUser);
      });
      
      availableUsers = Array.from(allUsersMap.values());
    } else if (currentUser.role === 'superadmin_aff') {
      // Superadmin_aff puede ver modelos y admins de su mismo affiliate_studio_id
      if (currentUser.affiliate_studio_id) {
        const { data: affiliateUsers } = await supabase
          .from('users')
          .select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login,
            avatar_url
          `)
          .eq('affiliate_studio_id', currentUser.affiliate_studio_id)
          .eq('is_active', true)
          .neq('id', user.id)
          .in('role', ['modelo', 'admin'])
          .order('name');

        if (affiliateUsers) {
          availableUsers = affiliateUsers;
        }
      }
    } else if (currentUser.role === 'modelo') {
      // Modelo puede ver admin de su mismo grupo O superadmin_aff de su mismo affiliate_studio_id
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = userGroups?.map((g: any) => g.group_id) || [];
      const allUsersMap = new Map<string, any>();

      // Obtener admins de su mismo grupo
      if (groupIds.length > 0) {
        const { data: adminsInGroups } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login, avatar_url)
          `)
          .in('group_id', groupIds)
          .eq('users.role', 'admin')
          .eq('users.is_active', true);

        const groupAdmins = adminsInGroups?.map((ug: any) => ug.users).filter(Boolean) || [];
        groupAdmins.forEach((admin: any) => {
          allUsersMap.set(admin.id, admin);
        });
      }

      // Si el modelo pertenece a un afiliado, también puede ver su superadmin_aff
      if (currentUser.affiliate_studio_id) {
        const { data: superadminAff } = await supabase
          .from('users')
          .select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login,
            avatar_url
          `)
          .eq('affiliate_studio_id', currentUser.affiliate_studio_id)
          .eq('role', 'superadmin_aff')
          .eq('is_active', true)
          .single();

        if (superadminAff) {
          allUsersMap.set(superadminAff.id, superadminAff);
        }
      }

      availableUsers = Array.from(allUsersMap.values());
    }

    // --- INTEGRACIÓN AURORA PIN ---
    // Cargar también los usuarios que el usuario actual haya agregado por PIN o que lo hayan agregado (y estén aceptados)
    const { data: pinContacts } = await supabase
      .from('chat_contacts')
      .select('user_id, contact_id')
      .or(`user_id.eq.${user.id},contact_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const pinContactUserIds = pinContacts?.map((c: any) => c.user_id === user.id ? c.contact_id : c.user_id) || [];

    if (pinContactUserIds.length > 0) {
      // Filtrar los que ya están en availableUsers
      const existingUserIds = new Set(availableUsers.map((u: any) => u.id));
      const newContactIds = pinContactUserIds.filter(id => !existingUserIds.has(id));

      if (newContactIds.length > 0) {
        const { data: newContactUsers } = await supabase
          .from('users')
          .select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login,
            avatar_url
          `)
          .in('id', newContactIds)
          .eq('is_active', true);

        if (newContactUsers) {
          availableUsers = [...availableUsers, ...newContactUsers];
        }
      }
    }
    // --- FIN INTEGRACIÓN AURORA PIN ---

    // Obtener estados en línea de los usuarios
    const userIds = availableUsers.map((u: any) => u.id);
    const { data: userStatuses } = await supabase
      .from('chat_user_status')
      .select('user_id, is_online, last_seen, status_message, updated_at')
      .in('user_id', userIds);

    // Verificar usuarios inactivos: si no han enviado heartbeat en más de 2 minutos, están offline
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    // Combinar información de usuarios con estados
    const usersWithStatus = availableUsers.map((user: any) => {
      const status = userStatuses?.find((s: any) => s.user_id === user.id);
      
      // Determinar si está realmente online
      let isOnline = status?.is_online || false;
      const lastSeen = status?.last_seen || status?.updated_at || user.last_login;
      
      // Si está marcado como online pero no ha enviado heartbeat recientemente, considerarlo offline
      if (isOnline && lastSeen) {
        const lastSeenDate = new Date(lastSeen);
        const twoMinutesAgoDate = new Date(twoMinutesAgo);
        if (lastSeenDate < twoMinutesAgoDate) {
          console.log(`🔴 [CHAT-USERS] Usuario ${user.id} marcado como offline por inactividad (>2 min)`);
          isOnline = false;
          
          // 🔧 FIX: Se elimina la actualización a la base de datos (UPDATE) desde esta ruta GET.
          // Actualizar la tabla 'chat_user_status' desde aquí disparaba un evento 'postgres_changes' en tiempo real
          // que era escuchado por todos los clientes, los cuales a su vez llamaban nuevamente a este endpoint GET,
          // creando un ciclo infinito (N-Squared API storm) que consumía casi el 100% de CPU de Supabase.
          // El estado "offline" ahora solo se deduce para esta respuesta, sin persistir el cambio forzosamente.
        }
      }
      
      return {
        ...user,
        is_online: isOnline,
        last_seen: lastSeen,
        status_message: status?.status_message || null
      };
    });

    // Agregar AIM Botty siempre como usuario disponible y siempre en línea
    // Nota: El bot usa role='modelo' en la DB pero lo identificamos como bot por su ID/email
    const aimBotty = {
      id: AIM_BOTTY_ID,
      name: AIM_BOTTY_NAME,
      email: AIM_BOTTY_EMAIL,
      role: 'modelo', // Usa 'modelo' en DB por restricción CHECK, pero es identificado como bot por ID
      is_active: true,
      is_online: true, // Siempre en línea
      last_seen: new Date().toISOString(),
      status_message: '¡Hola! Soy tu asistente virtual 🤖'
    };

    // --- INTEGRACIÓN PRIVACIDAD (MUTE/BLOCK) ---
    const { data: mutes } = await supabase.from('chat_mutes').select('muted_id').eq('muter_id', user.id);
    const { data: blocks } = await supabase.from('chat_blocks').select('blocked_id').eq('blocker_id', user.id);
    const { data: blockedBy } = await supabase.from('chat_blocks').select('blocker_id').eq('blocked_id', user.id);

    const mutedUserIds = mutes?.map((m: any) => m.muted_id) || [];
    const blockedUserIds = blocks?.map((b: any) => b.blocked_id) || [];
    const blockedByUserIds = new Set(blockedBy?.map((b: any) => b.blocker_id) || []);

    // Asegurar que AIM Botty sea siempre el primer contacto
    // Evitamos duplicados, y filtramos a los usuarios que nos han bloqueado (no podemos verlos)
    const filteredUsers = usersWithStatus.filter((u: any) => 
      u.id !== AIM_BOTTY_ID && 
      u.email !== AIM_BOTTY_EMAIL &&
      !blockedByUserIds.has(u.id)
    );
    const orderedUsers = [aimBotty, ...filteredUsers];

    return NextResponse.json({ 
      success: true, 
      users: orderedUsers,
      currentUserPin: currentUser.aurora_pin,
      mutedUsers: mutedUserIds,
      blockedUsers: blockedUserIds
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
