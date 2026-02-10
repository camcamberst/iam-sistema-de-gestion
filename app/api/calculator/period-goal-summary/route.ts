/**
 * Resumen del periodo actual: objetivo (cuota) y total facturado en USD modelo.
 * Usado por la barra horaria para mostrar "promedio diario para alcanzar objetivo".
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
    const defaultPct = Number(config.percentage_override ?? config.group_percentage ?? 80);
    const platformIds: string[] = config.enabled_platforms || [];

    if (platformIds.length === 0) {
      return NextResponse.json({ success: true, goalUsd, periodBilledUsd: 0 });
    }

    const { data: ratesData } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null);
    const rates = {
      usd_cop: ratesData?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: ratesData?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.2
    };

    const { data: platforms } = await supabase
      .from('calculator_platforms')
      .select('id, currency')
      .in('id', platformIds)
      .eq('active', true);

    const { data: rows, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, period_date, value, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', today)
      .order('updated_at', { ascending: false });

    if (valuesError) {
      return NextResponse.json({ success: false, error: valuesError.message }, { status: 500 });
    }

    const latestByKey: Record<string, number> = {};
    (rows || []).forEach((r: any) => {
      const key = `${r.period_date}-${r.platform_id}`;
      if (latestByKey[key] == null) latestByKey[key] = Number(r.value) || 0;
    });

    const platformMap = new Map((platforms || []).map((p: any) => [p.id, p]));
    let periodBilledUsd = 0;

    const toUsdBruto = (value: number, platformId: string, currency: string) => {
      const n = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (currency === 'EUR') {
        if (n === 'big7') return (value * rates.eur_usd) * 0.84;
        if (n === 'mondo') return (value * rates.eur_usd) * 0.78;
        return value * rates.eur_usd;
      }
      if (currency === 'GBP') {
        if (n === 'aw') return (value * rates.gbp_usd) * 0.677;
        return value * rates.gbp_usd;
      }
      if (currency === 'USD') {
        if (n === 'cmd' || n === 'camlust' || n === 'skypvt') return value * 0.75;
        if (n === 'chaturbate' || n === 'myfreecams' || n === 'stripchat') return value * 0.05;
        if (n === 'dxlive') return value * 0.6;
        if (n === 'secretfriends') return value * 0.5;
        return value;
      }
      return value;
    };

    for (const key of Object.keys(latestByKey)) {
      const parts = key.split('-');
      const platformId = parts.length >= 4 ? parts.slice(3).join('-') : (parts[1] || '');
      const platform = platformMap.get(platformId);
      const currency = platform?.currency || 'USD';
      const value = latestByKey[key];
      if (value <= 0) continue;
      const usdBruto = toUsdBruto(value, platformId, currency);
      const pct = platformId === 'superfoon' ? 100 : defaultPct;
      periodBilledUsd += usdBruto * (pct / 100);
    }

    periodBilledUsd = Math.round(periodBilledUsd * 100) / 100;

    return NextResponse.json({
      success: true,
      goalUsd,
      periodBilledUsd
    });
  } catch (e: any) {
    console.error('❌ [PERIOD-GOAL-SUMMARY]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
