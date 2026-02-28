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

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
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
    return NextResponse.json({ error: `Stock disponible insuficiente. Disponible: ${source.quantity - source.reserved}` }, { status: 400 });
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
    await supabase
      .from('shop_inventory')
      .insert({
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
  const url = new URL(req.url);
  const productId = url.searchParams.get('product_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = supabase
    .from('shop_stock_transfers')
    .select(`
      *,
      shop_products(id, name),
      shop_product_variants(id, name),
      users!transferred_by(id, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (productId) query = query.eq('product_id', productId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
