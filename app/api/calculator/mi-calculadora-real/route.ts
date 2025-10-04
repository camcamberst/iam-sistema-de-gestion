import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, createPeriodIfNeeded } from '@/utils/calculator-dates';

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

// GET: Obtener el valor real de Mi Calculadora usando la misma lógica
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MI-CALCULADORA-REAL] Obteniendo valor real de Mi Calculadora para modelId:', modelId, 'periodDate:', periodDate);
    
    // 0. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 1. Obtener el período actual
    const { data: period, error: periodError } = await supabase
      .from('periods')
      .select('id')
      .eq('start_date', periodDate)
      .single();

    if (periodError) {
      console.error('❌ [MI-CALCULADORA-REAL] Error al obtener período:', periodError);
      return NextResponse.json({ success: false, error: 'Error al obtener período' }, { status: 500 });
    }

    // 2. Obtener anticipos ya pagados del mes actual (no solo del período específico)
    console.log('🔍 [MI-CALCULADORA-REAL] Buscando anticipos para modelId:', modelId, 'periodId:', period.id);
    
    // Obtener todos los períodos del mes actual
    const currentDate = new Date(periodDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // getMonth() es 0-based
    
    console.log('🔍 [MI-CALCULADORA-REAL] Buscando períodos del mes:', year, month);
    
    const { data: monthPeriods, error: monthPeriodsError } = await supabase
      .from('periods')
      .select('id')
      .gte('start_date', `${year}-${month.toString().padStart(2, '0')}-01`)
      .lt('start_date', `${year}-${(month + 1).toString().padStart(2, '0')}-01`);
    
    if (monthPeriodsError) {
      console.error('❌ [MI-CALCULADORA-REAL] Error al obtener períodos del mes:', monthPeriodsError);
      return NextResponse.json({ success: false, error: 'Error al obtener períodos del mes' }, { status: 500 });
    }
    
    const periodIds = monthPeriods?.map(p => p.id) || [];
    console.log('🔍 [MI-CALCULADORA-REAL] Períodos del mes encontrados:', periodIds);
    
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado, period_id')
      .eq('model_id', modelId)
      .in('period_id', periodIds)
      .eq('estado', 'confirmado');

    console.log('🔍 [MI-CALCULADORA-REAL] Resultado de consulta anticipos:', {
      anticipos: anticipos,
      error: anticiposError,
      count: anticipos?.length || 0,
      periodId: period.id,
      periodDate: periodDate,
      modelId: modelId
    });

    let anticiposPagados = 0;
    if (!anticiposError && anticipos) {
      anticiposPagados = anticipos.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0);
      console.log('🔍 [MI-CALCULADORA-REAL] Anticipos pagados calculados:', anticiposPagados);
    } else {
      console.log('🔍 [MI-CALCULADORA-REAL] No hay anticipos o error:', anticiposError);
    }

    // 3. Obtener configuración de la modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [MI-CALCULADORA-REAL] Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    if (!config) {
      console.log('🔍 [MI-CALCULADORA-REAL] No se encontró configuración para modelId:', modelId);
      return NextResponse.json({
        success: true,
        data: {
          copModelo: 0,
          anticipoDisponible: 0,
          anticiposPagados: 0
        }
      });
    }

    // 4. Obtener plataformas habilitadas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [MI-CALCULADORA-REAL] Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    // 5. Obtener valores del modelo
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    if (valuesError) {
      console.error('❌ [MI-CALCULADORA-REAL] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    // 6. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value, valid_from, scope')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error('❌ [MI-CALCULADORA-REAL] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas' }, { status: 500 });
    }

    // 7. Procesar tasas (usar la más reciente)
    const usdCopRates = ratesData?.filter((r: any) => r.kind === 'USD→COP') || [];
    const eurUsdRates = ratesData?.filter((r: any) => r.kind === 'EUR→USD') || [];
    const gbpUsdRates = ratesData?.filter((r: any) => r.kind === 'GBP→USD') || [];
    
    // Usar la tasa más reciente (más alta valid_from)
    const latestUsdCop = usdCopRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    const latestEurUsd = eurUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    const latestGbpUsd = gbpUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    
    const rates = {
      usd_cop: latestUsdCop?.value || 3900,
      eur_usd: latestEurUsd?.value || 1.01,
      gbp_usd: latestGbpUsd?.value || 1.20
    };
    
    console.log('🔍 [MI-CALCULADORA-REAL] Tasas seleccionadas:', rates);

    // 8. MAPEAR VALORES A PLATAFORMAS
    const platformsWithValues = platforms?.map(platform => {
      const value = values?.find(v => v.platform_id === platform.id);
      return {
        ...platform,
        value: value ? Number(value.value) || 0 : 0,
        enabled: config.enabled_platforms.includes(platform.id),
        percentage: config.percentage_override || config.group_percentage || 80
      };
    }) || [];

    // 9. CALCULAR USANDO LA MISMA LÓGICA DE MI CALCULADORA
    const totalUsdModelo = platformsWithValues.reduce((sum, p) => {
      if (!p.enabled || p.value === 0) return sum;

      // Calcular USD modelo usando fórmulas específicas + porcentaje (MISMA LÓGICA)
      let usdModelo = 0;
      
      if (p.currency === 'EUR') {
        if (p.id === 'big7') {
          usdModelo = (p.value * rates.eur_usd) * 0.84;
        } else if (p.id === 'mondo') {
          usdModelo = (p.value * rates.eur_usd) * 0.78;
        } else {
          usdModelo = p.value * rates.eur_usd;
        }
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') {
          usdModelo = (p.value * rates.gbp_usd) * 0.677;
        } else {
          usdModelo = p.value * rates.gbp_usd;
        }
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
          usdModelo = p.value * 0.75;
        } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
          usdModelo = p.value * 0.05;
        } else if (p.id === 'dxlive') {
          usdModelo = p.value * 0.60;
        } else if (p.id === 'secretfriends') {
          usdModelo = p.value * 0.5;
        } else if (p.id === 'superfoon') {
          usdModelo = p.value;
        } else {
          usdModelo = p.value;
        }
      }

      // Aplicar porcentaje de la modelo (MISMA LÓGICA)
      return sum + (usdModelo * p.percentage / 100);
    }, 0);

    // 10. CALCULAR COP MODELO (MISMA LÓGICA)
    const copModelo = Math.round(totalUsdModelo * rates.usd_cop);

    // 11. CALCULAR 90% DE ANTICIPO
    const anticipoDisponible = Math.round(copModelo * 0.9);

    console.log('✅ [MI-CALCULADORA-REAL] Valores calculados con lógica real de Mi Calculadora:', {
      totalUsdModelo: Math.round(totalUsdModelo * 100) / 100,
      copModelo: copModelo,
      anticipoDisponible: Math.max(0, anticipoDisponible - anticiposPagados),
      anticiposPagados: anticiposPagados
    });

    return NextResponse.json({
      success: true,
      data: {
        copModelo: copModelo,
        anticipoDisponible: Math.max(0, anticipoDisponible - anticiposPagados),
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
