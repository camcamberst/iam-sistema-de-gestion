import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/**
 * GET: Buscar en calc_snapshots y otras tablas de backup
 */
export async function GET(request: NextRequest) {
  try {
    const results: any = {};

    // 1. Buscar en calc_snapshots
    try {
      const { data: snapshots, error: e1 } = await supabase
        .from('calc_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      results.calc_snapshots = {
        count: snapshots?.length || 0,
        error: e1?.message,
        sample: snapshots?.slice(0, 5)
      };
    } catch (e: any) {
      results.calc_snapshots = {
        count: 0,
        error: `Tabla no existe o error: ${e.message}`
      };
    }

    // 2. Buscar en audit_logs (si existe)
    try {
      const { data: auditLogs, error: e2 } = await supabase
        .from('audit_logs')
        .select('*')
        .gte('created_at', '2025-12-01')
        .lte('created_at', '2025-12-16')
        .order('created_at', { ascending: false })
        .limit(50);

      results.audit_logs = {
        count: auditLogs?.length || 0,
        error: e2?.message,
        sample: auditLogs?.slice(0, 5)
      };
    } catch (e: any) {
      results.audit_logs = {
        count: 0,
        error: `Tabla no existe o error: ${e.message}`
      };
    }

    // 3. Verificar si hay registros en calculator_totals con period_date del 1-15 de diciembre
    const { data: totalsDec, error: e3 } = await supabase
      .from('calculator_totals')
      .select('*')
      .gte('period_date', '2025-12-01')
      .lte('period_date', '2025-12-15')
      .order('updated_at', { ascending: false });

    results.calculator_totals_dec_1_15 = {
      count: totalsDec?.length || 0,
      error: e3?.message,
      sample: totalsDec?.slice(0, 10)
    };

    // 4. Verificar si hay registros en calculator_totals con period_date = 2025-12-16 (normalizado)
    const { data: totalsDec16, error: e4 } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('period_date', '2025-12-16')
      .order('updated_at', { ascending: false });

    results.calculator_totals_dec_16 = {
      count: totalsDec16?.length || 0,
      error: e4?.message,
      sample: totalsDec16?.slice(0, 10)
    };

    return NextResponse.json({
      success: true,
      search_results: results,
      summary: {
        snapshots_found: results.calc_snapshots?.count || 0,
        audit_logs_found: results.audit_logs?.count || 0,
        totals_dec_1_15: results.calculator_totals_dec_1_15?.count || 0,
        totals_dec_16: results.calculator_totals_dec_16?.count || 0
      }
    });

  } catch (error) {
    console.error('❌ [SEARCH-SNAPSHOTS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, { status: 500 });
  }
}

