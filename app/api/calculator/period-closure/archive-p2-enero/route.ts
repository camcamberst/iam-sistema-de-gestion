/**
 * 🛡️ P2 ENERO 2026: Verificar y archivar explícitamente
 *
 * - GET: Estado actual (model_values, calculator_totals, calculator_history)
 * - POST: Archivar P2 enero a calculator_history sin depender del día ni de getPeriodToClose()
 *
 * Los datos de P2 enero NO se pierden: este endpoint solo COPIA de model_values → calculator_history.
 * La limpieza (Paso 2) está protegida para no borrar P2 enero hasta que el admin confirme.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PERIOD_DATE_P2_ENERO = '2026-01-16';
const PERIOD_TYPE_P2_ENERO = '16-31';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PERIOD_DATE_END = '2026-01-31'; // Rango P2 enero: 16-31

/**
 * GET: Verificar estado de P2 enero en las tres tablas
 * Cuenta model_values en el rango 16-31 (no solo día 16) para reflejar datos reales.
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
        ? 'P2 enero aún no está en calculator_history. Usa POST para archivar desde model_values (rango 16-31).'
        : `P2 enero tiene ${calculator_history_count} registros en historial (${modelsInHistory} modelos).`
    });
  } catch (error: any) {
    console.error('❌ [ARCHIVE-P2-ENERO] GET Error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? String(error) }, { status: 500 });
  }
}

/**
 * POST: Archivar P2 enero desde model_values a calculator_history (sin tocar model_values)
 * Usa el ÚLTIMO valor registrado por (model_id, platform_id) en el rango 16-31 enero (updated_at más reciente),
 * NO la suma de todos los días. El total consolidado = suma de esos últimos valores por plataforma.
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

    // Solo super_admin puede archivar P2 enero (evitar duplicados)
    if (user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Solo el super admin puede ejecutar esta acción' }, { status: 403 });
    }

    // Traer todos los model_values del rango P2 enero (16-31) con updated_at para quedarnos con el último
    const { data: rows, error: valuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, updated_at')
      .gte('period_date', PERIOD_DATE_P2_ENERO)
      .lte('period_date', PERIOD_DATE_END)
      .order('updated_at', { ascending: false });

    if (valuesError) {
      return NextResponse.json({ success: false, error: `model_values: ${valuesError.message}` }, { status: 500 });
    }

    if (!rows?.length) {
      return NextResponse.json({
        success: true,
        message: 'No hay datos en model_values para P2 enero (16-31). Nada que archivar.',
        models_archived: 0,
        records_inserted: 0,
        execution_time_ms: Date.now() - startTime
      });
    }

    // Por (model_id, platform_id): quedarnos solo con el ÚLTIMO valor (primera aparición = updated_at más reciente)
    const byPlatform = new Map<string, number>();
    const typedRows = rows as { model_id: string; platform_id: string; value: number | null; updated_at: string }[];
    for (const r of typedRows) {
      const key = `${r.model_id}|${r.platform_id}`;
      if (byPlatform.has(key)) continue; // ya tenemos el último (ordenados por updated_at desc)
      byPlatform.set(key, Number(r.value) || 0);
    }
    // Total consolidado por modelo = suma de los últimos valores por plataforma (excl. __CONSOLIDATED_TOTAL__)
    const byModel = new Map<string, number>();
    for (const key of Array.from(byPlatform.keys())) {
      const [, platform_id] = key.split('|');
      if (platform_id === '__CONSOLIDATED_TOTAL__') continue;
      const model_id = key.split('|')[0];
      byModel.set(model_id, (byModel.get(model_id) ?? 0) + (byPlatform.get(key) ?? 0));
    }

    // Ya archivados en calculator_history (evitar duplicados)
    const { data: existing } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id')
      .eq('period_date', PERIOD_DATE_P2_ENERO)
      .eq('period_type', PERIOD_TYPE_P2_ENERO);
    const existingSet = new Set((existing || []).map((e: any) => `${e.model_id}|${e.platform_id}`));

    const toInsert: { model_id: string; period_date: string; period_type: string; platform_id: string; value: number; rate_eur_usd?: number; rate_gbp_usd?: number; rate_usd_cop?: number }[] = [];

    const platformKeys = Array.from(byPlatform.keys());
    for (const key of platformKeys) {
      if (existingSet.has(key)) continue;
      const [model_id, platform_id] = key.split('|');
      if (platform_id === '__CONSOLIDATED_TOTAL__') continue; // Se inserta una sola fila consolidada por modelo más abajo
      toInsert.push({
        model_id,
        period_date: PERIOD_DATE_P2_ENERO,
        period_type: PERIOD_TYPE_P2_ENERO,
        platform_id,
        value: byPlatform.get(key) ?? 0,
        rate_eur_usd: rateEurUsd,
        rate_gbp_usd: rateGbpUsd,
        rate_usd_cop: rateUsdCop
      });
    }

    const modelIds = Array.from(new Set(Array.from(byPlatform.keys()).map((k) => k.split('|')[0])));
    for (const modelId of modelIds) {
      const totalKey = `${modelId}|__CONSOLIDATED_TOTAL__`;
      if (existingSet.has(totalKey)) continue;
      const totalValue = byModel.get(modelId) ?? 0;
      toInsert.push({
        model_id: modelId,
        period_date: PERIOD_DATE_P2_ENERO,
        period_type: PERIOD_TYPE_P2_ENERO,
        platform_id: '__CONSOLIDATED_TOTAL__',
        value: totalValue,
        rate_eur_usd: rateEurUsd,
        rate_gbp_usd: rateGbpUsd,
        rate_usd_cop: rateUsdCop
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'P2 enero ya está en calculator_history. Nada que insertar.',
        models_archived: modelIds.length,
        records_inserted: 0,
        execution_time_ms: Date.now() - startTime
      });
    }

    const { error: insertErr } = await supabase.from('calculator_history').insert(toInsert);
    if (insertErr) {
      if (insertErr.code === '23505') {
        console.warn('⚠️ [ARCHIVE-P2-ENERO] Algunos registros ya existían, insertando en lotes...');
        let inserted = 0;
        for (const row of toInsert) {
          const { error: e } = await supabase.from('calculator_history').insert(row);
          if (!e) inserted++;
          else if (e.code !== '23505') return NextResponse.json({ success: false, error: e.message }, { status: 500 });
        }
        const execMs = Date.now() - startTime;
        console.log(`✅ [ARCHIVE-P2-ENERO] Insertados ${inserted} registros (algunos duplicados omitidos) en ${execMs}ms`);
        return NextResponse.json({
          success: true,
          period_date: PERIOD_DATE_P2_ENERO,
          period_type: PERIOD_TYPE_P2_ENERO,
          models_archived: modelIds.length,
          records_inserted: inserted,
          execution_time_ms: execMs
        });
      }
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ [ARCHIVE-P2-ENERO] Insertados ${toInsert.length} registros en ${executionTime}ms`);

    return NextResponse.json({
      success: true,
      period_date: PERIOD_DATE_P2_ENERO,
      period_type: PERIOD_TYPE_P2_ENERO,
      models_archived: modelIds.length,
      records_inserted: toInsert.length,
      execution_time_ms: executionTime
    });
  } catch (error: any) {
    console.error('❌ [ARCHIVE-P2-ENERO] POST Error:', error);
    return NextResponse.json({ success: false, error: error?.message ?? String(error) }, { status: 500 });
  }
}
