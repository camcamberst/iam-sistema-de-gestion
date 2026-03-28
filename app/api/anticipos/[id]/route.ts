import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  notifyAnticipoApproved, 
  notifyAnticipoRejected,
  notifyAnticipoRealizado,
  notifyAdminsAnticipoConfirmado,
  notifyAnticipoReversado
} from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// 📋 GET - Obtener anticipo específico
// =====================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('🔍 [API ANTICIPOS] GET anticipo:', id);

    const { data: anticipo, error } = await supabase
      .from('anticipos')
      .select(`
        *,
        model:users!anticipos_model_id_fkey(id, name, email, role),
        period:periods(id, name, start_date, end_date)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ [API ANTICIPOS] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!anticipo) {
      return NextResponse.json({ success: false, error: 'Anticipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: anticipo
    });

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// ✏️ PUT - Actualizar anticipo
// =====================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    console.log('🔍 [API ANTICIPOS] PUT anticipo:', id, body);

    const { 
      estado, 
      comentarios_admin, 
      comentarios_rechazo,
      motivo_reversa,
      admin_id,
      model_id
    } = body;

    // Validaciones
    if (!estado) {
      return NextResponse.json({ 
        success: false, 
        error: 'Estado es requerido' 
      }, { status: 400 });
    }

    if (!['pendiente', 'aprobado', 'rechazado', 'realizado', 'confirmado', 'cancelado', 'reversado'].includes(estado)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Estado inválido' 
      }, { status: 400 });
    }

    // Obtener anticipo actual
    const { data: currentAnticipo, error: fetchError } = await supabase
      .from('anticipos')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentAnticipo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Anticipo no encontrado' 
      }, { status: 404 });
    }

    // Preparar datos de actualización
    const updateData: any = {
      estado,
      updated_at: new Date().toISOString()
    };

    // Agregar campos según el estado
    if (estado === 'aprobado') {
      updateData.comentarios_admin = comentarios_admin;
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = admin_id;
    } else if (estado === 'rechazado') {
      updateData.comentarios_rechazo = comentarios_rechazo;
      updateData.rejected_at = new Date().toISOString();
      updateData.rejected_by = admin_id;
    } else if (estado === 'realizado') {
      updateData.realized_at = new Date().toISOString();
      updateData.realized_by = admin_id;
    } else if (estado === 'confirmado') {
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = model_id || admin_id;
    } else if (estado === 'cancelado') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = admin_id;
    } else if (estado === 'reversado') {
      // Solo se puede reversar un anticipo que esté en estado 'aprobado'
      if (currentAnticipo.estado !== 'aprobado') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden reversar anticipos en estado aprobado'
        }, { status: 400 });
      }
      updateData.reversed_at    = new Date().toISOString();
      updateData.reversed_by    = admin_id;
      updateData.motivo_reversa = motivo_reversa || null;
    }

    // Actualizar anticipo
    const { data: updatedAnticipo, error: updateError } = await supabase
      .from('anticipos')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        model:users!anticipos_model_id_fkey(id, name, email, role),
        period:periods(id, name, start_date, end_date)
      `)
      .single();

    if (updateError) {
      console.error('❌ [API ANTICIPOS] Error actualizando:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    console.log('✅ [API ANTICIPOS] Anticipo actualizado:', id, estado);

    // Notificar según el estado
    const modelId = updatedAnticipo.model_id;
    const modelName = (updatedAnticipo.model as any)?.name || 'Modelo';
    const montoSolicitado = updatedAnticipo.monto_solicitado;

    try {
      if (estado === 'aprobado') {
        await notifyAnticipoApproved(modelId);
        console.log('✅ [API ANTICIPOS] Notificación de aprobación enviada');
      } else if (estado === 'rechazado') {
        await notifyAnticipoRejected(modelId);
        console.log('✅ [API ANTICIPOS] Notificación de rechazo enviada');
      } else if (estado === 'realizado') {
        await notifyAnticipoRealizado(modelId, montoSolicitado);
        console.log('✅ [API ANTICIPOS] Notificación de realizado enviada');
      } else if (estado === 'confirmado') {
        await notifyAdminsAnticipoConfirmado(modelId, modelName, montoSolicitado);
        console.log('✅ [API ANTICIPOS] Notificación de confirmación enviada a admins');
      } else if (estado === 'reversado') {
        await notifyAnticipoReversado(modelId, montoSolicitado, motivo_reversa);
        console.log('✅ [API ANTICIPOS] Notificación de reversión enviada a la modelo');
      }
    } catch (error) {
      console.error('⚠️ [API ANTICIPOS] Error enviando notificación:', error);
      // No fallar la actualización si falla la notificación
    }

    return NextResponse.json({
      success: true,
      data: updatedAnticipo,
      message: `Anticipo ${estado} correctamente`
    });

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
