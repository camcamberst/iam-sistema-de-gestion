import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, applyShopAffiliateFilter, getStudioScope, canManageShopResource } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getShopUser(req);
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active_only') !== 'false';
  const now = new Date().toISOString();

  let query = supabase
    .from('shop_promotions')
    .select('*, shop_products(id, name), shop_categories(id, name)')
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = (query as any)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`);
  }

  if (user) {
    query = applyShopAffiliateFilter(query as any, user) as any;
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['admin', 'super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { name, type, value, product_id, category_id, min_quantity, starts_at, ends_at } = body;
  if (!name || !type) return NextResponse.json({ error: 'name y type son requeridos' }, { status: 400 });

  const scope = getStudioScope(user);

  const { data, error } = await supabase
    .from('shop_promotions')
    .insert({ name, type, value, product_id, category_id, min_quantity, starts_at, ends_at, created_by: user.id, affiliate_studio_id: scope })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['admin', 'super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const { data: promo } = await supabase
    .from('shop_promotions')
    .select('affiliate_studio_id')
    .eq('id', id)
    .single();

  if (!canManageShopResource(user, promo?.affiliate_studio_id ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para modificar esta promoción' }, { status: 403 });
  }

  const allowed = ['name','type','value','product_id','category_id','min_quantity','starts_at','ends_at','is_active'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  const { data, error } = await supabase
    .from('shop_promotions')
    .update(filtered)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
