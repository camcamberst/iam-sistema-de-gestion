import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Obtener rol del usuario
    const { data: userRow } = await supabaseServer
      .from('users')
      .select('id, role, name, email')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: userRow?.role,
        name: userRow?.name
      },
      userRow
    });
  } catch (e: any) {
    console.error('Debug user-status error', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
