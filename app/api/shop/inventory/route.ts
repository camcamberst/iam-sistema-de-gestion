import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, canManageShopResource, getStudioScope } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['admin', 'super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get('product_id');
  const locationType = url.searchParams.get('location_type');
  const locationId = url.searchParams.get('location_id');

  let query = supabase
    .from('shop_inventory')
    .select(`
      *,
      shop_products!inner(id, name, base_price, images, min_stock_alert, affiliate_studio_id),
      shop_product_variants(id, name, sku)
    `);

  if (productId) query = (query as any).eq('product_id', productId);
  if (locationType) query = (query as any).eq('location_type', locationType);
  if (locationId) query = (query as any).eq('location_id', locationId);

  // Filtrar por negocio a través del producto relacionado (sin excepciones)
  const scope = getStudioScope(user);
  if (scope === null) {
    query = (query as any).is('shop_products.affiliate_studio_id', null);
  } else {
    query = (query as any).eq('shop_products.affiliate_studio_id', scope);
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
  const { product_id, variant_id, location_type, location_id, quantity_delta } = body;

  if (!product_id || !location_type || quantity_delta === undefined) {
    return NextResponse.json({ error: 'product_id, location_type y quantity_delta son requeridos' }, { status: 400 });
  }

  // Verificar que el producto pertenece al mismo negocio
  const { data: product } = await supabase
    .from('shop_products')
    .select('name, min_stock_alert, affiliate_studio_id')
    .eq('id', product_id)
    .single();

  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  if (!canManageShopResource(user, product.affiliate_studio_id ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el inventario de este producto' }, { status: 403 });
  }

  // Upsert inventory
  const matchCondition = {
    product_id,
    location_type,
    location_id: location_id || null,
    ...(variant_id ? { variant_id } : {})
  };

  const { data: existing } = await supabase
    .from('shop_inventory')
    .select('id, quantity, reserved')
    .eq('product_id', product_id)
    .eq('location_type', location_type)
    .eq('location_id', location_id || null)
    .is('variant_id', variant_id || null)
    .maybeSingle();

  let result;
  if (existing) {
    const newQty = existing.quantity + quantity_delta;
    if (newQty < 0) return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    const { data, error } = await supabase
      .from('shop_inventory')
      .update({ quantity: newQty })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  } else {
    if (quantity_delta < 0) return NextResponse.json({ error: 'Stock insuficiente' }, { status: 400 });
    const { data, error } = await supabase
      .from('shop_inventory')
      .insert({ product_id, variant_id: variant_id || null, location_type, location_id: location_id || null, quantity: quantity_delta })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  // Alerta de stock bajo — solo notifica admins del mismo negocio
  const available = result.quantity - (result.reserved || 0);
  if (available <= product.min_stock_alert) {
    notifyLowStock(
      product.name,
      available,
      location_type,
      location_id,
      product.affiliate_studio_id ?? null
    ).catch(console.error);
  }

  return NextResponse.json(result);
}

async function notifyLowStock(
  productName: string,
  available: number,
  locationType: string,
  locationId: string | null,
  affiliateStudioId: string | null
) {
  const { sendBotNotification } = await import('@/lib/chat/bot-notifications');

  let locationLabel: string;
  if (locationType === 'bodega') {
    locationLabel = 'Bodega Principal';
  } else if (locationId) {
    const { data: group } = await supabase
      .from('groups')
      .select('name')
      .eq('id', locationId)
      .maybeSingle();
    locationLabel = group?.name ? `Sede ${group.name}` : `Sede ${locationId}`;
  } else {
    locationLabel = 'Sede (sin especificar)';
  }

  // Solo notificar admins del MISMO negocio
  let adminsQuery = supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'super_admin', 'superadmin_aff'])
    .eq('is_active', true);

  if (affiliateStudioId === null) {
    adminsQuery = (adminsQuery as any).is('affiliate_studio_id', null);
  } else {
    adminsQuery = (adminsQuery as any).eq('affiliate_studio_id', affiliateStudioId);
  }

  const { data: admins } = await adminsQuery;
  if (!admins) return;

  const msg = `⚠️ **Alerta de stock bajo — Sexshop**\n\nEl producto **${productName}** tiene solo **${available} unidad(es)** disponible(s) en **${locationLabel}**.\n\nSe recomienda reabastecer pronto.`;

  for (const admin of admins) {
    await sendBotNotification(admin.id, 'custom_message' as never, msg);
  }
}
