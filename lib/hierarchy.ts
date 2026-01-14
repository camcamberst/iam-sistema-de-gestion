// =====================================================
// 🏗️ JERARQUÍA DE ROLES Y PERMISOS
// =====================================================
// Sistema de jerarquía para gestión de usuarios
// =====================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia';
  is_active: boolean;
  groups: Array<{
    id: string;
    name: string;
  }>;
}

export interface CurrentUser {
  id: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia' | 'superadmin_aff';
  groups: Array<{
    id: string;
    name: string;
  }>;
}

// =====================================================
// 🔐 VALIDACIONES DE JERARQUÍA
// =====================================================

/**
 * Verifica si un usuario puede asignar un rol específico
 */
export function canAssignRole(currentUser: CurrentUser, targetRole: string): boolean {
  // Super Admin puede asignar cualquier rol
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin solo puede asignar 'modelo' (no puede crear otros admins)
  if (currentUser.role === 'admin' && targetRole === 'modelo') {
    return true;
  }
  
  // Gestor y Fotografía pueden asignar roles de admin (pero NO modelos)
  if ((currentUser.role === 'gestor' || currentUser.role === 'fotografia') && 
      (targetRole === 'admin' || targetRole === 'super_admin')) {
    return true;
  }
  
  // Modelo no puede asignar roles
  return false;
}

/**
 * Verifica si un usuario puede asignar grupos específicos
 */
export function canAssignGroups(currentUser: CurrentUser, targetGroups: string[]): boolean {
  // Super Admin puede asignar cualquier grupo
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin puede asignar grupos de los que es miembro
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    return targetGroups.every(groupId => userGroupIds.includes(groupId));
  }
  
  // Gestor y Fotografía pueden asignar cualquier grupo (interactúan con todos los admins)
  if (currentUser.role === 'gestor' || currentUser.role === 'fotografia') {
    return true;
  }
  
  // Modelo no puede asignar grupos
  return false;
}

/**
 * Valida restricciones de grupos según rol
 */
export function validateGroupRestrictions(role: string, groupIds: string[]): { valid: boolean; error?: string } {
  // Super Admin: todos los grupos por defecto
  if (role === 'super_admin') {
    return { valid: true };
  }
  
  // Admin: mínimo un grupo
  if (role === 'admin') {
    if (groupIds.length === 0) {
      return { 
        valid: false, 
        error: 'Los administradores deben tener al menos un grupo asignado' 
      };
    }
    return { valid: true };
  }
  
  // Modelo: solo un grupo
  if (role === 'modelo') {
    if (groupIds.length > 1) {
      return { 
        valid: false, 
        error: 'Los modelos solo pueden estar en un grupo a la vez' 
      };
    }
    if (groupIds.length === 0) {
      return { 
        valid: false, 
        error: 'Los modelos deben tener al menos un grupo asignado' 
      };
    }
    return { valid: true };
  }
  
  // Gestor: no requiere grupos (interactúa con todos los admins)
  if (role === 'gestor') {
    return { valid: true };
  }
  
  // Fotografía: no requiere grupos (interactúa con todos los admins)
  if (role === 'fotografia') {
    return { valid: true };
  }
  
  return { valid: true };
}

/**
 * Verifica si un usuario puede transferir a otro usuario
 */
export function canTransferUser(currentUser: CurrentUser, targetUser: User): boolean {
  // Super Admin puede transferir a cualquiera
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin puede transferir modelos de sus grupos
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    const targetUserGroupIds = targetUser.groups.map(g => g.id);
    
    // Puede transferir si la modelo está en alguno de sus grupos
    return targetUser.role === 'modelo' && 
           targetUserGroupIds.some(groupId => userGroupIds.includes(groupId));
  }
  
  // Modelo no puede transferir
  return false;
}

/**
 * Obtiene grupos por defecto según rol
 */
export function getDefaultGroups(role: string, allGroups: Array<{ id: string; name: string }>): string[] {
  if (role === 'super_admin') {
    // Super Admin: todos los grupos
    return allGroups.map(g => g.id);
  }
  
  if (role === 'admin') {
    // Admin: al menos un grupo (se debe seleccionar manualmente)
    return [];
  }
  
  if (role === 'modelo') {
    // Modelo: un grupo (se debe seleccionar manualmente)
    return [];
  }
  
  if (role === 'gestor') {
    // Gestor: no requiere grupos (interactúa con todos los admins)
    return [];
  }
  
  if (role === 'fotografia') {
    // Fotografía: no requiere grupos (interactúa con todos los admins)
    return [];
  }
  
  return [];
}

/**
 * Verifica si un usuario puede editar a otro usuario
 * NOTA: El estado is_active NO afecta los permisos de edición.
 * Esto permite reactivar usuarios inactivos.
 */
export function canEditUser(currentUser: CurrentUser, targetUser: User): boolean {
  // Super Admin puede editar a cualquiera (activos o inactivos)
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin puede editar modelos de sus grupos (activos o inactivos)
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    // Asegurar que targetUser.groups existe y es un array
    const targetUserGroupIds = (targetUser.groups || []).map((g: any) => typeof g === 'string' ? g : g.id);
    
    console.log('🔍 [JERARQUÍA] Verificando permisos de edición:', {
      currentUserRole: currentUser.role,
      currentUserGroups: userGroupIds,
      targetUserRole: targetUser.role,
      targetUserGroups: targetUserGroupIds,
      targetUserIsActive: targetUser.is_active,
      canEdit: targetUser.role === 'modelo' && 
               (targetUserGroupIds.length === 0 || targetUserGroupIds.some(groupId => userGroupIds.includes(groupId)))
    });
    
    // Permitir editar si es modelo y:
    // 1. Tiene grupos en común con el admin, O
    // 2. No tiene grupos (para permitir reactivación y asignación de grupos)
    return targetUser.role === 'modelo' && 
           (targetUserGroupIds.length === 0 || targetUserGroupIds.some(groupId => userGroupIds.includes(groupId)));
  }
  
  // Gestor y Fotografía pueden editar admins (pero NO modelos)
  if (currentUser.role === 'gestor' || currentUser.role === 'fotografia') {
    return targetUser.role === 'admin' || targetUser.role === 'super_admin';
  }
  
  // Modelo no puede editar otros usuarios
  return false;
}

/**
 * Verifica si un usuario puede eliminar a otro usuario
 * NOTA: El estado is_active NO afecta los permisos de eliminación.
 * Esto permite eliminar usuarios inactivos si se tienen permisos.
 */
export function canDeleteUser(currentUser: CurrentUser, targetUser: User): boolean {
  // Super Admin puede eliminar a cualquiera (activos o inactivos)
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin puede eliminar modelos de sus grupos (activos o inactivos)
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    // Asegurar que targetUser.groups existe y es un array
    const targetUserGroupIds = (targetUser.groups || []).map((g: any) => typeof g === 'string' ? g : g.id);
    
    console.log('🔍 [JERARQUÍA] Verificando permisos de eliminación:', {
      currentUserRole: currentUser.role,
      currentUserGroups: userGroupIds,
      targetUserRole: targetUser.role,
      targetUserGroups: targetUserGroupIds,
      targetUserIsActive: targetUser.is_active,
      canDelete: targetUser.role === 'modelo' && 
                 (targetUserGroupIds.length === 0 || targetUserGroupIds.some(groupId => userGroupIds.includes(groupId)))
    });
    
    // Permitir eliminar si es modelo y:
    // 1. Tiene grupos en común con el admin, O
    // 2. No tiene grupos (para permitir eliminación de usuarios sin grupos)
    return targetUser.role === 'modelo' && 
           (targetUserGroupIds.length === 0 || targetUserGroupIds.some(groupId => userGroupIds.includes(groupId)));
  }
  
  // Gestor y Fotografía pueden eliminar admins (pero NO modelos)
  if (currentUser.role === 'gestor' || currentUser.role === 'fotografia') {
    return targetUser.role === 'admin' || targetUser.role === 'super_admin';
  }
  
  // Modelo no puede eliminar otros usuarios
  return false;
}

/**
 * Obtiene grupos disponibles para asignar según el usuario actual
 */
export function getAvailableGroups(currentUser: CurrentUser, allGroups: Array<{ id: string; name: string }>): Array<{ id: string; name: string }> {
  // Super Admin puede asignar cualquier grupo
  if (currentUser.role === 'super_admin') {
    return allGroups;
  }
  
  // Admin solo puede asignar grupos de los que es miembro
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    return allGroups.filter(group => userGroupIds.includes(group.id));
  }
  
  // Gestor y Fotografía pueden asignar cualquier grupo (interactúan con todos los admins)
  if (currentUser.role === 'gestor' || currentUser.role === 'fotografia') {
    return allGroups;
  }
  
  // Modelo no puede asignar grupos
  return [];
}
