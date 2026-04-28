import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, getStudioScope } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = supabase
    .from('shop_orders')
    .select(`
      *,
      users!model_id(id, email),
      shop_order_items(
        id, quantity, unit_price, original_price, discount_applied,
        shop_products(id, name, images),
        shop_product_variants(id, name)
      ),
      shop_financing(id, installments, amount_per_installment, status)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (user.role === 'modelo') {
    // Modelo: solo sus propios pedidos
    query = (query as any).eq('model_id', user.id);
  } else {
    // Todos los admins (incluido super_admin) ven solo su propio negocio
    const scope = getStudioScope(user);

    if (scope === null) {
      // Innova (super_admin o admin Innova): pedidos con affiliate_studio_id IS NULL
      query = (query as any).is('affiliate_studio_id', null);

      // Admin de sede: filtra por modelos de sus grupos (via user_groups)
      if (user.role === 'admin' && !user.affiliate_studio_id) {
        const { data: userGroupRows } = await supabase
          .from('user_groups')
          .select('group_id')
          .eq('user_id', user.id);

        const adminGroupIds = (userGroupRows || []).map((r: { group_id: string }) => r.group_id);

        if (adminGroupIds.length > 0) {
          // Buscar modelos asignadas a esos grupos
          const { data: groupMemberRows } = await supabase
            .from('user_groups')
            .select('user_id, users!inner(role, affiliate_studio_id)')
            .in('group_id', adminGroupIds)
            .eq('users.role', 'modelo')
            .is('users.affiliate_studio_id', null);

          const modelIds = (groupMemberRows || []).map((r: { user_id: string }) => r.user_id);
          if (modelIds.length > 0) {
            query = (query as any).in('model_id', modelIds);
          } else {
            return NextResponse.json([]);
          }
        }
        // Si no tiene grupos asignados, ve todos los pedidos de Innova (ya filtrado por IS NULL)
      }
    } else {
      // Afiliado: solo su burbuja
      query = (query as any).eq('affiliate_studio_id', scope);
    }
  }

  if (status) query = (query as any).eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
