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
  group_id: string | null;
}

/** Extrae y valida el usuario autenticado desde el header Authorization. */
export async function getShopUser(req: NextRequest): Promise<ShopUser | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, affiliate_studio_id, group_id')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return profile as ShopUser;
}

/**
 * Retorna el affiliate_studio_id que se debe usar para filtrar / insertar
 * en la tienda, según el rol del usuario:
 *
 *   super_admin              → null  (Agencia Innova — bodega principal)
 *   admin de Innova          → null  (Agencia Innova)
 *   superadmin_aff           → su affiliate_studio_id
 *   admin de afiliado        → su affiliate_studio_id
 *   modelo de Innova         → null
 *   modelo de afiliado       → su affiliate_studio_id
 */
export function getStudioScope(user: ShopUser): string | null {
  if (user.role === 'super_admin') return null;
  if (user.role === 'admin' && !user.affiliate_studio_id) return null;
  return user.affiliate_studio_id ?? null;
}

/**
 * Aplica el filtro de burbuja a una query de Supabase sobre una tabla
 * que tiene la columna `affiliate_studio_id`.
 *
 * Reglas:
 *   super_admin        → sin filtro (ve todo)
 *   admin Innova       → solo NULL (Innova)
 *   superadmin_aff /
 *   admin afiliado     → solo su UUID
 *   modelo             → filtrado por su propio scope
 */
export function applyShopAffiliateFilter(query: ReturnType<typeof supabase.from>, user: ShopUser) {
  const scope = getStudioScope(user);

  if (user.role === 'super_admin') {
    return query; // ve todo: Innova + todos los afiliados
  }

  if (scope === null) {
    // Innova: affiliate_studio_id IS NULL
    return (query as any).is('affiliate_studio_id', null);
  }

  // Afiliado: affiliate_studio_id = su UUID
  return (query as any).eq('affiliate_studio_id', scope);
}

/** Verifica que un usuario admin/superadmin pueda gestionar un recurso del shop. */
export function canManageShopResource(
  user: ShopUser,
  resourceAffiliateStudioId: string | null
): boolean {
  if (user.role === 'super_admin') return true;

  const scope = getStudioScope(user);

  // Admin Innova solo gestiona recursos de Innova (affiliate_studio_id IS NULL)
  if (scope === null) return resourceAffiliateStudioId === null;

  // Admin/superadmin afiliado solo gestiona recursos de su estudio
  return resourceAffiliateStudioId === scope;
}
