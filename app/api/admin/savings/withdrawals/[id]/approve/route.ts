import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

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
 * PUT: Aprobar, rechazar o marcar como realizado un retiro
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      estado, // 'aprobado', 'rechazado', 'realizado'
      comentarios_admin,
      comentarios_rechazo,
      admin_id
    } = body;

    // Verificar autenticación y rol
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Validar estado
    if (!estado || !['aprobado', 'rechazado', 'realizado'].includes(estado)) {
      return NextResponse.json({ success: false, error: 'Estado inválido' }, { status: 400 });
    }

    // Obtener retiro actual
    const { data: currentWithdrawal, error: fetchError } = await supabase
      .from('savings_withdrawals')
      .select(`
        *,
        model:users!savings_withdrawals_model_id_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !currentWithdrawal) {
      return NextResponse.json({ success: false, error: 'Retiro no encontrado' }, { status: 404 });
    }

    // Validar transición de estado
    if (estado === 'aprobado' && currentWithdrawal.estado !== 'pendiente') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden aprobar retiros pendientes'
      }, { status: 400 });
    }

    if (estado === 'rechazado' && currentWithdrawal.estado !== 'pendiente') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden rechazar retiros pendientes'
      }, { status: 400 });
    }

    if (estado === 'realizado' && currentWithdrawal.estado !== 'aprobado') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden marcar como realizado retiros aprobados'
      }, { status: 400 });
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado,
      updated_at: new Date().toISOString()
    };

    if (estado === 'aprobado') {
      updateData.comentarios_admin = comentarios_admin;
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = admin_id || user.id;
    } else if (estado === 'rechazado') {
      updateData.comentarios_rechazo = comentarios_rechazo;
      updateData.rejected_at = new Date().toISOString();
      updateData.rejected_by = admin_id || user.id;
    } else if (estado === 'realizado') {
      updateData.realized_at = new Date().toISOString();
      updateData.realized_by = admin_id || user.id;
    }

    // Actualizar
    const { data: updatedWithdrawal, error: updateError } = await supabase
      .from('savings_withdrawals')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        model:users!savings_withdrawals_model_id_fkey(id, name, email)
      `)
      .single();

    if (updateError) {
      console.error('❌ [ADMIN-WITHDRAWALS] Error actualizando:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Notificar a la modelo
    try {
      const modelId = updatedWithdrawal.model_id;
      const modelName = (updatedWithdrawal.model as any)?.name || 'Modelo';
      const monto = updatedWithdrawal.monto_solicitado;

      if (estado === 'aprobado') {
        await sendBotNotification(
          modelId,
          'withdrawal_approved',
          `✅ Tu solicitud de retiro de $${monto.toLocaleString('es-CO')} COP ha sido aprobada. Tiempo estimado: ${updatedWithdrawal.tiempo_procesamiento}`
        );
      } else if (estado === 'rechazado') {
        await sendBotNotification(
          modelId,
          'withdrawal_rejected',
          `❌ Tu solicitud de retiro ha sido rechazada.${comentarios_rechazo ? ` Motivo: ${comentarios_rechazo}` : ''}`
        );
      } else if (estado === 'realizado') {
        await sendBotNotification(
          modelId,
          'withdrawal_completed',
          `💰 Tu retiro de $${monto.toLocaleString('es-CO')} COP ha sido procesado y enviado.`
        );
      }
    } catch (notifError) {
      console.error('❌ [ADMIN-WITHDRAWALS] Error enviando notificación:', notifError);
    }

    return NextResponse.json({
      success: true,
      withdrawal: updatedWithdrawal,
      message: `Retiro ${estado} correctamente`
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-WITHDRAWALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
