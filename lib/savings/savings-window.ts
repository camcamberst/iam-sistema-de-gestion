/**
 * Utilidad de ventana de ahorro segura para cliente (sin Supabase).
 * Usar en páginas "use client" para evitar cargar savings-utils en el navegador.
 */
import { getColombiaDate } from '@/utils/period-closure-dates';

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

  const period = new Date(periodDate);
  const periodMonth = period.getMonth() + 1;
  const periodYear = period.getFullYear();

  if (periodType === '1-15') {
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
 * Calcula el tiempo de procesamiento según el porcentaje del retiro (solo lógica, sin Supabase).
 * <50%: 48 horas; >=50%: 3 días.
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
  return { tiempo, fechaEstimada, porcentaje };
}
