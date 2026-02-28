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

async function getUserProfile(userId: string) {
  const { data } = await supabase
    .from('users')
    .select('role, group_id')
    .eq('id', userId)
    .single();
  return data;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const categoryId = url.searchParams.get('category_id');
  const activeOnly = url.searchParams.get('active_only') !== 'false';
  const withInventory = url.searchParams.get('with_inventory') === 'true';

  let query = supabase
    .from('shop_products')
    .select(`
      *,
      shop_categories(id, name),
      shop_product_variants(id, name, sku, price_delta, is_active)
    `)
    .order('name');

  if (activeOnly) query = query.eq('is_active', true);
  if (categoryId) query = query.eq('category_id', categoryId);

  const { data: products, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!withInventory) return NextResponse.json(products);

  // Agrega stock total visible por producto
  const { data: inventory } = await supabase
    .from('shop_inventory')
    .select('product_id, variant_id, quantity, reserved');

  const stockMap: Record<string, { available: number; reserved: number }> = {};
  for (const inv of inventory || []) {
    const key = inv.variant_id ? `${inv.product_id}__${inv.variant_id}` : inv.product_id;
    if (!stockMap[key]) stockMap[key] = { available: 0, reserved: 0 };
    stockMap[key].available += inv.quantity - inv.reserved;
    stockMap[key].reserved  += inv.reserved;
  }

  const productsWithStock = products!.map((p: Record<string, unknown>) => {
    const productStock = Object.entries(stockMap)
      .filter(([k]) => k === p.id || k.startsWith(`${p.id}__`))
      .reduce((acc, [, v]) => ({ available: acc.available + v.available, reserved: acc.reserved + v.reserved }), { available: 0, reserved: 0 });
    return { ...p, stock: productStock };
  });

  return NextResponse.json(productsWithStock);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Solo admins pueden crear productos' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, base_price, category_id, images, allow_financing, min_stock_alert, variants } = body;

  if (!name || base_price === undefined) {
    return NextResponse.json({ error: 'name y base_price son requeridos' }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from('shop_products')
    .insert({
      name,
      description,
      base_price,
      category_id,
      images: images || [],
      allow_financing: allow_financing !== false,
      min_stock_alert: min_stock_alert ?? 2,
      created_by: user.id
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insertar variantes si las hay
  if (variants && variants.length > 0) {
    const variantRows = variants.map((v: { name: string; sku?: string; price_delta?: number }) => ({
      product_id: product.id,
      name: v.name,
      sku: v.sku,
      price_delta: v.price_delta || 0
    }));
    await supabase.from('shop_product_variants').insert(variantRows);
  }

  return NextResponse.json(product, { status: 201 });
}
