import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { 
  notifyMetaDiaAlcanzada, 
  notifyMetaPeriodoAlcanzada,
  notifyAdminsMetaAlcanzada
} from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';

const supabase = supabaseServer;

// GET: Obtener ganancias del día actual
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!modelId) {
      return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
    }

    console.log('🔍 [DAILY-EARNINGS] Getting earnings for:', { modelId, date });

    const { data: earnings, error } = await supabase
      .from('daily_earnings')
      .select('earnings_amount, earnings_date, updated_at')
      .eq('model_id', modelId)
      .eq('earnings_date', date)
      .single();

    // 🔧 FIX: Manejar error cuando la tabla no existe (PGRST205)
    if (error) {
      // PGRST116 = no rows found (es normal, no hay datos para esa fecha)
      if (error.code === 'PGRST116') {
        const earningsAmount = 0;
        console.log('✅ [DAILY-EARNINGS] No earnings found for date, returning 0');
        return NextResponse.json({
          success: true,
          earnings: earningsAmount,
          date: date,
          modelId: modelId
        });
      }
      // PGRST205 = tabla no existe en schema cache
      if (error.code === 'PGRST205') {
        console.warn('⚠️ [DAILY-EARNINGS] Tabla daily_earnings no existe en schema cache, retornando 0. Ejecuta create_daily_earnings_table.sql en Supabase.');
        return NextResponse.json({
          success: true,
          earnings: 0,
          date: date,
          modelId: modelId,
          warning: 'Tabla daily_earnings no configurada - ejecuta el script SQL'
        });
      }
      // Otros errores
      console.error('❌ [DAILY-EARNINGS] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const earningsAmount = earnings?.earnings_amount || 0;
    console.log('✅ [DAILY-EARNINGS] Found earnings:', earningsAmount);

    return NextResponse.json({
      success: true,
      earnings: earningsAmount,
      date: date,
      modelId: modelId
    });

  } catch (error: any) {
    console.error('❌ [DAILY-EARNINGS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// POST: Guardar/actualizar ganancias del día
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, earnings, date } = body;

    if (!modelId || earnings === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y earnings son requeridos' 
      }, { status: 400 });
    }

    const earningsDate = date || new Date().toISOString().split('T')[0];
    console.log('🔍 [DAILY-EARNINGS] Saving earnings:', { modelId, earnings, earningsDate });

    const { data, error } = await supabase
      .from('daily_earnings')
      .upsert({
        model_id: modelId,
        earnings_date: earningsDate,
        earnings_amount: parseFloat(earnings.toString())
      }, { 
        onConflict: 'model_id,earnings_date' 
      })
      .select()
      .single();

    // 🔧 FIX: Manejar error cuando la tabla no existe (PGRST205)
    if (error) {
      // PGRST205 = tabla no existe en schema cache
      if (error.code === 'PGRST205') {
        console.warn('⚠️ [DAILY-EARNINGS] Tabla daily_earnings no existe en schema cache, omitiendo guardado. Ejecuta create_daily_earnings_table_FORCE.sql en Supabase SQL Editor.');
        return NextResponse.json({
          success: true,
          message: 'Ganancias no guardadas - tabla daily_earnings no configurada',
          warning: 'La tabla daily_earnings no existe. Ejecuta create_daily_earnings_table_FORCE.sql en Supabase SQL Editor para forzar la creación.',
          skipped: true
        });
      }
      console.error('❌ [DAILY-EARNINGS] Error saving:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('✅ [DAILY-EARNINGS] Earnings saved successfully:', data);

    // Verificar si se alcanzó una meta
    try {
      // Obtener configuración de objetivos
      const { data: config } = await supabase
        .from('calculator_config')
        .select('min_quota_override, group_min_quota, daily_goal_override, group_daily_goal')
        .eq('model_id', modelId)
        .eq('active', true)
        .single();

      if (config) {
        const dailyGoal = config.daily_goal_override || config.group_daily_goal || 0;
        const periodGoal = config.min_quota_override || config.group_min_quota || 0;

        // Verificar meta del día
        if (dailyGoal > 0 && earnings >= dailyGoal) {
          await notifyMetaDiaAlcanzada(modelId);
          
          // Obtener nombre de la modelo para notificar a admins
          const { data: model } = await supabase
            .from('users')
            .select('name')
            .eq('id', modelId)
            .single();
          
          if (model?.name) {
            await notifyAdminsMetaAlcanzada(modelId, model.name, 'día');
          }
          
          console.log('✅ [DAILY-EARNINGS] Meta del día alcanzada, notificaciones enviadas');
        }

        // Verificar meta del período (necesitaríamos calcular total del período)
        // Esto se puede hacer en otro lugar o con un cron job
      }
    } catch (metaError) {
      console.warn('⚠️ [DAILY-EARNINGS] Error verificando metas:', metaError);
      // No fallar el guardado si falla la verificación de metas
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Ganancias del día guardadas correctamente'
    });

  } catch (error: any) {
    console.error('❌ [DAILY-EARNINGS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
