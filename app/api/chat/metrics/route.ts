import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Role check
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!userRow || !['admin','super_admin'].includes(userRow.role)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Metrics
    const nowIso = new Date().toISOString();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const sessionsTotal = await supabase
      .from('chat_sessions')
      .select('id', { count: 'exact', head: true });
    const sessionsActive = await supabase
      .from('chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    const sessionsEscalated = await supabase
      .from('chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('escalated', true);

    const messages24h = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h);

    const ticketsOpen = await supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open','in_progress']);
    const ticketsUrgent = await supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'closed')
      .neq('status', 'resolved')
      .eq('priority', 'urgent');

    return NextResponse.json({
      success: true,
      generatedAt: nowIso,
      metrics: {
        sessionsTotal: sessionsTotal.count || 0,
        sessionsActive: sessionsActive.count || 0,
        sessionsEscalated: sessionsEscalated.count || 0,
        messagesLast24h: messages24h.count || 0,
        ticketsOpen: ticketsOpen.count || 0,
        ticketsUrgent: ticketsUrgent.count || 0
      }
    });
  } catch (e) {
    console.error('Chat metrics error', e);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}


