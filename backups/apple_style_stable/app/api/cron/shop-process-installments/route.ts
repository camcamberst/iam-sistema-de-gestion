/**
 * Cron: procesa cuotas de financiación sexshop al cierre de período.
 * Ejecutar al cerrar cada período (junto con los demás cierres).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const periodId = url.searchParams.get('period_id');

  // Obtener período a cerrar
  let period;
  if (periodId) {
    const { data } = await supabase.from('periods').select('id').eq('id', periodId).single();
    period = data;
  } else {
    // Período activo más reciente — is_active (booleano)
    const { data } = await supabase
      .from('periods')
      .select('id, start_date, end_date')
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    period = data;
  }

  if (!period) return NextResponse.json({ error: 'No hay período activo' }, { status: 400 });

  type FinancingRow = { id: string; model_id: string; total_amount: number; installments: number; status: string; order_id: string; };
  type InstallmentRow = { id: string; financing_id: string; installment_no: number; amount: number; status: string; prorogued_count: number; shop_financing: FinancingRow[] };

  // Cuotas pendientes de este período
  const { data: rawInstallments, error } = await supabase
    .from('shop_financing_installments')
    .select(`
      id, financing_id, installment_no, amount, status, prorogued_count,
      shop_financing!inner(id, model_id, total_amount, installments, status, order_id)
    `)
    .eq('period_id', period.id)
    .eq('status', 'pendiente');

  const installments = rawInstallments as InstallmentRow[] | null;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!installments || installments.length === 0) {
    return NextResponse.json({ processed: 0, deferred: 0, message: 'Sin cuotas pendientes' });
  }

  let processed = 0;
  let deferred = 0;

  for (const inst of installments) {
    // shop_financing comes as array due to Supabase join — take first element
    const fin: FinancingRow | undefined = Array.isArray(inst.shop_financing)
      ? inst.shop_financing[0]
      : inst.shop_financing;
    if (!fin || fin.status !== 'aprobado') continue;

    // Calcular neto disponible de la modelo
    const netoDisponible = await getNetoDisponible(fin.model_id, period.id);

    if (netoDisponible >= inst.amount) {
      // Cobrar cuota
      await supabase.from('shop_financing_installments').update({
        status: 'cobrada',
        deducted_at: new Date().toISOString()
      }).eq('id', inst.id);

      // Verificar si todas las cuotas fueron cobradas
      const { data: allInstallments } = await supabase
        .from('shop_financing_installments')
        .select('status')
        .eq('financing_id', fin.id);

      const allPaid = (allInstallments || []).every((i: { status: string }) => i.status === 'cobrada');
      if (allPaid) {
        await supabase.from('shop_financing').update({ status: 'completado' }).eq('id', fin.id);
      }

      processed++;
    } else {
      // Neto insuficiente → diferir a próximo período
      const { data: nextPeriod } = await supabase
        .from('periods')
        .select('id')
        .in('status', ['upcoming', 'active'])
        .neq('id', period.id)
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      await supabase.from('shop_financing_installments').update({
        status: 'prorrogada',
        prorogued_count: inst.prorogued_count + 1,
        period_id: nextPeriod?.id || null
      }).eq('id', inst.id);

      // Notificar modelo y admins
      const { data: modelUser } = await supabase.from('users').select('id, email').eq('id', fin.model_id).single();
      if (modelUser) {
        const modelMsg = `⚠️ **Cuota diferida — Sexshop**\n\nHola **${modelUser.email.split('@')[0]}**, tu cuota #${inst.installment_no} de **$${inst.amount.toLocaleString('es-CO')}** no pudo descontarse este período por fondos insuficientes. Se intentará en el próximo período.`;
        await sendBotNotification(modelUser.id, 'custom_message' as never, modelMsg);
      }

      // Notificar admins
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true);

      const adminMsg = `⚠️ **Cuota diferida — Sexshop**\n\nLa modelo **${modelUser?.email.split('@')[0]}** no tiene fondos suficientes para la cuota #${inst.installment_no} de **$${inst.amount.toLocaleString('es-CO')}** de la financiación \`${fin.id}\`. La cuota fue diferida al siguiente período.`;

      for (const admin of admins || []) {
        await sendBotNotification(admin.id, 'custom_message' as never, adminMsg);
      }

      deferred++;
    }
  }

  return NextResponse.json({ processed, deferred, message: `${processed} cobrada(s), ${deferred} diferida(s)` });
}

async function getNetoDisponible(modelId: string, periodId: string): Promise<number> {
  // Facturado: tabla real calculator_totals / total_cop_modelo
  const { data: periodData } = await supabase
    .from('periods')
    .select('start_date, end_date')
    .eq('id', periodId)
    .single();

  const { data: totals } = await supabase
    .from('calculator_totals')
    .select('total_cop_modelo')
    .eq('model_id', modelId)
    .gte('period_date', periodData?.start_date ?? '')
    .lte('period_date', periodData?.end_date ?? periodData?.start_date ?? '')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const facturado = Number(totals?.total_cop_modelo ?? 0);

  // Anticipos aprobados del período
  const { data: anticipos } = await supabase
    .from('anticipos')
    .select('monto_solicitado')
    .eq('model_id', modelId)
    .eq('period_id', periodId)
    .in('estado', ['aprobado', 'realizado', 'confirmado']);

  const anticiposTotal = (anticipos || []).reduce(
    (s: number, a: { monto_solicitado: number }) => s + Number(a.monto_solicitado || 0),
    0
  );

  return facturado - anticiposTotal;
}
