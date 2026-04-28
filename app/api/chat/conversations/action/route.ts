import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

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
    const { action, conversation_id } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id es requerido' }, { status: 400 });
    }

    if (action === 'clear_history') {
      const { error } = await supabase
        .from('chat_cleared_history')
        .upsert(
          { user_id: user.id, conversation_id, cleared_at: new Date().toISOString() },
          { onConflict: 'user_id, conversation_id' }
        );

      if (error) throw error;
      
      return NextResponse.json({ success: true, message: 'Historial vaciado' });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });

  } catch (error) {
    console.error('Error en POST /api/chat/conversations/action:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
