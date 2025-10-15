/**
 * 🕐 DETECTOR DE HORARIO DE VERANO EUROPEO
 * 
 * Determina automáticamente si Europa Central está en horario de verano (CEST) o invierno (CET)
 * para calcular la hora correcta de Colombia que coincida con medianoche europea.
 */

/**
 * Detecta si Europa Central está en horario de verano (CEST) o invierno (CET)
 * @param date - Fecha a verificar (opcional, usa fecha actual si no se proporciona)
 * @returns true si está en horario de verano (CEST), false si está en invierno (CET)
 */
export function isEuropeanSummerTime(date: Date = new Date()): boolean {
  // Crear fechas para el último domingo de marzo y octubre del año actual
  const year = date.getFullYear();
  
  // Último domingo de marzo (inicio horario de verano)
  const marchLastSunday = getLastSundayOfMonth(year, 2); // Marzo = mes 2 (0-indexado)
  
  // Último domingo de octubre (fin horario de verano)
  const octoberLastSunday = getLastSundayOfMonth(year, 9); // Octubre = mes 9 (0-indexado)
  
  // Verificar si la fecha está entre el último domingo de marzo y el último domingo de octubre
  return date >= marchLastSunday && date < octoberLastSunday;
}

/**
 * Obtiene el último domingo de un mes específico
 * @param year - Año
 * @param month - Mes (0-indexado: 0=enero, 1=febrero, etc.)
 * @returns Fecha del último domingo del mes
 */
function getLastSundayOfMonth(year: number, month: number): Date {
  // Obtener el último día del mes
  const lastDay = new Date(year, month + 1, 0);
  
  // Encontrar el último domingo
  const dayOfWeek = lastDay.getDay(); // 0=domingo, 1=lunes, etc.
  const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek; // Si es domingo, no restar nada
  
  const lastSunday = new Date(lastDay);
  lastSunday.setDate(lastDay.getDate() - daysToSubtract);
  
  return lastSunday;
}

/**
 * Calcula la hora de Colombia que coincide con medianoche europea
 * @param date - Fecha a verificar (opcional, usa fecha actual si no se proporciona)
 * @returns Hora en formato HH:MM (24h) en timezone Colombia
 */
export function getColombiaTimeForEuropeanMidnight(date: Date = new Date()): string {
  const isSummer = isEuropeanSummerTime(date);
  
  // Diferencia de horas:
  // - Invierno (CET): Colombia UTC-5, Europa UTC+1 = 6 horas de diferencia
  // - Verano (CEST): Colombia UTC-5, Europa UTC+2 = 7 horas de diferencia
  
  const hourOffset = isSummer ? 7 : 6;
  const colombiaHour = 24 - hourOffset; // 24:00 - offset = hora de Colombia del día anterior
  
  return `${colombiaHour.toString().padStart(2, '0')}:00`;
}

/**
 * Obtiene información completa del horario actual
 * @param date - Fecha a verificar (opcional, usa fecha actual si no se proporciona)
 * @returns Objeto con información detallada del horario
 */
export function getTimezoneInfo(date: Date = new Date()) {
  const isSummer = isEuropeanSummerTime(date);
  const colombiaTime = getColombiaTimeForEuropeanMidnight(date);
  
  return {
    isEuropeanSummerTime: isSummer,
    europeanTimezone: isSummer ? 'CEST (UTC+2)' : 'CET (UTC+1)',
    colombiaTimezone: 'COT (UTC-5)',
    hourDifference: isSummer ? 7 : 6,
    colombiaTimeForEuropeanMidnight: colombiaTime,
    description: isSummer 
      ? `Verano europeo: Medianoche Europa = ${colombiaTime} Colombia (día anterior)`
      : `Invierno europeo: Medianoche Europa = ${colombiaTime} Colombia (día anterior)`
  };
}

/**
 * Genera el cron schedule para Vercel basado en el horario actual
 * @param date - Fecha a verificar (opcional, usa fecha actual si no se proporciona)
 * @returns Schedule en formato cron para Vercel
 */
export function getCronScheduleForEuropeanMidnight(date: Date = new Date()): string {
  const colombiaTime = getColombiaTimeForEuropeanMidnight(date);
  const [hour] = colombiaTime.split(':').map(Number);
  
  // Para cierres quincenales: días 15 y 30 a la hora calculada
  return `0 ${hour} 15,30 * *`;
}

// Ejemplos de uso:
if (require.main === module) {
  console.log('🕐 Información de Timezone:');
  console.log(getTimezoneInfo());
  console.log('\n📅 Schedule para Vercel:');
  console.log(getCronScheduleForEuropeanMidnight());
}
