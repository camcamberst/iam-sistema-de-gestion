import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const { action, targetId } = body;

    if (!targetId || !action) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Verificar roles del usuario actual y el objetivo para validación de permisos
    const { data: usersInfo, error: usersError } = await supabase
      .from('users')
      .select('id, role')
      .in('id', [user.id, targetId]);

    if (usersError || !usersInfo || usersInfo.length !== 2) {
      return NextResponse.json({ error: 'Error obteniendo información de usuarios' }, { status: 500 });
    }

    const currentUser = usersInfo.find((u: any) => u.id === user.id);
    const targetUser = usersInfo.find((u: any) => u.id === targetId);

    // Validación crítica: Modelos no pueden afectar a Admins/Superadmins
    if (currentUser.role === 'modelo' && (targetUser.role === 'admin' || targetUser.role === 'super_admin' || targetUser.role === 'superadmin_aff')) {
      return NextResponse.json({ error: 'No tienes permisos para realizar esta acción sobre este usuario' }, { status: 403 });
    }

    if (action === 'mute') {
      const { error } = await supabase.from('chat_mutes').insert({ muter_id: user.id, muted_id: targetId });
      if (error && error.code !== '23505') throw error; // 23505 es unique violation (ya silenciado)
      return NextResponse.json({ success: true, message: 'Usuario silenciado' });
    }

    if (action === 'unmute') {
      const { error } = await supabase.from('chat_mutes').delete().match({ muter_id: user.id, muted_id: targetId });
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Silencio desactivado' });
    }

    if (action === 'block') {
      const { error } = await supabase.from('chat_blocks').insert({ blocker_id: user.id, blocked_id: targetId });
      if (error && error.code !== '23505') throw error; // 23505 es unique violation
      return NextResponse.json({ success: true, message: 'Usuario bloqueado' });
    }

    if (action === 'unblock') {
      const { error } = await supabase.from('chat_blocks').delete().match({ blocker_id: user.id, blocked_id: targetId });
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Usuario desbloqueado' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    console.error('Error POST /api/chat/privacy:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
