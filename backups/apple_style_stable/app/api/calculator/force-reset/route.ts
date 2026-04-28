import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BATCH_SIZE = 500;

/**
 * POST: Fuerza reset de TODAS las calculadoras del sistema
 * - Borra todos los valores en model_values (por lotes)
 * - Borra todos los totales en calculator_totals (por lotes)
 * - Descongela todas las calculadoras (calculator_frozen_platforms, calculator_period_closure_status)
 *
 * Autorización: super_admin (body.userId) O header x-cron-secret
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    console.log('🔥 [FORCE-RESET] Iniciando reset forzado de todas las calculadoras...');

    const cronSecret = request.headers.get('x-cron-secret');
    const expectedCronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
    const body = await request.json().catch(() => ({}));
    const userId = body.userId as string | undefined;

    let authorized = cronSecret === expectedCronSecret;
    if (!authorized && userId) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .single();
      if (!userError && user?.role === 'super_admin') authorized = true;
    }

    if (!authorized) {
      return NextResponse.json({ success: false, error: 'No autorizado. Solo super_admin o x-cron-secret.' }, { status: 401 });
    }

    let deletedModelValues = 0;
    let deletedCalculatorTotals = 0;

    // 1. Borrar model_values por lotes
    while (true) {
      const { data: rows, error: fetchError } = await supabase
        .from('model_values')
        .select('id')
        .range(0, BATCH_SIZE - 1);

      if (fetchError) {
        console.error('❌ [FORCE-RESET] Error leyendo model_values:', fetchError);
        throw fetchError;
      }
      if (!rows || rows.length === 0) break;

      const ids = rows.map((r: { id: string }) => r.id);
      const { error: deleteError } = await supabase
        .from('model_values')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('❌ [FORCE-RESET] Error borrando model_values:', deleteError);
        throw deleteError;
      }
      deletedModelValues += ids.length;
      if (rows.length < BATCH_SIZE) break;
    }

    // 2. Borrar calculator_totals por lotes
    while (true) {
      const { data: rows, error: fetchError } = await supabase
        .from('calculator_totals')
        .select('id')
        .range(0, BATCH_SIZE - 1);

      if (fetchError) {
        console.error('❌ [FORCE-RESET] Error leyendo calculator_totals:', fetchError);
        throw fetchError;
      }
      if (!rows || rows.length === 0) break;

      const ids = rows.map((r: { id: string }) => r.id);
      const { error: deleteError } = await supabase
        .from('calculator_totals')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('❌ [FORCE-RESET] Error borrando calculator_totals:', deleteError);
        throw deleteError;
      }
      deletedCalculatorTotals += ids.length;
      if (rows.length < BATCH_SIZE) break;
    }

    // 3. Descongelar calculadoras
    const { error: delFrozenError } = await supabase
      .from('calculator_frozen_platforms')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (delFrozenError) console.warn('⚠️ [FORCE-RESET] calculator_frozen_platforms:', delFrozenError.message);

    const { error: updateStatusError } = await supabase
      .from('calculator_period_closure_status')
      .update({ frozen: false })
      .eq('frozen', true);
    if (updateStatusError) console.warn('⚠️ [FORCE-RESET] calculator_period_closure_status:', updateStatusError.message);

    const executionTime = Date.now() - startTime;
    console.log(`✅ [FORCE-RESET] Completado en ${executionTime}ms: model_values=${deletedModelValues}, calculator_totals=${deletedCalculatorTotals}`);

    return NextResponse.json({
      success: true,
      message: 'Reset forzado de todas las calculadoras completado.',
      deleted_model_values: deletedModelValues,
      deleted_calculator_totals: deletedCalculatorTotals,
      calculators_unfrozen: true,
      execution_time_ms: executionTime
    });
  } catch (error) {
    console.error('❌ [FORCE-RESET] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, { status: 500 });
  }
}
