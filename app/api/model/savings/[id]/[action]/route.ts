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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; action: string } }
) {
  try {
    const { id, action } = params;

    // Verificar acción válida
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
    }

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario es admin o super_admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Obtener la solicitud de ahorro
    const { data: saving, error: savingError } = await supabase
      .from('model_savings')
      .select('*')
      .eq('id', id)
      .single();

    if (savingError || !saving) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (saving.estado !== 'pendiente') {
      return NextResponse.json({ success: false, error: 'La solicitud no está pendiente' }, { status: 400 });
    }

    const modelId = saving.model_id;

    if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('model_savings')
        .update({ estado: 'rechazado', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Error al rechazar solicitud' }, { status: 500 });
      }

      // Notificar a la modelo que fue rechazada (solicitud del usuario)
      await sendBotNotification(
        modelId,
        'savings_rejected',
        `Hola, tu solicitud de ahorro por $${parseFloat(String(saving.monto_ahorrado)).toLocaleString('es-CO')} COP ha sido declinada o rechazada por administración.`
      );

      return NextResponse.json({ success: true, message: 'Solicitud rechazada exitosamente' });
    }

    if (action === 'approve') {
      // Para aprobar, necesitamos generar la deducción física en el periodo cerrado
      const { error: updateAuthError } = await supabase
        .from('model_savings')
        .update({ estado: 'aprobado', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateAuthError) {
        return NextResponse.json({ success: false, error: 'Error al aprobar solicitud' }, { status: 500 });
      }

      // Insertar deducción
      const { error: deductionError } = await supabase
        .from('calculator_deductions')
        .insert({
          model_id: modelId,
          period_date: saving.period_date,
          period_type: saving.period_type,
          amount: parseFloat(String(saving.monto_ahorrado)),
          concept: 'Ahorro Período', // El concepto pedido por el usuario
          created_by: user.id
        });

      if (deductionError) {
        // Hacemos rollback manual del estado
        await supabase.from('model_savings').update({ estado: 'pendiente' }).eq('id', id);
        return NextResponse.json({ success: false, error: 'Error al generar la deducción en nómina' }, { status: 500 });
      }

      // Notificar a la modelo que su ahorro fue aprobado
      await sendBotNotification(
        modelId,
        'savings_approved',
        `¡Felicidades! Tu solicitud de ahorro por $${parseFloat(String(saving.monto_ahorrado)).toLocaleString('es-CO')} COP ha sido probada y descontada de tu quincena satisfactoriamente.`
      );

      return NextResponse.json({ success: true, message: 'Solicitud aprobada y deducida de la nómina' });
    }
  } catch (error: any) {
    console.error('❌ [SAVINGS API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
