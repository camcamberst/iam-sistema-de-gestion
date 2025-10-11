import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Obtener tickets para admins
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
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');
    const priority = searchParams.get('priority');

    // Construir consulta
    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        users!support_tickets_user_id_fkey(name, email),
        assigned_admin:users!support_tickets_assigned_to_fkey(name, email),
        chat_sessions!support_tickets_session_id_fkey(
          id,
          user_id,
          created_at,
          escalated_at
        )
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status);
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: tickets, error } = await query;

    if (error) {
      console.error('Error fetching tickets:', error);
      return NextResponse.json({ error: 'Error al obtener tickets' }, { status: 500 });
    }

    return NextResponse.json({ tickets });

  } catch (error) {
    console.error('Error in tickets GET:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Crear nuevo ticket (para escalación automática)
export async function POST(request: NextRequest) {
  try {
    const { sessionId, userId, title, description, priority = 'medium', contextData } = await request.json();

    if (!sessionId || !userId || !title) {
      return NextResponse.json({ error: 'Datos requeridos faltantes' }, { status: 400 });
    }

    // Crear ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        session_id: sessionId,
        user_id: userId,
        title,
        description,
        priority,
        context_data: contextData || {}
      })
      .select(`
        *,
        users!support_tickets_user_id_fkey(name, email)
      `)
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return NextResponse.json({ error: 'Error al crear ticket' }, { status: 500 });
    }

    // Notificar a todos los admins
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'super_admin']);

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        ticket_id: ticket.id,
        admin_id: admin.id,
        type: 'new_ticket',
        title: 'Nuevo ticket de soporte',
        message: `Nuevo ticket creado: ${title}`
      }));

      await supabase
        .from('admin_notifications')
        .insert(notifications);
    }

    return NextResponse.json({ ticket });

  } catch (error) {
    console.error('Error in tickets POST:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT - Actualizar ticket
export async function PUT(request: NextRequest) {
  try {
    const { ticketId, status, assignedTo, priority, description } = await request.json();

    if (!ticketId) {
      return NextResponse.json({ error: 'ID de ticket requerido' }, { status: 400 });
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

    // Construir objeto de actualización
    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedTo) updateData.assigned_to = assignedTo;
    if (priority) updateData.priority = priority;
    if (description) updateData.description = description;

    // Si se marca como resuelto, agregar timestamp
    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select(`
        *,
        users!support_tickets_user_id_fkey(name, email),
        assigned_admin:users!support_tickets_assigned_to_fkey(name, email)
      `)
      .single();

    if (error) {
      console.error('Error updating ticket:', error);
      return NextResponse.json({ error: 'Error al actualizar ticket' }, { status: 500 });
    }

    // Si se asigna a alguien, notificar
    if (assignedTo && assignedTo !== user.id) {
      await supabase
        .from('admin_notifications')
        .insert({
          ticket_id: ticketId,
          admin_id: assignedTo,
          type: 'message',
          title: 'Ticket asignado',
          message: `Se te ha asignado el ticket: ${ticket.title}`
        });
    }

    return NextResponse.json({ ticket });

  } catch (error) {
    console.error('Error in tickets PUT:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
