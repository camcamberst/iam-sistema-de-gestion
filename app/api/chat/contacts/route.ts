import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: Obtener solicitudes pendientes
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Obtener solicitudes pendientes enviadas y recibidas
    const { data: requests, error } = await supabase
      .from('chat_contacts')
      .select(`
        id,
        user_id,
        contact_id,
        status,
        created_at,
        sender:users!chat_contacts_user_id_fkey(id, name, avatar_url),
        receiver:users!chat_contacts_contact_id_fkey(id, name, avatar_url)
      `)
      .or(`user_id.eq.${user.id},contact_id.eq.${user.id}`)
      .eq('status', 'pending');

    if (error) throw error;

    return NextResponse.json({ success: true, requests: requests || [] });
  } catch (error) {
    console.error('Error GET contacts:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST: Acciones de Contactos (Buscar, Enviar, Aceptar, Rechazar)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const body = await request.json();
    const { action, payload } = body;

    if (action === 'search') {
      const { pin } = payload;
      if (!pin || pin.length !== 8) {
        return NextResponse.json({ error: 'PIN inválido' }, { status: 400 });
      }

      // Buscar coincidencia EXACTA de PIN
      const { data: targetUser, error } = await supabase
        .from('users')
        .select('id, name, avatar_url, email')
        .eq('aurora_pin', pin.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !targetUser) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      if (targetUser.id === user.id) {
        return NextResponse.json({ error: 'No puedes agregarte a ti mismo' }, { status: 400 });
      }

      // Ocultar la parte final del email
      const emailParts = targetUser.email.split('@');
      const safeEmail = emailParts[0]; // Solo el prefijo

      return NextResponse.json({ 
        success: true, 
        user: {
          id: targetUser.id,
          name: targetUser.name,
          avatar_url: targetUser.avatar_url,
          email_prefix: safeEmail
        }
      });
    }

    if (action === 'request') {
      const { contactId } = payload;
      
      // Verificar si ya existe relación
      const { data: existing } = await supabase
        .from('chat_contacts')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},contact_id.eq.${contactId}),and(user_id.eq.${contactId},contact_id.eq.${user.id})`)
        .single();

      if (existing) {
        if (existing.status === 'accepted') return NextResponse.json({ error: 'Ya son contactos' }, { status: 400 });
        if (existing.status === 'pending') return NextResponse.json({ error: 'Ya hay una solicitud pendiente' }, { status: 400 });
        return NextResponse.json({ error: 'No se puede agregar al contacto' }, { status: 400 });
      }

      const { error } = await supabase
        .from('chat_contacts')
        .insert({
          user_id: user.id,
          contact_id: contactId,
          status: 'pending'
        });

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Solicitud enviada' });
    }

    if (action === 'accept' || action === 'reject') {
      const { requestId } = payload;
      
      // Verificar que el requestId exista y sea dirigido a nosotros
      const { data: req } = await supabase
        .from('chat_contacts')
        .select('contact_id')
        .eq('id', requestId)
        .single();

      if (!req || req.contact_id !== user.id) {
        return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
      }

      if (action === 'accept') {
        const { error } = await supabase
          .from('chat_contacts')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', requestId);
        if (error) throw error;
        return NextResponse.json({ success: true, message: 'Solicitud aceptada' });
      } else {
        const { error } = await supabase
          .from('chat_contacts')
          .delete()
          .eq('id', requestId);
        if (error) throw error;
        return NextResponse.json({ success: true, message: 'Solicitud rechazada' });
      }
    }

    if (action === 'remove') {
      const { contactId } = payload;
      
      const { error } = await supabase
        .from('chat_contacts')
        .delete()
        .or(`and(user_id.eq.${user.id},contact_id.eq.${contactId}),and(user_id.eq.${contactId},contact_id.eq.${user.id})`);
        
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Contacto eliminado' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    console.error('Error POST contacts:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
