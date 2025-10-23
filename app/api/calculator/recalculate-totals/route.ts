import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Recalcular todos los totales usando la nueva lógica simple
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

    console.log(`🔍 [RECALCULATE-TOTALS] Encontradas ${configs.length} configuraciones`);

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

    console.log('🔍 [RECALCULATE-TOTALS] Tasas:', rates);

    // 3. Obtener todas las plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [RECALCULATE-TOTALS] Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    const platformMap = new Map(platforms?.map(p => [p.id, p]) || []);

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

      console.log(`🔍 [RECALCULATE-TOTALS] Procesando modelo ${modelId} con porcentaje ${modelPercentage}%`);

      // Obtener valores de este modelo
      const modelValues = allValues?.filter(v => v.model_id === modelId) || [];
      
      // Obtener solo el valor más reciente por plataforma
      const platformMap = new Map<string, any>();
      modelValues.forEach((value: any) => {
        if (!platformMap.has(value.platform_id)) {
          platformMap.set(value.platform_id, value);
        }
      });

      // Calcular USD Bruto usando la nueva lógica simple
      let totalUsdBruto = 0;
      
      for (const [platformId, value] of platformMap) {
        const platform = platforms?.find(p => p.id === platformId);
        if (!platform || !value.value) continue;

        let usdBruto = 0;
        if (platform.currency === 'EUR') {
          if (platform.id === 'big7') {
            usdBruto = (Number(value.value) * rates.eur_usd) * 0.84;
          } else if (platform.id === 'mondo') {
            usdBruto = (Number(value.value) * rates.eur_usd) * 0.78;
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
          } else if (platform.id === 'mdh' || platform.id === 'livejasmin' || platform.id === 'imlive' || platform.id === 'hegre' || platform.id === 'dirtyfans' || platform.id === 'camcontacts') {
            usdBruto = Number(value.value);
          } else {
            usdBruto = Number(value.value);
          }
        }

        totalUsdBruto += usdBruto;
      }

      // 🔧 NUEVA LÓGICA SIMPLE: USD Modelo = USD Bruto × Porcentaje de Reparto
      const totalUsdModelo = totalUsdBruto * (modelPercentage / 100);
      const totalCopModelo = totalUsdModelo * rates.usd_cop;

      recalculatedTotals.push({
        model_id: modelId,
        period_date: today,
        total_usd_bruto: Math.round(totalUsdBruto * 100) / 100,
        total_usd_modelo: Math.round(totalUsdModelo * 100) / 100,
        total_cop_modelo: Math.round(totalCopModelo),
        updated_at: new Date().toISOString()
      });

      console.log(`✅ [RECALCULATE-TOTALS] Modelo ${modelId}: USD Bruto=${totalUsdBruto.toFixed(2)}, USD Modelo=${totalUsdModelo.toFixed(2)}, Porcentaje=${modelPercentage}%`);
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

      console.log(`✅ [RECALCULATE-TOTALS] Actualizados ${recalculatedTotals.length} totales`);
    }

    return NextResponse.json({
      success: true,
      message: `Recalculados ${recalculatedTotals.length} totales con la nueva lógica simple`,
      recalculated: recalculatedTotals.length,
      rates
    });

  } catch (error: any) {
    console.error('❌ [RECALCULATE-TOTALS] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
