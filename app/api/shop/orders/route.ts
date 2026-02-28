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
    // Modelo solo ve sus propios pedidos
    query = (query as any).eq('model_id', user.id);
  } else if (user.role === 'super_admin') {
    // Super admin ve todo — sin filtro adicional
  } else {
    // Admin / superadmin_aff: filtra por su negocio
    const scope = getStudioScope(user);

    if (user.role === 'admin' && !user.affiliate_studio_id) {
      // Admin Innova: solo pedidos con affiliate_studio_id IS NULL
      query = (query as any).is('affiliate_studio_id', null);

      // Además, solo modelos de sus grupos
      const { data: groupModels } = await supabase
        .from('users')
        .select('id')
        .eq('group_id', user.group_id)
        .eq('role', 'modelo')
        .is('affiliate_studio_id', null);

      const modelIds = (groupModels || []).map((m: { id: string }) => m.id);
      if (modelIds.length > 0) {
        query = (query as any).in('model_id', modelIds);
      } else {
        return NextResponse.json([]);
      }
    } else if (scope) {
      // superadmin_aff / admin afiliado: solo su burbuja
      query = (query as any).eq('affiliate_studio_id', scope);
    }
  }

  if (status) query = (query as any).eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
