import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, canManageShopResource, getStudioScope } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['admin', 'super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json();
  const {
    product_id, variant_id,
    from_location_type, from_location_id,
    to_location_type, to_location_id,
    quantity, notes
  } = body;

  if (!product_id || !from_location_type || !to_location_type || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Datos de traslado incompletos' }, { status: 400 });
  }

  // Verificar que el producto pertenece al mismo negocio
  const { data: product } = await supabase
    .from('shop_products')
    .select('affiliate_studio_id')
    .eq('id', product_id)
    .single();

  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  if (!canManageShopResource(user, product.affiliate_studio_id ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para trasladar este producto' }, { status: 403 });
  }

  // Verificar stock disponible en origen
  const { data: source } = await supabase
    .from('shop_inventory')
    .select('id, quantity, reserved')
    .eq('product_id', product_id)
    .eq('location_type', from_location_type)
    .eq('location_id', from_location_id || null)
    .is('variant_id', variant_id || null)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: 'No hay inventario en el origen' }, { status: 400 });
  if (source.quantity - source.reserved < quantity) {
    return NextResponse.json({
      error: `Stock disponible insuficiente. Disponible: ${source.quantity - source.reserved}`
    }, { status: 400 });
  }

  // Descontar del origen
  const { error: deductError } = await supabase
    .from('shop_inventory')
    .update({ quantity: source.quantity - quantity })
    .eq('id', source.id);
  if (deductError) return NextResponse.json({ error: deductError.message }, { status: 500 });

  // Sumar al destino (upsert)
  const { data: dest } = await supabase
    .from('shop_inventory')
    .select('id, quantity')
    .eq('product_id', product_id)
    .eq('location_type', to_location_type)
    .eq('location_id', to_location_id || null)
    .is('variant_id', variant_id || null)
    .maybeSingle();

  if (dest) {
    await supabase
      .from('shop_inventory')
      .update({ quantity: dest.quantity + quantity })
      .eq('id', dest.id);
  } else {
    await supabase.from('shop_inventory').insert({
      product_id,
      variant_id: variant_id || null,
      location_type: to_location_type,
      location_id: to_location_id || null,
      quantity
    });
  }

  // Registrar traslado para trazabilidad
  const { data: transfer, error: tErr } = await supabase
    .from('shop_stock_transfers')
    .insert({
      product_id,
      variant_id: variant_id || null,
      from_location_type,
      from_location_id: from_location_id || null,
      to_location_type,
      to_location_id: to_location_id || null,
      quantity,
      notes,
      transferred_by: user.id
    })
    .select()
    .single();

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  return NextResponse.json(transfer, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const productId = url.searchParams.get('product_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = supabase
    .from('shop_stock_transfers')
    .select(`
      *,
      shop_products!inner(id, name, affiliate_studio_id),
      shop_product_variants(id, name),
      users!transferred_by(id, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (productId) query = (query as any).eq('product_id', productId);

  // Filtrar historial por negocio (sin excepciones)
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
