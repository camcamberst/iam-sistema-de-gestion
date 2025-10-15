import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Ejecutar mantenimiento diario de ganancias (archivar ayer, reiniciar hoy)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [DAILY-MAINTENANCE] Iniciando mantenimiento diario de ganancias...');

    // Ejecutar la función de mantenimiento
    const { data, error } = await supabase.rpc('daily_earnings_maintenance');

    if (error) {
      console.error('❌ [DAILY-MAINTENANCE] Error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Error ejecutando mantenimiento diario'
      }, { status: 500 });
    }

    console.log('✅ [DAILY-MAINTENANCE] Mantenimiento completado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Mantenimiento diario de ganancias completado',
      timestamp: new Date().toISOString(),
      data: data
    });

  } catch (error: any) {
    console.error('❌ [DAILY-MAINTENANCE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// GET: Obtener estadísticas del mantenimiento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    console.log('🔍 [DAILY-MAINTENANCE] Obteniendo estadísticas para:', date);

    // Obtener estadísticas de ganancias actuales
    const { data: currentEarnings, error: currentError } = await supabase
      .from('daily_earnings')
      .select('model_id, earnings_amount')
      .eq('earnings_date', date);

    if (currentError) {
      console.error('❌ [DAILY-MAINTENANCE] Error obteniendo ganancias actuales:', currentError);
      return NextResponse.json({
        success: false,
        error: currentError.message
      }, { status: 500 });
    }

    // Obtener estadísticas del historial
    const { data: historyStats, error: historyError } = await supabase
      .from('daily_earnings_history')
      .select('earnings_date, earnings_amount')
      .gte('earnings_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Últimos 7 días
      .order('earnings_date', { ascending: false });

    if (historyError) {
      console.error('❌ [DAILY-MAINTENANCE] Error obteniendo historial:', historyError);
      return NextResponse.json({
        success: false,
        error: historyError.message
      }, { status: 500 });
    }

    // Calcular estadísticas
    const totalCurrentEarnings = currentEarnings?.reduce((sum, item) => sum + (item.earnings_amount || 0), 0) || 0;
    const totalHistoryEarnings = historyStats?.reduce((sum, item) => sum + (item.earnings_amount || 0), 0) || 0;
    const activeModelsToday = currentEarnings?.length || 0;

    return NextResponse.json({
      success: true,
      date: date,
      statistics: {
        currentDay: {
          totalEarnings: totalCurrentEarnings,
          activeModels: activeModelsToday,
          records: currentEarnings?.length || 0
        },
        history: {
          totalEarnings: totalHistoryEarnings,
          records: historyStats?.length || 0,
          last7Days: historyStats?.slice(0, 7) || []
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DAILY-MAINTENANCE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
