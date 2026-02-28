/**
 * Helpers de autenticación y scope para la Sexshop.
 * Aplica el mismo principio de "burbuja de datos" del resto del sistema.
 */

import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ShopUser {
  id: string;
  role: string;
  affiliate_studio_id: string | null;
}

/** Extrae y valida el usuario autenticado desde el header Authorization. */
export async function getShopUser(req: NextRequest): Promise<ShopUser | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, role, affiliate_studio_id')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;
  return profile as ShopUser;
}

/**
 * Retorna el affiliate_studio_id del negocio al que pertenece el usuario
 * en el contexto del shop. Cada negocio es una burbuja privada:
 *
 *   super_admin              → null  (Agencia Innova — solo ve su propio shop)
 *   admin de Innova          → null  (Agencia Innova)
 *   superadmin_aff           → su affiliate_studio_id (solo su estudio)
 *   admin de afiliado        → su affiliate_studio_id (solo su estudio)
 *   modelo de Innova         → null
 *   modelo de afiliado       → su affiliate_studio_id
 *
 * IMPORTANTE: incluso super_admin solo accede al shop de Innova.
 * El inventario de cada afiliado es privado y no visible desde Innova.
 */
export function getStudioScope(user: ShopUser): string | null {
  if (user.role === 'super_admin') return null;           // Innova
  if (user.role === 'admin' && !user.affiliate_studio_id) return null; // Innova
  return user.affiliate_studio_id ?? null;
}

/**
 * Aplica el filtro de burbuja a una query de Supabase sobre una tabla
 * que tiene la columna `affiliate_studio_id`.
 *
 * Todos los roles quedan estrictamente dentro de su propio negocio.
 * Nadie puede ver el shop de otro negocio, incluido el super_admin.
 */
export function applyShopAffiliateFilter(query: ReturnType<typeof supabase.from>, user: ShopUser) {
  const scope = getStudioScope(user);

  if (scope === null) {
    // Innova (super_admin, admin Innova, modelo Innova)
    return (query as any).is('affiliate_studio_id', null);
  }

  // Afiliado: solo su estudio
  return (query as any).eq('affiliate_studio_id', scope);
}

/**
 * Verifica que un usuario pueda gestionar un recurso del shop.
 * Cada negocio solo gestiona sus propios recursos.
 */
export function canManageShopResource(
  user: ShopUser,
  resourceAffiliateStudioId: string | null
): boolean {
  const scope = getStudioScope(user);

  // Mismo negocio → puede gestionar
  return scope === resourceAffiliateStudioId;
}
