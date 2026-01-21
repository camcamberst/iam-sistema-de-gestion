// =====================================================
// 🔍 FILTROS PARA ESTUDIOS AFILIADOS
// =====================================================
// Helpers para filtrar consultas por affiliate_studio_id
// Implementa el principio de "burbuja de datos"
// =====================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export interface AuthUser {
  id: string;
  role: string;
  affiliate_studio_id?: string | null;
}

/**
 * Obtener el affiliate_studio_id del usuario autenticado
 */
export async function getUserAffiliateStudioId(userId: string): Promise<string | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('users')
      .select('affiliate_studio_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.affiliate_studio_id;
  } catch (error) {
    console.error('❌ [AFFILIATES-FILTERS] Error obteniendo affiliate_studio_id:', error);
    return null;
  }
}

/**
 * Agregar filtro de afiliado a una query de Supabase
 * 
 * Reglas:
 * - super_admin: Sin filtro (ve todo: Innova + todos los afiliados)
 * - admin (de Innova): SOLO modelos de Innova (affiliate_studio_id IS NULL)
 * - superadmin_aff: Solo datos de su affiliate_studio_id
 * - admin (de afiliado): Solo datos de su affiliate_studio_id
 * - modelo: Solo sus propios datos (ya implementado en otras partes)
 */
export function addAffiliateFilter<T>(
  query: any,
  user: AuthUser | null
): any {
  if (!user) {
    // Si no hay usuario, no mostrar nada (seguridad por defecto)
    return query.eq('affiliate_studio_id', '00000000-0000-0000-0000-000000000000'); // UUID inválido
  }

  // Super admin ve TODO (Innova + todos los afiliados)
  if (user.role === 'super_admin') {
    return query; // Sin filtro - ve todo
  }

  // Admin de Innova SOLO ve modelos de Innova (sin affiliate_studio_id)
  if (user.role === 'admin' && !user.affiliate_studio_id) {
    return query.is('affiliate_studio_id', null); // Solo Innova
  }

  // Superadmin_aff y admin de afiliado solo ven su burbuja
  if (user.role === 'superadmin_aff' || (user.role === 'admin' && user.affiliate_studio_id)) {
    if (user.affiliate_studio_id) {
      return query.eq('affiliate_studio_id', user.affiliate_studio_id);
    }
    // Si no tiene affiliate_studio_id asignado, no mostrar nada
    return query.eq('affiliate_studio_id', '00000000-0000-0000-0000-000000000000');
  }

  // Para otros roles (modelo, gestor, etc.), no aplicar filtro de afiliado
  // (ya tienen sus propios filtros en otras partes)
  return query;
}

/**
 * Verificar si un usuario puede acceder a un recurso de un afiliado específico
 */
export function canAccessAffiliateResource(
  user: AuthUser | null,
  resourceAffiliateStudioId: string | null
): boolean {
  if (!user) {
    return false;
  }

  // Super admin puede acceder a todo (Innova + afiliados)
  if (user.role === 'super_admin') {
    return true;
  }

  // Si el recurso no tiene affiliate_studio_id (pertenece a Innova)
  if (!resourceAffiliateStudioId) {
    // Solo superadmin y admin de Innova pueden acceder a recursos de Innova
    return user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id);
  }

  // Si el recurso tiene affiliate_studio_id (pertenece a un afiliado)
  // Admin de Innova NO puede acceder a recursos de afiliados
  if (user.role === 'admin' && !user.affiliate_studio_id) {
    return false;
  }

  // Superadmin_aff y admin de afiliado solo pueden acceder a recursos de su afiliado
  if (user.role === 'superadmin_aff' || (user.role === 'admin' && user.affiliate_studio_id)) {
    return user.affiliate_studio_id === resourceAffiliateStudioId;
  }

  // Otros roles no pueden acceder a recursos de afiliados
  return false;
}

/**
 * Obtener lista de affiliate_studio_ids que el usuario puede ver
 * 
 * Retorna:
 * - null: Puede ver todo (super_admin)
 * - ['INNOVA']: Solo modelos de Innova (admin de Innova) - representado como array vacío para filtro .is(null)
 * - string[]: Lista de affiliate_studio_ids permitidos (afiliados)
 */
export function getAllowedAffiliateStudioIds(user: AuthUser | null): string[] | null {
  if (!user) {
    return [];
  }

  // Super admin puede ver todo (Innova + todos los afiliados)
  if (user.role === 'super_admin') {
    return null; // null = sin restricción (ver todo)
  }

  // Admin de Innova solo ve modelos de Innova (sin affiliate_studio_id)
  // Retornamos array vacío como señal especial para aplicar filtro .is(null)
  if (user.role === 'admin' && !user.affiliate_studio_id) {
    return []; // Array vacío = solo Innova
  }

  // Superadmin_aff y admin de afiliado solo ven su afiliado
  if (user.role === 'superadmin_aff' || (user.role === 'admin' && user.affiliate_studio_id)) {
    return user.affiliate_studio_id ? [user.affiliate_studio_id] : [];
  }

  // Otros roles no pueden ver afiliados
  return [];
}

/**
 * Construir filtro WHERE para consultas SQL directas
 */
export function buildAffiliateWhereClause(user: AuthUser | null, tableAlias: string = ''): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  if (!user) {
    return `${prefix}affiliate_studio_id = '00000000-0000-0000-0000-000000000000'`; // UUID inválido
  }

  // Super admin ve todo (Innova + afiliados)
  if (user.role === 'super_admin') {
    return '1=1'; // Sin restricción
  }

  // Admin de Innova solo ve modelos de Innova (sin affiliate_studio_id)
  if (user.role === 'admin' && !user.affiliate_studio_id) {
    return `${prefix}affiliate_studio_id IS NULL`;
  }

  // Superadmin_aff y admin de afiliado solo ven su burbuja
  if (user.role === 'superadmin_aff' || (user.role === 'admin' && user.affiliate_studio_id)) {
    if (user.affiliate_studio_id) {
      return `${prefix}affiliate_studio_id = '${user.affiliate_studio_id}'`;
    }
    return `${prefix}affiliate_studio_id = '00000000-0000-0000-0000-000000000000'`;
  }

  // Otros roles: no aplicar filtro de afiliado (ya tienen sus propios filtros)
  return '1=1';
}

/**
 * Verificar si un usuario pertenece a un afiliado
 */
export function isAffiliateUser(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  return user.role === 'superadmin_aff' || 
         (user.role === 'admin' && !!user.affiliate_studio_id) ||
         (user.role === 'modelo' && !!user.affiliate_studio_id);
}

/**
 * Verificar si un usuario es de Agencia Innova (no afiliado)
 */
export function isInnovaUser(user: AuthUser | null): boolean {
  if (!user) {
    return false;
  }

  return (user.role === 'super_admin' || 
          user.role === 'admin' && !user.affiliate_studio_id ||
          user.role === 'gestor' ||
          (user.role === 'modelo' && !user.affiliate_studio_id));
}

