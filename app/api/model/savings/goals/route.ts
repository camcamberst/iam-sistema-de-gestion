import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTotalSavingsBalance } from '@/lib/savings/savings-utils';
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
 * GET: Obtener metas de ahorro de la modelo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const estado = searchParams.get('estado'); // 'activa', 'completada', 'cancelada', o null para todas

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

    // Verificar que el usuario es la modelo o admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
    const targetModelId = modelId || user.id;

    // Si no es admin y no es su propio ID, denegar
    if (!isAdmin && user.id !== targetModelId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Obtener saldo actual para calcular progreso
    const balance = await getTotalSavingsBalance(targetModelId);
    const saldoActual = balance.success ? balance.saldo_actual : 0;

    // Construir query
    let query = supabase
      .from('savings_goals')
      .select('*')
      .eq('model_id', targetModelId)
      .order('created_at', { ascending: false });

    if (estado) {
      query = query.eq('estado', estado);
    }

    const { data: goals, error: goalsError } = await query;

    if (goalsError) {
      console.error('❌ [GOALS] Error obteniendo metas:', goalsError);
      return NextResponse.json({ success: false, error: goalsError.message }, { status: 500 });
    }

    // Obtener historial de ahorros para calcular proyeccion
    const { data: savingsHistory } = await supabase
      .from('model_savings')
      .select('monto_ahorrado, created_at')
      .eq('model_id', targetModelId)
      .eq('estado', 'aprobado')
      .order('created_at', { ascending: true });

    let promedioMensual = 0;
    if (savingsHistory && savingsHistory.length > 0) {
      const totalSaved = savingsHistory.reduce((sum, s) => sum + parseFloat(s.monto_ahorrado || 0), 0);
      const firstSave = new Date(savingsHistory[0].created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - firstSave.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const diffMonths = Math.max(1, diffDays / 30); // Minimo 1 mes
      promedioMensual = totalSaved / diffMonths;
    }

    // Calcular progreso para cada meta
    const goalsWithProgress = (goals || []).map(goal => {
      const montoActual = parseFloat(String(goal.monto_actual || 0));
      const montoMeta = parseFloat(String(goal.monto_meta));
      const porcentaje = montoMeta > 0 ? (montoActual / montoMeta) * 100 : 0;
      const isCompleted = porcentaje >= 100 && goal.estado === 'activa';
      const faltante = Math.max(0, montoMeta - montoActual);

      // Calculo de proyeccion
      let proyeccion = null;
      if (goal.estado === 'activa' && goal.fecha_limite && faltante > 0) {
        if (promedioMensual > 0) {
          const mesesNecesarios = faltante / promedioMensual;
          const fechaEstimada = new Date();
          fechaEstimada.setMonth(fechaEstimada.getMonth() + mesesNecesarios);
          const fechaLimite = new Date(goal.fecha_limite);
          
          let estadoRitmo = 'viable';
          const margenDias = (fechaLimite.getTime() - fechaEstimada.getTime()) / (1000 * 60 * 60 * 24);
          
          if (margenDias < 0) {
            estadoRitmo = 'inviable';
          } else if (margenDias <= 30) {
            estadoRitmo = 'riesgo';
          }

          proyeccion = {
            promedio_mensual: promedioMensual,
            meses_necesarios: Math.ceil(mesesNecesarios),
            fecha_estimada: fechaEstimada.toISOString(),
            estado_ritmo: estadoRitmo,
            margen_dias: Math.floor(margenDias)
          };
        } else {
           proyeccion = { estado_ritmo: 'sin_datos' };
        }
      }

      return {
        ...goal,
        monto_actual: montoActual,
        monto_meta: montoMeta,
        porcentaje_progreso: Math.min(100, porcentaje),
        is_completed: isCompleted,
        faltante,
        proyeccion
      };
    });

    return NextResponse.json({
      success: true,
      goals: goalsWithProgress,
      saldo_actual: saldoActual
    });

  } catch (error: any) {
    console.error('❌ [GOALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Crear nueva meta de ahorro
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre_meta, monto_meta, fecha_limite } = body;

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

    const modelId = user.id;

    // Validaciones
    if (!nombre_meta || !monto_meta) {
      return NextResponse.json({ success: false, error: 'Nombre y monto son requeridos' }, { status: 400 });
    }

    const monto = parseFloat(String(monto_meta));
    if (isNaN(monto) || monto <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    // Verificar saldo actual
    const balance = await getTotalSavingsBalance(modelId);
    if (!balance.success) {
      return NextResponse.json({ success: false, error: 'Error al obtener saldo' }, { status: 500 });
    }

    // Verificar si ya existe una meta activa
    const { data: activeGoals, error: checkError } = await supabase
      .from('savings_goals')
      .select('id')
      .eq('model_id', modelId)
      .eq('estado', 'activa');

    if (checkError) {
      return NextResponse.json({ success: false, error: 'Error al verificar metas existentes' }, { status: 500 });
    }

    if (activeGoals && activeGoals.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ya tienes una meta activa. Solo puedes tener una meta a la vez.' 
      }, { status: 400 });
    }

    // Crear meta
    const { data: newGoal, error: createError } = await supabase
      .from('savings_goals')
      .insert({
        model_id: modelId,
        nombre_meta,
        monto_meta: monto,
        fecha_limite: fecha_limite || null,
        estado: 'activa',
        monto_actual: balance.saldo_actual // Inicializar con saldo actual
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ [GOALS] Error creando meta:', createError);
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    // Calcular progreso inicial
    const porcentaje = monto > 0 ? (balance.saldo_actual / monto) * 100 : 0;
    const isCompleted = porcentaje >= 100;

    // Si ya está completada, actualizar estado
    if (isCompleted) {
      await supabase
        .from('savings_goals')
        .update({
          estado: 'completada',
          completed_at: new Date().toISOString()
        })
        .eq('id', newGoal.id);

      // Notificar
      await sendBotNotification(
        modelId,
        'savings_goal_completed',
        `🎉 ¡Felicidades! Has alcanzado tu meta de ahorro: "${nombre_meta}"`
      );
    }

    return NextResponse.json({
      success: true,
      goal: {
        ...newGoal,
        porcentaje_progreso: Math.min(100, porcentaje),
        is_completed: isCompleted,
        faltante: Math.max(0, monto - balance.saldo_actual)
      }
    });

  } catch (error: any) {
    console.error('❌ [GOALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
