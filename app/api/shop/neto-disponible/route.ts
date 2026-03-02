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

  // ── Período quincenal ACTUAL según fecha de Colombia ──────────────────────
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
  let comprasContado = 0;
  let financingIds: string[] = [];

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

    // ── Cuotas sexshop pendientes SOLO de financiaciones multi-quincena ──────
    const { data: myFinancings } = await supabase
      .from('shop_financing')
      .select('id, installments')
      .eq('model_id', user.id)
      .eq('status', 'aprobado');

    financingIds = (myFinancings || [])
      .filter((f: { installments: number }) => f.installments > 1) // excluir 1q
      .map((f: { id: string }) => f.id);

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

  // ── Compras de contado (1q) de la quincena actual ──────────────────────────
  // Se descuentan igual que un anticipo, pero se basan en las órdenes 1q
  const startDateTime = `${startDate}T00:00:00`;
  const endDateTime = `${endDate}T23:59:59.999Z`;

  const { data: oneQOrders } = await supabase
    .from('shop_orders')
    .select('id, total, payment_mode, status, created_at')
    .eq('model_id', user.id)
    .eq('payment_mode', '1q')
    .in('status', ['aprobado', 'en_preparacion', 'entregado'])
    .gte('created_at', startDateTime)
    .lte('created_at', endDateTime);

  comprasContado = (oneQOrders || []).reduce(
    (s: number, o: { total: number }) => s + Number(o.total || 0),
    0
  );

  // ── Fallback: primera cuota de financiaciones multi-quincena recién aprobadas ─
  // Si por algún motivo aún no hay cuota pendiente ligada al período actual
  // (period_id null o desajuste), pero la financiación fue aprobada en esta
  // quincena, restamos al menos una cuota equivalente a amount_per_installment.
  let cuotaPrimeraAprobacion = 0;
  if (cuotasPendientes === 0) {
    const { data: recentlyApproved } = await supabase
      .from('shop_financing')
      .select('amount_per_installment')
      .eq('model_id', user.id)
      .eq('status', 'aprobado')
      .gt('installments', 1)
      .gte('approved_at', startDateTime)
      .lte('approved_at', endDateTime);

    cuotaPrimeraAprobacion = (recentlyApproved || []).reduce(
      (s: number, f: { amount_per_installment: number }) => s + Number(f.amount_per_installment || 0),
      0
    );
  }

  const netoDisponible = facturado - anticiposTotal - cuotasPendientes - comprasContado - cuotaPrimeraAprobacion;

  // ── Detalle legible para la modelo (ej. "Cuota 1/4 Sexshop (Producto X): $15.000") ─
  const descuentos_detalle: Array<{ concepto: string; monto: number }> = [];

  if (anticiposTotal > 0) {
    descuentos_detalle.push({ concepto: `Anticipo: $${anticiposTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, monto: anticiposTotal });
  }

  // Compras 1q con nombres de productos
  if (oneQOrders && oneQOrders.length > 0) {
    for (const ord of oneQOrders) {
      const orderId = (ord as any).id;
      if (!orderId) continue;
      const { data: items } = await supabase
        .from('shop_order_items')
        .select('shop_products(name)')
        .eq('order_id', orderId);
      const names = (items || [])
        .map((i: any) => i.shop_products?.name)
        .filter(Boolean);
      const label = names.length > 0
        ? `Compra Sexshop (${names.slice(0, 2).join(', ')}${names.length > 2 ? '...' : ''}): $${Number(ord.total || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
        : `Compra Sexshop: $${Number(ord.total || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
      descuentos_detalle.push({ concepto: label, monto: Number(ord.total || 0) });
    }
  }

  // Cuotas pendientes multi-cuota: "Cuota N/M Sexshop (producto): $X"
  if (financingIds && financingIds.length > 0 && period?.id) {
    const { data: installmentsWithFin } = await supabase
      .from('shop_financing_installments')
      .select('id, financing_id, installment_no, amount, shop_financing(installments, order_id)')
      .in('financing_id', financingIds)
      .eq('period_id', period.id)
      .eq('status', 'pendiente');
    for (const inst of installmentsWithFin || []) {
      const fin = Array.isArray((inst as any).shop_financing) ? (inst as any).shop_financing[0] : (inst as any).shop_financing;
      const orderId = fin?.order_id;
      const totalInst = fin?.installments ?? 1;
      let productLabel = '';
      if (orderId) {
        const { data: orderItems } = await supabase
          .from('shop_order_items')
          .select('shop_products(name)')
          .eq('order_id', orderId);
        const names = (orderItems || []).map((i: any) => i.shop_products?.name).filter(Boolean);
        productLabel = names.length > 0 ? ` (${names.slice(0, 2).join(', ')}${names.length > 2 ? '...' : ''})` : '';
      }
      const label = `Cuota ${(inst as any).installment_no}/${totalInst} Sexshop${productLabel}: $${Number((inst as any).amount || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
      descuentos_detalle.push({ concepto: label, monto: Number((inst as any).amount || 0) });
    }
  }

  if (cuotaPrimeraAprobacion > 0 && cuotasPendientes === 0) {
    const { data: recent } = await supabase
      .from('shop_financing')
      .select('order_id, installments, amount_per_installment')
      .eq('model_id', user.id)
      .eq('status', 'aprobado')
      .gt('installments', 1)
      .gte('approved_at', startDateTime)
      .lte('approved_at', endDateTime)
      .limit(1)
      .maybeSingle();
    let productLabel = '';
    if (recent?.order_id) {
      const { data: orderItems } = await supabase.from('shop_order_items').select('shop_products(name)').eq('order_id', recent.order_id);
      const names = (orderItems || []).map((i: any) => i.shop_products?.name).filter(Boolean);
      productLabel = names.length > 0 ? ` (${names.slice(0, 2).join(', ')}${names.length > 2 ? '...' : ''})` : '';
    }
    descuentos_detalle.push({ concepto: `Cuota 1/${recent?.installments ?? 1} Sexshop${productLabel}: $${Number(cuotaPrimeraAprobacion).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, monto: cuotaPrimeraAprobacion });
  }

  return NextResponse.json({
    neto_disponible: netoDisponible,
    facturado,
    anticipos: anticiposTotal,
    cuotas_pendientes: cuotasPendientes,
    compras_contado: comprasContado,
    cuotas_primera_aprobacion: cuotaPrimeraAprobacion,
    descuentos_detalle
  });
}
