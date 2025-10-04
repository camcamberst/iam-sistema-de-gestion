/**
 * 🕐 UTILIDADES DE FECHAS PARA CALCULADORA
 * 
 * Este módulo maneja las fechas específicamente para la calculadora,
 * usando el huso horario de Europa Central (Europe/Berlin).
 * 
 * El resto del sistema mantiene el huso horario de Colombia (America/Bogota).
 */

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD usando Europa Central
 * @returns Fecha en formato YYYY-MM-DD (Europa Central)
 */
export const getCalculatorDate = (): string => {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: 'Europe/Berlin' 
  });
};

/**
 * Obtiene la fecha y hora actual en formato ISO usando Europa Central
 * @returns Fecha y hora en formato ISO (Europa Central)
 */
export const getCalculatorDateTime = (): string => {
  return new Date().toLocaleString('sv-SE', { 
    timeZone: 'Europe/Berlin' 
  });
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
 * Convierte una fecha a formato YYYY-MM-DD usando Europa Central
 * @param date - Fecha a convertir
 * @returns Fecha en formato YYYY-MM-DD (Europa Central)
 */
export const formatCalculatorDate = (date: Date): string => {
  return date.toLocaleDateString('en-CA', { 
    timeZone: 'Europe/Berlin' 
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
 * Obtiene la fecha del siguiente día en Europa Central
 * @returns Fecha del siguiente día en formato YYYY-MM-DD
 */
export const getNextCalculatorDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatCalculatorDate(tomorrow);
};

/**
 * Crea un período automáticamente si no existe
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
  
  const targetDate = date || getCalculatorDate();
  
  try {
    // Verificar si existe período para la fecha
    const { data: existingPeriod, error: checkError } = await supabase
      .from('periods')
      .select('id, name, start_date, end_date, is_active')
      .eq('start_date', targetDate)
      .eq('end_date', targetDate)
      .eq('is_active', true)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ [CREATE-PERIOD] Error verificando período:', checkError);
      throw checkError;
    }
    
    if (existingPeriod) {
      console.log('✅ [CREATE-PERIOD] Período ya existe:', existingPeriod);
      return existingPeriod;
    }
    
    // Crear nuevo período
    console.log('🔄 [CREATE-PERIOD] Creando período para:', targetDate);
    
    const { data: newPeriod, error: createError } = await supabase
      .from('periods')
      .insert({
        name: `Período ${targetDate}`,
        start_date: targetDate,
        end_date: targetDate,
        is_active: true
      })
      .select()
      .single();
    
    if (createError) {
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