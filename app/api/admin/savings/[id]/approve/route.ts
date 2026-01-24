import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';
import { updateSavingsGoalsProgress } from '@/lib/savings/savings-utils';

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
 * PUT: Aprobar o rechazar solicitud de ahorro
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      estado, // 'aprobado' o 'rechazado'
      comentarios_admin,
      comentarios_rechazo,
      monto_ajustado, // Opcional: si el admin ajusta el monto
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
    if (!estado || !['aprobado', 'rechazado'].includes(estado)) {
      return NextResponse.json({ success: false, error: 'Estado inválido' }, { status: 400 });
    }

    // Obtener solicitud actual
    const { data: currentSavings, error: fetchError } = await supabase
      .from('model_savings')
      .select(`
        *,
        model:users!model_savings_model_id_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !currentSavings) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo permitir aprobar/rechazar si está pendiente
    if (currentSavings.estado !== 'pendiente') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden aprobar/rechazar solicitudes pendientes'
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
      
      // Si hay monto ajustado, guardarlo
      if (monto_ajustado !== undefined && monto_ajustado !== null) {
        const montoAjustado = parseFloat(String(monto_ajustado));
        const porcentajeAjustado = (montoAjustado / currentSavings.neto_pagar_base) * 100;
        
        updateData.monto_ajustado = montoAjustado;
        // También actualizar porcentaje si se ajustó el monto
        if (montoAjustado !== currentSavings.monto_ahorrado) {
          updateData.porcentaje_ahorrado = porcentajeAjustado;
        }
      }
    } else if (estado === 'rechazado') {
      updateData.comentarios_rechazo = comentarios_rechazo;
      updateData.rejected_at = new Date().toISOString();
      updateData.rejected_by = admin_id || user.id;
    }

    // Actualizar
    const { data: updatedSavings, error: updateError } = await supabase
      .from('model_savings')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        model:users!model_savings_model_id_fkey(id, name, email)
      `)
      .single();

    if (updateError) {
      console.error('❌ [ADMIN-SAVINGS] Error actualizando:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Notificar a la modelo y actualizar progreso de metas
    try {
      const modelId = updatedSavings.model_id;
      const modelName = (updatedSavings.model as any)?.name || 'Modelo';
      const montoFinal = updatedSavings.monto_ajustado || updatedSavings.monto_ahorrado;

      if (estado === 'aprobado') {
        // Actualizar progreso de metas
        const goalsUpdate = await updateSavingsGoalsProgress(modelId);
        
        // Notificar aprobación
        await sendBotNotification(
          modelId,
          'savings_approved',
          `✅ Tu solicitud de ahorro ha sido aprobada. Monto ahorrado: $${montoFinal.toLocaleString('es-CO')} COP`
        );

        // Notificar metas completadas
        if (goalsUpdate.completedGoals && goalsUpdate.completedGoals.length > 0) {
          for (const goal of goalsUpdate.completedGoals) {
            await sendBotNotification(
              modelId,
              'savings_goal_completed',
              `🎉 ¡Felicidades! Has alcanzado tu meta de ahorro: "${goal.nombre_meta}"`
            );
          }
        }
      } else if (estado === 'rechazado') {
        await sendBotNotification(
          modelId,
          'savings_rejected',
          `❌ Tu solicitud de ahorro ha sido rechazada.${comentarios_rechazo ? ` Motivo: ${comentarios_rechazo}` : ''}`
        );
      }
    } catch (notifError) {
      console.error('❌ [ADMIN-SAVINGS] Error enviando notificación:', notifError);
    }

    return NextResponse.json({
      success: true,
      savings: updatedSavings,
      message: `Solicitud de ahorro ${estado} correctamente`
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-SAVINGS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
