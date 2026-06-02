import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * POST: Cancelar meta de ahorro activa de una modelo (Forzada por Administrador)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // 2. Verificar rol de administrador
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return NextResponse.json({ success: false, error: 'Acceso denegado: Se requieren permisos de administrador' }, { status: 403 });
    }

    // 3. Obtener la meta de ahorro
    const { data: goal, error: fetchError } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !goal) {
      return NextResponse.json({ success: false, error: 'Ahorro programado no encontrado' }, { status: 404 });
    }

    // 4. Verificar que la meta está activa
    if (goal.estado !== 'activa') {
      return NextResponse.json({ success: false, error: `Este ahorro programado ya se encuentra ${goal.estado}` }, { status: 400 });
    }

    // 5. Cancelar la meta en Supabase
    const { data: updatedGoal, error: updateError } = await supabase
      .from('savings_goals')
      .update({
        estado: 'cancelada',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError || !updatedGoal) {
      console.error('❌ [ADMIN-GOALS-CANCEL] Error cancelando ahorro:', updateError);
      return NextResponse.json({ success: false, error: updateError?.message || 'Error al actualizar el estado' }, { status: 500 });
    }

    // 6. Notificar a la modelo a través del chatbot en vivo
    try {
      await sendBotNotification(
        goal.model_id,
        'custom_message' as never,
        `⚠️ Tu ahorro programado "${goal.nombre_meta}" ha sido cancelado por la administración. Los fondos acumulados han sido liberados inmediatamente para tu disponibilidad.`
      );
    } catch (notifyErr) {
      console.error('⚠️ [ADMIN-GOALS-CANCEL] Error al enviar notificación de bot:', notifyErr);
      // No bloqueamos la respuesta exitosa si la notificación falla
    }

    return NextResponse.json({
      success: true,
      message: 'Ahorro programado cancelado y fondos liberados con éxito',
      goal: updatedGoal
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-GOALS-CANCEL] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
