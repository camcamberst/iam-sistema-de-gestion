'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID } from '@/lib/chat/aim-botty';

export const dynamic = 'force-dynamic';

// Tipos de entrada
interface BroadcastBody {
  title?: string;
  content: string;
  // Uno de los tres enfoques. En el servidor resolvemos a userIds
  roles?: string[]; // ['modelo', 'admin'] ...
  groupIds?: string[]; // IDs de grupos
  userIds?: string[]; // IDs directos
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Auth por token Bearer, igual a otros endpoints
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    // Datos del usuario para verificar rol
    const { data: dbUser, error: userErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (userErr || !dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
    }

    const body: BroadcastBody = await req.json();
    const content = (body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
    }

    // Resolver destinatarios
    let targetUserIds: string[] = [];

    // 1) userIds directos
    if (Array.isArray(body.userIds) && body.userIds.length > 0) {
      targetUserIds = [...new Set(body.userIds)];
    }

    // 2) por roles
    if (targetUserIds.length === 0 && Array.isArray(body.roles) && body.roles.length > 0) {
      const { data: usersByRole } = await supabase
        .from('users')
        .select('id, role, is_active')
        .in('role', body.roles)
        .eq('is_active', true);
      targetUserIds = (usersByRole || []).map(u => u.id);
    }

    // 3) por grupos (si existen tablas de relación). Fallback: ignorar si no hay estructura.
    if (targetUserIds.length === 0 && Array.isArray(body.groupIds) && body.groupIds.length > 0) {
      // Intento estándar: user_groups(user_id, group_id)
      const { data: usersByGroup } = await supabase
        .from('user_groups')
        .select('user_id, group_id')
        .in('group_id', body.groupIds);
      if (usersByGroup) {
        targetUserIds = [...new Set(usersByGroup.map(u => u.user_id))];
      }
    }

    // Quitar al bot y al propio emisor si aparecieran
    targetUserIds = targetUserIds.filter(id => id && id !== AIM_BOTTY_ID && id !== user.id);

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'No hay destinatarios' }, { status: 400 });
    }

    // Reglas de jerarquía: admin no puede enviar a admins/super_admins
    if (dbUser.role === 'admin') {
      const { data: targets } = await supabase
        .from('users')
        .select('id, role')
        .in('id', targetUserIds);
      const invalid = (targets || []).some(t => t.role === 'admin' || t.role === 'super_admin');
      if (invalid) {
        return NextResponse.json({ error: 'No autorizado para enviar a administradores' }, { status: 403 });
      }
    }

    // Crear registro maestro de broadcast (opcional, pero útil para auditoría)
    const { data: broadcast, error: bErr } = await supabase
      .from('chat_broadcasts')
      .insert({
        created_by: user.id,
        scope_type: body.userIds?.length ? 'users' : (body.roles?.length ? 'roles' : 'groups'),
        scope_values: body.userIds?.length ? body.userIds : (body.roles?.length ? body.roles : (body.groupIds || [])),
        title: body.title || null,
        content
      })
      .select('id')
      .single();

    const broadcastId = broadcast?.id || null;

    // Para cada destinatario: asegurar conversación con Botty y crear mensaje
    for (const targetId of targetUserIds) {
      // Buscar conversación existente (dos participantes)
      const { data: conv } = await supabase
        .from('chat_conversations')
        .select('id, participant_1_id, participant_2_id')
        .or(`and(participant_1_id.eq.${targetId},participant_2_id.eq.${AIM_BOTTY_ID}),and(participant_1_id.eq.${AIM_BOTTY_ID},participant_2_id.eq.${targetId})`)
        .maybeSingle();

      let conversationId = conv?.id;
      if (!conversationId) {
        const { data: created, error: cErr } = await supabase
          .from('chat_conversations')
          .insert({ participant_1_id: targetId, participant_2_id: AIM_BOTTY_ID })
          .select('id')
          .single();
        if (cErr) continue;
        conversationId = created?.id;
      }

      if (!conversationId) continue;

      // Insertar mensaje como Botty
      await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: AIM_BOTTY_ID,
          content,
          is_broadcast: true,
          no_reply: true,
          broadcast_id: broadcastId,
          metadata: { label: 'Difusión' }
        });

      // Auditar destino
      if (broadcastId) {
        await supabase
          .from('chat_broadcast_targets')
          .insert({ broadcast_id: broadcastId, user_id: targetId, delivered_at: new Date().toISOString() });
      }
    }

    return NextResponse.json({ success: true, recipients: targetUserIds.length, broadcast_id: broadcastId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}


