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

// GET: Solo reflejar los valores ya calculados por Mi Calculadora
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || getColombiaDate();

  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log('🔍 [REFLECT-VALUES] Reflejando valores ya calculados por Mi Calculadora para modelId:', modelId, 'periodDate:', periodDate);
    
    // 0. Crear período si no existe
    await createPeriodIfNeeded(periodDate);

    // 1. Obtener anticipos ya pagados
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('monto_solicitado, estado')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    let anticiposPagados = 0;
    if (!anticiposError && anticipos) {
      anticiposPagados = anticipos.reduce((sum, a) => sum + (a.monto_solicitado || 0), 0);
    }

    // 2. Obtener valores actuales de model_values (misma fuente que Mi Calculadora)
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('value')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);

    let copModelo = 0;
    let anticipoDisponible = 0;

    if (!valuesError && values && values.length > 0) {
      // Obtener el valor real de Mi Calculadora desde la base de datos
      // Buscar en calculator_history el valor más reciente
      const { data: historyData, error: historyError } = await supabase
        .from('calculator_history')
        .select('total_cop_modelo')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!historyError && historyData && historyData.length > 0) {
        // Usar el valor real de Mi Calculadora
        copModelo = historyData[0].total_cop_modelo || 0;
        anticipoDisponible = Math.max(0, Math.round(copModelo * 0.9) - anticiposPagados);
      } else {
        // Si no hay historial, usar conversión básica como fallback
        const totalValue = values.reduce((sum, v) => sum + (Number(v.value) || 0), 0);
        copModelo = Math.round(totalValue * 2500);
        anticipoDisponible = Math.max(0, Math.round(copModelo * 0.9) - anticiposPagados);
      }
    }

    console.log('✅ [REFLECT-VALUES] Valores reflejados:', {
      copModelo: copModelo,
      anticipoDisponible: anticipoDisponible,
      anticiposPagados: anticiposPagados,
      valuesCount: values?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: {
        copModelo: copModelo,
        anticipoDisponible: anticipoDisponible,
        anticiposPagados: anticiposPagados
      }
    });

  } catch (error: any) {
    console.error('❌ [REFLECT-VALUES] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
