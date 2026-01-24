import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTotalSavingsBalance } from '@/lib/savings/savings-utils';
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
 * PUT: Actualizar meta de ahorro
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { nombre_meta, monto_meta, fecha_limite, estado } = body;

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

    // Verificar que la meta pertenece al usuario
    const { data: existingGoal, error: fetchError } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingGoal) {
      return NextResponse.json({ success: false, error: 'Meta no encontrada' }, { status: 404 });
    }

    if (existingGoal.model_id !== user.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Preparar actualización
    const updates: any = {};

    if (nombre_meta !== undefined) updates.nombre_meta = nombre_meta;
    if (monto_meta !== undefined) {
      const monto = parseFloat(String(monto_meta));
      if (isNaN(monto) || monto <= 0) {
        return NextResponse.json({ success: false, error: 'El monto debe ser mayor a 0' }, { status: 400 });
      }
      updates.monto_meta = monto;
    }
    if (fecha_limite !== undefined) updates.fecha_limite = fecha_limite || null;
    if (estado !== undefined) {
      updates.estado = estado;
      if (estado === 'completada' && existingGoal.estado !== 'completada') {
        updates.completed_at = new Date().toISOString();
      }
      if (estado === 'cancelada' && existingGoal.estado !== 'cancelada') {
        updates.cancelled_at = new Date().toISOString();
      }
    }

    // Actualizar
    const { data: updatedGoal, error: updateError } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [GOALS] Error actualizando meta:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Si se marcó como completada, notificar
    if (estado === 'completada' && existingGoal.estado !== 'completada') {
      await sendBotNotification(
        user.id,
        'savings_goal_completed',
        `🎉 ¡Felicidades! Has alcanzado tu meta de ahorro: "${updatedGoal.nombre_meta}"`
      );
    }

    // Calcular progreso
    const balance = await getTotalSavingsBalance(user.id);
    const saldoActual = balance.success ? balance.saldo_actual : 0;
    const montoActual = parseFloat(String(updatedGoal.monto_actual || saldoActual));
    const montoMeta = parseFloat(String(updatedGoal.monto_meta));
    const porcentaje = montoMeta > 0 ? (montoActual / montoMeta) * 100 : 0;

    return NextResponse.json({
      success: true,
      goal: {
        ...updatedGoal,
        monto_actual: montoActual,
        porcentaje_progreso: Math.min(100, porcentaje),
        is_completed: porcentaje >= 100 && updatedGoal.estado === 'activa',
        faltante: Math.max(0, montoMeta - montoActual)
      }
    });

  } catch (error: any) {
    console.error('❌ [GOALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Eliminar/cancelar meta de ahorro
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    // Verificar que la meta pertenece al usuario
    const { data: existingGoal, error: fetchError } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingGoal) {
      return NextResponse.json({ success: false, error: 'Meta no encontrada' }, { status: 404 });
    }

    if (existingGoal.model_id !== user.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Si está activa, cancelarla en lugar de eliminar
    if (existingGoal.estado === 'activa') {
      const { error: updateError } = await supabase
        .from('savings_goals')
        .update({
          estado: 'cancelada',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', params.id);

      if (updateError) {
        console.error('❌ [GOALS] Error cancelando meta:', updateError);
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Meta cancelada exitosamente' });
    }

    // Si ya está completada o cancelada, eliminar físicamente
    const { error: deleteError } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', params.id);

    if (deleteError) {
      console.error('❌ [GOALS] Error eliminando meta:', deleteError);
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Meta eliminada exitosamente' });

  } catch (error: any) {
    console.error('❌ [GOALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
