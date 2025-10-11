import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Generar análisis con IA de los datos del portafolio
export async function POST(request: NextRequest) {
  try {
    const { modelId, analysisType = 'comprehensive' } = await request.json();

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    // Obtener datos históricos de la calculadora (últimos 30 días)
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
          code,
          percentage
        )
      `)
      .eq('model_id', modelId)
      .gte('period_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('period_date', { ascending: true });

    if (calculatorError) {
      console.error('Error obteniendo datos de calculadora:', calculatorError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener datos históricos' 
      }, { status: 500 });
    }

    if (!calculatorData || calculatorData.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: {
          analysis: 'No hay suficientes datos históricos para generar un análisis. Continúa trabajando para obtener insights valiosos.',
          recommendations: [
            'Mantén un registro consistente de tus ingresos',
            'Diversifica tus plataformas para maximizar ganancias',
            'Establece objetivos claros y medibles'
          ],
          trends: [],
          summary: {
            totalDays: 0,
            totalEarnings: 0,
            avgDailyEarnings: 0,
            bestPlatform: null,
            growthRate: 0
          }
        }
      });
    }

    // Procesar datos para análisis
    const platformStats = new Map();
    const dailyEarnings = new Map();
    let totalEarnings = 0;
    let totalDays = 0;

    calculatorData.forEach(record => {
      const date = record.period_date.split('T')[0];
      const platformName = record.calculator_platforms?.name;
      
      // Saltar si no hay datos de plataforma
      if (!platformName || !record.calculator_platforms) {
        return;
      }
      
      // Estadísticas por plataforma
      if (!platformStats.has(platformName)) {
        platformStats.set(platformName, {
          name: platformName,
          code: record.calculator_platforms.code,
          percentage: record.calculator_platforms.percentage,
          totalEarnings: 0,
          totalDays: 0,
          avgEarnings: 0,
          maxEarnings: 0,
          minEarnings: Infinity
        });
      }
      
      const platform = platformStats.get(platformName);
      platform.totalEarnings += record.usd_modelo || 0;
      platform.totalDays += 1;
      platform.maxEarnings = Math.max(platform.maxEarnings, record.usd_modelo || 0);
      platform.minEarnings = Math.min(platform.minEarnings, record.usd_modelo || 0);
      
      // Estadísticas diarias
      if (!dailyEarnings.has(date)) {
        dailyEarnings.set(date, 0);
        totalDays++;
      }
      dailyEarnings.set(date, dailyEarnings.get(date) + (record.usd_modelo || 0));
      totalEarnings += record.usd_modelo || 0;
    });

    // Calcular promedios
    platformStats.forEach(platform => {
      platform.avgEarnings = platform.totalDays > 0 ? platform.totalEarnings / platform.totalDays : 0;
      if (platform.minEarnings === Infinity) platform.minEarnings = 0;
    });

    // Encontrar la mejor plataforma
    let bestPlatform = null;
    let maxAvgEarnings = 0;
    platformStats.forEach(platform => {
      if (platform.avgEarnings > maxAvgEarnings) {
        maxAvgEarnings = platform.avgEarnings;
        bestPlatform = platform;
      }
    });

    // Calcular tendencia de crecimiento
    const earningsArray = Array.from(dailyEarnings.values());
    let growthRate = 0;
    if (earningsArray.length >= 7) {
      const firstWeek = earningsArray.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
      const lastWeek = earningsArray.slice(-7).reduce((a, b) => a + b, 0) / 7;
      growthRate = firstWeek > 0 ? ((lastWeek - firstWeek) / firstWeek) * 100 : 0;
    }

    // Generar análisis con IA (simulado por ahora)
    const analysis = generateAnalysis({
      totalEarnings,
      totalDays,
      avgDailyEarnings: totalDays > 0 ? totalEarnings / totalDays : 0,
      bestPlatform,
      growthRate,
      platformStats: Array.from(platformStats.values()),
      dailyEarnings: Array.from(dailyEarnings.entries())
    });

    const recommendations = generateRecommendations({
      totalEarnings,
      totalDays,
      avgDailyEarnings: totalDays > 0 ? totalEarnings / totalDays : 0,
      bestPlatform,
      growthRate,
      platformStats: Array.from(platformStats.values())
    });

    const trends = generateTrends({
      dailyEarnings: Array.from(dailyEarnings.entries()),
      platformStats: Array.from(platformStats.values())
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        analysis,
        recommendations,
        trends,
        summary: {
          totalDays,
          totalEarnings,
          avgDailyEarnings: totalDays > 0 ? totalEarnings / totalDays : 0,
          bestPlatform: bestPlatform?.name || null,
          growthRate: Math.round(growthRate * 100) / 100
        },
        platformStats: Array.from(platformStats.values()),
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error en análisis de portafolio:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// Función para generar análisis
function generateAnalysis(data: any): string {
  const { totalEarnings, totalDays, avgDailyEarnings, bestPlatform, growthRate } = data;
  
  let analysis = `📊 **Análisis de Rendimiento (${totalDays} días)**\n\n`;
  
  analysis += `**Rendimiento General:**\n`;
  analysis += `• Ganancias totales: $${totalEarnings.toFixed(2)} USD\n`;
  analysis += `• Promedio diario: $${avgDailyEarnings.toFixed(2)} USD\n`;
  analysis += `• Tasa de crecimiento: ${growthRate > 0 ? '+' : ''}${growthRate.toFixed(1)}%\n\n`;
  
  if (bestPlatform) {
    analysis += `**Plataforma Destacada:**\n`;
    analysis += `• ${bestPlatform.name}: $${bestPlatform.avgEarnings.toFixed(2)} USD/día promedio\n`;
    analysis += `• Contribuye ${((bestPlatform.totalEarnings / totalEarnings) * 100).toFixed(1)}% de tus ganancias totales\n\n`;
  }
  
  if (growthRate > 10) {
    analysis += `🎉 **Excelente crecimiento!** Estás en una tendencia muy positiva.`;
  } else if (growthRate > 0) {
    analysis += `📈 **Crecimiento positivo** - Mantén el buen trabajo!`;
  } else if (growthRate > -10) {
    analysis += `📊 **Rendimiento estable** - Considera estrategias para impulsar el crecimiento.`;
  } else {
    analysis += `📉 **Oportunidad de mejora** - Revisa tus estrategias y horarios.`;
  }
  
  return analysis;
}

// Función para generar recomendaciones
function generateRecommendations(data: any): string[] {
  const { avgDailyEarnings, bestPlatform, growthRate, platformStats } = data;
  const recommendations = [];
  
  if (bestPlatform && bestPlatform.avgEarnings > avgDailyEarnings * 1.5) {
    recommendations.push(`🎯 Enfócate más en ${bestPlatform.name} - es tu plataforma más rentable`);
  }
  
  if (platformStats.length < 3) {
    recommendations.push(`🔄 Considera diversificar con más plataformas para reducir riesgos`);
  }
  
  if (growthRate < 0) {
    recommendations.push(`📈 Revisa tus horarios y estrategias de engagement para mejorar el rendimiento`);
  }
  
  if (avgDailyEarnings < 50) {
    recommendations.push(`💡 Establece objetivos diarios específicos para aumentar la motivación`);
  }
  
  recommendations.push(`📊 Mantén un registro consistente para mejores análisis futuros`);
  recommendations.push(`🎯 Establece metas semanales y mensuales para medir el progreso`);
  
  return recommendations;
}

// Función para generar tendencias
function generateTrends(data: any): any[] {
  const { dailyEarnings, platformStats } = data;
  const trends = [];
  
  // Tendencia semanal
  if (dailyEarnings.length >= 7) {
    const lastWeek = dailyEarnings.slice(-7);
    const weekTotal = lastWeek.reduce((sum, [_, earnings]) => sum + earnings, 0);
    trends.push({
      type: 'weekly',
      label: 'Última Semana',
      value: weekTotal,
      change: 'vs semana anterior',
      trend: 'up' // Simplificado
    });
  }
  
  // Mejor día de la semana
  const dayOfWeekEarnings = new Map();
  dailyEarnings.forEach(([date, earnings]) => {
    const dayOfWeek = new Date(date).getDay();
    if (!dayOfWeekEarnings.has(dayOfWeek)) {
      dayOfWeekEarnings.set(dayOfWeek, []);
    }
    dayOfWeekEarnings.get(dayOfWeek).push(earnings);
  });
  
  let bestDay = 0;
  let bestDayAvg = 0;
  dayOfWeekEarnings.forEach((earnings, day) => {
    const avg = earnings.reduce((a, b) => a + b, 0) / earnings.length;
    if (avg > bestDayAvg) {
      bestDayAvg = avg;
      bestDay = day;
    }
  });
  
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  trends.push({
    type: 'best_day',
    label: 'Mejor Día',
    value: dayNames[bestDay],
    change: `$${bestDayAvg.toFixed(2)} promedio`,
    trend: 'neutral'
  });
  
  return trends;
}
