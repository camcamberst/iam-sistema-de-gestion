import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener totales calculados para admin view
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const adminId = searchParams.get('adminId');

    if (!modelId || !adminId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId y adminId son requeridos' 
      }, { status: 400 });
    }

    console.log('🔍 [ADMIN-TOTALS] Calculating totals for model:', modelId);

    // 1. Obtener configuración de calculadora del modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [ADMIN-TOTALS] Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json({ 
        success: false, 
        error: 'Modelo no tiene configuración de calculadora' 
      }, { status: 404 });
    }

    // 2. Obtener plataformas habilitadas
    const { data: platformData, error: platformError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true)
      .order('name');

    if (platformError) {
      console.error('❌ [ADMIN-TOTALS] Error al obtener plataformas:', platformError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    // 3. Obtener tasas actualizadas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value, valid_from')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error('❌ [ADMIN-TOTALS] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas' }, { status: 500 });
    }

    // Procesar tasas (usar la más reciente)
    const usdCopRates = ratesData?.filter((r: any) => r.kind === 'USD→COP') || [];
    const eurUsdRates = ratesData?.filter((r: any) => r.kind === 'EUR→USD') || [];
    const gbpUsdRates = ratesData?.filter((r: any) => r.kind === 'GBP→USD') || [];
    
    const latestUsdCop = usdCopRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    const latestEurUsd = eurUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    const latestGbpUsd = gbpUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
    
    const rates = {
      usd_cop: latestUsdCop?.value || 3900,
      eur_usd: latestEurUsd?.value || 1.01,
      gbp_usd: latestGbpUsd?.value || 1.20
    };

    // 4. Obtener valores actuales del modelo - USAR MISMA LÓGICA QUE ADMIN-VIEW
    const today = getColombiaDate();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    console.log('🔍 [ADMIN-TOTALS] Loading values with date filter:', { modelId, today, sevenDaysAgoStr });

    const { data: allRecentValues, error: valuesError } = await supabase
      .from('model_values')
      .select(`
        platform_id,
        value,
        tokens,
        value_usd,
        platform,
        period_date,
        created_at,
        updated_at
      `)
      .eq('model_id', modelId)
      .gte('period_date', sevenDaysAgoStr) // Últimos 7 días
      .order('updated_at', { ascending: false });

    if (valuesError) {
      console.error('❌ [ADMIN-TOTALS] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    // Obtener solo el valor más reciente por plataforma (misma lógica que admin-view)
    const platformMap = new Map<string, any>();
    allRecentValues?.forEach((value: any) => {
      if (!platformMap.has(value.platform_id)) {
        platformMap.set(value.platform_id, value);
      }
    });

    const modelValues = Array.from(platformMap.values());

    // 5. Calcular totales usando la misma lógica que Mi Calculadora
    const platformsWithValues = platformData?.map(platform => {
      const value = modelValues?.find(v => v.platform_id === platform.id);
      // 🔧 FIX: Usar porcentaje de reparto del modelo (no de cada plataforma)
      const modelPercentage = config.percentage_override || config.group_percentage || 80;


      return {
        ...platform,
        value: value ? Number(value.value) || 0 : 0,
        percentage: modelPercentage
      };
    }) || [];


    // Calcular USD Bruto (SIN porcentaje de reparto)
    const totalUsdBruto = platformsWithValues.reduce((sum, platform) => {
      if (platform.value === 0) return sum;

      let usdBruto = 0;
      if (platform.currency === 'EUR') {
        if (platform.id === 'big7') {
          usdBruto = (platform.value * rates.eur_usd) * 0.84;
        } else if (platform.id === 'mondo') {
          usdBruto = (platform.value * rates.eur_usd) * 0.78;
        } else {
          usdBruto = platform.value * rates.eur_usd;
        }
      } else if (platform.currency === 'GBP') {
        if (platform.id === 'aw') {
          usdBruto = (platform.value * rates.gbp_usd) * 0.677;
        } else {
          usdBruto = platform.value * rates.gbp_usd;
        }
      } else if (platform.currency === 'USD') {
        if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
          usdBruto = platform.value * 0.75;
        } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
          usdBruto = platform.value * 0.05;
        } else if (platform.id === 'dxlive') {
          usdBruto = platform.value * 0.60;
        } else if (platform.id === 'secretfriends') {
          usdBruto = platform.value * 0.5;
        } else if (platform.id === 'superfoon') {
          usdBruto = platform.value;
        } else if (platform.id === 'mdh' || platform.id === 'livejasmin' || platform.id === 'imlive' || platform.id === 'hegre' || platform.id === 'dirtyfans' || platform.id === 'camcontacts') {
          usdBruto = platform.value;
        } else {
          usdBruto = platform.value;
        }
      }

      return sum + usdBruto;
    }, 0);

    // 🔧 SOLUCIÓN SIMPLE: USD Modelo = USD Bruto × Porcentaje de Reparto de la Modelo
    const modelPercentage = config.percentage_override || config.group_percentage || 80;
    const totalUsdModelo = totalUsdBruto * (modelPercentage / 100);
    const totalCopModelo = totalUsdModelo * rates.usd_cop;

    // Calcular objetivo básico (cuota mínima) - USAR USD BRUTO
    const cuotaMinima = config.min_quota_override || config.group_min_quota || 470;
    const porcentajeAlcanzado = (totalUsdBruto / cuotaMinima) * 100;
    const estaPorDebajo = totalUsdBruto < cuotaMinima;

    const totals = {
      usdBruto: totalUsdBruto,
      usdModelo: totalUsdModelo,
      copModelo: totalCopModelo,
      cuotaMinima,
      porcentajeAlcanzado,
      estaPorDebajo
    };


    return NextResponse.json({
      success: true,
      totals: {
        usdBruto: Math.round(totals.usdBruto * 100) / 100,
        usdModelo: Math.round(totals.usdModelo * 100) / 100,
        copModelo: Math.round(totals.copModelo),
        anticipoDisponible: Math.round(totals.copModelo * 0.9),
        cuotaMinima: totals.cuotaMinima,
        porcentajeAlcanzado: Math.round(totals.porcentajeAlcanzado * 100) / 100,
        estaPorDebajo: totals.estaPorDebajo
      },
      rates,
      periodDate: today
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-TOTALS] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
