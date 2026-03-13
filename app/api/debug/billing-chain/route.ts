/**
 * Diagnóstico completo de la cadena de facturación para una modelo.
 * Verifica: usuario, calculator_config, model_values, calculator_totals,
 * membresía de grupos, y la tabla `platforms` vs `calculator_platforms`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

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
    const periodEnd = d <= 15
      ? `${y}-${String(m).padStart(2, '0')}-15`
      : `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

    // 1. Usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', modelId)
      .single();

    // 2. calculator_config
    const { data: config, error: configError } = await supabase
      .from('calculator_config')
      .select('id, model_id, active, enabled_platforms, percentage_override, group_percentage, min_quota_override, group_min_quota')
      .eq('model_id', modelId)
      .eq('active', true)
      .maybeSingle();

    // 3. model_values para este período
    const { data: modelValues, error: valuesError } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date, updated_at')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('updated_at', { ascending: false });

    // 4. calculator_totals para este período
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('model_id', modelId)
      .gte('period_date', periodStart)
      .lte('period_date', periodEnd)
      .order('updated_at', { ascending: false })
      .limit(5);

    // 5. user_groups (membresía)
    const { data: groups, error: groupsError } = await supabase
      .from('user_groups')
      .select('group_id, groups(id, name)')
      .eq('user_id', modelId);

    // 6. Verificar tabla `platforms` (la que usa billing-summary fallback con INNER JOIN)
    const platformIdsFromValues = [...new Set((modelValues || []).map(v => v.platform_id))];
    let platformsTableCheck: any = null;
    let calcPlatformsCheck: any = null;
    if (platformIdsFromValues.length > 0) {
      const { data: pRows, error: pErr } = await supabase
        .from('platforms' as any)
        .select('id, name, currency')
        .in('id', platformIdsFromValues);
      platformsTableCheck = { found: pRows?.length ?? 0, error: pErr?.message, ids: pRows?.map((p: any) => p.id) };

      const { data: cpRows, error: cpErr } = await supabase
        .from('calculator_platforms')
        .select('id, name, currency')
        .in('id', platformIdsFromValues);
      calcPlatformsCheck = { found: cpRows?.length ?? 0, error: cpErr?.message, ids: cpRows?.map(p => p.id) };
    }

    // 7. Intentar JOIN que usa billing-summary para ver si falla
    let billingJoinTest: any = null;
    if ((modelValues || []).length > 0) {
      const { data: joinData, error: joinError } = await supabase
        .from('model_values')
        .select('platform_id, value, platforms!inner(id, name, currency)')
        .eq('model_id', modelId)
        .gte('period_date', periodStart)
        .lte('period_date', periodEnd)
        .limit(5);
      billingJoinTest = {
        success: !joinError,
        rowsReturned: joinData?.length ?? 0,
        error: joinError?.message,
        sample: joinData?.slice(0, 3)
      };
    }

    const diagnosis: string[] = [];
    if (!user) diagnosis.push('❌ Usuario no encontrado');
    else {
      if (!user.is_active) diagnosis.push('❌ Usuario INACTIVO (is_active=false) → no aparece en billing-summary');
      if (user.role !== 'modelo') diagnosis.push(`⚠️ Rol "${user.role}" → billing-summary solo lista role=modelo`);
    }
    if (!config) diagnosis.push('❌ Sin calculator_config activo → calculadora no carga plataformas');
    if (!modelValues || modelValues.length === 0) diagnosis.push('❌ Sin model_values en este período → no hay datos fuente');
    if (!totals || totals.length === 0) diagnosis.push('❌ Sin calculator_totals en este período → billing-summary y billetera muestran $0');
    if ((!groups || groups.length === 0)) diagnosis.push('⚠️ Sin membresía de grupos → admin no-superadmin no verá esta modelo');
    if (billingJoinTest && !billingJoinTest.success) diagnosis.push(`❌ JOIN model_values↔platforms FALLA: ${billingJoinTest.error} → fallback de billing-summary no puede sincronizar`);
    if (billingJoinTest && billingJoinTest.success && billingJoinTest.rowsReturned === 0) diagnosis.push('⚠️ JOIN model_values↔platforms retorna 0 filas → INNER JOIN descarta todos los registros');
    if (platformsTableCheck && platformsTableCheck.error) diagnosis.push(`❌ Tabla "platforms" no existe o error: ${platformsTableCheck.error}`);
    if (platformsTableCheck && !platformsTableCheck.error && platformsTableCheck.found === 0 && platformIdsFromValues.length > 0)
      diagnosis.push(`❌ Tabla "platforms" NO tiene IDs que coincidan con model_values (${platformIdsFromValues.join(', ')})`);

    if (diagnosis.length === 0) diagnosis.push('✅ Todos los datos parecen correctos');

    return NextResponse.json({
      success: true,
      modelId,
      period: { start: periodStart, end: periodEnd, today },
      diagnosis,
      user: user ? { name: user.name, email: user.email, role: user.role, is_active: user.is_active } : null,
      calculator_config: config ? {
        active: config.active,
        enabled_platforms: config.enabled_platforms?.length ?? 0,
        percentage: config.percentage_override ?? config.group_percentage ?? 'none',
        min_quota: config.min_quota_override ?? config.group_min_quota ?? 'none'
      } : null,
      model_values: {
        count: modelValues?.length ?? 0,
        platformIds: platformIdsFromValues,
        withValue: (modelValues || []).filter(v => v.value > 0).length,
        sample: (modelValues || []).slice(0, 5).map(v => ({ platform: v.platform_id, value: v.value, date: v.period_date }))
      },
      calculator_totals: {
        count: totals?.length ?? 0,
        latest: totals?.[0] ? {
          usd_bruto: totals[0].total_usd_bruto,
          usd_modelo: totals[0].total_usd_modelo,
          cop_modelo: totals[0].total_cop_modelo,
          period_date: totals[0].period_date,
          updated_at: totals[0].updated_at
        } : null
      },
      groups: (groups || []).map((g: any) => ({ id: g.group_id, name: g.groups?.name })),
      platforms_table_check: platformsTableCheck,
      calculator_platforms_check: calcPlatformsCheck,
      billing_join_test: billingJoinTest
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
