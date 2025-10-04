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

// GET: Debug completo del cálculo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [DEBUG] Iniciando debug completo para modelId:', modelId, 'periodDate:', periodDate);

    // 1. Obtener configuración
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    console.log('🔍 [DEBUG] Configuración:', config);

    // 2. Obtener plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config?.enabled_platforms || [])
      .eq('active', true);

    console.log('🔍 [DEBUG] Plataformas encontradas:', platforms?.length || 0);
    console.log('🔍 [DEBUG] Plataformas habilitadas:', config?.enabled_platforms);

    // 3. Obtener valores
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    console.log('🔍 [DEBUG] Valores encontrados:', values?.length || 0);
    console.log('🔍 [DEBUG] Valores:', values);

    // 4. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true);

    const rates = {
      USD_COP: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      EUR_USD: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      GBP_USD: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    console.log('🔍 [DEBUG] Tasas:', rates);

    // 5. Convertir datos al formato esperado
    const platformRules = platforms?.map(p => ({
      id: p.id,
      code: p.id,
      name: p.name,
      conversionType: (p.currency === 'EUR' ? 'eur_usd_cop' :
                       p.currency === 'GBP' ? 'gbp_usd_cop' :
                       p.currency === 'USD' ? 'usd_cop' : 'tokens') as ConversionType,
      tokenRateUsd: p.token_rate,
      discountFactor: p.discount_factor,
      taxFactor: p.tax_rate,
      specialFlags: p.id === 'superfoon' ? { superfoon_100_model: true } : undefined
    })) || [];

    console.log('🔍 [DEBUG] PlatformRules:', platformRules);

    const valueInputs = values?.map(v => ({
      platformId: v.platform_id,
      valueInput: Number(v.value) || 0
    })) || [];

    console.log('🔍 [DEBUG] ValueInputs:', valueInputs);

    const calculatorConfig = {
      enabledPlatformIds: config?.enabled_platforms || [],
      percentageRule: {
        percentageModel: config?.percentage_override || config?.group_percentage || 80
      },
      cuotaMinimaUsd: config?.min_quota_override || config?.group_min_quota || 470
    };

    console.log('🔍 [DEBUG] CalculatorConfig:', calculatorConfig);

    // 6. Ejecutar computeTotals
    console.log('🔍 [DEBUG] Ejecutando computeTotals...');
    const result = computeTotals(platformRules, valueInputs, rates, calculatorConfig);
    console.log('🔍 [DEBUG] Resultado de computeTotals:', result);

    return NextResponse.json({
      success: true,
      debug: {
        config,
        platforms: platforms?.length || 0,
        values: values?.length || 0,
        rates,
        platformRules: platformRules.length,
        valueInputs: valueInputs.length,
        calculatorConfig,
        result
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG] Error en debug:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
