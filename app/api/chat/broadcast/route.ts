import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

type Target = 'all' | 'groups' | 'user';

interface BroadcastBody {
  target: Target;
  groupNames?: string[]; // requerido si target === 'groups'
  userId?: string; // requerido si target === 'user'
  text: string;
  imageUrl?: string;
  isBroadcast?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Obtener rol del usuario
    const { data: userRow } = await supabaseServer
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!userRow) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    const role = (userRow.role || '').toString();
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    const body = (await request.json()) as BroadcastBody;
    const target = body.target;
    const text = (body.text || '').trim();
    const imageUrl = (body.imageUrl || '').trim();
    const isBroadcast = !!body.isBroadcast;
    if (!target || !text) return NextResponse.json({ error: 'Datos insuficientes' }, { status: 400 });

    // Validar URL (whitelist básica de dominios comunes)
    const whitelistHosts = ['i.imgur.com', 'images.unsplash.com', 'cdn.discordapp.com', 'media.tenor.com', 'pbs.twimg.com'];
    let safeImageUrl: string | undefined = undefined;
    if (imageUrl) {
      try {
        const u = new URL(imageUrl);
        if (whitelistHosts.includes(u.host)) safeImageUrl = u.toString();
      } catch (_) {
        // URL inválida -> ignorar
      }
    }

    // Resolver destinatarios
    let recipientIds: string[] = [];
    if (target === 'all') {
      if (role !== 'super_admin') {
        return NextResponse.json({ error: 'Solo super_admin puede enviar a Todos' }, { status: 403 });
      }
      const { data: models } = await supabaseServer
        .from('users')
        .select('id')
        .eq('role', 'modelo');
      recipientIds = (models || []).map(r => r.id);
    } else if (target === 'user') {
      const userId = body.userId;
      if (!userId) return NextResponse.json({ error: 'userId requerido para mensaje individual' }, { status: 400 });
      
      // Verificar que el usuario existe y es modelo
      const { data: targetUser } = await supabaseServer
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .single();
      
      if (!targetUser || targetUser.role !== 'modelo') {
        return NextResponse.json({ error: 'Usuario no encontrado o no es modelo' }, { status: 404 });
      }
      
      recipientIds = [userId];
    } else if (target === 'groups') {
      const names = (body.groupNames || []).map(s => s.trim()).filter(Boolean);
      if (names.length === 0) return NextResponse.json({ error: 'Debe indicar al menos un grupo' }, { status: 400 });

      // Si es admin, limitar a sus propios grupos (asumiendo relación user_groups)
      if (role === 'admin') {
        const { data: adminGroups } = await supabaseServer
          .from('user_groups')
          .select('groups(name)')
          .eq('user_id', user.id);
        const allowed = new Set((adminGroups || []).map((g: any) => g.groups?.name).filter(Boolean));
        for (const n of names) if (!allowed.has(n)) return NextResponse.json({ error: `Grupo no permitido: ${n}` }, { status: 403 });
      }

      // Obtener ids de usuarios (modelos) pertenecientes a esos grupos
      const { data: members } = await supabaseServer
        .from('user_groups')
        .select('user_id, groups(name), users(role)')
        .in('groups.name', names);

      recipientIds = (members || [])
        .filter((m: any) => (m.users?.role || '') === 'modelo')
        .map((m: any) => m.user_id);
    } else {
      return NextResponse.json({ error: 'Target no soportado' }, { status: 400 });
    }

    // Enviar mensajes: crear/obtener sesión para cada destinatario e insertar mensaje del admin
    let sent = 0;
    const footer = isBroadcast ? '\n\n— Mensaje de difusión' : '';
    const imageLine = safeImageUrl ? `\n[Imagen]: ${safeImageUrl}` : '';
    const finalMessage = `${text}${imageLine}${footer}`.trim();

    for (const recipientId of recipientIds) {
      const sessionId = await getOrCreateSession(recipientId);
      if (!sessionId) continue;
      const { error: insErr } = await supabaseServer
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'admin',
          sender_id: user.id,
          message: finalMessage,
          message_type: isBroadcast ? 'broadcast' : 'text'
        });
      if (!insErr) sent += 1;
    }

    return NextResponse.json({ success: true, recipients: sent });
  } catch (e) {
    console.error('broadcast error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function getOrCreateSession(userId: string): Promise<string | null> {
  const { data: existing } = await supabaseServer
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabaseServer
    .from('chat_sessions')
    .insert({ user_id: userId, is_active: true })
    .select('id')
    .single();
  if (error) return null;
  return created?.id || null;
}


