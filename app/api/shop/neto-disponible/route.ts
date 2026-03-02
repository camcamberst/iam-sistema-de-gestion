/**
 * Calcula el neto disponible de la modelo para la QUINCENA ACTUAL (por fecha),
 * sin depender de flags `is_active` en `periods`:
 *
 *   total_cop_modelo (calculator_totals del período actual)
 *   - anticipos aprobados de ese período (si existe en `periods`)
 *   - cuotas sexshop pendientes de ese período (si existe en `periods`)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getPeriodDetails } from '@/utils/calculator-dates';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // ── Período quincenal ACTUAL segun fecha de Colombia ──────────────────────
  const todayCo = getColombiaDate();
  const { startDate, endDate } = getPeriodDetails(todayCo);

  // ── Facturado del período actual: calculator_totals ────────────────────────
  // period_date en calculator_totals = start_date de la quincena (1 o 16).
  // Tomamos el último total dentro del rango de la quincena actual.
  const { data: totals } = await supabase
    .from('calculator_totals')
    .select('total_cop_modelo')
    .eq('model_id', user.id)
    .gte('period_date', startDate)
    .lte('period_date', endDate)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const facturado = Number(totals?.total_cop_modelo ?? 0);

  // ── Buscar período en `periods` por fechas exactas (si existe) ─────────────
  // Esto se usa solo para vincular anticipos y cuotas a un period_id concreto.
  const { data: period } = await supabase
    .from('periods')
    .select('id')
    .eq('start_date', startDate)
    .eq('end_date', endDate)
    .maybeSingle();

  let anticiposTotal = 0;
  let cuotasPendientes = 0;

  if (period?.id) {
    // ── Anticipos aprobados del período actual ───────────────────────────────
    const { data: anticipos } = await supabase
      .from('anticipos')
      .select('monto_solicitado')
      .eq('model_id', user.id)
      .eq('period_id', period.id)
      .in('estado', ['aprobado', 'realizado', 'confirmado']);

    anticiposTotal = (anticipos || []).reduce(
      (s: number, a: { monto_solicitado: number }) => s + Number(a.monto_solicitado || 0),
      0
    );

    // ── Cuotas sexshop pendientes del período actual ─────────────────────────
    const { data: myFinancings } = await supabase
      .from('shop_financing')
      .select('id')
      .eq('model_id', user.id)
      .eq('status', 'aprobado');

    const financingIds = (myFinancings || []).map((f: { id: string }) => f.id);

    if (financingIds.length > 0) {
      const { data: installments } = await supabase
        .from('shop_financing_installments')
        .select('amount')
        .in('financing_id', financingIds)
        .eq('period_id', period.id)
        .eq('status', 'pendiente');

      cuotasPendientes = (installments || []).reduce(
        (s: number, i: { amount: number }) => s + Number(i.amount || 0),
        0
      );
    }
  }

  const netoDisponible = facturado - anticiposTotal - cuotasPendientes;

  return NextResponse.json({
    neto_disponible: netoDisponible,
    facturado,
    anticipos: anticiposTotal,
    cuotas_pendientes: cuotasPendientes
  });
}
