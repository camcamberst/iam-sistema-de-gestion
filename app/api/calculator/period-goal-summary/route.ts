/**
 * Resumen del periodo actual: objetivo (cuota) y total facturado en USD bruto.
 * Usado por la barra horaria para mostrar "promedio diario para alcanzar objetivo".
 * NOTA: La cuota mínima (goalUsd) es un objetivo de producción BRUTA,
 * por lo que periodBilledUsd usa total_usd_bruto (no total_usd_modelo).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    const today = getColombiaDate();
    const [y, m, d] = today.split('-').map(Number);
    const periodStart = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-01`
      : `${y}-${String(m).padStart(2, '0')}-16`;

    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('min_quota_override, group_min_quota, percentage_override, group_percentage, enabled_platforms')
      .eq('model_id', modelId)
      .eq('active', true)
      .maybeSingle();

    if (configError || !config) {
      return NextResponse.json({
        success: true,
        goalUsd: 470,
        periodBilledUsd: 0
      });
    }

    const goalUsd = Number(config.min_quota_override ?? config.group_min_quota ?? 470);

    // Leer el total USD Bruto guardado por la calculadora.
    // La cuota mínima (goalUsd) es un objetivo de producción BRUTA,
    // por lo que la comparación debe hacerse contra total_usd_bruto (no modelo).
    const { data: totalsRow } = await supabase
      .from('calculator_totals')
      .select('total_usd_bruto, total_usd_modelo, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', today)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const periodBilledUsd = Math.round((Number(totalsRow?.total_usd_bruto) || 0) * 100) / 100;
    const periodBilledUsdModelo = Math.round((Number(totalsRow?.total_usd_modelo) || 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      goalUsd,
      periodBilledUsd,
      periodBilledUsdModelo,
    });
  } catch (e: any) {
    console.error('❌ [PERIOD-GOAL-SUMMARY]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
