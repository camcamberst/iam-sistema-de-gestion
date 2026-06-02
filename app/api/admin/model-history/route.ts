import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getColombiaDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = supabaseServer;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    // 1. Calcular de forma precisa cuál es la fecha de inicio de la quincena actual activa (en curso)
    // para excluirla de los históricos y promedios, ya que está incompleta.
    const todayStr = getColombiaDate(); // e.g. "2026-05-29"
    const [yearStr, monthStr, dayStr] = todayStr.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const day = parseInt(dayStr);

    const activePeriodStartStr = day <= 15
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-${String(month).padStart(2, '0')}-16`;

    console.log(`🔍 [MODEL-HISTORY] Excluyendo periodo activo actual a partir de: ${activePeriodStartStr}`);

    // 2. Obtener históricos de calculator_history (verdadero archivo histórico)
    const { data: historyData, error: historyError } = await supabase
      .from('calculator_history')
      .select('period_date, period_type, value_usd_bruto, platform_id')
      .eq('model_id', modelId)
      .order('period_date', { ascending: false });

    if (historyError) {
      throw historyError;
    }

    // 3. Obtener todas las configuraciones de calculator_config de la modelo
    const { data: configs, error: configsError } = await supabase
      .from('calculator_config')
      .select('min_quota_override, group_min_quota, created_at, active')
      .eq('model_id', modelId)
      .order('created_at', { ascending: true });

    if (configsError) {
      throw configsError;
    }

    // Encontrar la cuota activa actual (active = true) para compatibilidad
    const activeConfig = configs?.find(c => c.active === true);
    const cuotaMinima = activeConfig?.min_quota_override || activeConfig?.group_min_quota || 470;

    // 4. Filtrar y agrupar por quincena única (period_date + period_type)
    const uniquePeriods = new Map<string, { periodDate: string; periodType: string; totalUsdBruto: number }>();
    const individualSums = new Map<string, number>();
    const consolidatedTotals = new Map<string, number>();

    if (historyData && historyData.length > 0) {
      historyData.forEach(h => {
        const dateStr = typeof h.period_date === 'string' ? h.period_date.slice(0, 10) : String(h.period_date).slice(0, 10);
        const typeStr = h.period_type || '';
        
        // EXCLUIR el período activo actual en curso por seguridad (aunque no debería estar en historial)
        if (dateStr >= activePeriodStartStr) {
          console.log(`🔍 [MODEL-HISTORY] Excluyendo registro en curso del periodo: ${dateStr}`);
          return;
        }
        
        const key = `${dateStr}-${typeStr}`;
        const bruto = Number(h.value_usd_bruto) || 0;
        
        if (!uniquePeriods.has(key)) {
          uniquePeriods.set(key, {
            periodDate: dateStr,
            periodType: typeStr,
            totalUsdBruto: 0
          });
        }

        if (h.platform_id === '__CONSOLIDATED_TOTAL__') {
          consolidatedTotals.set(key, bruto);
        } else {
          const currentSum = individualSums.get(key) || 0;
          individualSums.set(key, currentSum + bruto);
        }
      });

      // Asignar el total correcto para cada quincena
      for (const [key, periodObj] of uniquePeriods.entries()) {
        const sumIndiv = individualSums.get(key) || 0;
        const totalConsol = consolidatedTotals.get(key) || 0;

        // Si la suma de las plataformas individuales es mayor que 0, usamos esa suma (es lo más preciso)
        // Si no (ej: quincenas sintéticas o importaciones consolidadas antiguas), usamos el consolidado
        if (sumIndiv > 0) {
          periodObj.totalUsdBruto = sumIndiv;
        } else {
          periodObj.totalUsdBruto = totalConsol;
        }
      }
    }

    // Si no hay historial cerrado de períodos anteriores:
    if (uniquePeriods.size === 0) {
      console.log(`📊 [MODEL-HISTORY] Modelo ${modelId} no tiene períodos cerrados previos.`);
      return NextResponse.json({
        success: true,
        hasHistory: false,
        avgUsdBruto: 0,
        avgPorcentaje: 0,
        cuotaMinima,
        sugGoal: cuotaMinima
      });
    }

    // Ordenar periodos de forma descendente (más recientes primero)
    const sortedPeriods = Array.from(uniquePeriods.values()).sort((a, b) => {
      const dateA = new Date(a.periodDate);
      const dateB = new Date(b.periodDate);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return a.periodType === '1-15' ? 1 : -1; // 1-15 viene antes (menor fecha final), por lo que va después en orden descendente
    });

    // Tomar solo los últimos 6 periodos (3 meses) para una muestra objetiva y dinámica
    const recentPeriods = sortedPeriods.slice(0, 6);
    console.log(`📊 [MODEL-HISTORY] Usando los ${recentPeriods.length} periodos más recientes de ${sortedPeriods.length} totales.`);

    const historyList = recentPeriods.map(p => {
      // Calcular la fecha de fin del período de forma precisa
      const [yearStr, monthStr, dayStr] = p.periodDate.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      
      let endDate: Date;
      if (p.periodType === '1-15') {
        // Período 1-15: Finaliza el 15 de ese mes
        endDate = new Date(year, month - 1, 15, 23, 59, 59, 999);
      } else {
        // Período 16-31: Finaliza el último día del mes
        const lastDay = new Date(year, month, 0).getDate();
        endDate = new Date(year, month - 1, lastDay, 23, 59, 59, 999);
      }

      // Encontrar la configuración más reciente creada antes o en la fecha de fin del período
      let matchingConfig = null;
      if (configs && configs.length > 0) {
        for (const cfg of configs) {
          const cfgCreatedAt = new Date(cfg.created_at);
          if (cfgCreatedAt <= endDate) {
            matchingConfig = cfg;
          }
        }
        // Si no hay ninguna configuración creada antes del fin del período,
        // usar la primera configuración disponible (la más antigua)
        if (!matchingConfig) {
          matchingConfig = configs[0];
        }
      }

      const periodCuota = matchingConfig?.min_quota_override || matchingConfig?.group_min_quota || 470;
      const porcentaje = (p.totalUsdBruto / periodCuota) * 100;

      return {
        periodDate: p.periodDate,
        usdBruto: p.totalUsdBruto,
        porcentaje: Math.round(porcentaje * 10) / 10,
        cuotaMinima: periodCuota
      };
    });

    // Calcular promedios basados en los porcentajes correctos de cada período
    const totalUsd = historyList.reduce((sum, h) => sum + h.usdBruto, 0);
    const totalPct = historyList.reduce((sum, h) => sum + h.porcentaje, 0);
    
    const avgUsdBruto = totalUsd / historyList.length;
    const avgPorcentaje = totalPct / historyList.length;

    // Algoritmo inteligente de recomendación de objetivo basado en el promedio de rendimiento histórico real
    let sugGoal = cuotaMinima;
    if (avgPorcentaje < 80) {
      // Rendimiento bajo: Sugerir bajar el objetivo al múltiplo de 50 más cercano a su promedio facturado, mínimo 300
      sugGoal = Math.max(300, Math.round(avgUsdBruto / 50) * 50);
    } else if (avgPorcentaje >= 120) {
      // Rendimiento excelente: Sugerir subir el objetivo a un múltiplo de 50 o superior
      const potentialGoal = Math.round(avgUsdBruto / 50) * 50;
      sugGoal = Math.max(cuotaMinima + 50, potentialGoal);
    } else {
      // Rendimiento estable (80% a 119%): Recomendar mantener la cuota actual
      sugGoal = cuotaMinima;
    }

    console.log(`📊 [MODEL-HISTORY] Calculados promedios históricos para modelo ${modelId}:`, {
      totalPeriodos: historyList.length,
      avgUsdBruto: Math.round(avgUsdBruto * 100) / 100,
      avgPorcentaje: Math.round(avgPorcentaje * 10) / 10,
      currentCuota: cuotaMinima,
      sugGoal
    });

    return NextResponse.json({
      success: true,
      hasHistory: true,
      avgUsdBruto: Math.round(avgUsdBruto * 100) / 100,
      avgPorcentaje: Math.round(avgPorcentaje * 10) / 10,
      cuotaMinima,
      sugGoal
    });

  } catch (error: any) {
    console.error('❌ [MODEL-HISTORY] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
  }
}

