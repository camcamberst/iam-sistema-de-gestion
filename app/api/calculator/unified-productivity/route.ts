import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: API unificada para obtener datos de productividad con cálculos consistentes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [UNIFIED-PRODUCTIVITY] Loading data for:', { modelId, periodDate });

    // 1. Obtener tasas activas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error('❌ [UNIFIED-PRODUCTIVITY] Error loading rates:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al cargar tasas' }, { status: 500 });
    }

    const rates = {
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    // 2. Obtener configuración de plataformas habilitadas
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [UNIFIED-PRODUCTIVITY] Error loading config:', configError);
      return NextResponse.json({ success: false, error: 'Error al cargar configuración' }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json({
        success: true,
        data: {
          usdBruto: 0,
          usdModelo: 0,
          copModelo: 0,
          rates,
          isConfigured: false
        }
      });
    }

    // 3. Obtener plataformas habilitadas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true);

    if (platformsError) {
      console.error('❌ [UNIFIED-PRODUCTIVITY] Error loading platforms:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al cargar plataformas' }, { status: 500 });
    }

    // 4. Obtener valores del modelo usando la API inteligente
    const getCurrentPeriodDates = () => {
      const now = new Date();
      return {
        colombia: now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      };
    };

    const dates = getCurrentPeriodDates();
    const { data: modelValues, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value')
      .eq('model_id', modelId)
      .eq('period_date', dates.colombia)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (valuesError) {
      console.error('❌ [UNIFIED-PRODUCTIVITY] Error loading values:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al cargar valores' }, { status: 500 });
    }

    // 5. Crear mapa de valores por plataforma
    const platformValues: Record<string, number> = {};
    modelValues?.forEach((value: any) => {
      if (!platformValues[value.platform_id]) {
        platformValues[value.platform_id] = Number(value.value) || 0;
      }
    });

    // 6. Calcular totales usando fórmulas específicas unificadas
    let usdBruto = 0;
    let usdModelo = 0;
    const percentage = config.percentage_override || config.group_percentage || 80;

    platforms?.forEach((platform: any) => {
      const value = platformValues[platform.id] || 0;
      if (value <= 0) return;

      // Aplicar fórmulas específicas por plataforma (UNIFICADAS)
      let usdFromPlatform = 0;
      if (platform.currency === 'EUR') {
        if (platform.id === 'big7') {
          usdFromPlatform = (value * rates.eur_usd) * 0.84; // 16% impuesto
        } else if (platform.id === 'mondo') {
          usdFromPlatform = (value * rates.eur_usd) * 0.78; // 22% descuento
        } else {
          usdFromPlatform = value * rates.eur_usd; // EUR directo
        }
      } else if (platform.currency === 'GBP') {
        if (platform.id === 'aw') {
          usdFromPlatform = (value * rates.gbp_usd) * 0.677; // 32.3% descuento
        } else {
          usdFromPlatform = value * rates.gbp_usd; // GBP directo
        }
      } else if (platform.currency === 'USD') {
        if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
          usdFromPlatform = value * 0.75; // 25% descuento
        } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
          usdFromPlatform = value * 0.05; // 100 tokens = 5 USD
        } else if (platform.id === 'dxlive') {
          usdFromPlatform = value * 0.60; // 100 pts = 60 USD
        } else if (platform.id === 'secretfriends') {
          usdFromPlatform = value * 0.5; // 50% descuento
        } else if (platform.id === 'superfoon') {
          usdFromPlatform = value; // 100% directo
        } else {
          usdFromPlatform = value; // USD directo por defecto
        }
      }

      usdBruto += usdFromPlatform;
      usdModelo += (usdFromPlatform * percentage) / 100;
    });

    const copModelo = usdModelo * rates.usd_cop;

    console.log('✅ [UNIFIED-PRODUCTIVITY] Calculated:', {
      usdBruto: usdBruto.toFixed(2),
      usdModelo: usdModelo.toFixed(2),
      copModelo: copModelo.toFixed(0),
      percentage
    });

    return NextResponse.json({
      success: true,
      data: {
        usdBruto,
        usdModelo,
        copModelo,
        rates,
        percentage,
        isConfigured: true,
        platformsCount: platforms?.length || 0,
        valuesCount: Object.keys(platformValues).length
      }
    });

  } catch (error: any) {
    console.error('❌ [UNIFIED-PRODUCTIVITY] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
