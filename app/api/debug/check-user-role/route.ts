import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG-USER-ROLE] Starting debug check...');
    
    const authHeader = request.headers.get('authorization');
    console.log('🔍 [DEBUG-USER-ROLE] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔍 [DEBUG-USER-ROLE] Token length:', token.length);
    
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    console.log('🔍 [DEBUG-USER-ROLE] Auth result:', { 
      userId: user?.id, 
      userEmail: user?.email,
      error: authError?.message 
    });
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Consultar usuario en la base de datos
    const { data: userRow, error: userRowError } = await supabaseServer
      .from('users')
      .select('id, role, name, email')
      .eq('id', user.id)
      .single();

    console.log('🔍 [DEBUG-USER-ROLE] User row query:', { 
      userRow, 
      error: userRowError?.message 
    });

    if (userRowError) {
      console.error('❌ [DEBUG-USER-ROLE] Error querying user:', userRowError);
      return NextResponse.json({ 
        error: 'Error consultando usuario', 
        details: userRowError.message 
      }, { status: 500 });
    }

    if (!userRow) {
      console.error('❌ [DEBUG-USER-ROLE] User not found in database');
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const role = (userRow.role || '').toString();
    console.log('🔍 [DEBUG-USER-ROLE] Final role check:', { 
      role, 
      isAdmin: role === 'admin',
      isSuperAdmin: role === 'super_admin',
      userInfo: userRow
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        isAdmin: role === 'admin',
        isSuperAdmin: role === 'super_admin',
        canSendIndividual: role === 'admin' || role === 'super_admin'
      }
    });
  } catch (e: any) {
    console.error('❌ [DEBUG-USER-ROLE] Error:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
