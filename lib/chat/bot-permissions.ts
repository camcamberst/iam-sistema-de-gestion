// Bot Permissions - Sistema de permisos y límites por jerarquía
// ==============================================================

import type { UserContext } from './aim-botty';

export type BotCapability = 
  // Consultas analíticas
  | 'analytics_own_stats'
  | 'analytics_own_productivity'
  | 'analytics_group_stats'          // Admin: solo sus grupos
  | 'analytics_sede_stats'           // Super Admin: todas las sedes
  | 'analytics_system_wide'          // Super Admin: todo el sistema
  | 'analytics_comparison'
  | 'analytics_trends'
  | 'analytics_rankings'
  
  // Recomendaciones
  | 'recommendations_own_platforms'  // Solo plataformas del portafolio
  | 'recommendations_group'           // Admin: solo sus grupos
  | 'recommendations_system'           // Super Admin: todo
  
  // Configuración
  | 'config_view_own'                 // Ver su propia config
  | 'config_view_group'               // Admin: ver configs de sus grupos
  | 'config_view_all'                 // Super Admin: ver todas
  | 'config_edit_own'                 // ❌ MODELO NO TIENE
  | 'config_edit_group'               // Admin: editar configs de sus grupos
  | 'config_edit_all'                 // Super Admin: editar todas
  
  // Anticipos
  | 'anticipo_view_own'
  | 'anticipo_view_group'             // Admin: ver anticipos de sus grupos
  | 'anticipo_view_all'               // Super Admin: ver todos
  | 'anticipo_request'                // Solo modelo puede solicitar
  | 'anticipo_approve'                // Admin/Super Admin
  | 'anticipo_reject'                 // Admin/Super Admin
  
  // Recordatorios y alertas
  | 'notifications_receive'
  | 'notifications_configure'
  
  // Consultas de datos
  | 'query_own_data'
  | 'query_group_data'                // Admin: datos de sus grupos
  | 'query_all_data'                  // Super Admin: todos los datos
  | 'query_historical_own'
  | 'query_historical_group'
  | 'query_historical_all'
  
  // Acciones
  | 'action_request_anticipo'          // Solo modelo
  | 'action_cancel_own_anticipo'       // Solo modelo sus propios
  | 'action_modify_config'            // ❌ MODELO NO TIENE
  | 'action_export_own_data'
  | 'action_export_group_data'        // Admin
  | 'action_export_all_data';         // Super Admin

export interface RolePermissions {
  modelo: BotCapability[];
  admin: BotCapability[];
  super_admin: BotCapability[];
}

// Definición estricta de permisos por rol
export const ROLE_PERMISSIONS: RolePermissions = {
  modelo: [
    // Consultas analíticas - SOLO PROPIAS
    'analytics_own_stats',
    'analytics_own_productivity',
    'analytics_comparison',            // Solo comparar consigo misma
    'analytics_trends',                // Solo sus propias tendencias
    
    // Recomendaciones - SOLO SUS PLATAFORMAS
    'recommendations_own_platforms',
    
    // Configuración - SOLO LECTURA DE LA PROPIA
    'config_view_own',
    
    // Anticipos - SOLO PROPIOS
    'anticipo_view_own',
    'anticipo_request',
    'action_request_anticipo',
    'action_cancel_own_anticipo',
    
    // Recordatorios
    'notifications_receive',
    
    // Consultas - SOLO PROPIOS DATOS
    'query_own_data',
    'query_historical_own',
    
    // Acciones - SOLO PROPIAS
    'action_export_own_data',
  ],
  
  admin: [
    // Consultas analíticas - SUS GRUPOS
    'analytics_group_stats',
    'analytics_comparison',            // Dentro de sus grupos
    'analytics_trends',                // De sus grupos
    'analytics_rankings',              // De modelos en sus grupos
    
    // Recomendaciones - SUS GRUPOS
    'recommendations_group',
    
    // Configuración - SUS GRUPOS
    'config_view_group',
    'config_edit_group',
    
    // Anticipos - SUS GRUPOS
    'anticipo_view_group',
    'anticipo_approve',
    'anticipo_reject',
    
    // Recordatorios
    'notifications_receive',
    'notifications_configure',
    
    // Consultas - SUS GRUPOS
    'query_group_data',
    'query_historical_group',
    
    // Acciones - SUS GRUPOS
    'action_export_group_data',
  ],
  
  super_admin: [
    // Consultas analíticas - TODO EL SISTEMA
    'analytics_own_stats',
    'analytics_sede_stats',
    'analytics_system_wide',
    'analytics_comparison',
    'analytics_trends',
    'analytics_rankings',
    
    // Recomendaciones - TODO
    'recommendations_system',
    'recommendations_group',
    'recommendations_own_platforms',
    
    // Configuración - TODO
    'config_view_all',
    'config_edit_all',
    'config_edit_group',
    'config_view_own',
    
    // Anticipos - TODO
    'anticipo_view_all',
    'anticipo_approve',
    'anticipo_reject',
    
    // Recordatorios
    'notifications_receive',
    'notifications_configure',
    
    // Consultas - TODO
    'query_all_data',
    'query_historical_all',
    'query_own_data',
    
    // Acciones - TODO
    'action_export_all_data',
    'action_export_group_data',
    'action_export_own_data',
  ]
};

/**
 * Verificar si un usuario tiene un permiso específico
 */
export function hasPermission(
  userRole: 'super_admin' | 'admin' | 'modelo',
  capability: BotCapability
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(capability);
}

/**
 * Verificar permisos y lanzar error si no tiene acceso
 */
export function requirePermission(
  userRole: 'super_admin' | 'admin' | 'modelo',
  capability: BotCapability
): void {
  if (!hasPermission(userRole, capability)) {
    throw new Error(
      `No tienes permisos para realizar esta acción: ${capability}. ` +
      `Tu rol (${userRole}) no tiene acceso a esta funcionalidad.`
    );
  }
}

/**
 * Filtrar datos según rol - Asegura que modelo solo vea sus propios datos
 */
export function filterDataByRole<T extends { user_id?: string; model_id?: string; userId?: string }>(
  data: T[],
  userContext: UserContext,
  idField: 'user_id' | 'model_id' | 'userId' = 'user_id'
): T[] {
  if (userContext.role === 'super_admin') {
    return data; // Super admin ve todo
  }
  
  if (userContext.role === 'admin') {
    // Admin solo ve datos de sus grupos (esto se debe validar en la query, no aquí)
    // Por seguridad, si no hay grupos definidos, no devolver nada
    if (!userContext.groups || userContext.groups.length === 0) {
      return [];
    }
    // Nota: La validación real de grupos debe hacerse en la query de BD
    return data;
  }
  
  // Modelo: SOLO sus propios datos
  const fieldValue = data[0]?.[idField];
  const userId = userContext.userId;
  
  return data.filter(item => {
    const itemId = item[idField] || item.user_id || item.model_id || item.userId;
    return itemId === userId;
  });
}

/**
 * Verificar que un modelo solo accede a sus propias plataformas
 */
export function validatePlatformAccess(
  platformId: string,
  userContext: UserContext
): boolean {
  if (userContext.role === 'super_admin' || userContext.role === 'admin') {
    return true; // Admin y Super Admin pueden acceder a cualquier plataforma
  }
  
  // Modelo: SOLO plataformas de su portafolio
  if (!userContext.portfolio || userContext.portfolio.length === 0) {
    return false;
  }
  
  return userContext.portfolio.some(
    p => (p.platform_id === platformId || p.platform_name === platformId) && p.enabled
  );
}

/**
 * Obtener lista de plataformas permitidas para un usuario
 */
export function getAllowedPlatforms(
  userContext: UserContext
): string[] {
  if (userContext.role === 'super_admin' || userContext.role === 'admin') {
    // Admin y Super Admin pueden ver todas las plataformas
    // (en producción, esto podría venir de una tabla de plataformas)
    return []; // Array vacío = todas permitidas
  }
  
  // Modelo: SOLO sus plataformas habilitadas
  if (!userContext.portfolio || userContext.portfolio.length === 0) {
    return [];
  }
  
  return userContext.portfolio
    .filter(p => p.enabled)
    .map(p => p.platform_id || p.platform_name);
}

/**
 * Validar que una acción de configuración no sea ejecutada por modelo
 */
export function validateConfigAction(
  action: 'view' | 'edit',
  userContext: UserContext
): void {
  if (action === 'edit') {
    requirePermission(userContext.role, 'config_edit_own');
  } else {
    requirePermission(userContext.role, 'config_view_own');
  }
}

/**
 * Validar acceso a datos de otro usuario
 */
export function validateUserDataAccess(
  targetUserId: string,
  userContext: UserContext
): void {
  // Super Admin siempre tiene acceso
  if (userContext.role === 'super_admin') {
    return;
  }
  
  // Admin solo puede acceder a usuarios de sus grupos
  if (userContext.role === 'admin') {
    // Esta validación debe hacerse consultando la BD
    // Por ahora, lanzamos error si intenta acceder a otro usuario
    if (targetUserId !== userContext.userId) {
      throw new Error(
        'No tienes permisos para acceder a datos de otros usuarios. ' +
        'Solo puedes ver datos de modelos en tus grupos asignados.'
      );
    }
    return;
  }
  
  // Modelo: SOLO sus propios datos
  if (targetUserId !== userContext.userId) {
    throw new Error(
      'No tienes permisos para acceder a datos de otros usuarios. ' +
      'Solo puedes consultar tu propia información.'
    );
  }
}

/**
 * Mensaje de error amigable cuando no hay permisos
 */
export function getPermissionDeniedMessage(
  capability: BotCapability,
  userRole: string
): string {
  const messages: Record<string, string> = {
    'config_edit_own': 'Lo siento, no puedes modificar configuraciones. Solo los administradores pueden hacer cambios en porcentajes, objetivos y configuraciones del sistema.',
    'analytics_group_stats': 'No tienes acceso a estadísticas de grupos. Solo puedes ver tus propias estadísticas.',
    'analytics_sede_stats': 'No tienes acceso a estadísticas de sedes. Esta funcionalidad está disponible solo para super administradores.',
    'query_group_data': 'No puedes consultar datos de otros usuarios. Solo tienes acceso a tu propia información.',
    'recommendations_system': 'Las recomendaciones generales del sistema solo están disponibles para administradores. Puedo ayudarte con recomendaciones específicas sobre tus plataformas.',
  };
  
  return messages[capability] || 
    `Lo siento, tu rol (${userRole}) no tiene permisos para realizar esta acción. ` +
    `Por favor, contacta a tu administrador si necesitas acceso a esta funcionalidad.`;
}

/**
 * Verificar si puede recibir recomendaciones de una plataforma específica
 */
export function canRecommendPlatform(
  platformId: string,
  userContext: UserContext
): boolean {
  // Super Admin y Admin pueden recibir recomendaciones de cualquier plataforma
  if (userContext.role === 'super_admin' || userContext.role === 'admin') {
    return true;
  }
  
  // Modelo: SOLO si la plataforma está en su portafolio
  return validatePlatformAccess(platformId, userContext);
}

/**
 * Filtrar recomendaciones según rol
 */
export function filterRecommendationsByRole<T extends { platform_id?: string; platform?: string }>(
  recommendations: T[],
  userContext: UserContext
): T[] {
  if (userContext.role === 'super_admin' || userContext.role === 'admin') {
    return recommendations; // Admin ve todas
  }
  
  // Modelo: SOLO recomendaciones de SUS plataformas
  const allowedPlatforms = getAllowedPlatforms(userContext);
  
  return recommendations.filter(rec => {
    const platformId = rec.platform_id || rec.platform;
    if (!platformId) return false;
    return allowedPlatforms.includes(platformId);
  });
}



