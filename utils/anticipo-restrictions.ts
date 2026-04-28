/**
 * 🚫 RESTRICCIONES TEMPORALES PARA ANTICIPOS
 * 
 * Las modelos no pueden solicitar anticipos:
 * - Del día de fin del mes anterior al 5 del mes siguiente
 * - Del 15 al 20 de cada mes
 * 
 * Huso horario: Colombia (America/Bogota)
 */

export interface AnticipoRestriction {
  allowed: boolean;
  reason?: string;
  nextAvailable?: Date;
}

/**
 * Valida si se puede solicitar un anticipo en la fecha actual
 * @returns Información sobre si está permitido y cuándo será la próxima fecha disponible
 */
export const canRequestAnticipo = (): AnticipoRestriction => {
  // Validación estricta sin bypass
  // Obtener fecha actual en Colombia
  const now = new Date();
  const colombiaDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  
  const day = colombiaDate.getDate();
  const month = colombiaDate.getMonth();
  const year = colombiaDate.getFullYear();
  
  console.log('🔍 [ANTICIPO-RESTRICTIONS] Validando fecha:', {
    colombiaDate: colombiaDate.toISOString(),
    day,
    month: month + 1, // getMonth() es 0-indexado
    year
  });
  
  // Restricción 1 corregida: Último día del mes actual o del 1 al 5 del mes
  const lastDayOfCurrentMonth = new Date(year, month + 1, 0).getDate();
  const isInFirstRestriction = day === lastDayOfCurrentMonth || day <= 5;
  
  // Restricción 2: Del 15 al 20 de cada mes
  const isInSecondRestriction = day >= 15 && day <= 20;
  
  console.log('🔍 [ANTICIPO-RESTRICTIONS] Validaciones:', {
    lastDayOfCurrentMonth,
    isInFirstRestriction,
    isInSecondRestriction
  });
  
  if (isInFirstRestriction || isInSecondRestriction) {
    // Calcular próxima fecha disponible
    let nextAvailable = new Date(colombiaDate);
    
    if (isInFirstRestriction) {
      // Si está en la primera restricción, próxima fecha es el 6 del mes actual
      nextAvailable.setDate(6);
    } else if (isInSecondRestriction) {
      // Si está en la segunda restricción, próxima fecha es el 21 del mes actual
      nextAvailable.setDate(21);
    }
    
    const reason = 'Servicio no disponible en cierres de periodo, puedes regresar después de pagos';
    
    console.log('🚫 [ANTICIPO-RESTRICTIONS] Solicitud bloqueada:', {
      reason,
      nextAvailable: nextAvailable.toISOString()
    });
    
    return {
      allowed: false,
      reason,
      nextAvailable
    };
  }
  
  console.log('✅ [ANTICIPO-RESTRICTIONS] Solicitud permitida');
  return { allowed: true };
};

/**
 * Obtiene información detallada sobre las restricciones actuales
 * @returns Información completa sobre restricciones
 */
export const getRestrictionInfo = () => {
  const restriction = canRequestAnticipo();
  const now = new Date();
  const colombiaDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  
  return {
    currentDate: colombiaDate,
    restriction,
    timezone: 'America/Bogota'
  };
};
