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

// GET: Replicar EXACTAMENTE los endpoints que usa Mi Calculadora
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [MI-CALCULADORA-EXACT] Replicando endpoints exactos de Mi Calculadora para modelId:', modelId, 'periodDate:', periodDate);
    
    // 0. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 1. Obtener tasas usando el MISMO endpoint que Mi Calculadora
    const ratesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app'}/api/rates-v2?activeOnly=true`);
    const ratesData = await ratesResponse.json();
    console.log('🔍 [MI-CALCULADORA-EXACT] Rates data:', ratesData);
    
    if (!ratesData.success || !ratesData.data) {
      throw new Error('Error al obtener tasas');
    }

    // Formatear tasas exactamente como Mi Calculadora
    const rates = {
      usd_cop: ratesData.data.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData.data.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData.data.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
    };

    // 2. Obtener configuración usando el MISMO endpoint que Mi Calculadora
    const configResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app'}/api/calculator/config-v2?modelId=${modelId}`);
    const configData = await configResponse.json();
    console.log('🔍 [MI-CALCULADORA-EXACT] Config data:', configData);
    
    if (!configData.success) {
      throw new Error(configData.error || 'Error al obtener configuración');
    }

    const platforms = configData.config?.platforms || [];
    const enabled = platforms.filter((p: any) => p.enabled);

    // 3. Obtener valores usando el MISMO endpoint que Mi Calculadora
    const valuesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app'}/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${periodDate}`);
    const valuesData = await valuesResponse.json();
    console.log('🔍 [MI-CALCULADORA-EXACT] Values data:', valuesData);
    
    if (!valuesData.success) {
      throw new Error(valuesData.error || 'Error al obtener valores');
    }

    const rows = valuesData.data || [];
    const idToValue: Record<string, number> = {};
    rows.forEach((r: any) => {
      idToValue[r.platform_id] = Number(r.value) || 0;
    });

    // 4. CALCULAR USANDO LA MISMA LÓGICA EXACTA DE MI CALCULADORA
    const totalUsdModelo = enabled.reduce((sum, p) => {
      const value = idToValue[p.id] || 0;
      if (value <= 0) return sum;

      // Calcular USD modelo usando fórmulas específicas + porcentaje (MISMA LÓGICA)
      let usdModelo = 0;
      
      if (p.currency === 'EUR') {
        if (p.id === 'big7') {
          usdModelo = (value * rates.eur_usd) * 0.84;
        } else if (p.id === 'mondo') {
          usdModelo = (value * rates.eur_usd) * 0.78;
        } else {
          usdModelo = value * rates.eur_usd;
        }
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') {
          usdModelo = (value * rates.gbp_usd) * 0.677;
        } else {
          usdModelo = value * rates.gbp_usd;
        }
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
          usdModelo = value * 0.75;
        } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
          usdModelo = value * 0.05;
        } else if (p.id === 'dxlive') {
          usdModelo = value * 0.60;
        } else if (p.id === 'secretfriends') {
          usdModelo = value * 0.5;
        } else if (p.id === 'superfoon') {
          usdModelo = value;
        } else {
          usdModelo = value;
        }
      }

      // Aplicar porcentaje de la modelo (MISMA LÓGICA)
      const percentage = p.percentage_override || p.group_percentage || 80;
      return sum + (usdModelo * percentage / 100);
    }, 0);

    // 5. CALCULAR COP MODELO (MISMA LÓGICA EXACTA)
    const copModelo = Math.round(totalUsdModelo * rates.usd_cop);

    // 6. CALCULAR 90% DE ANTICIPO (MISMA LÓGICA EXACTA)
    const anticipoDisponible = Math.round(copModelo * 0.9);

    // 7. Obtener anticipos ya pagados
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    let anticiposPagados = 0;
    if (!anticiposError && anticipos) {
      anticiposPagados = anticipos.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0);
    }

    console.log('✅ [MI-CALCULADORA-EXACT] Valores calculados con endpoints exactos de Mi Calculadora:', {
      totalUsdModelo: Math.round(totalUsdModelo * 100) / 100,
      copModelo: copModelo,
      anticipoDisponible: Math.max(0, anticipoDisponible - anticiposPagados),
      anticiposPagados: anticiposPagados,
      rates: rates,
      enabledCount: enabled.length,
      valuesCount: Object.keys(idToValue).length
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
    console.error('❌ [MI-CALCULADORA-EXACT] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
