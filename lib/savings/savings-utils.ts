import { createClient } from '@supabase/supabase-js';

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

/** Re-export para uso en servidor; en cliente usar @/lib/savings/savings-window para evitar cargar Supabase. */
export { isWithinSavingsWindow, calculateProcessingTime } from './savings-window';

/**
 * Obtiene el NETO A PAGAR de un período específico desde el historial
 * Usa la misma lógica que /api/model/calculator/historial
 */
export async function getNetoPagarForPeriod(
  modelId: string,
  periodDate: string,
  periodType: '1-15' | '16-31'
): Promise<{
  neto_pagar: number;
  total_cop_modelo: number;
  total_anticipos: number;
  total_deducciones: number;
  success: boolean;
  error?: string;
}> {
  try {
    // Obtener datos del historial desde calculator_history
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select('value_cop_modelo')
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .eq('period_type', periodType);

    if (historyError) {
      console.error('❌ [SAVINGS-UTILS] Error obteniendo historial:', historyError);
      return {
        neto_pagar: 0,
        total_cop_modelo: 0,
        total_anticipos: 0,
        total_deducciones: 0,
        success: false,
        error: 'Error obteniendo historial'
      };
    }

    // Calcular total COP modelo
    const total_cop_modelo = (history || []).reduce((sum, h) => {
      return sum + parseFloat(h.value_cop_modelo || '0');
    }, 0);

    // Obtener anticipos del período
    // Necesitamos buscar el period_id correspondiente
    const { data: period } = await supabase
      .from('periods')
      .select('id')
      .eq('start_date', periodDate)
      .maybeSingle();

    let total_anticipos = 0;
    if (period?.id) {
      const { data: anticipos } = await supabase
        .from('anticipos')
        .select('monto_solicitado')
        .eq('model_id', modelId)
        .eq('period_id', period.id)
        .in('estado', ['aprobado', 'realizado', 'confirmado']);

      total_anticipos = (anticipos || []).reduce((sum, a) => {
        return sum + parseFloat(String(a.monto_solicitado || 0));
      }, 0);
    }

    // Obtener deducciones manuales del período
    const { data: deductions } = await supabase
      .from('calculator_deductions')
      .select('amount')
      .eq('model_id', modelId)
      .eq('period_date', periodDate)
      .eq('period_type', periodType);

    const total_deducciones = (deductions || []).reduce((sum, d) => {
      return sum + parseFloat(String(d.amount || 0));
    }, 0);

    // Calcular NETO A PAGAR
    const neto = total_cop_modelo - total_anticipos - total_deducciones;
    const neto_pagar = Math.max(0, neto);

    return {
      neto_pagar,
      total_cop_modelo,
      total_anticipos,
      total_deducciones,
      success: true
    };
  } catch (error: any) {
    console.error('❌ [SAVINGS-UTILS] Error calculando neto_pagar:', error);
    return {
      neto_pagar: 0,
      total_cop_modelo: 0,
      total_anticipos: 0,
      total_deducciones: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Calcula el saldo total ahorrado de una modelo
 * Suma todos los ahorros aprobados + ajustes
 */
export async function getTotalSavingsBalance(modelId: string): Promise<{
  total_ahorrado: number;
  total_retirado: number;
  saldo_actual: number;
  success: boolean;
  error?: string;
}> {
  try {
    // Obtener todos los ahorros aprobados
    const { data: savings, error: savingsError } = await supabase
      .from('model_savings')
      .select('monto_ahorrado, monto_ajustado')
      .eq('model_id', modelId)
      .eq('estado', 'aprobado');

    if (savingsError) {
      console.error('❌ [SAVINGS-UTILS] Error obteniendo ahorros:', savingsError);
      return {
        total_ahorrado: 0,
        total_retirado: 0,
        saldo_actual: 0,
        success: false,
        error: 'Error obteniendo ahorros'
      };
    }

    // Calcular total ahorrado (usar monto_ajustado si existe, sino monto_ahorrado)
    const total_ahorrado = (savings || []).reduce((sum, s) => {
      const monto = parseFloat(String(s.monto_ajustado || s.monto_ahorrado || 0));
      return sum + monto;
    }, 0);

    // Obtener ajustes manuales (sumas y restas)
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from('savings_adjustments')
      .select('monto')
      .eq('model_id', modelId);

    if (adjustmentsError) {
      console.error('❌ [SAVINGS-UTILS] Error obteniendo ajustes:', adjustmentsError);
    }

    const total_ajustes = (adjustments || []).reduce((sum, a) => {
      return sum + parseFloat(String(a.monto || 0));
    }, 0);

    // Obtener retiros realizados
    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('savings_withdrawals')
      .select('monto_solicitado')
      .eq('model_id', modelId)
      .eq('estado', 'realizado');

    if (withdrawalsError) {
      console.error('❌ [SAVINGS-UTILS] Error obteniendo retiros:', withdrawalsError);
    }

    const total_retirado = (withdrawals || []).reduce((sum, w) => {
      return sum + parseFloat(String(w.monto_solicitado || 0));
    }, 0);

    // Saldo actual = ahorros + ajustes - retiros
    const saldo_actual = total_ahorrado + total_ajustes - total_retirado;

    return {
      total_ahorrado: total_ahorrado + total_ajustes,
      total_retirado,
      saldo_actual: Math.max(0, saldo_actual), // No permitir saldo negativo
      success: true
    };
  } catch (error: any) {
    console.error('❌ [SAVINGS-UTILS] Error calculando saldo:', error);
    return {
      total_ahorrado: 0,
      total_retirado: 0,
      saldo_actual: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Valida si una modelo puede retirar en el período actual
 * Solo puede retirar una vez por período (P1: días 1-15, P2: 16-fin de mes)
 */
export async function canWithdrawInPeriod(
  modelId: string,
  periodDate: string,
  periodType: '1-15' | '16-31'
): Promise<{
  canWithdraw: boolean;
  reason?: string;
  existingWithdrawal?: any;
}> {
  try {
    const period = new Date(periodDate);
    const year = period.getFullYear();
    const month = period.getMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, '0');

    let periodStart: string;
    let periodEnd: string;
    if (periodType === '1-15') {
      periodStart = `${year}-${pad(month)}-01T00:00:00`;
      periodEnd = `${year}-${pad(month)}-15T23:59:59`;
    } else {
      const lastDay = new Date(year, month, 0).getDate();
      periodStart = `${year}-${pad(month)}-16T00:00:00`;
      periodEnd = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59`;
    }

    const { data: existing } = await supabase
      .from('savings_withdrawals')
      .select('id, estado, created_at')
      .eq('model_id', modelId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .in('estado', ['pendiente', 'aprobado', 'realizado'])
      .maybeSingle();

    if (existing) {
      return {
        canWithdraw: false,
        reason: 'Ya has realizado un retiro en este período. Solo se permite un retiro por período.',
        existingWithdrawal: existing
      };
    }

    return {
      canWithdraw: true
    };
  } catch (error: any) {
    console.error('❌ [SAVINGS-UTILS] Error verificando retiro:', error);
    return {
      canWithdraw: false,
      reason: 'Error verificando disponibilidad de retiro'
    };
  }
}

/**
 * Calcula el tiempo de procesamiento según el porcentaje del retiro
 * <50%: 48 horas
 * >=50%: 3 días
 */
/**
 * Actualiza el progreso de las metas de ahorro cuando se aprueba un ahorro
 * También verifica si alguna meta se completó y la marca como completada
 */
export async function updateSavingsGoalsProgress(modelId: string): Promise<{
  success: boolean;
  completedGoals?: Array<{ id: string; nombre_meta: string }>;
  error?: string;
}> {
  try {
    // Obtener saldo actual
    const balance = await getTotalSavingsBalance(modelId);
    if (!balance.success) {
      return { success: false, error: 'Error obteniendo saldo' };
    }

    // Obtener todas las metas activas
    const { data: activeGoals, error: goalsError } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('model_id', modelId)
      .eq('estado', 'activa');

    if (goalsError) {
      console.error('❌ [SAVINGS-UTILS] Error obteniendo metas:', goalsError);
      return { success: false, error: 'Error obteniendo metas' };
    }

    const completedGoals: Array<{ id: string; nombre_meta: string }> = [];

    // Actualizar progreso de cada meta
    for (const goal of activeGoals || []) {
      const montoMeta = parseFloat(String(goal.monto_meta));
      const montoActual = balance.saldo_actual;
      const porcentaje = montoMeta > 0 ? (montoActual / montoMeta) * 100 : 0;

      // Actualizar monto_actual
      await supabase
        .from('savings_goals')
        .update({ monto_actual: montoActual })
        .eq('id', goal.id);

      // Si se completó, marcar como completada
      if (porcentaje >= 100) {
        await supabase
          .from('savings_goals')
          .update({
            estado: 'completada',
            completed_at: new Date().toISOString()
          })
          .eq('id', goal.id);

        completedGoals.push({
          id: goal.id,
          nombre_meta: goal.nombre_meta
        });
      }
    }

    return {
      success: true,
      completedGoals: completedGoals.length > 0 ? completedGoals : undefined
    };
  } catch (error: any) {
    console.error('❌ [SAVINGS-UTILS] Error actualizando progreso de metas:', error);
    return { success: false, error: error.message };
  }
}
