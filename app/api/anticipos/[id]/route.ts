import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    if (!['pendiente', 'aprobado', 'rechazado', 'realizado', 'confirmado', 'cancelado'].includes(estado)) {
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
