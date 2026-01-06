// =====================================================
// 🔐 PERMISOS ESPECÍFICOS PARA ESTUDIOS AFILIADOS
// =====================================================
// Validaciones adicionales para garantizar privacidad de datos
// =====================================================

import { AuthUser } from './filters';
import { canAccessAffiliateResource, isAffiliateUser, isInnovaUser } from './filters';

/**
 * Verificar si un usuario puede crear usuarios en un afiliado
 */
export function canCreateUserInAffiliate(
  user: AuthUser | null,
  targetAffiliateStudioId: string | null
): boolean {
  if (!user) {
    return false;
  }

  // Superadmin y admin de Innova pueden crear usuarios en cualquier afiliado
  if (user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id)) {
    return true;
  }

  // Superadmin_aff solo puede crear usuarios en su propio afiliado
  if (user.role === 'superadmin_aff') {
    return user.affiliate_studio_id === targetAffiliateStudioId;
  }

  // Admin de afiliado solo puede crear usuarios en su propio afiliado
  if (user.role === 'admin' && user.affiliate_studio_id) {
    return user.affiliate_studio_id === targetAffiliateStudioId;
  }

  return false;
}

/**
 * Verificar si un usuario puede gestionar sedes de un afiliado
 */
export function canManageSedesInAffiliate(
  user: AuthUser | null,
  targetAffiliateStudioId: string | null
): boolean {
  return canAccessAffiliateResource(user, targetAffiliateStudioId);
}

/**
 * Verificar si un usuario puede configurar rates de un afiliado
 */
export function canConfigureRatesInAffiliate(
  user: AuthUser | null,
  targetAffiliateStudioId: string | null
): boolean {
  if (!user) {
    return false;
  }

  // Superadmin y admin de Innova pueden configurar rates de cualquier afiliado
  if (user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id)) {
    return true;
  }

  // Superadmin_aff solo puede configurar rates de su propio afiliado
  if (user.role === 'superadmin_aff') {
    return user.affiliate_studio_id === targetAffiliateStudioId;
  }

  // Admin de afiliado solo puede configurar rates de su propio afiliado
  if (user.role === 'admin' && user.affiliate_studio_id) {
    return user.affiliate_studio_id === targetAffiliateStudioId;
  }

  return false;
}

/**
 * Verificar si un usuario puede ver la calculadora de un afiliado
 */
export function canViewCalculatorInAffiliate(
  user: AuthUser | null,
  targetAffiliateStudioId: string | null
): boolean {
  return canAccessAffiliateResource(user, targetAffiliateStudioId);
}

/**
 * Verificar si un usuario puede gestionar anticipos de un afiliado
 */
export function canManageAnticiposInAffiliate(
  user: AuthUser | null,
  targetAffiliateStudioId: string | null
): boolean {
  return canAccessAffiliateResource(user, targetAffiliateStudioId);
}

/**
 * Verificar si un usuario puede crear/editar plataformas
 * 
 * Solo superadmin y admin de Innova pueden hacerlo
 */
export function canManagePlatforms(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  // Solo superadmin y admin de Innova pueden gestionar plataformas
  return user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id);
}

/**
 * Verificar si un usuario puede ver facturación de afiliados
 */
export function canViewAffiliateBilling(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  // Superadmin, admin de Innova y gestor pueden ver facturación de afiliados
  if (user.role === 'super_admin' || 
      (user.role === 'admin' && !user.affiliate_studio_id) ||
      user.role === 'gestor') {
    return true;
  }

  // Superadmin_aff solo puede ver facturación de su propio afiliado
  if (user.role === 'superadmin_aff') {
    return true; // Puede ver facturación de su afiliado
  }

  return false;
}

/**
 * Verificar si un usuario puede crear/editar estudios afiliados
 * 
 * Solo superadmin y admin de Innova pueden hacerlo
 */
export function canManageAffiliateStudios(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  // Solo superadmin y admin de Innova pueden gestionar estudios afiliados
  return user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id);
}

/**
 * Verificar si un usuario puede ver datos de otros afiliados
 */
export function canViewOtherAffiliates(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  // Solo superadmin y admin de Innova pueden ver otros afiliados
  return user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id);
}

/**
 * Obtener el contexto de permisos de afiliado para un usuario
 */
export interface AffiliatePermissions {
  canCreateUsers: boolean;
  canManageSedes: boolean;
  canConfigureRates: boolean;
  canViewCalculator: boolean;
  canManageAnticipos: boolean;
  canManagePlatforms: boolean;
  canViewBilling: boolean;
  canManageAffiliateStudios: boolean;
  canViewOtherAffiliates: boolean;
  isAffiliateUser: boolean;
  isInnovaUser: boolean;
  affiliateStudioId: string | null;
}

export function getAffiliatePermissions(
  user: AuthUser | null,
  targetAffiliateStudioId: string | null = null
): AffiliatePermissions {
  const userAffiliateId = user?.affiliate_studio_id || null;
  const targetId = targetAffiliateStudioId || userAffiliateId;

  return {
    canCreateUsers: canCreateUserInAffiliate(user, targetId),
    canManageSedes: canManageSedesInAffiliate(user, targetId),
    canConfigureRates: canConfigureRatesInAffiliate(user, targetId),
    canViewCalculator: canViewCalculatorInAffiliate(user, targetId),
    canManageAnticipos: canManageAnticiposInAffiliate(user, targetId),
    canManagePlatforms: canManagePlatforms(user),
    canViewBilling: canViewAffiliateBilling(user),
    canManageAffiliateStudios: canManageAffiliateStudios(user),
    canViewOtherAffiliates: canViewOtherAffiliates(user),
    isAffiliateUser: isAffiliateUser(user),
    isInnovaUser: isInnovaUser(user),
    affiliateStudioId: userAffiliateId
  };
}

