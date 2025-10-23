import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Debug valores de hollyrogers
export async function GET(request: NextRequest) {
  try {
    const modelId = '0976437e-15e6-424d-8122-afb65580239a'; // ID de hollyrogers
    
    console.log('🔍 [DEBUG-HOLLYROGERS] Starting debug for model:', modelId);

    // 1. Obtener configuración
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    console.log('🔍 [DEBUG-HOLLYROGERS] Config:', config);

    // 2. Obtener plataformas
    const { data: platformData, error: platformError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config?.enabled_platforms || [])
      .eq('active', true)
      .order('name');

    console.log('🔍 [DEBUG-HOLLYROGERS] Platforms:', platformData);

    // 3. Obtener valores - MISMA LÓGICA QUE ADMIN-VIEW
    const today = getColombiaDate();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    console.log('🔍 [DEBUG-HOLLYROGERS] Date range:', { today, sevenDaysAgoStr });

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
      .gte('period_date', sevenDaysAgoStr)
      .order('updated_at', { ascending: false });

    console.log('🔍 [DEBUG-HOLLYROGERS] All recent values:', allRecentValues);

    // Obtener valores únicos por plataforma
    const platformMap = new Map<string, any>();
    allRecentValues?.forEach((value: any) => {
      if (!platformMap.has(value.platform_id)) {
        platformMap.set(value.platform_id, value);
      }
    });

    const modelValues = Array.from(platformMap.values());
    console.log('🔍 [DEBUG-HOLLYROGERS] Unique values:', modelValues);

    // 4. Mapear plataformas con valores
    const platformsWithValues = platformData?.map(platform => {
      const value = modelValues?.find(v => v.platform_id === platform.id);
      const platformPercentage = config?.percentage_override || config?.group_percentage || 80;

      console.log(`🔍 [DEBUG-HOLLYROGERS] Platform ${platform.name} (${platform.id}):`, {
        foundValue: !!value,
        value: value ? value.value : 0,
        percentage: platformPercentage,
        currency: platform.currency
      });

      return {
        ...platform,
        value: value ? Number(value.value) || 0 : 0,
        percentage: platformPercentage
      };
    }) || [];

    console.log('🔍 [DEBUG-HOLLYROGERS] Final platforms with values:', platformsWithValues);

    // 5. Calcular totales
    const totals = platformsWithValues.reduce((acc, platform) => {
      if (platform.value === 0) return acc;

      console.log(`🔍 [DEBUG-HOLLYROGERS] Calculating for ${platform.name}:`, {
        value: platform.value,
        currency: platform.currency,
        id: platform.id
      });

      // Calcular USD Bruto
      let usdBruto = 0;
      if (platform.currency === 'EUR') {
        if (platform.id === 'big7') {
          usdBruto = (platform.value * 1.01) * 0.84;
        } else if (platform.id === 'mondo') {
          usdBruto = (platform.value * 1.01) * 0.78;
        } else {
          usdBruto = platform.value * 1.01;
        }
      } else if (platform.currency === 'GBP') {
        if (platform.id === 'aw') {
          usdBruto = (platform.value * 1.20) * 0.677;
        } else {
          usdBruto = platform.value * 1.20;
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
        } else {
          usdBruto = platform.value;
        }
      }

      console.log(`🔍 [DEBUG-HOLLYROGERS] ${platform.name} USD Bruto:`, usdBruto);

      return {
        usdBruto: acc.usdBruto + usdBruto,
        usdModelo: acc.usdModelo + (usdBruto * platform.percentage / 100),
        copModelo: acc.copModelo + (usdBruto * platform.percentage / 100 * 3900)
      };
    }, { usdBruto: 0, usdModelo: 0, copModelo: 0 });

    console.log('🔍 [DEBUG-HOLLYROGERS] Final totals:', totals);

    return NextResponse.json({
      success: true,
      debug: {
        modelId,
        config,
        platforms: platformData,
        allRecentValues,
        modelValues,
        platformsWithValues,
        totals
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-HOLLYROGERS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
