/**
 * 🕐 UTILIDADES DE FECHAS UNIFICADAS
 * 
 * Sistema simplificado: TODO usa timezone de Colombia (America/Bogota)
 * Eliminamos el sistema híbrido que causaba problemas de inconsistencia.
 */

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando Colombia
 * @returns Fecha en formato YYYY-MM-DD (Colombia)
 * @deprecated Use getColombiaDate() instead
 */
export const getCalculatorDate = (): string => {
  // console.warn('⚠️ getCalculatorDate() is deprecated. Use getColombiaDate() instead.');
  return getColombiaDate();
};

/**
 * Obtiene la fecha y hora actual en formato ISO usando Colombia
 * @returns Fecha y hora en formato ISO (Colombia)
 * @deprecated Use getColombiaDateTime() instead
 */
export const getCalculatorDateTime = (): string => {
  // console.warn('⚠️ getCalculatorDateTime() is deprecated. Use getColombiaDateTime() instead.');
  return getColombiaDateTime();
};

/**
 * Obtiene la fecha de inicio del período actual basado en la fecha de Colombia
 * Retorna el día 1 o 16 del mes actual
 * @returns Fecha en formato YYYY-MM-DD
 */
export const getColombiaPeriodStartDate = (): string => {
  const colombiaDate = getColombiaDate();
  const [year, month, day] = colombiaDate.split('-').map(Number);
  
  const startDay = day <= 15 ? 1 : 16;
  return `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
};

/**
 * 🔧 NUEVO: Normaliza cualquier fecha (YYYY-MM-DD) a su fecha de inicio de período (1 o 16)
 * Útil para asegurar que guardamos/leemos del "bucket" correcto sin importar la fecha específica
 */
export const normalizeToPeriodStartDate = (dateStr: string): string => {
  try {
    // Validar formato básico YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.warn('⚠️ [DATE-UTILS] Formato de fecha inválido para normalizar:', dateStr);
      return getColombiaPeriodStartDate();
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return getColombiaPeriodStartDate();
    
    const startDay = day <= 15 ? 1 : 16;
    return `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  } catch (e) {
    console.error('❌ [DATE-UTILS] Error normalizando fecha:', e);
    return getColombiaPeriodStartDate();
  }
};

/**
 * Calcula el rango y nombre correcto de un período quincenal
 */
export const getPeriodDetails = (dateStr: string) => {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const isP1 = day <= 15;
    const startDate = `${year}-${String(month).padStart(2, '0')}-${isP1 ? '01' : '16'}`;
    
    let endDate = '';
    if (isP1) {
      endDate = `${year}-${String(month).padStart(2, '0')}-15`;
    } else {
      // Last day of month
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    }

    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const name = `${months[month - 1]} ${year} - Período ${isP1 ? '1' : '2'}`;

    return { startDate, endDate, name, isP1 };
  } catch (e) {
    console.error('❌ [DATE-UTILS] Error calculando detalles del período:', e);
    // Fallback safe
    return { startDate: dateStr, endDate: dateStr, name: `Período ${dateStr}`, isP1: true };
  }
};

/**
 * Obtiene la fecha de ayer en Colombia
 * @returns Fecha en formato YYYY-MM-DD
 */
export const getColombiaYesterday = (): string => {
  const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando Colombia
 * @returns Fecha en formato YYYY-MM-DD (Colombia)
 */
export const getSystemDate = (): string => {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando Colombia (America/Bogota)
 * Alias explícito para módulos fuera de calculadora (p.ej. Anticipos)
 */
export const getColombiaDate = (): string => {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Obtiene la fecha y hora actual en formato ISO usando Colombia
 * @returns Fecha y hora en formato ISO (Colombia)
 */
export const getColombiaDateTime = (): string => {
  return new Date().toLocaleString('sv-SE', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Convierte una fecha a formato YYYY-MM-DD usando Colombia
 * @param date - Fecha a convertir
 * @returns Fecha en formato YYYY-MM-DD (Colombia)
 */
export const formatCalculatorDate = (date: Date): string => {
  return date.toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Convierte una fecha a formato YYYY-MM-DD usando Colombia
 * @param date - Fecha a convertir
 * @returns Fecha en formato YYYY-MM-DD (Colombia)
 */
export const formatSystemDate = (date: Date): string => {
  return date.toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
};

/**
 * Obtiene el período actual de la calculadora (1-15 o 16-31)
 * @returns Objeto con información del período actual
 */
export const getCurrentCalculatorPeriod = () => {
  const today = new Date();
  const day = today.getDate();
  
  if (day >= 1 && day <= 15) {
    return {
      type: '1-15' as const,
      start: 1,
      end: 15,
      description: 'Período 1 (días 1-15)'
    };
  } else {
    return {
      type: '16-31' as const,
      start: 16,
      end: 31,
      description: 'Período 2 (días 16-31)'
    };
  }
};

/**
 * Verifica si una fecha está en el período 1 (días 1-15)
 * @param date - Fecha a verificar
 * @returns true si está en período 1, false si está en período 2
 */
export const isPeriod1 = (date: Date): boolean => {
  const day = date.getDate();
  return day >= 1 && day <= 15;
};

/**
 * Verifica si una fecha está en el período 2 (días 16-31)
 * @param date - Fecha a verificar
 * @returns true si está en período 2, false si está en período 1
 */
export const isPeriod2 = (date: Date): boolean => {
  const day = date.getDate();
  return day >= 16 && day <= 31;
};

/**
 * Obtiene la fecha de inicio del período actual
 * @returns Fecha de inicio del período actual
 */
export const getPeriodStartDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  
  const period = getCurrentCalculatorPeriod();
  const startDay = period.start;
  
  return `${year}-${month.toString().padStart(2, '0')}-${startDay.toString().padStart(2, '0')}`;
};

/**
 * Obtiene la fecha de fin del período actual
 * @returns Fecha de fin del período actual
 */
export const getPeriodEndDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  
  const period = getCurrentCalculatorPeriod();
  const endDay = period.end;
  
  return `${year}-${month.toString().padStart(2, '0')}-${endDay.toString().padStart(2, '0')}`;
};

/**
 * Obtiene la fecha del siguiente día en Colombia
 * @returns Fecha del siguiente día en formato YYYY-MM-DD (Colombia)
 */
export const getNextCalculatorDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatCalculatorDate(tomorrow);
};

/**
 * Crea un período automáticamente si no existe
 * 🔧 CORREGIDO: Ahora crea periodos quincenales (1-15, 16-End) y no diarios
 * @param date - Fecha del período (opcional, usa fecha actual si no se proporciona)
 * @returns Período creado o existente
 */
export const createPeriodIfNeeded = async (date?: string) => {
  const { createClient } = await import('@supabase/supabase-js');
  
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
  
  const targetDate = date || getColombiaDate();
  const { startDate, endDate, name } = getPeriodDetails(targetDate);
  
  try {
    console.log('🔍 [CREATE-PERIOD] Verificando período quincenal:', { targetDate, startDate, endDate, name });

    // 1. Verificar si existe período EXACTO (por nombre o fechas)
    const { data: existingPeriod, error: checkError } = await supabase
      .from('periods')
      .select('id, name, start_date, end_date, is_active')
      .or(`name.eq.${name},and(start_date.eq.${startDate},end_date.eq.${endDate})`)
      .eq('is_active', true)
      .maybeSingle(); // Usar maybeSingle para no lanzar error si hay 0
    
    if (checkError) {
      console.error('❌ [CREATE-PERIOD] Error verificando período:', checkError);
      throw checkError;
    }
    
    if (existingPeriod) {
      console.log('✅ [CREATE-PERIOD] Período quincenal ya existe:', existingPeriod.name);
      return existingPeriod;
    }
    
    // 2. Crear nuevo período QUINCENAL
    console.log('🔄 [CREATE-PERIOD] Creando período quincenal:', name);
    
    const { data: newPeriod, error: createError } = await supabase
      .from('periods')
      .insert({
        name: name,
        start_date: startDate,
        end_date: endDate,
        is_active: true
      })
      .select()
      .single();
    
    if (createError) {
      // Si falla por duplicado (race condition), intentamos buscarlo de nuevo
      if (createError.code === '23505') {
        console.log('⚠️ [CREATE-PERIOD] Race condition detectada, buscando periodo existente...');
        const { data: retryPeriod } = await supabase
          .from('periods')
          .select('*')
          .eq('name', name)
          .single();
        return retryPeriod;
      }
      console.error('❌ [CREATE-PERIOD] Error creando período:', createError);
      throw createError;
    }
    
    console.log('✅ [CREATE-PERIOD] Período creado exitosamente:', newPeriod);
    return newPeriod;
    
  } catch (error) {
    console.error('❌ [CREATE-PERIOD] Error en createPeriodIfNeeded:', error);
    throw error;
  }
};
