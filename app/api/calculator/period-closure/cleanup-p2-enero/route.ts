/**
 * 🧹 P2 ENERO 2026: Limpieza extraordinaria (cierre atípico)
 *
 * - GET: Estado actual (model_values, calculator_history, safe_to_cleanup)
 * - POST: Limpiar valores de P2 enero en Mi Calculadora sin depender del día ni del Paso 1 estándar
 *
 * No toca calculator_history (los históricos se conservan). Solo:
 * 1. Mueve model_values (rango 16-31 enero) a archived_model_values
 * 2. Borra de model_values ese rango
 * 3. Borra calculator_totals con period_date 2026-01-16
 * 4. Descongela calculadoras
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PERIOD_DATE_P2_ENERO = '2026-01-16';
const PERIOD_TYPE_P2_ENERO = '16-31';
const PERIOD_DATE_END = '2026-01-31';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * GET: Estado de P2 enero (mismo formato que archive-p2-enero para compatibilidad con la UI)
 */
export async function GET() {
  try {
    const [mvRes, ctRes, chRes] = await Promise.all([
      supabase.from('model_values').select('model_id').gte('period_date', PERIOD_DATE_P2_ENERO).lte('period_date', PERIOD_DATE_END),
      supabase.from('calculator_totals').select('model_id').eq('period_date', PERIOD_DATE_P2_ENERO),
      supabase.from('calculator_history').select('model_id, platform_id').eq('period_date', PERIOD_DATE_P2_ENERO).eq('period_type', PERIOD_TYPE_P2_ENERO)
    ]);

    const mvList = (mvRes.data || []) as { model_id: string }[];
    const chList = (chRes.data || []) as { model_id: string; platform_id: string }[];

    const model_values_count = mvList.length;
    const calculator_totals_count = (ctRes.data || []).length;
    const calculator_history_count = chList.length;
    const modelsWithValues = Array.from(new Set(mvList.map((r) => r.model_id))).length;
    const modelsInHistory = Array.from(new Set(chList.filter((r) => r.platform_id !== '__CONSOLIDATED_TOTAL__').map((r) => r.model_id))).length;

    return NextResponse.json({
      success: true,
      period_date: PERIOD_DATE_P2_ENERO,
      period_type: PERIOD_TYPE_P2_ENERO,
      model_values: { count: model_values_count, models_with_data: modelsWithValues },
      calculator_totals: { count: calculator_totals_count },
      calculator_history: { count: calculator_history_count, models_archived: modelsInHistory },
      safe_to_cleanup: calculator_history_count > 0,
      message: calculator_history_count === 0
        ? 'P2 enero no está en calculator_history. Archiva primero antes de limpiar.'
        : model_values_count === 0
          ? 'P2 enero ya está limpiado en Mi Calculadora.'
          : `P2 enero: ${model_values_count} registros en model_values listos para limpiar (historial conservado).`
    });
  } catch (error: any) {
    console.error('❌ [CLEANUP-P2-ENERO] GET Error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? String(error) }, { status: 500 });
  }
}

/**
 * POST: Ejecutar limpieza extraordinaria de P2 enero
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Solo el super admin puede ejecutar la limpieza extraordinaria' }, { status: 403 });
    }

    // Verificar que el historial existe (no limpiar si no está archivado)
    const { data: chList } = await supabase
      .from('calculator_history')
      .select('id')
      .eq('period_date', PERIOD_DATE_P2_ENERO)
      .eq('period_type', PERIOD_TYPE_P2_ENERO);

    if (!chList || chList.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'P2 enero no está en calculator_history. Ejecuta primero "Archivar P2 enero a historial" antes de limpiar.'
      }, { status: 400 });
    }

    const batchId = crypto.randomUUID();

    // 1. Obtener model_values en el rango 16-31 enero
    const { data: values, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', PERIOD_DATE_P2_ENERO)
      .lte('period_date', PERIOD_DATE_END);

    if (valuesError) {
      return NextResponse.json({ success: false, error: `model_values: ${valuesError.message}` }, { status: 500 });
    }

    let recordsArchived = 0;
    if (values && values.length > 0) {
      const [year, month] = PERIOD_DATE_P2_ENERO.split('-').map(Number);
      const archivedRecords = values.map((v: any) => ({
        id: v.id,
        model_id: v.model_id,
        platform_id: v.platform_id,
        value: v.value,
        period_date: v.period_date,
        created_at: v.created_at,
        updated_at: v.updated_at,
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_batch_id: batchId,
        period_type: PERIOD_TYPE_P2_ENERO,
        period_year: year,
        period_month: month,
        original_table: 'model_values',
        archive_reason: 'cleanup_p2_enero_extraordinary',
        can_restore: true
      }));

      const { error: archiveError } = await supabase.from('archived_model_values').insert(archivedRecords);
      if (archiveError) {
        return NextResponse.json({ success: false, error: `archived_model_values: ${archiveError.message}` }, { status: 500 });
      }

      const { error: deleteError } = await supabase
        .from('model_values')
        .delete()
        .gte('period_date', PERIOD_DATE_P2_ENERO)
        .lte('period_date', PERIOD_DATE_END);

      if (deleteError) {
        return NextResponse.json({ success: false, error: `model_values delete: ${deleteError.message}` }, { status: 500 });
      }
      recordsArchived = values.length;
    }

    // 2. Borrar calculator_totals del período (period_date 2026-01-16)
    const { data: totalsToDelete } = await supabase
      .from('calculator_totals')
      .select('id')
      .eq('period_date', PERIOD_DATE_P2_ENERO);

    let totalsReset = 0;
    if (totalsToDelete && totalsToDelete.length > 0) {
      const { error: totalsError } = await supabase
        .from('calculator_totals')
        .delete()
        .eq('period_date', PERIOD_DATE_P2_ENERO);
      if (totalsError) {
        console.warn('⚠️ [CLEANUP-P2-ENERO] Error borrando calculator_totals:', totalsError.message);
      } else {
        totalsReset = totalsToDelete.length;
      }
    }

    // 3. Descongelar calculadoras
    await supabase
      .from('calculator_frozen_platforms')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase
      .from('calculator_period_closure_status')
      .update({ frozen: false })
      .eq('frozen', true);

    const executionTime = Date.now() - startTime;
    console.log(`✅ [CLEANUP-P2-ENERO] Limpieza completada: ${recordsArchived} registros archivados, ${totalsReset} totales reseteados en ${executionTime}ms`);

    return NextResponse.json({
      success: true,
      period_date: PERIOD_DATE_P2_ENERO,
      period_type: PERIOD_TYPE_P2_ENERO,
      records_archived: recordsArchived,
      totals_reset: totalsReset,
      calculators_unfrozen: true,
      execution_time_ms: executionTime,
      message: `Limpieza P2 enero completada. Mi Calculadora quedó lista para el nuevo período. Historial conservado.`
    });
  } catch (error: any) {
    console.error('❌ [CLEANUP-P2-ENERO] POST Error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? String(error) }, { status: 500 });
  }
}
