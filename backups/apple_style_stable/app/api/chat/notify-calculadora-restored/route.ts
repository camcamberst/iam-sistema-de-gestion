import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID } from '@/lib/chat/aim-botty';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';

const MESSAGE_CALCULADORA_RESTAURADA = `"Mi Calculadora" ha sido restaurada, ya puedes ingresar valores en este nuevo periodo. También puedes consultar tu facturación del periodo anterior en "Mi Historial" filtrando año, mes y periodo.`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST: Envía por Botty el aviso de calculadora restaurada a todos los usuarios con Mi Calculadora (rol modelo).
 * Solo super_admin.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!dbUser || dbUser.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Solo super_admin puede enviar este aviso' }, { status: 403 });
    }

    const { data: modelos } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'modelo')
      .eq('is_active', true)
      .neq('id', AIM_BOTTY_ID);

    const ids = (modelos || []).map((u: { id: string }) => u.id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No hay modelos activos' });
    }

    let sent = 0;
    for (const userId of ids) {
      const ok = await sendBotNotification(userId, 'periodo_cerrado', MESSAGE_CALCULADORA_RESTAURADA);
      if (ok) sent++;
    }

    return NextResponse.json({ success: true, sent, total: ids.length });
  } catch (e: any) {
    console.error('Error notify-calculadora-restored:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Error interno' }, { status: 500 });
  }
}
