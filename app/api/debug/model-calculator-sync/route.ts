import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Diagnosticar sincronización de calculadora
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');

  if (!modelId) {
    return NextResponse.json({ 
      success: false, 
      error: 'modelId es requerido' 
    }, { status: 400 });
  }

  try {
    const periodDate = getColombiaDate();
    
    // 1. Verificar valores en model_values
    const { data: modelValues, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0])
      .order('updated_at', { ascending: false });

    // 2. Verificar totales en calculator_totals
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0])
      .order('updated_at', { ascending: false });

    // 3. Obtener información del modelo
    const { data: model, error: modelError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', modelId)
      .single();

    // 4. Calcular rango de quincena actual
    const today = new Date(periodDate);
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    const quinStartStr = day <= 15
      ? `${year}-${String(month + 1).padStart(2, '0')}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-16`;
    const quinEndStr = day <= 15
      ? `${year}-${String(month + 1).padStart(2, '0')}-15`
      : `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // 5. Verificar totales en el rango de quincena
    const { data: totalsInRange, error: totalsRangeError } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', quinStartStr)
      .lte('period_date', quinEndStr)
      .order('updated_at', { ascending: false });

    return NextResponse.json({
      success: true,
      model: model || null,
      periodDate,
      quincenaRange: {
        start: quinStartStr,
        end: quinEndStr
      },
      modelValues: {
        count: modelValues?.length || 0,
        data: modelValues || [],
        error: valuesError?.message || null
      },
      calculatorTotals: {
        count: totals?.length || 0,
        data: totals || [],
        error: totalsError?.message || null
      },
      totalsInQuincenaRange: {
        count: totalsInRange?.length || 0,
        data: totalsInRange || [],
        error: totalsRangeError?.message || null
      },
      diagnosis: {
        hasModelValues: (modelValues?.length || 0) > 0,
        hasTotals: (totals?.length || 0) > 0,
        hasTotalsInRange: (totalsInRange?.length || 0) > 0,
        needsSync: (modelValues?.length || 0) > 0 && (totalsInRange?.length || 0) === 0,
        latestModelValueDate: modelValues?.[0]?.period_date || null,
        latestTotalDate: totals?.[0]?.period_date || null,
        latestTotalInRangeDate: totalsInRange?.[0]?.period_date || null
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-SYNC] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}







