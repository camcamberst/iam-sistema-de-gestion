import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeToPeriodStartDate, getColombiaPeriodStartDate, getPeriodDetails } from '@/utils/calculator-dates';
import { getAnticiposPagadosDelCorte } from '@/lib/anticipos/anticipos-utils';

export const dynamic = 'force-dynamic';

// Usar service role key para bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const rawPeriodDate = searchParams.get('periodDate') || getColombiaPeriodStartDate();
  const periodDate = normalizeToPeriodStartDate(rawPeriodDate);
  
  if (!modelId) {
    return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
  }

  try {
    console.log(`🔍 [MI-CALCULADORA-REAL] Obteniendo totales sincronizados para modelId: ${modelId}, Periodo: ${periodDate}`);

    // 1. Obtener totales directamente de calculator_totals
    // Estos valores son los mismos que la plataforma muestra en Mi Billetera y son actualizados en tiempo real
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('total_usd_modelo, total_cop_modelo')
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .maybeSingle();

    if (totalsError && totalsError.code !== 'PGRST116') {
      console.warn('⚠️ [MI-CALCULADORA-REAL] Error al consultar calculator_totals:', totalsError.message);
    }

    const usdModelo = totals?.total_usd_modelo || 0;
    const copModelo = totals?.total_cop_modelo || 0;

    // 2. Obtener anticipos PAGADOS del corte vigente
    const anticiposCorte = await getAnticiposPagadosDelCorte(modelId, periodDate);
    const anticiposPagados = anticiposCorte.total;

    // 3. Asegurar lógica reforzada: OBTENER DEUDAS DE SEXSHOP DEL PERÍODO
    const { startDate, endDate } = getPeriodDetails(periodDate);
    const { data: period } = await supabase
      .from('periods')
      .select('id')
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    let sexshopTotal = 0;

    // 3.1 Cuotas pendientes de financiaciones multi-quincena
    if (period?.id) {
      const { data: myFinancings } = await supabase
        .from('shop_financing')
        .select('id, installments')
        .eq('model_id', modelId)
        .eq('status', 'aprobado');

      const financingIds = (myFinancings || [])
        .filter((f: any) => f.installments > 1)
        .map((f: any) => f.id);

      if (financingIds.length > 0) {
        const { data: installments } = await supabase
          .from('shop_financing_installments')
          .select('amount')
          .in('financing_id', financingIds)
          .eq('period_id', period.id)
          .eq('status', 'pendiente');

        sexshopTotal += (installments || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
      }
    }

    // 3.2 Compras contadas (1q) en la quincena actual
    const { data: oneQOrders } = await supabase
      .from('shop_orders')
      .select('total')
      .eq('model_id', modelId)
      .eq('payment_mode', '1q')
      .in('status', ['aprobado', 'en_preparacion', 'entregado'])
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59.999Z`);

    sexshopTotal += (oneQOrders || []).reduce((s: number, o: any) => s + Number(o.total || 0), 0);

    // 3.3 Cuotas de contingencia (recién aprobadas sin consolidar en schedule)
    const { data: recentlyApproved } = await supabase
      .from('shop_financing')
      .select('amount_per_installment')
      .eq('model_id', modelId)
      .eq('status', 'aprobado')
      .gt('installments', 1)
      .gte('approved_at', `${startDate}T00:00:00`)
      .lte('approved_at', `${endDate}T23:59:59.999Z`);

    sexshopTotal += (recentlyApproved || []).reduce((s: number, f: any) => s + Number(f.amount_per_installment || 0), 0);

    // Unificamos todo el capital gastado/descontado (Anticipos + Sexshop) para calcular el disponible real
    const totalPagadoYDescontado = anticiposPagados + sexshopTotal;

    // 4. Calcular anticipo disponible (90% del total cop - lo consumido en anticipos y sexshop)
    const anticipoTotal = Math.round(copModelo * 0.9);
    const anticipoDisponible = Math.max(0, anticipoTotal - totalPagadoYDescontado);

    console.log('✅ [MI-CALCULADORA-REAL] Valores calculados con Sexshop:', {
      usdModelo,
      copModelo,
      anticiposSueltos: anticiposPagados,
      sexshopGastado: sexshopTotal,
      totalPagadoYDescontado,
      anticipoDisponible,
    });

    return NextResponse.json({
      success: true,
      data: {
        usdModelo,
        copModelo,
        anticipoDisponible,
        anticiposPagados: anticiposPagados // Mantemos ESTRICTAMENTE solo los anticipos solicitados para no alarmar a la modelo
      }
    });

  } catch (error: any) {
    console.error('❌ [MI-CALCULADORA-REAL] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
