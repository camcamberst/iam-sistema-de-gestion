import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * PUT: Actualizar solicitud de ahorro (solo si está pendiente)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { monto_ahorrado, porcentaje_ahorrado, tipo_solicitud } = body;

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

    // Obtener la solicitud actual
    const { data: currentSavings, error: fetchError } = await supabase
      .from('model_savings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentSavings) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Verificar que pertenece a la modelo autenticada
    if (currentSavings.model_id !== user.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Solo permitir edición si está pendiente
    if (currentSavings.estado !== 'pendiente') {
      return NextResponse.json({
        success: false,
        error: 'Solo puedes editar solicitudes pendientes'
      }, { status: 400 });
    }

    // Validar y calcular nuevos valores
    let montoFinal: number;
    let porcentajeFinal: number;

    if (tipo_solicitud === 'monto') {
      montoFinal = parseFloat(String(monto_ahorrado));
      porcentajeFinal = (montoFinal / currentSavings.neto_pagar_base) * 100;
    } else {
      porcentajeFinal = parseFloat(String(porcentaje_ahorrado));
      montoFinal = (currentSavings.neto_pagar_base * porcentajeFinal) / 100;
    }

    // Validar límites
    const MIN_MONTO = 50000;
    const MAX_PORCENTAJE = 90;

    if (montoFinal < MIN_MONTO) {
      return NextResponse.json({
        success: false,
        error: `El monto mínimo de ahorro es $${MIN_MONTO.toLocaleString('es-CO')} COP`
      }, { status: 400 });
    }

    if (porcentajeFinal > MAX_PORCENTAJE) {
      return NextResponse.json({
        success: false,
        error: `El porcentaje máximo de ahorro es ${MAX_PORCENTAJE}%`
      }, { status: 400 });
    }

    if (montoFinal > currentSavings.neto_pagar_base) {
      return NextResponse.json({
        success: false,
        error: `El monto solicitado excede el NETO A PAGAR disponible`
      }, { status: 400 });
    }

    // Actualizar
    const { data: updated, error: updateError } = await supabase
      .from('model_savings')
      .update({
        monto_ahorrado: montoFinal,
        porcentaje_ahorrado: porcentajeFinal,
        tipo_solicitud,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [SAVINGS] Error actualizando:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      savings: updated,
      message: 'Solicitud de ahorro actualizada'
    });

  } catch (error: any) {
    console.error('❌ [SAVINGS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Cancelar solicitud de ahorro (solo si está pendiente)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    // Obtener la solicitud actual
    const { data: currentSavings, error: fetchError } = await supabase
      .from('model_savings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentSavings) {
      return NextResponse.json({ success: false, error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Verificar que pertenece a la modelo autenticada
    if (currentSavings.model_id !== user.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Solo permitir cancelación si está pendiente
    if (currentSavings.estado !== 'pendiente') {
      return NextResponse.json({
        success: false,
        error: 'Solo puedes cancelar solicitudes pendientes'
      }, { status: 400 });
    }

    // Actualizar estado a cancelado
    const { data: updated, error: updateError } = await supabase
      .from('model_savings')
      .update({
        estado: 'cancelado',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [SAVINGS] Error cancelando:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      savings: updated,
      message: 'Solicitud de ahorro cancelada'
    });

  } catch (error: any) {
    console.error('❌ [SAVINGS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
