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

// GET: Debug paso a paso del cálculo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [STEP-BY-STEP] Iniciando debug paso a paso para modelId:', modelId);

    // 1. Obtener configuración
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo configuración' }, { status: 500 });
    }

    // 2. Obtener plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true);

    if (platformsError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo plataformas' }, { status: 500 });
    }

    // 3. Obtener valores
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    if (valuesError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo valores' }, { status: 500 });
    }

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

    // 6. Debug paso a paso
    const enabled = new Set(calculatorConfig.enabledPlatformIds);
    const valueByPlatform = new Map<string, number>(valueInputs.map(v => [v.platformId, v.valueInput]));

    console.log('🔍 [STEP-BY-STEP] Enabled platforms:', Array.from(enabled));
    console.log('🔍 [STEP-BY-STEP] Value by platform:', Object.fromEntries(valueByPlatform));

    const stepByStepResults = [];

    for (const p of platformRules) {
      const isEnabled = enabled.has(p.id);
      const valueInput = valueByPlatform.get(p.id) ?? 0;
      
      console.log(`🔍 [STEP-BY-STEP] Processing platform ${p.id}:`, {
        isEnabled,
        valueInput,
        conversionType: p.conversionType,
        tokenRateUsd: p.tokenRateUsd,
        discountFactor: p.discountFactor,
        taxFactor: p.taxFactor
      });

      if (!isEnabled) {
        stepByStepResults.push({
          platformId: p.id,
          enabled: false,
          valueInput,
          usdBruto: 0,
          usdModelo: 0,
          copModelo: 0,
          reason: 'Platform not enabled'
        });
        continue;
      }

      if (valueInput === 0) {
        stepByStepResults.push({
          platformId: p.id,
          enabled: true,
          valueInput,
          usdBruto: 0,
          usdModelo: 0,
          copModelo: 0,
          reason: 'No value input'
        });
        continue;
      }

      // Calcular USD bruto según tipo de conversión
      let usdBruto = 0;
      switch (p.conversionType) {
        case 'usd_cop':
          usdBruto = valueInput;
          if (p.taxFactor !== undefined) usdBruto *= p.taxFactor;
          if (p.discountFactor !== undefined) usdBruto *= p.discountFactor;
          break;
        case 'eur_usd_cop':
          usdBruto = valueInput * rates.EUR_USD;
          if (p.taxFactor !== undefined) usdBruto *= p.taxFactor;
          if (p.discountFactor !== undefined) usdBruto *= p.discountFactor;
          break;
        case 'gbp_usd_cop':
          usdBruto = valueInput * rates.GBP_USD;
          if (p.taxFactor !== undefined) usdBruto *= p.taxFactor;
          if (p.discountFactor !== undefined) usdBruto *= p.discountFactor;
          break;
        case 'tokens':
          const tokenRate = p.tokenRateUsd ?? 0;
          usdBruto = valueInput * tokenRate;
          if (p.taxFactor !== undefined) usdBruto *= p.taxFactor;
          if (p.discountFactor !== undefined) usdBruto *= p.discountFactor;
          break;
      }

      usdBruto = Math.max(0, usdBruto); // clampNonNegative

      let percentageModel = calculatorConfig.percentageRule.percentageModel;
      if (p.specialFlags?.superfoon_100_model) {
        percentageModel = 100;
      }

      const usdModelo = usdBruto * (percentageModel / 100);
      const copModelo = Math.round(usdModelo * rates.USD_COP);

      stepByStepResults.push({
        platformId: p.id,
        enabled: true,
        valueInput,
        conversionType: p.conversionType,
        tokenRateUsd: p.tokenRateUsd,
        discountFactor: p.discountFactor,
        taxFactor: p.taxFactor,
        usdBruto: Math.round(usdBruto * 100) / 100,
        usdModelo: Math.round(usdModelo * 100) / 100,
        copModelo,
        percentageModel,
        reason: 'Calculated successfully'
      });
    }

    // 7. Ejecutar computeTotals para comparar
    const result = computeTotals(platformRules, valueInputs, rates, calculatorConfig);

    return NextResponse.json({
      success: true,
      debug: {
        config: {
          enabledPlatforms: config.enabled_platforms,
          percentageModel: calculatorConfig.percentageRule.percentageModel,
          cuotaMinimaUsd: calculatorConfig.cuotaMinimaUsd
        },
        rates,
        stepByStepResults,
        computeTotalsResult: result,
        summary: {
          totalPlatforms: platformRules.length,
          enabledPlatforms: Array.from(enabled).length,
          valuesWithInput: valueInputs.filter(v => v.valueInput > 0).length,
          stepByStepTotalUsdBruto: stepByStepResults.reduce((sum, r) => sum + r.usdBruto, 0),
          stepByStepTotalUsdModelo: stepByStepResults.reduce((sum, r) => sum + r.usdModelo, 0),
          computeTotalsTotalUsdBruto: result.totalUsdBruto,
          computeTotalsTotalUsdModelo: result.totalUsdModelo
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [STEP-BY-STEP] Error en debug:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
