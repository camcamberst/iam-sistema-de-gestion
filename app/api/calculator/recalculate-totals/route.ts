import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Recalcular todos los totales
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [RECALCULATE-TOTALS] Iniciando recálculo de totales...');

    // 1. Obtener todas las configuraciones activas
    const { data: configs, error: configsError } = await supabase
      .from('calculator_config')
      .select('model_id, percentage_override, group_percentage')
      .eq('active', true);

    if (configsError) {
      console.error('❌ [RECALCULATE-TOTALS] Error al obtener configuraciones:', configsError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuraciones' }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay configuraciones para recalcular' });
    }

    // 1.5 Obtener todas las configuraciones por plataforma activas
    const { data: platformConfigs, error: platformConfigsError } = await supabase
      .from('calculator_config_platforms')
      .select('model_id, platform_id, percentage_override');

    const overridesByModel: Record<string, Record<string, number>> = {};
    if (platformConfigs) {
      platformConfigs.forEach((pc: any) => {
        if (!overridesByModel[pc.model_id]) overridesByModel[pc.model_id] = {};
        if (pc.percentage_override) {
          overridesByModel[pc.model_id][pc.platform_id] = pc.percentage_override;
        }
      });
    }

    console.log('🔍 [RECALCULATE-TOTALS] Encontradas ' + configs.length + ' configuraciones');

    // 2. Obtener tasas actuales
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value, valid_from')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    let rates = { usd_cop: 3900, eur_usd: 1.01, gbp_usd: 1.20 };
    if (!ratesError && ratesData) {
      const usdCopRates = ratesData?.filter((r: any) => r.kind === 'USD→COP') || [];
      const eurUsdRates = ratesData?.filter((r: any) => r.kind === 'EUR→USD') || [];
      const gbpUsdRates = ratesData?.filter((r: any) => r.kind === 'GBP→USD') || [];

      const latestUsdCop = usdCopRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
      const latestEurUsd = eurUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];
      const latestGbpUsd = gbpUsdRates.sort((a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime())[0];

      rates = {
        usd_cop: latestUsdCop?.value || 3900,
        eur_usd: latestEurUsd?.value || 1.01,
        gbp_usd: latestGbpUsd?.value || 1.20
      };
    }

    // 3. Obtener todas las plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [RECALCULATE-TOTALS] Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    // 4. Obtener valores recientes de todos los modelos
    const today = getColombiaDate();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const { data: allValues, error: valuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date, updated_at')
      .gte('period_date', sevenDaysAgoStr)
      .order('updated_at', { ascending: false });

    if (valuesError) {
      console.error('❌ [RECALCULATE-TOTALS] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    // 5. Procesar cada modelo
    const recalculatedTotals = [];
    
    for (const config of configs) {
      const modelId = config.model_id;
      const modelPercentage = config.percentage_override || config.group_percentage || 80;

      // Obtener valores de este modelo
      const modelValues = allValues?.filter((v: any) => v.model_id === modelId) || [];
      
      // Obtener solo el valor más reciente por plataforma
      const platformMap = new Map<string, any>();
      modelValues.forEach((value: any) => {
        if (!platformMap.has(value.platform_id)) {
          platformMap.set(value.platform_id, value);
        }
      });

      // Calcular USD Bruto usando la nueva lógica y USD Modelo con overrides
      let totalUsdBruto = 0;
      let totalUsdModelo = 0;
      
      const modelOverrides = overridesByModel[modelId] || {};

      for (const [platformId, value] of Array.from(platformMap.entries())) {
        const platform = platforms?.find((p: any) => p.id === platformId);
        if (!platform || !value.value) continue;

        let usdBruto = 0;
        if (platform.currency === 'EUR') {
          if (platform.id === 'big7') {
            usdBruto = (Number(value.value) * rates.eur_usd) * 0.84;
          } else if (platform.id === 'mondo') {
            usdBruto = (Number(value.value) * rates.eur_usd) * 0.78;
          } else if (['modelka', 'xmodels', '777', 'vx', 'livecreator', 'mow'].includes(platform.id)) {
            usdBruto = Number(value.value) * rates.eur_usd;
          } else {
            usdBruto = Number(value.value) * rates.eur_usd;
          }
        } else if (platform.currency === 'GBP') {
          if (platform.id === 'aw') {
            usdBruto = (Number(value.value) * rates.gbp_usd) * 0.677;
          } else {
            usdBruto = Number(value.value) * rates.gbp_usd;
          }
        } else if (platform.currency === 'USD') {
          if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
            usdBruto = Number(value.value) * 0.75;
          } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
            usdBruto = Number(value.value) * 0.05;
          } else if (platform.id === 'dxlive') {
            usdBruto = Number(value.value) * 0.60;
          } else if (platform.id === 'secretfriends') {
            usdBruto = Number(value.value) * 0.5;
          } else if (platform.id === 'superfoon') {
            usdBruto = Number(value.value);
          } else if (['mdh', 'livejasmin', 'imlive', 'hegre', 'dirtyfans', 'camcontacts'].includes(platform.id)) {
            usdBruto = Number(value.value);
          } else {
            usdBruto = Number(value.value);
          }
        }

        totalUsdBruto += usdBruto;

        const platformPct = modelOverrides[platform.id] || modelPercentage;
        
        if (platform.id === 'superfoon') {
          totalUsdModelo += usdBruto; // 100% directo
        } else {
          totalUsdModelo += usdBruto * (platformPct / 100);
        }
      }

      const totalCopModelo = totalUsdModelo * rates.usd_cop;

      recalculatedTotals.push({
        model_id: modelId,
        period_date: today,
        total_usd_bruto: Math.round(totalUsdBruto * 100) / 100,
        total_usd_modelo: Math.round(totalUsdModelo * 100) / 100,
        total_cop_modelo: Math.round(totalCopModelo),
        updated_at: new Date().toISOString()
      });
    }

    // 6. Actualizar calculator_totals con los nuevos cálculos
    if (recalculatedTotals.length > 0) {
      const { error: updateError } = await supabase
        .from('calculator_totals')
        .upsert(recalculatedTotals, { 
          onConflict: 'model_id,period_date' 
        });

      if (updateError) {
        console.error('❌ [RECALCULATE-TOTALS] Error al actualizar totales:', updateError);
        return NextResponse.json({ success: false, error: 'Error al actualizar totales' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Recalculados ' + recalculatedTotals.length + ' totales'
    });

  } catch (error: any) {
    console.error('❌ [RECALCULATE-TOTALS] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
