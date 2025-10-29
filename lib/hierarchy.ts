// =====================================================
// 🏗️ JERARQUÍA DE ROLES Y PERMISOS
// =====================================================
// Sistema de jerarquía para gestión de usuarios
// =====================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'modelo';
  is_active: boolean;
  groups: Array<{
    id: string;
    name: string;
  }>;
}

export interface CurrentUser {
  id: string;
  role: 'super_admin' | 'admin' | 'modelo';
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
  
  return [];
}

/**
 * Verifica si un usuario puede editar a otro usuario
 */
export function canEditUser(currentUser: CurrentUser, targetUser: User): boolean {
  // Super Admin puede editar a cualquiera
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin puede editar modelos de sus grupos
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    const targetUserGroupIds = targetUser.groups.map(g => g.id);
    
    console.log('🔍 [JERARQUÍA] Verificando permisos de edición:', {
      currentUserRole: currentUser.role,
      currentUserGroups: userGroupIds,
      targetUserRole: targetUser.role,
      targetUserGroups: targetUserGroupIds,
      canEdit: targetUser.role === 'modelo' && 
               targetUserGroupIds.some(groupId => userGroupIds.includes(groupId))
    });
    
    return targetUser.role === 'modelo' && 
           targetUserGroupIds.some(groupId => userGroupIds.includes(groupId));
  }
  
  // Modelo no puede editar otros usuarios
  return false;
}

/**
 * Verifica si un usuario puede eliminar a otro usuario
 */
export function canDeleteUser(currentUser: CurrentUser, targetUser: User): boolean {
  // Super Admin puede eliminar a cualquiera
  if (currentUser.role === 'super_admin') {
    return true;
  }
  
  // Admin puede eliminar modelos de sus grupos
  if (currentUser.role === 'admin') {
    const userGroupIds = currentUser.groups.map(g => g.id);
    const targetUserGroupIds = targetUser.groups.map(g => g.id);
    
    console.log('🔍 [JERARQUÍA] Verificando permisos de eliminación:', {
      currentUserRole: currentUser.role,
      currentUserGroups: userGroupIds,
      targetUserRole: targetUser.role,
      targetUserGroups: targetUserGroupIds,
      canDelete: targetUser.role === 'modelo' && 
                 targetUserGroupIds.some(groupId => userGroupIds.includes(groupId))
    });
    
    return targetUser.role === 'modelo' && 
           targetUserGroupIds.some(groupId => userGroupIds.includes(groupId));
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
  
  // Modelo no puede asignar grupos
  return [];
}
