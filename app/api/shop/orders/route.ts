import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role, group_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });

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

  // Filtro por rol
  if (profile.role === 'modelo') {
    query = query.eq('model_id', user.id);
  } else if (profile.role === 'admin') {
    // Admin ve pedidos de sus modelos
    const { data: groupModels } = await supabase
      .from('users')
      .select('id')
      .eq('group_id', profile.group_id)
      .eq('role', 'modelo');
    const modelIds = (groupModels || []).map((m: { id: string }) => m.id);
    if (modelIds.length > 0) {
      query = query.in('model_id', modelIds);
    } else {
      return NextResponse.json([]);
    }
  }
  // super_admin ve todos

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
