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

// GET: Obtener valores usando la misma lógica que el dashboard
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [DASHBOARD-VALUES] Obteniendo valores usando lógica del dashboard para modelId:', modelId, 'periodDate:', periodDate);
    
    // 0. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 1. Obtener tasas activas (misma lógica que dashboard)
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true);

    if (ratesError) {
      console.error('❌ [DASHBOARD-VALUES] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas' }, { status: 500 });
    }

    const rates = {
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.2,
    };

    // 2. Obtener configuración de plataformas habilitadas (misma lógica que dashboard)
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [DASHBOARD-VALUES] Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    if (!config) {
      console.log('🔍 [DASHBOARD-VALUES] No se encontró configuración para modelId:', modelId);
      return NextResponse.json({
        success: true,
        data: {
          copModelo: 0,
          anticipoDisponible: 0,
          anticiposPagados: 0
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
      console.error('❌ [DASHBOARD-VALUES] Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    const enabled = platforms?.filter(p => config.enabled_platforms.includes(p.id)) || [];

    // 4. Obtener valores del día (misma lógica que dashboard)
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    if (valuesError) {
      console.error('❌ [DASHBOARD-VALUES] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    const idToValue: Record<string, number> = {};
    values?.forEach((r) => {
      idToValue[r.platform_id] = Number(r.value) || 0;
    });

    // 5. Cálculo por plataforma (MISMA LÓGICA QUE DASHBOARD)
    let usdBruto = 0;
    let usdModelo = 0;
    
    for (const p of enabled) {
      const value = idToValue[p.id] || 0;
      if (value <= 0) continue;

      let usdFromPlatform = 0;
      if (p.currency === 'USD') {
        if (p.direct_payout) {
          usdFromPlatform = value;
        } else if (p.discount_factor) {
          usdFromPlatform = value * p.discount_factor;
        } else {
          usdFromPlatform = value;
        }
      } else if (p.currency === 'EUR') {
        const eurToUsd = value * rates.eur_usd;
        if (p.tax_rate) {
          usdFromPlatform = eurToUsd * (1 - p.tax_rate);
        } else {
          usdFromPlatform = eurToUsd;
        }
      } else if (p.currency === 'GBP') {
        const gbpToUsd = value * rates.gbp_usd;
        if (p.discount_factor) {
          usdFromPlatform = gbpToUsd * p.discount_factor;
        } else {
          usdFromPlatform = gbpToUsd;
        }
      }

      usdBruto += usdFromPlatform;
    }

    // 6. Calcular USD Modelo y COP Modelo (misma lógica que dashboard)
    const percentage = config.percentage_override || config.group_percentage || 80;
    usdModelo = usdBruto * (percentage / 100);
    const copModelo = Math.round(usdModelo * rates.usd_cop);

    // 7. Calcular anticipo disponible (90% de COP Modelo)
    const anticipoDisponible = Math.round(copModelo * 0.9);

    // 8. Obtener anticipos ya pagados
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    let anticiposPagados = 0;
    if (!anticiposError && anticipos) {
      anticiposPagados = anticipos.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0);
    }

    console.log('✅ [DASHBOARD-VALUES] Valores calculados usando lógica del dashboard:', {
      usdBruto: Math.round(usdBruto * 100) / 100,
      usdModelo: Math.round(usdModelo * 100) / 100,
      copModelo: copModelo,
      anticipoDisponible: Math.max(0, anticipoDisponible - anticiposPagados),
      anticiposPagados: anticiposPagados
    });

    return NextResponse.json({
      success: true,
      data: {
        copModelo: copModelo,
        anticipoDisponible: Math.max(0, anticipoDisponible - anticiposPagados),
        anticiposPagados: anticiposPagados
      }
    });

  } catch (error: any) {
    console.error('❌ [DASHBOARD-VALUES] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
