// =====================================================
// 🔐 SISTEMA DE PERMISOS GRANULARES - SMART HOME
// =====================================================
// Sistema avanzado de permisos y autorización
// =====================================================

export type Permission = 
  // Usuarios
  | 'admin.users.read'
  | 'admin.users.create'
  | 'admin.users.update'
  | 'admin.users.delete'
  | 'admin.users.activate'
  | 'admin.users.deactivate'
  
  // Grupos
  | 'admin.groups.read'
  | 'admin.groups.create'
  | 'admin.groups.update'
  | 'admin.groups.delete'
  | 'admin.groups.assign'
  | 'admin.groups.remove'
  
  // Roles
  | 'admin.roles.read'
  | 'admin.roles.create'
  | 'admin.roles.update'
  | 'admin.roles.delete'
  | 'admin.roles.assign'
  
  // Organización
  | 'admin.organization.read'
  | 'admin.organization.update'
  | 'admin.organization.settings'
  
  // Reportes
  | 'admin.reports.read'
  | 'admin.reports.export'
  | 'admin.reports.analytics'
  
  // Sistema
  | 'admin.system.logs'
  | 'admin.system.settings'
  | 'admin.system.backup'
  | 'admin.system.restore'
  
  // Auditoría
  | 'admin.audit.read'
  | 'admin.audit.export'
  
  // Modelos
  | 'modelo.profile.read'
  | 'modelo.profile.update'
  | 'modelo.sessions.read'
  | 'modelo.sessions.create'
  
  // Chatters
  | 'chatter.profile.read'
  | 'chatter.profile.update'
  | 'chatter.sessions.read'
  | 'chatter.sessions.create';

export type Role = 'super_admin' | 'admin' | 'modelo' | 'chatter';

export interface PermissionMatrix {
  [key: string]: Permission[];
}

// =====================================================
// 📊 MATRIZ DE PERMISOS POR ROL
// =====================================================

export const PERMISSION_MATRIX: PermissionMatrix = {
  super_admin: [
    // Todos los permisos
    'admin.users.read',
    'admin.users.create',
    'admin.users.update',
    'admin.users.delete',
    'admin.users.activate',
    'admin.users.deactivate',
    'admin.groups.read',
    'admin.groups.create',
    'admin.groups.update',
    'admin.groups.delete',
    'admin.groups.assign',
    'admin.groups.remove',
    'admin.roles.read',
    'admin.roles.create',
    'admin.roles.update',
    'admin.roles.delete',
    'admin.roles.assign',
    'admin.organization.read',
    'admin.organization.update',
    'admin.organization.settings',
    'admin.reports.read',
    'admin.reports.export',
    'admin.reports.analytics',
    'admin.system.logs',
    'admin.system.settings',
    'admin.system.backup',
    'admin.system.restore',
    'admin.audit.read',
    'admin.audit.export',
    'modelo.profile.read',
    'modelo.profile.update',
    'modelo.sessions.read',
    'modelo.sessions.create',
    'chatter.profile.read',
    'chatter.profile.update',
    'chatter.sessions.read',
    'chatter.sessions.create'
  ],
  
  admin: [
    'admin.users.read',
    'admin.users.create',
    'admin.users.update',
    'admin.users.activate',
    'admin.users.deactivate',
    'admin.groups.read',
    'admin.groups.create',
    'admin.groups.update',
    'admin.groups.assign',
    'admin.groups.remove',
    'admin.roles.read',
    'admin.organization.read',
    'admin.organization.update',
    'admin.reports.read',
    'admin.reports.export',
    'admin.audit.read',
    'modelo.profile.read',
    'modelo.sessions.read',
    'chatter.profile.read',
    'chatter.sessions.read'
  ],
  
  modelo: [
    'modelo.profile.read',
    'modelo.profile.update',
    'modelo.sessions.read',
    'modelo.sessions.create'
  ],
  
  chatter: [
    'chatter.profile.read',
    'chatter.profile.update',
    'chatter.sessions.read',
    'chatter.sessions.create'
  ]
};

// =====================================================
// 🔍 FUNCIONES DE VERIFICACIÓN DE PERMISOS
// =====================================================

export function hasPermission(userRole: Role, permission: Permission): boolean {
  const rolePermissions = PERMISSION_MATRIX[userRole] || [];
  return rolePermissions.includes(permission);
}

export function hasAnyPermission(userRole: Role, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: Role, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

export function getUserPermissions(userRole: Role): Permission[] {
  return PERMISSION_MATRIX[userRole] || [];
}

// =====================================================
// 🛡️ VERIFICACIÓN DE ACCESO A RECURSOS
// =====================================================

export interface ResourceAccess {
  resource: string;
  action: 'read' | 'create' | 'update' | 'delete';
  organizationId?: string;
  userId?: string;
}

export function canAccessResource(
  userRole: Role,
  userOrganizationId: string,
  resourceAccess: ResourceAccess
): boolean {
  const { resource, action, organizationId, userId } = resourceAccess;
  
  // Verificar permisos básicos
  const permission = `${resource}.${action}` as Permission;
  if (!hasPermission(userRole, permission)) {
    return false;
  }
  
  // Verificar acceso a organización
  if (organizationId && organizationId !== userOrganizationId) {
    // Solo super_admin puede acceder a otras organizaciones
    return userRole === 'super_admin';
  }
  
  // Verificar acceso a usuario específico
  if (userId && action !== 'create') {
    // Los usuarios solo pueden modificar su propio perfil (excepto super_admin y admin)
    if (userRole === 'modelo' || userRole === 'chatter') {
      // Esta verificación se haría con el ID del usuario autenticado
      // return userId === authenticatedUserId;
    }
  }
  
  return true;
}

// =====================================================
// 🔒 VERIFICACIÓN DE SEGURIDAD AVANZADA
// =====================================================

export interface SecurityContext {
  userRole: Role;
  organizationId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export function validateSecurityContext(context: SecurityContext): boolean {
  // Verificar que el rol sea válido
  if (!Object.keys(PERMISSION_MATRIX).includes(context.userRole)) {
    return false;
  }
  
  // Verificar que la organización sea válida (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(context.organizationId)) {
    return false;
  }
  
  // Verificar que el usuario sea válido (UUID)
  if (!uuidRegex.test(context.userId)) {
    return false;
  }
  
  // Verificar timestamp (no más de 1 hora de antigüedad)
  const now = new Date();
  const timeDiff = now.getTime() - context.timestamp.getTime();
  const oneHour = 60 * 60 * 1000;
  
  if (timeDiff > oneHour) {
    return false;
  }
  
  return true;
}

// =====================================================
// 📊 AUDITORÍA DE PERMISOS
// =====================================================

export interface PermissionAudit {
  userId: string;
  permission: Permission;
  granted: boolean;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export function createPermissionAudit(
  userId: string,
  permission: Permission,
  granted: boolean,
  context?: Partial<SecurityContext>
): PermissionAudit {
  return {
    userId,
    permission,
    granted,
    timestamp: new Date(),
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
    reason: granted ? 'Permission granted' : 'Permission denied'
  };
}

// =====================================================
// 🚀 UTILIDADES DE PERMISOS
// =====================================================

export function getRoleHierarchy(): Record<Role, number> {
  return {
    super_admin: 4,
    admin: 3,
    modelo: 2,
    chatter: 1
  };
}

export function canManageRole(managerRole: Role, targetRole: Role): boolean {
  const hierarchy = getRoleHierarchy();
  return hierarchy[managerRole] > hierarchy[targetRole];
}

export function getAvailableRoles(userRole: Role): Role[] {
  const hierarchy = getRoleHierarchy();
  const userLevel = hierarchy[userRole];
  
  return Object.entries(hierarchy)
    .filter(([_, level]) => level < userLevel)
    .map(([role, _]) => role as Role);
}

// =====================================================
// 🔐 MIDDLEWARE DE PERMISOS
// =====================================================

export function createPermissionMiddleware(requiredPermission: Permission) {
  return (userRole: Role, userOrganizationId: string, context?: Partial<SecurityContext>) => {
    // Verificar permiso básico
    if (!hasPermission(userRole, requiredPermission)) {
      return {
        allowed: false,
        reason: 'Insufficient permissions',
        audit: createPermissionAudit(
          context?.userId || 'unknown',
          requiredPermission,
          false,
          context
        )
      };
    }
    
    // Verificar contexto de seguridad
    if (context && !validateSecurityContext(context as SecurityContext)) {
      return {
        allowed: false,
        reason: 'Invalid security context',
        audit: createPermissionAudit(
          context.userId || 'unknown',
          requiredPermission,
          false,
          context
        )
      };
    }
    
    return {
      allowed: true,
      audit: createPermissionAudit(
        context?.userId || 'unknown',
        requiredPermission,
        true,
        context
      )
    };
  };
}
