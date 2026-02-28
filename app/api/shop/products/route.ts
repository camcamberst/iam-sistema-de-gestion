import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, applyShopAffiliateFilter, getStudioScope } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getShopUser(req);
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

  if (activeOnly) query = (query as any).eq('is_active', true);
  if (categoryId) query = (query as any).eq('category_id', categoryId);

  // Aplicar filtro de burbuja si hay usuario autenticado
  if (user) {
    query = applyShopAffiliateFilter(query as any, user) as any;
  }
  // Sin token (catálogo público): no filtramos aquí — el storefront pasa su token

  const { data: products, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!withInventory) return NextResponse.json(products);

  // Agrega stock total visible (sum de todas las ubicaciones)
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
      .reduce(
        (acc, [, v]) => ({ available: acc.available + v.available, reserved: acc.reserved + v.reserved }),
        { available: 0, reserved: 0 }
      );
    return { ...p, stock: productStock };
  });

  return NextResponse.json(productsWithStock);
}

export async function POST(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['admin', 'super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'Solo admins pueden crear productos' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, base_price, category_id, images, allow_financing, min_stock_alert, variants } = body;

  if (!name || base_price === undefined) {
    return NextResponse.json({ error: 'name y base_price son requeridos' }, { status: 400 });
  }

  // Verificar que la categoría pertenece al mismo estudio
  if (category_id) {
    const { data: cat } = await supabase
      .from('shop_categories')
      .select('affiliate_studio_id')
      .eq('id', category_id)
      .single();

    const scope = getStudioScope(user);
    if (user.role !== 'super_admin' && cat?.affiliate_studio_id !== scope) {
      return NextResponse.json({ error: 'La categoría no pertenece a tu negocio' }, { status: 403 });
    }
  }

  const scope = getStudioScope(user);

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
      created_by: user.id,
      affiliate_studio_id: scope
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
