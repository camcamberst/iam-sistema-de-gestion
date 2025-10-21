import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Actualizando rol del usuario...');
    
    const { email, newRole } = await request.json();
    
    if (!email || !newRole) {
      return NextResponse.json({ success: false, error: 'Email y newRole son requeridos' }, { status: 400 });
    }

    const supabase = supabaseServer;

    // Actualizar el rol del usuario
    const { data, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('email', email)
      .select();

    if (error) {
      console.error('❌ [DEBUG] Error actualizando usuario:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [DEBUG] Usuario actualizado:', data);

    return NextResponse.json({
      success: true,
      message: `Usuario ${email} actualizado a rol ${newRole}`,
      data
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno' 
    }, { status: 500 });
  }
}
