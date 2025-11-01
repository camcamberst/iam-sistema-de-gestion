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
  
  // Obtener fecha de hoy en Europa Central
  const europeDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const europeDateStr = europeDateFormatter.format(now); // YYYY-MM-DD
  
  // Crear Date object que representa medianoche en Europa Central
  // Necesitamos crear un string ISO que JavaScript interprete correctamente
  // Usamos el formato: YYYY-MM-DDTHH:mm:ss+offset
  // Pero primero necesitamos saber qué hora es medianoche Europa Central en UTC
  
  // Método más simple: crear Date con string ISO usando timezone
  // JavaScript Date no soporta timezone en constructor, así que usamos otro enfoque
  
  // Calcular qué hora UTC corresponde a medianoche en Europa Central
  // Para esto, creamos una fecha "test" en medianoche Europa Central
  const testFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Obtener hora actual en Europa Central
  const parts = testFormatter.formatToParts(now);
  const europeParts: Record<string, string> = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      europeParts[part.type] = part.value;
    }
  });
  
  // Crear fecha ISO string para medianoche Europa Central
  const europeMidnightISO = `${europeParts.year}-${europeParts.month}-${europeParts.day}T00:00:00`;
  
  // Ahora necesitamos convertir esto a hora Colombia
  // Para esto, usamos el hecho de que JavaScript Date trabaja en UTC
  // Pero podemos usar una fecha "falsa" y luego calcular la diferencia
  
  // Método más directo: usar la API de tiempo para obtener offset
  // Crear un Date para medianoche en Europa Central
  const europeYear = parseInt(europeParts.year);
  const europeMonth = parseInt(europeParts.month) - 1; // 0-based
  const europeDay = parseInt(europeParts.day);
  
  // Crear Date en UTC que represente medianoche en Europa Central
  // Necesitamos saber el offset de Europa Central en ese momento
  const testDateUTC = new Date(Date.UTC(europeYear, europeMonth, europeDay, 0, 0, 0));
  
  // Calcular offset de Europa Central en ese momento
  const europeOffset = getEuropeCentralOffset(testDateUTC); // Horas desde UTC
  const europeMidnightUTC = new Date(Date.UTC(europeYear, europeMonth, europeDay, -europeOffset, 0, 0));
  
  // Colombia es UTC-5, así que restamos 5 horas
  const colombiaMidnight = new Date(europeMidnightUTC.getTime() - (5 * 3600000));
  
  // Formatear resultado
  const colombiaDate = colombiaMidnight.toLocaleDateString('en-CA', {
    timeZone: 'America/Bogota'
  });
  const colombiaTime = colombiaMidnight.toLocaleTimeString('en-US', {
    timeZone: 'America/Bogota',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return {
    colombiaTime: colombiaTime || '00:00:00',
    colombiaDate,
    colombiaDateTime: colombiaMidnight,
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
 * Verifica si es día de cierre (día 1 o 16)
 * @returns true si es día de cierre
 */
export const isClosureDay = (): boolean => {
  const colombiaDate = getColombiaDate();
  const day = parseInt(colombiaDate.split('-')[2]);
  
  return day === 1 || day === 16;
};

/**
 * Verifica si es día relevante para early freeze (día 1, 16, 31, o 15)
 * Esto incluye tanto los días de cierre como los días previos cuando puede activarse el early freeze
 * @returns true si es día relevante para early freeze
 */
export const isEarlyFreezeRelevantDay = (): boolean => {
  const colombiaDate = getColombiaDate();
  const day = parseInt(colombiaDate.split('-')[2]);
  
  return day === 1 || day === 16 || day === 31 || day === 15;
};

