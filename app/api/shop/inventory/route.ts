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

// GET: inventario por producto o por ubicación
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('product_id');
  const locationType = url.searchParams.get('location_type');
  const locationId = url.searchParams.get('location_id');

  let query = supabase
    .from('shop_inventory')
    .select(`
      *,
      shop_products(id, name, base_price, images, min_stock_alert),
      shop_product_variants(id, name, sku)
    `);

  if (productId) query = query.eq('product_id', productId);
  if (locationType) query = query.eq('location_type', locationType);
  if (locationId) query = query.eq('location_id', locationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: agregar o actualizar stock en una ubicación
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role, group_id')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const { product_id, variant_id, location_type, location_id, quantity_delta } = body;

  if (!product_id || !location_type || quantity_delta === undefined) {
    return NextResponse.json({ error: 'product_id, location_type y quantity_delta son requeridos' }, { status: 400 });
  }

  // Upsert inventory
  const { data: existing } = await supabase
    .from('shop_inventory')
    .select('id, quantity')
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
      .insert({
        product_id,
        variant_id: variant_id || null,
        location_type,
        location_id: location_id || null,
        quantity: quantity_delta
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = data;
  }

  // Alerta de stock bajo
  const { data: product } = await supabase
    .from('shop_products')
    .select('name, min_stock_alert')
    .eq('id', product_id)
    .single();

  if (product && result.quantity - result.reserved <= product.min_stock_alert) {
    // Notificar admins sobre stock bajo (asíncrono, no bloquea respuesta)
    notifyLowStock(product.name, result.quantity - result.reserved, location_type, location_id).catch(console.error);
  }

  return NextResponse.json(result);
}

async function notifyLowStock(productName: string, available: number, locationType: string, locationId: string | null) {
  const { sendBotNotification } = await import('@/lib/chat/bot-notifications');

  const adminQuery = supabase
    .from('users')
    .select('id, role, group_id')
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true);

  const { data: admins } = await adminQuery;
  if (!admins) return;

  const locationLabel = locationType === 'bodega' ? 'Bodega Principal' : `Sede ${locationId}`;
  const msg = `⚠️ **Alerta de stock bajo — Sexshop**\n\nEl producto **${productName}** tiene solo **${available} unidad(es)** disponible(s) en **${locationLabel}**.\n\nSe recomienda reabastecer pronto.`;

  for (const admin of admins) {
    await sendBotNotification(admin.id, 'custom_message' as never, msg);
  }
}
