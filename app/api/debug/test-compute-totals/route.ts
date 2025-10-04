import { NextRequest, NextResponse } from 'next/server';
import { computeTotals, ConversionType } from '@/lib/calculadora/calc';

// GET: Prueba directa de computeTotals
export async function GET(request: NextRequest) {
  try {
    // Datos de prueba basados en los valores reales de Melanié
    const platformRules = [
      {
        id: 'modelka',
        code: 'modelka',
        name: 'MODELKA',
        conversionType: 'eur_usd_cop' as ConversionType,
        tokenRateUsd: undefined,
        discountFactor: undefined,
        taxFactor: undefined,
        specialFlags: undefined
      },
      {
        id: 'livecreator',
        code: 'livecreator',
        name: 'LIVECREATOR',
        conversionType: 'eur_usd_cop' as ConversionType,
        tokenRateUsd: undefined,
        discountFactor: undefined,
        taxFactor: undefined,
        specialFlags: undefined
      },
      {
        id: 'skypvt',
        code: 'skypvt',
        name: 'SKYPVT',
        conversionType: 'usd_cop' as ConversionType,
        tokenRateUsd: undefined,
        discountFactor: 0.75,
        taxFactor: undefined,
        specialFlags: undefined
      },
      {
        id: 'mdh',
        code: 'mdh',
        name: 'MDH',
        conversionType: 'usd_cop' as ConversionType,
        tokenRateUsd: undefined,
        discountFactor: undefined,
        taxFactor: undefined,
        specialFlags: undefined
      },
      {
        id: 'dirtyfans',
        code: 'dirtyfans',
        name: 'DIRTYFANS',
        conversionType: 'usd_cop' as ConversionType,
        tokenRateUsd: undefined,
        discountFactor: undefined,
        taxFactor: undefined,
        specialFlags: undefined
      },
      {
        id: 'babestation',
        code: 'babestation',
        name: 'BABESTATION',
        conversionType: 'gbp_usd_cop' as ConversionType,
        tokenRateUsd: undefined,
        discountFactor: undefined,
        taxFactor: undefined,
        specialFlags: undefined
      }
    ];

    const valueInputs = [
      { platformId: 'modelka', valueInput: 3 },
      { platformId: 'livecreator', valueInput: 5 },
      { platformId: 'skypvt', valueInput: 20 },
      { platformId: 'mdh', valueInput: 4 },
      { platformId: 'dirtyfans', valueInput: 76 },
      { platformId: 'babestation', valueInput: 135 }
    ];

    const rates = {
      USD_COP: 3900,
      EUR_USD: 1.01,
      GBP_USD: 1.2
    };

    const calculatorConfig = {
      enabledPlatformIds: ['modelka', 'livecreator', 'skypvt', 'mdh', 'dirtyfans', 'babestation'],
      percentageRule: {
        percentageModel: 70
      },
      cuotaMinimaUsd: 1000
    };

    console.log('🔍 [TEST-COMPUTE] Ejecutando computeTotals con datos de prueba...');
    console.log('🔍 [TEST-COMPUTE] PlatformRules:', platformRules.length);
    console.log('🔍 [TEST-COMPUTE] ValueInputs:', valueInputs.length);
    console.log('🔍 [TEST-COMPUTE] Rates:', rates);
    console.log('🔍 [TEST-COMPUTE] Config:', calculatorConfig);

    const result = computeTotals(platformRules, valueInputs, rates, calculatorConfig);

    console.log('🔍 [TEST-COMPUTE] Resultado:', result);

    return NextResponse.json({
      success: true,
      testData: {
        platformRules: platformRules.length,
        valueInputs: valueInputs.length,
        rates,
        calculatorConfig
      },
      result,
      summary: {
        totalUsdBruto: result.totalUsdBruto,
        totalUsdModelo: result.totalUsdModelo,
        totalCopModelo: result.totalCopModelo,
        perPlatformCount: result.perPlatform.length,
        platformsWithValue: result.perPlatform.filter(p => p.usdBruto > 0).length
      }
    });

  } catch (error: any) {
    console.error('❌ [TEST-COMPUTE] Error en prueba:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor',
      stack: error.stack
    }, { status: 500 });
  }
}
