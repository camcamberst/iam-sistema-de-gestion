import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, createPeriodIfNeeded, normalizeToPeriodStartDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';
import { getAnticiposConfirmadosDelMes, getAnticiposPorPeriodo, getAnticiposPagadosPeriodo, getAnticiposPagadosDelCorte } from '@/lib/anticipos/anticipos-utils';

export const dynamic = 'force-dynamic';

// Usar service role key para bypass RLS
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

// GET: Obtener el valor real de Mi Calculadora usando la misma lógica que el Dashboard de Modelo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  
  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    // 🔧 LOGICA DE DASHBOARD DE MODELO (app/admin/model/dashboard/page.tsx)
    // Usamos getColombiaDate() para la fecha de hoy, igual que el dashboard
    const todayDate = getColombiaDate();
    const yesterdayDate = new Date(new Date(todayDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Normalizar la fecha del período para cálculos de corte (1-15 o 16-fin)
    const periodStartDate = normalizeToPeriodStartDate(todayDate);

    console.log('🔍 [MI-CALCULADORA-REAL] Obteniendo valores para modelId:', modelId);
    console.log('🔍 [MI-CALCULADORA-REAL] Fechas: Hoy=', todayDate, 'Ayer=', yesterdayDate, 'Periodo=', periodStartDate);

    // 1. Obtener tasas activas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value, valid_from')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      throw new Error(`Error al obtener tasas: ${ratesError.message}`);
    }

    const usdCopRates = ratesData?.filter((r: any) => r.kind === 'USD→COP') || [];
    const eurUsdRates = ratesData?.filter((r: any) => r.kind === 'EUR→USD') || [];
    const gbpUsdRates = ratesData?.filter((r: any) => r.kind === 'GBP→USD') || [];
    
    // Usar la tasa más reciente
    const latestUsdCop = usdCopRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    const latestEurUsd = eurUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    const latestGbpUsd = gbpUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    
    const rates = {
      usd_cop: latestUsdCop?.value || 3900,
      eur_usd: latestEurUsd?.value || 1.01,
      gbp_usd: latestGbpUsd?.value || 1.20
    };

    // 2. Obtener configuración de la modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      throw new Error(`Error al obtener configuración: ${configError.message}`);
    }

    if (!config) {
      console.log('🔍 [MI-CALCULADORA-REAL] No se encontró configuración para modelId:', modelId);
      return NextResponse.json({
        success: true,
        data: {
          usdModelo: 0,
          copModelo: 0,
          anticipoDisponible: 0,
          anticiposPagados: 0
        }
      });
    }

    // 3. Obtener plataformas habilitadas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true);

    if (platformsError) {
      throw new Error(`Error al obtener plataformas: ${platformsError.message}`);
    }

    // 4. Obtener valores de HOY (usando getColombiaDate() como el Dashboard)
    const { data: todayValues, error: todayError } = await supabase
      .from('model_values')
      .select('platform_id, value')
      .eq('model_id', modelId)
      .eq('period_date', todayDate); // Usar fecha exacta de hoy, NO fallbacks

    if (todayError) {
      throw new Error(`Error al obtener valores de hoy: ${todayError.message}`);
    }

    const todayIdToValue: Record<string, number> = {};
    todayValues?.forEach((r) => {
      todayIdToValue[r.platform_id] = Number(r.value) || 0;
    });

    // 5. Obtener valores de AYER (para cálculo de ganancias del día)
    const { data: yesterdayValues, error: yesterdayError } = await supabase
      .from('model_values')
      .select('platform_id, value')
      .eq('model_id', modelId)
      .eq('period_date', yesterdayDate);

    if (yesterdayError) {
      console.warn('⚠️ [MI-CALCULADORA-REAL] Error al obtener valores de ayer (no crítico):', yesterdayError.message);
    }

    const yesterdayIdToValue: Record<string, number> = {};
    yesterdayValues?.forEach((r) => {
      yesterdayIdToValue[r.platform_id] = Number(r.value) || 0;
    });

    // 6. Obtener anticipos PAGADOS del corte vigente (1–15 o 16–fin)
    // Esto se mantiene igual para la lógica de anticipos
    const anticiposCorte = await getAnticiposPagadosDelCorte(modelId, periodStartDate);
    const anticiposPagados = anticiposCorte.total;

    // 7. CALCULAR RESULTADOS (Lógica exacta del Dashboard)
    let todayUsdModelo = 0;
    let yesterdayUsdModelo = 0;

    // Procesar plataformas habilitadas
    const enabledPlatforms = platforms || [];
    
    // Cálculo para HOY
    for (const p of enabledPlatforms) {
      const value = todayIdToValue[p.id] || 0;
      if (value <= 0) continue;

      const currency = p.currency || 'USD';
      // Prioridad: Override > Group > Platform > Default (80)
      const finalPct = (config.percentage_override ?? config.group_percentage ?? p.percentage ?? 80) as number;

      let usdFromPlatform = 0;
      
      // Lógica de conversión de monedas (idéntica al Dashboard)
      if (currency === 'EUR') {
        if (p.id === 'big7') {
          usdFromPlatform = (value * rates.eur_usd) * 0.84;
        } else if (p.id === 'mondo') {
          usdFromPlatform = (value * rates.eur_usd) * 0.78;
        } else {
          usdFromPlatform = value * rates.eur_usd;
        }
      } else if (currency === 'GBP') {
        if (p.id === 'aw') {
          usdFromPlatform = (value * rates.gbp_usd) * 0.677;
        } else {
          usdFromPlatform = value * rates.gbp_usd;
        }
      } else if (currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
          usdFromPlatform = value * 0.75;
        } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
          usdFromPlatform = value * 0.05;
        } else if (p.id === 'dxlive') {
          usdFromPlatform = value * 0.60;
        } else if (p.id === 'secretfriends') {
          usdFromPlatform = value * 0.5;
        } else if (p.id === 'superfoon') {
          usdFromPlatform = value;
        } else {
          usdFromPlatform = value;
        }
      }

      // Participación para modelo (superfoon 100%)
      const share = (p.id === 'superfoon') ? usdFromPlatform : (usdFromPlatform * (finalPct / 100));
      todayUsdModelo += share;
    }

    // Cálculo para AYER (si se necesitara para delta, aquí solo nos interesa el acumulado de hoy para COP Modelo)
    // En el Dashboard, `todayUsdModelo` representa el ACUMULADO hasta hoy del periodo actual si `value` es el acumulado.
    // Si `model_values` guarda el acumulado del periodo, entonces `todayUsdModelo` es el total acumulado.
    
    // Calcular COP Modelo
    const copModelo = Math.round(todayUsdModelo * rates.usd_cop);
    
    // Calcular 90% de anticipo disponible
    const anticipoTotal = Math.round(copModelo * 0.9);
    const anticipoDisponible = Math.max(0, anticipoTotal - anticiposPagados);

    console.log('✅ [MI-CALCULADORA-REAL] Resultados calculados (Lógica Dashboard):', {
      usdModelo: todayUsdModelo,
      copModelo,
      anticipoDisponible,
      anticiposPagados
    });

    return NextResponse.json({
      success: true,
      data: {
        usdModelo: Math.round(todayUsdModelo * 100) / 100,
        copModelo: copModelo,
        anticipoDisponible: anticipoDisponible,
        anticiposPagados: anticiposPagados
      }
    });

  } catch (error: any) {
    console.error('❌ [MI-CALCULADORA-REAL] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
