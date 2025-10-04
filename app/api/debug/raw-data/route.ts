import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, createPeriodIfNeeded } from '@/utils/calculator-dates';

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

// GET: Debug de datos brutos
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [RAW-DATA] Obteniendo datos brutos para modelId:', modelId, 'periodDate:', periodDate);
    
    // 0. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 1. Obtener configuración
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: 'Error obteniendo configuración' }, { status: 500 });
    }

    // 2. Obtener plataformas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config?.enabled_platforms || [])
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

    if (ratesError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo tasas' }, { status: 500 });
    }

    // 5. Procesar tasas
    const rates = {
      USD_COP: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      EUR_USD: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      GBP_USD: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    // 6. Análisis detallado
    const analysis = {
      config: config ? {
        model_id: config.model_id,
        enabled_platforms: config.enabled_platforms,
        percentage_override: config.percentage_override,
        group_percentage: config.group_percentage,
        min_quota_override: config.min_quota_override,
        group_min_quota: config.group_min_quota
      } : null,
      platforms: platforms?.map(p => ({
        id: p.id,
        name: p.name,
        currency: p.currency,
        token_rate: p.token_rate,
        discount_factor: p.discount_factor,
        tax_rate: p.tax_rate,
        active: p.active
      })) || [],
      values: values?.map(v => ({
        model_id: v.model_id,
        platform_id: v.platform_id,
        value: v.value,
        period_date: v.period_date,
        updated_at: v.updated_at
      })) || [],
      rates,
      summary: {
        configExists: !!config,
        platformsCount: platforms?.length || 0,
        valuesCount: values?.length || 0,
        valuesWithInput: values?.filter(v => Number(v.value) > 0).length || 0,
        enabledPlatforms: config?.enabled_platforms?.length || 0
      }
    };

    // 7. Análisis de valores con input
    const valuesWithInput = values?.filter(v => Number(v.value) > 0) || [];
    const valueAnalysis = valuesWithInput.map(v => {
      const platform = platforms?.find(p => p.id === v.platform_id);
      return {
        platform_id: v.platform_id,
        platform_name: platform?.name || 'Unknown',
        currency: platform?.currency || 'Unknown',
        value: Number(v.value),
        token_rate: platform?.token_rate,
        discount_factor: platform?.discount_factor,
        tax_rate: platform?.tax_rate
      };
    });

    return NextResponse.json({
      success: true,
      analysis,
      valueAnalysis,
      debug: {
        modelId,
        periodDate,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ [RAW-DATA] Error en debug de datos brutos:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor',
      stack: error.stack
    }, { status: 500 });
  }
}
