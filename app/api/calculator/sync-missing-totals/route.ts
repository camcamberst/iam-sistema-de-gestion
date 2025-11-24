import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Sincronizar totales faltantes para modelos con valores pero sin totales
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, periodDate } = body;

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    const targetDate = periodDate || getColombiaDate();
    console.log('🔍 [SYNC-MISSING-TOTALS] Sincronizando totales para:', { modelId, targetDate });

    // 1. Obtener valores del modelo
    const { data: modelValues, error: valuesError } = await supabase
      .from('model_values')
      .select(`
        *,
        platforms!inner(id, name, currency, percentage)
      `)
      .eq('model_id', modelId)
      .gte('period_date', new Date(new Date(targetDate).setDate(new Date(targetDate).getDate() - 2)).toISOString().split('T')[0])
      .lte('period_date', new Date(new Date(targetDate).setDate(new Date(targetDate).getDate() + 2)).toISOString().split('T')[0])
      .order('updated_at', { ascending: false });

    if (valuesError) {
      console.error('❌ [SYNC-MISSING-TOTALS] Error obteniendo valores:', valuesError);
      return NextResponse.json({ 
        success: false, 
        error: `Error obteniendo valores: ${valuesError.message}` 
      }, { status: 500 });
    }

    if (!modelValues || modelValues.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No se encontraron valores para este modelo' 
      }, { status: 404 });
    }

    // 2. Obtener configuración del modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('percentage_override, group_percentage')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [SYNC-MISSING-TOTALS] Error obteniendo configuración:', configError);
    }

    // 3. Obtener tasas actuales
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    let rates = { usd_cop: 3900, eur_usd: 1.01, gbp_usd: 1.20 };
    if (!ratesError && ratesData) {
      ratesData.forEach(rate => {
        if (rate.kind === 'USD→COP') rates.usd_cop = rate.value;
        if (rate.kind === 'EUR→USD') rates.eur_usd = rate.value;
        if (rate.kind === 'GBP→USD') rates.gbp_usd = rate.value;
      });
    }

    // 4. Obtener plataformas con sus configuraciones
    const { data: platformsData, error: platformsError } = await supabase
      .from('platforms')
      .select('id, name, currency, percentage');

    if (platformsError) {
      console.error('❌ [SYNC-MISSING-TOTALS] Error obteniendo plataformas:', platformsError);
    }

    const platformMap = new Map();
    platformsData?.forEach(p => {
      platformMap.set(p.id, p);
    });

    // 5. Calcular totales usando la misma lógica que Mi Calculadora
    let totalUsdBruto = 0;
    let totalUsdModelo = 0;

    // Agrupar valores por plataforma (tomar el más reciente)
    const valuesByPlatform = new Map();
    modelValues.forEach(mv => {
      const platformId = mv.platform_id;
      if (!valuesByPlatform.has(platformId) || 
          new Date(mv.updated_at) > new Date(valuesByPlatform.get(platformId).updated_at)) {
        valuesByPlatform.set(platformId, mv);
      }
    });

    valuesByPlatform.forEach((mv, platformId) => {
      const platform = platformMap.get(platformId);
      if (!platform || !mv.value || mv.value <= 0) return;

      let usdBruto = 0;
      let usdModelo = 0;

      if (platform.currency === 'EUR') {
        if (platformId === 'big7') {
          usdBruto = (mv.value * rates.eur_usd) * 0.84;
        } else if (platformId === 'mondo') {
          usdBruto = (mv.value * rates.eur_usd) * 0.78;
        } else {
          usdBruto = mv.value * rates.eur_usd;
        }
      } else if (platform.currency === 'GBP') {
        if (platformId === 'aw') {
          usdBruto = (mv.value * rates.gbp_usd) * 0.677;
        } else {
          usdBruto = mv.value * rates.gbp_usd;
        }
      } else if (platform.currency === 'USD') {
        if (platformId === 'cmd' || platformId === 'camlust' || platformId === 'skypvt') {
          usdBruto = mv.value * 0.75;
        } else if (platformId === 'chaturbate' || platformId === 'myfreecams' || platformId === 'stripchat') {
          usdBruto = mv.value * 0.05;
        } else if (platformId === 'dxlive') {
          usdBruto = mv.value * 0.60;
        } else if (platformId === 'secretfriends') {
          usdBruto = mv.value * 0.5;
        } else {
          usdBruto = mv.value;
        }
      }

      totalUsdBruto += usdBruto;
      usdModelo = usdBruto * (platform.percentage / 100);
      totalUsdModelo += usdModelo;
    });

    // Aplicar porcentaje de configuración si existe
    const modelPercentage = config?.percentage_override || config?.group_percentage || 70;
    totalUsdModelo = totalUsdBruto * (modelPercentage / 100);

    const totalCopModelo = totalUsdModelo * rates.usd_cop;

    // 6. Guardar totales en calculator_totals
    const { data: savedTotal, error: saveError } = await supabase
      .from('calculator_totals')
      .upsert({
        model_id: modelId,
        period_date: targetDate,
        total_usd_bruto: Math.round(totalUsdBruto * 100) / 100,
        total_usd_modelo: Math.round(totalUsdModelo * 100) / 100,
        total_cop_modelo: Math.round(totalCopModelo),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'model_id,period_date' 
      })
      .select()
      .single();

    if (saveError) {
      console.error('❌ [SYNC-MISSING-TOTALS] Error guardando totales:', saveError);
      return NextResponse.json({ 
        success: false, 
        error: `Error guardando totales: ${saveError.message}` 
      }, { status: 500 });
    }

    console.log('✅ [SYNC-MISSING-TOTALS] Totales sincronizados:', {
      modelId,
      targetDate,
      totalUsdBruto,
      totalUsdModelo,
      totalCopModelo
    });

    return NextResponse.json({
      success: true,
      message: 'Totales sincronizados correctamente',
      data: savedTotal,
      calculated: {
        totalUsdBruto,
        totalUsdModelo,
        totalCopModelo,
        modelPercentage
      }
    });

  } catch (error: any) {
    console.error('❌ [SYNC-MISSING-TOTALS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}







