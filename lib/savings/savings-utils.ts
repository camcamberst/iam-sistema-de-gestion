import { createClient } from '@supabase/supabase-js';
import { getColombiaDate } from '@/utils/period-closure-dates';

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
 * Verifica si estamos dentro de la ventana de tiempo para solicitar ahorro
 * P1 cierra día 16 → ventana: 16, 17, 18 (3 días completos)
 * P2 cierra día 1 → ventana: 1, 2, 3 (3 días completos)
 */
export function isWithinSavingsWindow(periodDate: string, periodType: '1-15' | '16-31'): {
  isWithin: boolean;
  reason?: string;
  windowStart?: string;
  windowEnd?: string;
} {
  const colombiaDate = getColombiaDate();
  const today = new Date(colombiaDate);
  const todayDay = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const todayYear = today.getFullYear();

  // Parsear la fecha del período
  const period = new Date(periodDate);
  const periodDay = period.getDate();
  const periodMonth = period.getMonth() + 1;
  const periodYear = period.getFullYear();

  if (periodType === '1-15') {
    // P1 cierra día 16 → ventana: 16, 17, 18
    // El período cerrado es del 1-15, así que la ventana es del 16 al 18 del mismo mes
    if (todayYear === periodYear && todayMonth === periodMonth) {
      if (todayDay >= 16 && todayDay <= 18) {
        return {
          isWithin: true,
          windowStart: `${todayYear}-${String(todayMonth).padStart(2, '0')}-16`,
          windowEnd: `${todayYear}-${String(todayMonth).padStart(2, '0')}-18`
        };
      } else if (todayDay < 16) {
        return {
          isWithin: false,
          reason: 'El período aún no ha cerrado. La ventana de ahorro se abrirá el día 16.',
          windowStart: `${todayYear}-${String(todayMonth).padStart(2, '0')}-16`,
          windowEnd: `${todayYear}-${String(todayMonth).padStart(2, '0')}-18`
        };
      } else {
        return {
          isWithin: false,
          reason: 'La ventana de ahorro para este período ha cerrado. Solo puedes solicitar ahorro del 16 al 18 después del cierre.',
          windowStart: `${todayYear}-${String(todayMonth).padStart(2, '0')}-16`,
          windowEnd: `${todayYear}-${String(todayMonth).padStart(2, '0')}-18`
        };
      }
    } else {
      return {
        isWithin: false,
        reason: 'Este período no corresponde a la fecha actual.'
      };
    }
  } else {
    // P2 cierra día 1 → ventana: 1, 2, 3
    // El período cerrado es del 16-31 del mes anterior, así que la ventana es del 1 al 3 del mes actual
    const nextMonth = periodMonth === 12 ? 1 : periodMonth + 1;
    const nextYear = periodMonth === 12 ? periodYear + 1 : periodYear;

    if (todayYear === nextYear && todayMonth === nextMonth) {
      if (todayDay >= 1 && todayDay <= 3) {
        return {
          isWithin: true,
          windowStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
          windowEnd: `${nextYear}-${String(nextMonth).padStart(2, '0')}-03`
        };
      } else if (todayDay < 1) {
        return {
          isWithin: false,
          reason: 'El período aún no ha cerrado. La ventana de ahorro se abrirá el día 1.',
          windowStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
          windowEnd: `${nextYear}-${String(nextMonth).padStart(2, '0')}-03`
        };
      } else {
        return {
          isWithin: false,
          reason: 'La ventana de ahorro para este período ha cerrado. Solo puedes solicitar ahorro del 1 al 3 después del cierre.',
          windowStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
          windowEnd: `${nextYear}-${String(nextMonth).padStart(2, '0')}-03`
        };
      }
    } else {
      return {
        isWithin: false,
        reason: 'Este período no corresponde a la fecha actual.'
      };
    }
  }
}

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
 * Solo puede retirar una vez por período
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
    // Buscar si ya hay un retiro en este período
    const { data: existing } = await supabase
      .from('savings_withdrawals')
      .select('id, estado, created_at')
      .eq('model_id', modelId)
      .gte('created_at', `${periodDate}T00:00:00`)
      .lte('created_at', `${periodDate}T23:59:59`)
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
export function calculateProcessingTime(montoRetiro: number, saldoTotal: number): {
  tiempo: '48h' | '3dias';
  fechaEstimada: Date;
  porcentaje: number;
} {
  const porcentaje = saldoTotal > 0 ? (montoRetiro / saldoTotal) * 100 : 0;
  const tiempo = porcentaje < 50 ? '48h' : '3dias';
  
  const fechaEstimada = new Date();
  if (tiempo === '48h') {
    fechaEstimada.setHours(fechaEstimada.getHours() + 48);
  } else {
    fechaEstimada.setDate(fechaEstimada.getDate() + 3);
  }

  return {
    tiempo,
    fechaEstimada,
    porcentaje
  };
}
