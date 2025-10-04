import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

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

// GET: Debug específico de conversión
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [CONVERSION-DEBUG] Iniciando debug de conversión para modelId:', modelId);

    // 1. Obtener valores con valores > 0
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .gt('value', 0);

    if (valuesError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo valores' }, { status: 500 });
    }

    console.log('🔍 [CONVERSION-DEBUG] Valores con input > 0:', values);

    // 2. Obtener plataformas correspondientes
    const platformIds = values?.map(v => v.platform_id) || [];
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', platformIds)
      .eq('active', true);

    if (platformsError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo plataformas' }, { status: 500 });
    }

    console.log('🔍 [CONVERSION-DEBUG] Plataformas encontradas:', platforms);

    // 3. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true);

    const rates = {
      USD_COP: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      EUR_USD: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      GBP_USD: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    console.log('🔍 [CONVERSION-DEBUG] Tasas:', rates);

    // 4. Debug de conversión paso a paso
    const conversionResults = [];

    for (const value of values || []) {
      const platform = platforms?.find(p => p.id === value.platform_id);
      if (!platform) {
        conversionResults.push({
          platformId: value.platform_id,
          value: value.value,
          error: 'Platform not found'
        });
        continue;
      }

      const valueInput = Number(value.value);
      const currency = platform.currency;
      const tokenRate = platform.token_rate;
      const discountFactor = platform.discount_factor;
      const taxFactor = platform.tax_rate;

      console.log(`🔍 [CONVERSION-DEBUG] Procesando ${platform.id}:`, {
        valueInput,
        currency,
        tokenRate,
        discountFactor,
        taxFactor
      });

      let usdBruto = 0;
      let conversionSteps = [];

      // Determinar tipo de conversión basado en currency
      let conversionType = 'unknown';
      if (currency === 'USD') {
        conversionType = 'usd_cop';
        usdBruto = valueInput;
        conversionSteps.push(`USD directo: ${valueInput}`);
        
        if (taxFactor !== null && taxFactor !== undefined) {
          usdBruto *= taxFactor;
          conversionSteps.push(`Aplicar taxFactor ${taxFactor}: ${usdBruto}`);
        }
        
        if (discountFactor !== null && discountFactor !== undefined) {
          usdBruto *= discountFactor;
          conversionSteps.push(`Aplicar discountFactor ${discountFactor}: ${usdBruto}`);
        }
      } else if (currency === 'EUR') {
        conversionType = 'eur_usd_cop';
        usdBruto = valueInput * rates.EUR_USD;
        conversionSteps.push(`EUR→USD: ${valueInput} * ${rates.EUR_USD} = ${usdBruto}`);
        
        if (taxFactor !== null && taxFactor !== undefined) {
          usdBruto *= taxFactor;
          conversionSteps.push(`Aplicar taxFactor ${taxFactor}: ${usdBruto}`);
        }
        
        if (discountFactor !== null && discountFactor !== undefined) {
          usdBruto *= discountFactor;
          conversionSteps.push(`Aplicar discountFactor ${discountFactor}: ${usdBruto}`);
        }
      } else if (currency === 'GBP') {
        conversionType = 'gbp_usd_cop';
        usdBruto = valueInput * rates.GBP_USD;
        conversionSteps.push(`GBP→USD: ${valueInput} * ${rates.GBP_USD} = ${usdBruto}`);
        
        if (taxFactor !== null && taxFactor !== undefined) {
          usdBruto *= taxFactor;
          conversionSteps.push(`Aplicar taxFactor ${taxFactor}: ${usdBruto}`);
        }
        
        if (discountFactor !== null && discountFactor !== undefined) {
          usdBruto *= discountFactor;
          conversionSteps.push(`Aplicar discountFactor ${discountFactor}: ${usdBruto}`);
        }
      } else {
        conversionType = 'tokens';
        const tokenRateUsd = tokenRate || 0;
        usdBruto = valueInput * tokenRateUsd;
        conversionSteps.push(`Tokens→USD: ${valueInput} * ${tokenRateUsd} = ${usdBruto}`);
        
        if (taxFactor !== null && taxFactor !== undefined) {
          usdBruto *= taxFactor;
          conversionSteps.push(`Aplicar taxFactor ${taxFactor}: ${usdBruto}`);
        }
        
        if (discountFactor !== null && discountFactor !== undefined) {
          usdBruto *= discountFactor;
          conversionSteps.push(`Aplicar discountFactor ${discountFactor}: ${usdBruto}`);
        }
      }

      // Aplicar clampNonNegative
      usdBruto = Math.max(0, usdBruto);

      conversionResults.push({
        platformId: platform.id,
        platformName: platform.name,
        currency,
        conversionType,
        valueInput,
        tokenRate,
        discountFactor,
        taxFactor,
        usdBruto: Math.round(usdBruto * 100) / 100,
        conversionSteps,
        finalResult: usdBruto
      });
    }

    return NextResponse.json({
      success: true,
      debug: {
        rates,
        conversionResults,
        summary: {
          totalValues: values?.length || 0,
          totalUsdBruto: conversionResults.reduce((sum, r) => sum + r.usdBruto, 0),
          platformsWithConversion: conversionResults.filter(r => r.usdBruto > 0).length
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [CONVERSION-DEBUG] Error en debug de conversión:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
