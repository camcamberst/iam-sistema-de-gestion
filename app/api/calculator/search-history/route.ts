import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * GET: Búsqueda exhaustiva de valores del P1 de diciembre en calculator_history
 */
export async function GET(request: NextRequest) {
  try {
    const results: any = {};

    // 1. Buscar por period_date = 2025-12-01
    const { data: search1, error: e1 } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, value, period_date, period_type, archived_at', { count: 'exact' })
      .eq('period_date', '2025-12-01')
      .eq('period_type', '1-15');

    results.search_by_2025_12_01 = {
      count: search1?.length || 0,
      error: e1?.message,
      sample: search1?.slice(0, 5)
    };

    // 2. Buscar por period_date = 2025-12-15
    const { data: search2, error: e2 } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, value, period_date, period_type, archived_at', { count: 'exact' })
      .eq('period_date', '2025-12-15')
      .eq('period_type', '1-15');

    results.search_by_2025_12_15 = {
      count: search2?.length || 0,
      error: e2?.message,
      sample: search2?.slice(0, 5)
    };

    // 3. Buscar en rango 2025-12-01 a 2025-12-15
    const { data: search3, error: e3 } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, value, period_date, period_type, archived_at', { count: 'exact' })
      .gte('period_date', '2025-12-01')
      .lte('period_date', '2025-12-15')
      .eq('period_type', '1-15');

    results.search_by_range_01_to_15 = {
      count: search3?.length || 0,
      error: e3?.message,
      sample: search3?.slice(0, 10)
    };

    // 4. Buscar TODOS los registros de diciembre 2025
    const { data: search4, error: e4 } = await supabase
      .from('calculator_history')
      .select('period_date, period_type', { count: 'exact' })
      .gte('period_date', '2025-12-01')
      .lte('period_date', '2025-12-31');

    // Agrupar por fecha y tipo
    const grouped: Record<string, number> = {};
    search4?.forEach((r: any) => {
      const key = `${r.period_date} (${r.period_type})`;
      grouped[key] = (grouped[key] || 0) + 1;
    });

    results.all_december_2025 = {
      count: search4?.length || 0,
      error: e4?.message,
      distribution: grouped
    };

    // 5. Buscar por archived_at reciente (últimas 24 horas)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const { data: search5, error: e5 } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, value, period_date, period_type, archived_at', { count: 'exact' })
      .gte('archived_at', yesterday.toISOString());

    results.recent_24h = {
      count: search5?.length || 0,
      error: e5?.message,
      sample: search5?.slice(0, 10),
      date_range: {
        from: yesterday.toISOString(),
        to: new Date().toISOString()
      }
    };

    // 6. Buscar period_date = 2025-12-16 pero period_type = '1-15' (error de normalización)
    const { data: search6, error: e6 } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, value, period_date, period_type, archived_at', { count: 'exact' })
      .eq('period_date', '2025-12-16')
      .eq('period_type', '1-15');

    results.search_2025_12_16_with_type_1_15 = {
      count: search6?.length || 0,
      error: e6?.message,
      sample: search6?.slice(0, 10)
    };

    // 7. Obtener distribución completa de todos los períodos
    const { data: allHistory, error: e7 } = await supabase
      .from('calculator_history')
      .select('period_date, period_type, model_id')
      .order('period_date', { ascending: false })
      .limit(1000);

    const distribution: Record<string, { count: number; models: Set<string> }> = {};
    allHistory?.forEach((r: any) => {
      const key = `${r.period_date} (${r.period_type})`;
      if (!distribution[key]) {
        distribution[key] = { count: 0, models: new Set() };
      }
      distribution[key].count++;
      distribution[key].models.add(r.model_id);
    });

    const distributionFormatted: Record<string, { count: number; unique_models: number }> = {};
    Object.keys(distribution).forEach(key => {
      distributionFormatted[key] = {
        count: distribution[key].count,
        unique_models: distribution[key].models.size
      };
    });

    results.full_distribution = {
      total_records: allHistory?.length || 0,
      error: e7?.message,
      by_period: distributionFormatted
    };

    return NextResponse.json({
      success: true,
      search_results: results,
      summary: {
        found_in_2025_12_01: search1?.length || 0,
        found_in_2025_12_15: search2?.length || 0,
        found_in_range_01_15: search3?.length || 0,
        found_recent_24h: search5?.length || 0,
        found_2025_12_16_type_1_15: search6?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ [SEARCH-HISTORY] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, { status: 500 });
  }
}

