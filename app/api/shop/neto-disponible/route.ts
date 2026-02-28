/**
 * Calcula el neto disponible de la modelo para el período activo:
 *   facturado - anticipos - cuotas sexshop pendientes del período
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

  // Período activo
  const { data: period } = await supabase
    .from('periods')
    .select('id, start_date')
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!period) return NextResponse.json({ neto_disponible: 0, facturado: 0, anticipos: 0, cuotas_pendientes: 0 });

  // Facturado
  const { data: billing } = await supabase
    .from('billing_records')
    .select('amount_cop')
    .eq('model_id', user.id)
    .eq('period_id', period.id);

  const facturado = (billing || []).reduce((s: number, r: { amount_cop: number }) => s + (r.amount_cop || 0), 0);

  // Anticipos del período
  const { data: anticipos } = await supabase
    .from('anticipos')
    .select('monto_solicitado')
    .eq('model_id', user.id)
    .in('estado', ['aprobado', 'realizado', 'confirmado'])
    .gte('created_at', period.start_date);

  const anticiposTotal = (anticipos || []).reduce((s: number, a: { monto_solicitado: number }) => s + (a.monto_solicitado || 0), 0);

  // Cuotas sexshop pendientes del período activo
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

    cuotasPendientes = (installments || []).reduce((s: number, i: { amount: number }) => s + (i.amount || 0), 0);
  }

  const netoDisponible = facturado - anticiposTotal - cuotasPendientes;

  return NextResponse.json({
    neto_disponible: netoDisponible,
    facturado,
    anticipos: anticiposTotal,
    cuotas_pendientes: cuotasPendientes
  });
}
