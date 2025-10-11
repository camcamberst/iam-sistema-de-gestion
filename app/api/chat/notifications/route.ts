import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Obtener notificaciones para un admin
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea admin o super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Construir consulta
    let query = supabase
      .from('admin_notifications')
      .select(`
        *,
        support_tickets!admin_notifications_ticket_id_fkey(
          id,
          title,
          status,
          priority,
          users!support_tickets_user_id_fkey(name, email)
        )
      `)
      .eq('admin_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
    }

    // Contar notificaciones no leídas
    const { count: unreadCount } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', user.id)
      .eq('is_read', false);

    return NextResponse.json({ 
      notifications, 
      unreadCount: unreadCount || 0 
    });

  } catch (error) {
    console.error('Error in notifications GET:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT - Marcar notificaciones como leídas
export async function PUT(request: NextRequest) {
  try {
    const { notificationIds, markAllAsRead } = await request.json();

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea admin o super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    let query;

    if (markAllAsRead) {
      // Marcar todas las notificaciones del admin como leídas
      query = supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('admin_id', user.id)
        .eq('is_read', false);
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Marcar notificaciones específicas como leídas
      query = supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .in('id', notificationIds)
        .eq('admin_id', user.id);
    } else {
      return NextResponse.json({ error: 'IDs de notificación requeridos' }, { status: 400 });
    }

    const { error } = await query;

    if (error) {
      console.error('Error updating notifications:', error);
      return NextResponse.json({ error: 'Error al actualizar notificaciones' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in notifications PUT:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE - Eliminar notificaciones
export async function DELETE(request: NextRequest) {
  try {
    const { notificationIds } = await request.json();

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'IDs de notificación requeridos' }, { status: 400 });
    }

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea admin o super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { error } = await supabase
      .from('admin_notifications')
      .delete()
      .in('id', notificationIds)
      .eq('admin_id', user.id);

    if (error) {
      console.error('Error deleting notifications:', error);
      return NextResponse.json({ error: 'Error al eliminar notificaciones' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in notifications DELETE:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
