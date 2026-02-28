/**
 * Calcula el neto disponible de la modelo para el período activo:
 *   total_cop_modelo (calculator_totals) - anticipos aprobados - cuotas sexshop pendientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  // ── Período activo ─────────────────────────────────────────────────────────
  const { data: period } = await supabase
    .from('periods')
    .select('id, start_date, end_date')
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!period) {
    return NextResponse.json({ neto_disponible: 0, facturado: 0, anticipos: 0, cuotas_pendientes: 0 });
  }

  // ── Facturado del período: calculator_totals ────────────────────────────────
  // period_date en calculator_totals = start_date de la quincena (ej: "2025-01-01" o "2025-01-16")
  const { data: totals } = await supabase
    .from('calculator_totals')
    .select('total_cop_modelo')
    .eq('model_id', user.id)
    .gte('period_date', period.start_date)
    .lte('period_date', period.end_date ?? period.start_date)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const facturado = Number(totals?.total_cop_modelo ?? 0);

  // ── Anticipos aprobados del período ────────────────────────────────────────
  const { data: anticipos } = await supabase
    .from('anticipos')
    .select('monto_solicitado')
    .eq('model_id', user.id)
    .eq('period_id', period.id)
    .in('estado', ['aprobado', 'realizado', 'confirmado']);

  const anticiposTotal = (anticipos || []).reduce(
    (s: number, a: { monto_solicitado: number }) => s + Number(a.monto_solicitado || 0),
    0
  );

  // ── Cuotas sexshop pendientes del período ──────────────────────────────────
  const { data: myFinancings } = await supabase
    .from('shop_financing')
    .select('id')
    .eq('model_id', user.id)
    .eq('status', 'aprobado');

  const financingIds = (myFinancings || []).map((f: { id: string }) => f.id);

  let cuotasPendientes = 0;
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

  const netoDisponible = facturado - anticiposTotal - cuotasPendientes;

  return NextResponse.json({
    neto_disponible: netoDisponible,
    facturado,
    anticipos: anticiposTotal,
    cuotas_pendientes: cuotasPendientes
  });
}
