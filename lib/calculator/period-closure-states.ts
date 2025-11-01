/**
 * 🔄 ESTADOS Y TRANSICIONES DEL CIERRE DE PERÍODOS
 * 
 * Define los estados válidos del proceso de cierre y sus transiciones permitidas
 */

export type ClosureStatus = 
  | 'pending'
  | 'early_freezing'
  | 'closing_calculators'
  | 'waiting_summary'
  | 'closing_summary'
  | 'archiving'
  | 'completed'
  | 'failed';

export const VALID_TRANSITIONS: Record<ClosureStatus, ClosureStatus[]> = {
  pending: ['early_freezing', 'closing_calculators', 'failed'],
  early_freezing: ['closing_calculators', 'failed'],
  closing_calculators: ['waiting_summary', 'failed'],
  waiting_summary: ['closing_summary', 'failed'],
  closing_summary: ['archiving', 'failed'],
  archiving: ['completed', 'failed'],
  completed: [],
  failed: ['pending'] // Solo para retry manual
};

/**
 * Verifica si una transición de estado es válida
 */
export const isValidTransition = (
  from: ClosureStatus,
  to: ClosureStatus
): boolean => {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
};

/**
 * Obtiene la siguiente transición válida desde un estado
 */
export const getNextValidStates = (currentStatus: ClosureStatus): ClosureStatus[] => {
  return VALID_TRANSITIONS[currentStatus] || [];
};

/**
 * Descripción de cada estado para UI/logs
 */
export const STATUS_DESCRIPTIONS: Record<ClosureStatus, string> = {
  pending: 'Preparándose para cerrar',
  early_freezing: 'Congelando plataformas especiales',
  closing_calculators: 'Cerrando calculadoras',
  waiting_summary: 'Esperando última actualización del resumen',
  closing_summary: 'Cerrando resumen de facturación',
  archiving: 'Archivando período',
  completed: 'Cierre completado',
  failed: 'Error en el cierre'
};

