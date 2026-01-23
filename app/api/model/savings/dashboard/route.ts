import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getTotalSavingsBalance } from '@/lib/savings/savings-utils';

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

/**
 * GET: Obtener dashboard completo de ahorros
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el usuario es la modelo o admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
    const targetModelId = modelId || user.id;

    // Si no es admin y no es su propio ID, denegar
    if (!isAdmin && user.id !== targetModelId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Obtener balance total
    const balance = await getTotalSavingsBalance(targetModelId);

    // Obtener últimos movimientos (ahorros aprobados + retiros realizados)
    const { data: savings, error: savingsError } = await supabase
      .from('model_savings')
      .select('id, period_date, period_type, monto_ahorrado, monto_ajustado, estado, created_at, approved_at')
      .eq('model_id', targetModelId)
      .eq('estado', 'aprobado')
      .order('approved_at', { ascending: false })
      .limit(10);

    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('savings_withdrawals')
      .select('id, monto_solicitado, estado, created_at, realized_at')
      .eq('model_id', targetModelId)
      .eq('estado', 'realizado')
      .order('realized_at', { ascending: false })
      .limit(10);

    // Obtener ajustes manuales
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from('savings_adjustments')
      .select('id, tipo_ajuste, concepto, monto, created_at, created_by, users!created_by(name)')
      .eq('model_id', targetModelId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Combinar y ordenar movimientos
    const movements: any[] = [];

    (savings || []).forEach(s => {
      movements.push({
        id: s.id,
        tipo: 'ahorro',
        monto: parseFloat(String(s.monto_ajustado || s.monto_ahorrado)),
        fecha: s.approved_at || s.created_at,
        periodo: `${s.period_date} (${s.period_type})`,
        descripcion: `Ahorro del período ${s.period_date} (${s.period_type})`
      });
    });

    (withdrawals || []).forEach(w => {
      movements.push({
        id: w.id,
        tipo: 'retiro',
        monto: -parseFloat(String(w.monto_solicitado)),
        fecha: w.realized_at || w.created_at,
        descripcion: 'Retiro de ahorro'
      });
    });

    (adjustments || []).forEach(a => {
      movements.push({
        id: a.id,
        tipo: 'ajuste',
        monto: parseFloat(String(a.monto)),
        fecha: a.created_at,
        descripcion: `${a.concepto} (${a.tipo_ajuste})`,
        admin: (a.users as any)?.name || 'Admin'
      });
    });

    // Ordenar por fecha descendente
    movements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    // Obtener gráfico de crecimiento (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: historicalSavings } = await supabase
      .from('model_savings')
      .select('approved_at, created_at, monto_ahorrado, monto_ajustado')
      .eq('model_id', targetModelId)
      .eq('estado', 'aprobado')
      .gte('approved_at', sixMonthsAgo.toISOString())
      .order('approved_at', { ascending: true });

    const { data: historicalWithdrawals } = await supabase
      .from('savings_withdrawals')
      .select('realized_at, created_at, monto_solicitado')
      .eq('model_id', targetModelId)
      .eq('estado', 'realizado')
      .gte('realized_at', sixMonthsAgo.toISOString())
      .order('realized_at', { ascending: true });

    // Calcular crecimiento mensual
    const monthlyData: Record<string, { ingresos: number; retiros: number; saldo: number }> = {};
    let runningBalance = 0;

    (historicalSavings || []).forEach(s => {
      const month = new Date(s.approved_at || s.created_at).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { ingresos: 0, retiros: 0, saldo: 0 };
      }
      const monto = parseFloat(String(s.monto_ajustado || s.monto_ahorrado));
      monthlyData[month].ingresos += monto;
      runningBalance += monto;
      monthlyData[month].saldo = runningBalance;
    });

    (historicalWithdrawals || []).forEach(w => {
      const month = new Date(w.realized_at || w.created_at).toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { ingresos: 0, retiros: 0, saldo: 0 };
      }
      const monto = parseFloat(String(w.monto_solicitado));
      monthlyData[month].retiros += monto;
      runningBalance -= monto;
      monthlyData[month].saldo = runningBalance;
    });

    const chartData = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        ...data
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Obtener metas activas
    const { data: goals } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('model_id', targetModelId)
      .eq('estado', 'activa')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      balance: balance.success ? {
        total_ahorrado: balance.total_ahorrado,
        total_retirado: balance.total_retirado,
        saldo_actual: balance.saldo_actual
      } : null,
      movements: movements.slice(0, 10), // Últimos 10 movimientos
      chartData,
      goals: goals || [],
      stats: {
        total_deposits: (savings || []).length,
        total_withdrawals: (withdrawals || []).length,
        total_adjustments: (adjustments || []).length
      }
    });

  } catch (error: any) {
    console.error('❌ [SAVINGS-DASHBOARD] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
