import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, createPeriodIfNeeded } from '@/utils/calculator-dates';
import { computeTotals, ConversionType } from '@/lib/calculadora/calc';

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

// GET: Obtener totales usando función centralizada
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

        try {
          console.log('🔍 [CALCULATOR-TOTALS] Obteniendo totales para modelId:', modelId, 'periodDate:', periodDate);
          
          // 0. Crear período si no existe
          console.log('🔄 [CALCULATOR-TOTALS] Verificando/creando período...');
          await createPeriodIfNeeded(periodDate);
          console.log('✅ [CALCULATOR-TOTALS] Período verificado/creado');

    // 1. Obtener configuración de calculadora
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    if (!config) {
      console.log('🔍 [CALCULATOR-TOTALS] No hay configuración para modelId:', modelId);
      return NextResponse.json({
        success: true,
        data: {
          copModelo: 0,
          anticipoDisponible: 0,
          anticiposPagados: 0,
          totalUsdBruto: 0,
          totalUsdModelo: 0,
          totalCopModelo: 0
        }
      });
    }

    // 2. Obtener plataformas habilitadas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true)
      .order('name');

    if (platformsError) {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    // 3. Obtener valores del modelo
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    if (valuesError) {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    // 4. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true);

    if (ratesError) {
      console.error('❌ [CALCULATOR-TOTALS] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas' }, { status: 500 });
    }

    // 5. Procesar tasas
    const rates = {
      USD_COP: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      EUR_USD: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      GBP_USD: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    // 6. Convertir datos al formato esperado por computeTotals
    const platformRules = platforms?.map(p => ({
      id: p.id,
      code: p.id, // Usar id como code
      name: p.name,
      conversionType: (p.currency === 'EUR' ? 'eur_usd_cop' : 
                     p.currency === 'GBP' ? 'gbp_usd_cop' : 
                     p.currency === 'USD' ? 'usd_cop' : 'tokens') as ConversionType,
      tokenRateUsd: p.token_rate,
      discountFactor: p.discount_factor,
      taxFactor: p.tax_rate,
      specialFlags: p.id === 'superfoon' ? { superfoon_100_model: true } : undefined
    })) || [];

    const valueInputs = values?.map(v => ({
      platformId: v.platform_id,
      valueInput: Number(v.value) || 0
    })) || [];

    const calculatorConfig = {
      enabledPlatformIds: config.enabled_platforms,
      percentageRule: {
        percentageModel: config.percentage_override || config.group_percentage || 80
      },
      cuotaMinimaUsd: config.min_quota_override || config.group_min_quota || 470
    };

    // 7. IMPLEMENTACIÓN CORREGIDA DE CÁLCULO
    const enabled = new Set(config.enabled_platforms);
    const valueByPlatform = new Map<string, number>(values?.map(v => [v.platform_id, Number(v.value) || 0]) || []);

    console.log('🔍 [CALCULATOR-TOTALS] Enabled platforms:', Array.from(enabled));
    console.log('🔍 [CALCULATOR-TOTALS] Value by platform:', Object.fromEntries(valueByPlatform));

    const perPlatform = [];
    let totalUsdBruto = 0;
    let totalUsdModelo = 0;

    for (const platform of platforms || []) {
      if (!enabled.has(platform.id)) continue;
      
      const valueInput = valueByPlatform.get(platform.id) || 0;
      console.log(`🔍 [CALCULATOR-TOTALS] Procesando ${platform.id}: value=${valueInput}, currency=${platform.currency}`);
      
      if (valueInput === 0) {
        perPlatform.push({
          platformId: platform.id,
          usdBruto: 0,
          usdModelo: 0,
          copModelo: 0
        });
        continue;
      }

      // Calcular USD bruto según tipo de conversión
      let usdBruto = 0;
      
      if (platform.currency === 'EUR') {
        usdBruto = valueInput * rates.EUR_USD;
        if (platform.tax_rate !== null && platform.tax_rate !== undefined) {
          usdBruto *= platform.tax_rate;
        }
        if (platform.discount_factor !== null && platform.discount_factor !== undefined) {
          usdBruto *= platform.discount_factor;
        }
      } else if (platform.currency === 'GBP') {
        usdBruto = valueInput * rates.GBP_USD;
        if (platform.tax_rate !== null && platform.tax_rate !== undefined) {
          usdBruto *= platform.tax_rate;
        }
        if (platform.discount_factor !== null && platform.discount_factor !== undefined) {
          usdBruto *= platform.discount_factor;
        }
      } else if (platform.currency === 'USD') {
        usdBruto = valueInput;
        if (platform.tax_rate !== null && platform.tax_rate !== undefined) {
          usdBruto *= platform.tax_rate;
        }
        if (platform.discount_factor !== null && platform.discount_factor !== undefined) {
          usdBruto *= platform.discount_factor;
        }
      } else {
        // Tokens/Créditos
        const tokenRate = platform.token_rate || 0;
        usdBruto = valueInput * tokenRate;
        if (platform.tax_rate !== null && platform.tax_rate !== undefined) {
          usdBruto *= platform.tax_rate;
        }
        if (platform.discount_factor !== null && platform.discount_factor !== undefined) {
          usdBruto *= platform.discount_factor;
        }
      }

      usdBruto = Math.max(0, usdBruto); // clampNonNegative

      // Reglas especiales
      let percentageModel = config.percentage_override || config.group_percentage || 80;
      if (platform.id === 'superfoon') {
        percentageModel = 100; // SUPERFOON: 100% para la modelo
      }

      const usdModelo = usdBruto * (percentageModel / 100);
      const copModelo = Math.round(usdModelo * rates.USD_COP);

      console.log(`🔍 [CALCULATOR-TOTALS] ${platform.id}: usdBruto=${usdBruto}, usdModelo=${usdModelo}, copModelo=${copModelo}`);

      perPlatform.push({
        platformId: platform.id,
        usdBruto: Math.round(usdBruto * 100) / 100,
        usdModelo: Math.round(usdModelo * 100) / 100,
        copModelo: copModelo
      });

      totalUsdBruto += usdBruto;
      totalUsdModelo += usdModelo;
    }

    const totalCopModelo = Math.round(totalUsdModelo * rates.USD_COP);

    // Alerta de cuota mínima
    let cuotaMinimaAlert;
    const cuotaMinimaUsd = config.min_quota_override || config.group_min_quota || 470;
    if (cuotaMinimaUsd > 0) {
      const below = totalUsdBruto < cuotaMinimaUsd;
      const percentToReach = below
        ? Math.max(0, ((cuotaMinimaUsd - totalUsdBruto) / cuotaMinimaUsd) * 100)
        : 0;
      cuotaMinimaAlert = { below, percentToReach: Math.round(percentToReach * 100) / 100 };
    }

    // Anticipo máximo: 90% de COP MODELO
    const anticipoMaxCop = Math.round(totalCopModelo * 0.90);

    const result = {
      perPlatform,
      totalUsdBruto: Math.round(totalUsdBruto * 100) / 100,
      totalUsdModelo: Math.round(totalUsdModelo * 100) / 100,
      totalCopModelo: Math.round(totalCopModelo),
      cuotaMinimaAlert,
      anticipoMaxCop: Math.round(anticipoMaxCop)
    };

    // 8. Obtener anticipos ya pagados
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    let anticiposPagados = 0;
    if (!anticiposError && anticipos) {
      anticiposPagados = anticipos.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0);
    }

    // 9. Calcular anticipo disponible (90% de COP Modelo)
    const anticipoDisponible = Math.max(0, result.anticipoMaxCop - anticiposPagados);

    console.log('✅ [CALCULATOR-TOTALS] Totales calculados con función centralizada:', {
      totalUsdBruto: result.totalUsdBruto,
      totalUsdModelo: result.totalUsdModelo,
      totalCopModelo: result.totalCopModelo,
      anticipoDisponible: Math.round(anticipoDisponible),
      anticiposPagados: Math.round(anticiposPagados)
    });

    return NextResponse.json({
      success: true,
      data: {
        copModelo: result.totalCopModelo,
        anticipoDisponible: Math.round(anticipoDisponible),
        anticiposPagados: Math.round(anticiposPagados),
        totalUsdBruto: result.totalUsdBruto,
        totalUsdModelo: result.totalUsdModelo,
        totalCopModelo: result.totalCopModelo,
        cuotaMinimaAlert: result.cuotaMinimaAlert,
        anticipoMaxCop: result.anticipoMaxCop,
        perPlatform: result.perPlatform,
        rates,
        enabledPlatforms: platformRules.length,
        valuesCount: values?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ [CALCULATOR-TOTALS] Error general:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
