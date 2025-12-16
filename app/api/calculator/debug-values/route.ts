import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * GET: Debug - muestra todos los valores actuales en model_values
 */
export async function GET(request: NextRequest) {
  try {
    const todayDate = getColombiaDate();
    const periodStart = getColombiaPeriodStartDate();
    const [year, month, day] = todayDate.split('-').map(Number);
    
    // Calcular rango del período actual
    const isP2 = day >= 16;
    let startDate: string;
    let endDate: string;
    
    if (isP2) {
      startDate = `${year}-${String(month).padStart(2, '0')}-16`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    } else {
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
    }

    // Obtener TODOS los valores en model_values
    const { data: allValues, error } = await supabase
      .from('model_values')
      .select('id, model_id, platform_id, value, period_date, updated_at')
      .order('period_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Agrupar por period_date para ver la distribución
    const byDate: Record<string, number> = {};
    allValues?.forEach((v: any) => {
      byDate[v.period_date] = (byDate[v.period_date] || 0) + 1;
    });

    // Valores en el período actual
    const currentPeriodValues = allValues?.filter((v: any) => 
      v.period_date >= startDate && v.period_date <= endDate
    );

    return NextResponse.json({
      success: true,
      current_date: todayDate,
      period_start_calculated: periodStart,
      current_period: { startDate, endDate, isP2 },
      total_values_in_db: allValues?.length || 0,
      values_in_current_period: currentPeriodValues?.length || 0,
      distribution_by_date: byDate,
      sample_values: allValues?.slice(0, 20)
    });

  } catch (error) {
    console.error('❌ [DEBUG-VALUES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 });
  }
}

