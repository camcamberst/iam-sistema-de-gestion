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

// GET: Replicar EXACTAMENTE la lógica de "Mi Calculadora"
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [EXACT-CALCULATOR] Replicando lógica exacta de Mi Calculadora para modelId:', modelId, 'periodDate:', periodDate);
    
    // 0. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 1. Obtener configuración de la modelo
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('❌ [EXACT-CALCULATOR] Error al obtener configuración:', configError);
      return NextResponse.json({ success: false, error: 'Error al obtener configuración' }, { status: 500 });
    }

    if (!config) {
      console.log('🔍 [EXACT-CALCULATOR] No se encontró configuración para modelId:', modelId);
      return NextResponse.json({
        success: true,
        data: {
          copModelo: 0,
          anticipoDisponible: 0,
          anticiposPagados: 0
        }
      });
    }

    // 2. Obtener plataformas habilitadas
    const { data: platforms, error: platformsError } = await supabase
      .from('calculator_platforms')
      .select('*')
      .in('id', config.enabled_platforms)
      .eq('active', true)
      .order('name');

    if (platformsError) {
      console.error('❌ [EXACT-CALCULATOR] Error al obtener plataformas:', platformsError);
      return NextResponse.json({ success: false, error: 'Error al obtener plataformas' }, { status: 500 });
    }

    // 3. Obtener valores del modelo
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    if (valuesError) {
      console.error('❌ [EXACT-CALCULATOR] Error al obtener valores:', valuesError);
      return NextResponse.json({ success: false, error: 'Error al obtener valores' }, { status: 500 });
    }

    // 4. Obtener tasas
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true);

    if (ratesError) {
      console.error('❌ [EXACT-CALCULATOR] Error al obtener tasas:', ratesError);
      return NextResponse.json({ success: false, error: 'Error al obtener tasas' }, { status: 500 });
    }

    // 5. Procesar tasas (misma lógica que Mi Calculadora)
    const rates = {
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    // 6. MAPEAR VALORES A PLATAFORMAS (misma lógica que Mi Calculadora)
    const platformsWithValues = platforms?.map(platform => {
      const value = values?.find(v => v.platform_id === platform.id);
      return {
        ...platform,
        value: value ? Number(value.value) || 0 : 0,
        enabled: config.enabled_platforms.includes(platform.id),
        percentage: config.percentage_override || config.group_percentage || 80
      };
    }) || [];

    // 7. CALCULAR USANDO LA MISMA LÓGICA EXACTA DE MI CALCULADORA
    const totalUsdModelo = platformsWithValues.reduce((sum, p) => {
      if (!p.enabled || p.value === 0) return sum;

      // Calcular USD modelo usando fórmulas específicas + porcentaje (MISMA LÓGICA)
      let usdModelo = 0;
      
      if (p.currency === 'EUR') {
        if (p.id === 'big7') {
          usdModelo = (p.value * rates.eur_usd) * 0.84;
        } else if (p.id === 'mondo') {
          usdModelo = (p.value * rates.eur_usd) * 0.78;
        } else {
          usdModelo = p.value * rates.eur_usd;
        }
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') {
          usdModelo = (p.value * rates.gbp_usd) * 0.677;
        } else {
          usdModelo = p.value * rates.gbp_usd;
        }
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
          usdModelo = p.value * 0.75;
        } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
          usdModelo = p.value * 0.05;
        } else if (p.id === 'dxlive') {
          usdModelo = p.value * 0.60;
        } else if (p.id === 'secretfriends') {
          usdModelo = p.value * 0.5;
        } else if (p.id === 'superfoon') {
          usdModelo = p.value;
        } else {
          usdModelo = p.value;
        }
      }

      // Aplicar porcentaje de la modelo (MISMA LÓGICA)
      return sum + (usdModelo * p.percentage / 100);
    }, 0);

    // 8. CALCULAR COP MODELO (MISMA LÓGICA EXACTA)
    const copModelo = Math.round(totalUsdModelo * rates.usd_cop);

    // 9. CALCULAR 90% DE ANTICIPO (MISMA LÓGICA EXACTA)
    const anticipoDisponible = Math.round(copModelo * 0.9);

    // 10. Obtener anticipos ya pagados
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    let anticiposPagados = 0;
    if (!anticiposError && anticipos) {
      anticiposPagados = anticipos.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0);
    }

    console.log('✅ [EXACT-CALCULATOR] Valores calculados con lógica exacta de Mi Calculadora:', {
      totalUsdModelo: Math.round(totalUsdModelo * 100) / 100,
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
    console.error('❌ [EXACT-CALCULATOR] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
