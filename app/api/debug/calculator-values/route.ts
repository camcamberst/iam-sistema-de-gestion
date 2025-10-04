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

// GET: Debug para ver exactamente qué valores está calculando
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [DEBUG-CALCULATOR] Debugging valores para modelId:', modelId, 'periodDate:', periodDate);
    
    // 1. Obtener configuración
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    // 2. Obtener plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config?.enabled_platforms || [])
      .eq('active', true);

    // 3. Obtener valores
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    // 4. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true);

    const rates = {
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    // 5. Mapear valores a plataformas
    const platformsWithValues = platforms?.map(platform => {
      const value = values?.find(v => v.platform_id === platform.id);
      return {
        id: platform.id,
        name: platform.name,
        currency: platform.currency,
        value: value ? Number(value.value) || 0 : 0,
        enabled: config?.enabled_platforms?.includes(platform.id) || false,
        percentage: config?.percentage_override || config?.group_percentage || 80
      };
    }) || [];

    // 6. Calcular paso a paso
    let totalUsdModelo = 0;
    const calculations = [];

    for (const p of platformsWithValues) {
      if (!p.enabled || p.value === 0) continue;

      let usdModelo = 0;
      let calculation = {
        platform: p.name,
        currency: p.currency,
        value: p.value,
        percentage: p.percentage
      };

      if (p.currency === 'EUR') {
        if (p.id === 'big7') {
          usdModelo = (p.value * rates.eur_usd) * 0.84;
          calculation.eurToUsd = p.value * rates.eur_usd;
          calculation.big7Factor = 0.84;
        } else if (p.id === 'mondo') {
          usdModelo = (p.value * rates.eur_usd) * 0.78;
          calculation.eurToUsd = p.value * rates.eur_usd;
          calculation.mondoFactor = 0.78;
        } else {
          usdModelo = p.value * rates.eur_usd;
          calculation.eurToUsd = p.value * rates.eur_usd;
        }
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') {
          usdModelo = (p.value * rates.gbp_usd) * 0.677;
          calculation.gbpToUsd = p.value * rates.gbp_usd;
          calculation.awFactor = 0.677;
        } else {
          usdModelo = p.value * rates.gbp_usd;
          calculation.gbpToUsd = p.value * rates.gbp_usd;
        }
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
          usdModelo = p.value * 0.75;
          calculation.usdFactor = 0.75;
        } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
          usdModelo = p.value * 0.05;
          calculation.usdFactor = 0.05;
        } else if (p.id === 'dxlive') {
          usdModelo = p.value * 0.60;
          calculation.usdFactor = 0.60;
        } else if (p.id === 'secretfriends') {
          usdModelo = p.value * 0.5;
          calculation.usdFactor = 0.5;
        } else if (p.id === 'superfoon') {
          usdModelo = p.value;
          calculation.usdFactor = 1.0;
        } else {
          usdModelo = p.value;
          calculation.usdFactor = 1.0;
        }
      }

      const usdModeloWithPercentage = usdModelo * (p.percentage / 100);
      calculation.usdModelo = usdModelo;
      calculation.usdModeloWithPercentage = usdModeloWithPercentage;
      calculation.copModelo = Math.round(usdModeloWithPercentage * rates.usd_cop);

      totalUsdModelo += usdModeloWithPercentage;
      calculations.push(calculation);
    }

    const totalCopModelo = Math.round(totalUsdModelo * rates.usd_cop);

    return NextResponse.json({
      success: true,
      data: {
        config: config,
        platforms: platformsWithValues,
        values: values,
        rates: rates,
        calculations: calculations,
        totalUsdModelo: Math.round(totalUsdModelo * 100) / 100,
        totalCopModelo: totalCopModelo,
        anticipoDisponible: Math.round(totalCopModelo * 0.9)
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-CALCULATOR] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
