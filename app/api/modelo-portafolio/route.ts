import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener portafolio de la modelo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    // Obtener plataformas activas de la modelo
    const { data: platforms, error: platformsError } = await supabase
      .from('modelo_plataformas')
      .select(`
        id,
        platform_id,
        status,
        requested_at,
        delivered_at,
        confirmed_at,
        deactivated_at,
        notes,
        is_initial_config,
        calculator_sync,
        calculator_activated_at,
        created_at,
        updated_at,
        calculator_platforms (
          id,
          name,
          currency
        )
      `)
      .eq('model_id', modelId)
      .in('status', ['entregada', 'confirmada', 'desactivada'])
      .order('updated_at', { ascending: false });

    if (platformsError) {
      console.error('Error obteniendo plataformas:', platformsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener plataformas' 
      }, { status: 500 });
    }

    // Obtener estadísticas de la calculadora (datos de Mi Historial)
    const { data: calculatorData, error: calculatorError } = await supabase
      .from('calculator_history')
      .select(`
        platform_id,
        value,
        usd_bruto,
        usd_modelo,
        cop_modelo,
        period_date,
        calculator_platforms (
          name,
          id
        )
      `)
      .eq('model_id', modelId)
      .gte('period_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 30 días
      .order('period_date', { ascending: false });

    if (calculatorError) {
      console.warn('Error obteniendo datos de calculadora:', calculatorError);
    }

    // Obtener promedio acumulado mensual de conexión (una sola vez para todas las plataformas)
    const { data: userData } = await supabase
      .from('users')
      .select('monthly_connection_avg, last_avg_calculation_date, last_avg_month')
      .eq('id', modelId)
      .single();
    
    // Calcular connectionPercentage una sola vez
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    let connectionPercentage = 0;
    
    if (userData?.last_avg_month === currentMonth && userData?.monthly_connection_avg) {
      // Usar promedio acumulado mensual
      connectionPercentage = Math.round(userData.monthly_connection_avg);
    } else {
      // Fallback: calcular en tiempo real para el período quincenal actual
      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      const currentPeriod = currentDay >= 1 && currentDay <= 15 ? '1-15' : '16-31';
      const periodDays = currentPeriod === '1-15' ? 13 : 13; // 13 días para ambos períodos (considerando descansos)
      const totalDaysWithActivity = calculatorData?.length || 0;
      connectionPercentage = periodDays > 0 ? Math.round((totalDaysWithActivity / periodDays) * 100) : 0;
    }

    // Procesar estadísticas por plataforma
    const platformStats = platforms.map(platform => {
      const platformHistory = calculatorData?.filter(data => 
        data.platform_id === platform.platform_id
      ) || [];

      const totalValue = platformHistory.reduce((sum, data) => sum + (data.value || 0), 0);
      const totalUsdBruto = platformHistory.reduce((sum, data) => sum + (data.usd_bruto || 0), 0);
      const totalUsdModelo = platformHistory.reduce((sum, data) => sum + (data.usd_modelo || 0), 0);
      const totalCopModelo = platformHistory.reduce((sum, data) => sum + (data.cop_modelo || 0), 0);
      const avgValue = platformHistory.length > 0 ? totalValue / platformHistory.length : 0;
      const avgUsdModelo = platformHistory.length > 0 ? totalUsdModelo / platformHistory.length : 0;

      return {
        ...platform,
        stats: {
          totalDays: platformHistory.length,
          connectionPercentage, // Nueva métrica: Promedio Conexión
          totalValue,
          totalUsdBruto,
          totalUsdModelo,
          totalCopModelo,
          avgValue,
          avgUsdModelo,
          lastActivity: platformHistory[0]?.period_date || null
        }
      };
    });

    // Calcular estadísticas generales
    const totalPlatforms = platforms.length;
    const activePlatforms = platforms.filter(p => p.status === 'confirmada').length;
    const pendingConfirmation = platforms.filter(p => p.status === 'entregada').length;
    const totalUsdModelo = platformStats.reduce((sum, p) => sum + p.stats.totalUsdModelo, 0);
    const totalCopModelo = platformStats.reduce((sum, p) => sum + p.stats.totalCopModelo, 0);

    const summary = {
      totalPlatforms,
      activePlatforms,
      pendingConfirmation,
      totalUsdModelo,
      totalCopModelo,
      avgUsdPerPlatform: totalPlatforms > 0 ? totalUsdModelo / totalPlatforms : 0
    };

    return NextResponse.json({ 
      success: true, 
      data: {
        platforms: platformStats,
        summary,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error en portafolio de modelo:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
