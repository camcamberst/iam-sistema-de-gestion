import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * GET: Debug - muestra contenido de calculator_history Y calculator_totals
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener todos los registros de calculator_history
    const { data: history, error } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, value, period_date, period_type, archived_at')
      .order('archived_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Agrupar por period_date y period_type
    const byPeriod: Record<string, number> = {};
    history?.forEach((h: any) => {
      const key = `${h.period_date} (${h.period_type})`;
      byPeriod[key] = (byPeriod[key] || 0) + 1;
    });

    // Agrupar por model_id
    const byModel: Record<string, number> = {};
    history?.forEach((h: any) => {
      byModel[h.model_id] = (byModel[h.model_id] || 0) + 1;
    });

    // También verificar calculator_totals
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('id, model_id, period_date, total_usd_bruto, total_usd_modelo, total_cop_modelo, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);

    const totalsByPeriod: Record<string, number> = {};
    totals?.forEach((t: any) => {
      totalsByPeriod[t.period_date] = (totalsByPeriod[t.period_date] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      calculator_history: {
        total_records: history?.length || 0,
        distribution_by_period: byPeriod,
        distribution_by_model: byModel,
        sample_records: history?.slice(0, 10)
      },
      calculator_totals: {
        total_records: totals?.length || 0,
        distribution_by_period: totalsByPeriod,
        sample_records: totals?.slice(0, 10),
        error: totalsError?.message
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG-HISTORY] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 });
  }
}

