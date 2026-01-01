/**
 * 🕐 UTILIDADES DE FECHAS PARA CIERRE DE PERÍODOS
 * 
 * Calcula medianoche Europa Central en hora Colombia y gestiona
 * los momentos de congelación y cierre de períodos.
 * 
 * IMPORTANTE: Todo se calcula en timezone Colombia (America/Bogota)
 */

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando Colombia
 */
export const getColombiaDate = (): string => {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Obtiene la fecha y hora actual en formato ISO usando Colombia
 */
export const getColombiaDateTime = (): string => {
  return new Date().toLocaleString('sv-SE', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Calcula la medianoche de Europa Central (Europe/Berlin) en hora Colombia
 * 
 * IMPORTANTE: Esta función calcula qué hora es en Colombia cuando es medianoche (00:00:00)
 * en Europa Central. Esto es aproximadamente 18:00-19:00 Colombia dependiendo del horario de verano.
 * 
 * @param date - Fecha de referencia (opcional, usa fecha actual si no se proporciona)
 * @returns Objeto con fecha/hora en Colombia y timestamp
 */
export const getEuropeanCentralMidnightInColombia = (date?: Date): {
  colombiaTime: string; // HH:MM:SS
  colombiaDate: string; // YYYY-MM-DD
  colombiaDateTime: Date;
  europeDate: string; // YYYY-MM-DD en Europa Central
} => {
  const now = date || new Date();
  
  // Obtener fecha actual en Europa Central
  const europeDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const europeDateStr = europeDateFormatter.format(now); // YYYY-MM-DD
  
  // Método simplificado y confiable:
  // 1. Crear un Date que represente medianoche en Europa Central
  // 2. Formatearlo en hora Colombia
  
  // Obtener componentes de fecha en Europa Central
  const europePartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const europeParts = europePartsFormatter.formatToParts(now);
  const partsMap: Record<string, string> = {};
  europeParts.forEach(part => {
    if (part.type !== 'literal') {
      partsMap[part.type] = part.value;
    }
  });
  
  // Crear un Date que represente medianoche en Europa Central
  // Usamos el método de encontrar el timestamp UTC que, cuando se formatea en Europa,
  // da medianoche (00:00:00)
  
  // Empezar con una estimación: medianoche UTC del día en Europa
  const testDate = new Date(`${partsMap.year}-${partsMap.month}-${partsMap.day}T00:00:00Z`);
  
  // Ajustar para encontrar el momento exacto de medianoche en Europa Central
  // Europa Central está a UTC+1 (invierno) o UTC+2 (verano)
  // Probamos ambos offsets
  let europeMidnightUTC: Date | null = null;
  
  for (const offset of [1, 2]) {
    // UTC+offset significa que medianoche Europa = (24-offset):00 UTC del día anterior
    const candidate = new Date(testDate.getTime() - (offset * 3600000));
    const europeTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(candidate);
    
    if (europeTime === '00:00:00') {
      europeMidnightUTC = candidate;
      break;
    }
  }
  
  // Si no encontramos, usar estimación basada en offset promedio
  if (!europeMidnightUTC) {
    // Offset promedio: 1.5 horas (entre UTC+1 y UTC+2)
    europeMidnightUTC = new Date(testDate.getTime() - (1.5 * 3600000));
  }
  
  // Formatear en hora Colombia
  const colombiaFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const colombiaParts = colombiaFormatter.formatToParts(europeMidnightUTC);
  const colombiaPartsMap: Record<string, string> = {};
  colombiaParts.forEach(part => {
    if (part.type !== 'literal') {
      colombiaPartsMap[part.type] = part.value;
    }
  });
  
  const colombiaTime = `${colombiaPartsMap.hour}:${colombiaPartsMap.minute}:${colombiaPartsMap.second}`;
  const colombiaDate = `${colombiaPartsMap.year}-${colombiaPartsMap.month}-${colombiaPartsMap.day}`;
  
  return {
    colombiaTime: colombiaTime || '00:00:00',
    colombiaDate,
    colombiaDateTime: europeMidnightUTC,
    europeDate: europeDateStr
  };
};

/**
 * Obtiene el offset de Europa Central en horas (considera DST)
 * @param date - Fecha de referencia
 * @returns Offset en horas (1 para invierno, 2 para verano)
 */
function getEuropeCentralOffset(date: Date): number {
  // Obtener la hora UTC y la hora en Europa Central para la misma fecha
  const utcHour = date.getUTCHours();
  
  // Crear formatter para Europa Central
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hour12: false
  });
  
  const europeHour = parseInt(formatter.format(date));
  
  // Calcular diferencia (considerando que puede cruzar medianoche)
  let offset = europeHour - utcHour;
  if (offset > 12) offset -= 24;
  if (offset < -12) offset += 24;
  
  return offset;
}

/**
 * Obtiene medianoche Colombia (00:00:00)
 * @param date - Fecha de referencia (opcional)
 * @returns Fecha/hora de medianoche en Colombia
 */
export const getColombiaMidnight = (date?: Date): {
  date: string; // YYYY-MM-DD
  datetime: Date;
  time: string; // HH:MM:SS
} => {
  const now = date || new Date();
  const colombiaDate = getColombiaDate();
  const midnight = new Date(`${colombiaDate}T00:00:00`);
  
  return {
    date: colombiaDate,
    datetime: midnight,
    time: '00:00:00'
  };
};

/**
 * Verifica si es momento de congelar plataformas especiales
 * (medianoche Europa Central)
 * @returns true si es momento de congelación anticipada
 */
export const isEarlyFreezeTime = (): boolean => {
  const now = new Date();
  const colombiaTime = getColombiaDateTime();
  const europeMidnight = getEuropeanCentralMidnightInColombia(now);
  
  // Comparar hora actual Colombia con hora de medianoche Europa Central en Colombia
  const [currentHour, currentMinute] = colombiaTime.split(' ')[1]?.split(':') || ['00', '00'];
  const [targetHour, targetMinute] = europeMidnight.colombiaTime.split(':');
  
  const currentTime = parseInt(currentHour) * 60 + parseInt(currentMinute);
  const targetTime = parseInt(targetHour) * 60 + parseInt(targetMinute);
  
  // Tolerancia de ±5 minutos
  const tolerance = 5;
  return Math.abs(currentTime - targetTime) <= tolerance;
};

/**
 * Verifica si es momento de cierre completo (00:00 Colombia)
 * @returns true si es medianoche en Colombia (con ventana amplia para cron jobs)
 */
export const isFullClosureTime = (): boolean => {
  const now = new Date();
  const colombiaTime = getColombiaDateTime();
  const [hour, minute] = colombiaTime.split(' ')[1]?.split(':') || ['00', '00'];
  
  const currentHour = parseInt(hour);
  const currentMinute = parseInt(minute);
  
  // Ventana amplia: desde 00:00 hasta 00:15 (15 minutos) para manejar retrasos del cron
  // Esto permite que el cron se ejecute aunque haya un pequeño retraso en Vercel
  const isWithinWindow = currentHour === 0 && currentMinute >= 0 && currentMinute <= 15;
  
  return isWithinWindow;
};

/**
 * Lista de 10 plataformas especiales que se congelan a medianoche Europa Central
 */
export const EARLY_FREEZE_PLATFORMS = [
  'superfoon',
  'livecreator',
  'mdh',
  '777',
  'xmodels',
  'big7',
  'mondo',
  'vx',
  'babestation',
  'dirtyfans'
] as const;

/**
 * Verifica si una plataforma es especial (se congela anticipadamente)
 * @param platformId - ID de la plataforma
 * @returns true si es plataforma especial
 */
export const isEarlyFreezePlatform = (platformId: string): boolean => {
  return EARLY_FREEZE_PLATFORMS.includes(platformId.toLowerCase() as any);
};

/**
 * Obtiene el período actual basado en el día
 * @returns Período: '1-15' o '16-31'
 */
export const getCurrentPeriodType = (): '1-15' | '16-31' => {
  const colombiaDate = getColombiaDate();
  const day = parseInt(colombiaDate.split('-')[2]);
  
  return day >= 1 && day <= 15 ? '1-15' : '16-31';
};

/**
 * Obtiene el período que se debe CERRAR cuando es día de cierre
 * IMPORTANTE: Al cerrar día 1, cerramos el período 16-31 del mes anterior
 *             Al cerrar día 16, cerramos el período 1-15 del mes actual
 * @returns { periodDate: string, periodType: '1-15' | '16-31' } - Fecha y tipo del período a cerrar
 */
export const getPeriodToClose = (): { periodDate: string; periodType: '1-15' | '16-31' } => {
  const colombiaDate = getColombiaDate();
  const [year, month, day] = colombiaDate.split('-').map(Number);
  
  if (day === 1) {
    // Día 1: cerrar período 16-31 del mes anterior
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate(); // Último día del mes anterior
    
    // Usar el último día del mes anterior como referencia para el período 16-31
    // Pero el period_date será el día 16 del mes anterior
    const periodDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-16`;
    
    return {
      periodDate,
      periodType: '16-31'
    };
  } else if (day === 16) {
    // Día 16: cerrar período 1-15 del mes actual
    const periodDate = `${year}-${String(month).padStart(2, '0')}-01`;
    
    return {
      periodDate,
      periodType: '1-15'
    };
  }
  
  // Fallback (no debería llegar aquí si se llama solo en días de cierre)
  return {
    periodDate: colombiaDate,
    periodType: day <= 15 ? '1-15' : '16-31'
  };
};

/**
 * Obtiene el período que INICIA después del cierre
 * @returns { periodDate: string, periodType: '1-15' | '16-31' } - Fecha y tipo del nuevo período
 */
export const getNewPeriodAfterClosure = (): { periodDate: string; periodType: '1-15' | '16-31' } => {
  const colombiaDate = getColombiaDate();
  const [year, month, day] = colombiaDate.split('-').map(Number);
  
  if (day === 1) {
    // Al cerrar día 1, inicia período 1-15 del mes actual
    return {
      periodDate: colombiaDate, // 2025-11-01
      periodType: '1-15'
    };
  } else if (day === 16) {
    // Al cerrar día 16, inicia período 16-31 del mes actual
    return {
      periodDate: colombiaDate, // 2025-11-16
      periodType: '16-31'
    };
  }
  
  // Fallback
  return {
    periodDate: colombiaDate,
    periodType: day <= 15 ? '1-15' : '16-31'
  };
};

/**
 * Verifica si es día de cierre (día 1 o 16)
 * @returns true si es día de cierre
 */
export const isClosureDay = (): boolean => {
  const colombiaDate = getColombiaDate();
  const day = parseInt(colombiaDate.split('-')[2]);
  
  return day === 1 || day === 16;
};

/**
 * Verifica si es día relevante para early freeze
 * IMPORTANTE: Solo se ejecuta el ÚLTIMO día de cada período:
 * - Día 15: último día del período 1-15 (P1)
 * - Día 31: último día del período 16-31 (P2)
 * 
 * El early freeze se ejecuta a medianoche Europa Central (aproximadamente 18:00-19:00 Colombia)
 * del último día de cada período, antes del cierre completo que ocurre a medianoche Colombia.
 * 
 * @returns true si es el último día de un período (15 o 31)
 */
export const isEarlyFreezeRelevantDay = (): boolean => {
  const colombiaDate = getColombiaDate();
  const day = parseInt(colombiaDate.split('-')[2]);
  
  // Solo días 15 y 31 (último día de cada período)
  return day === 15 || day === 31;
};

