import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, canManageShopResource } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('shop_products')
    .select(`
      *,
      shop_categories(id, name),
      shop_product_variants(id, name, sku, price_delta, is_active),
      shop_inventory(id, location_type, location_id, quantity, reserved, variant_id)
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['admin', 'super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Verificar que el producto pertenece al mismo negocio
  const { data: product } = await supabase
    .from('shop_products')
    .select('affiliate_studio_id')
    .eq('id', params.id)
    .single();

  if (!canManageShopResource(user, product?.affiliate_studio_id ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para modificar este producto' }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ['name','description','base_price','category_id','images','allow_financing','min_stock_alert','is_active'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from('shop_products')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!['super_admin', 'superadmin_aff'].includes(user.role)) {
    return NextResponse.json({ error: 'Solo super admins pueden eliminar productos' }, { status: 403 });
  }

  const { data: product } = await supabase
    .from('shop_products')
    .select('affiliate_studio_id')
    .eq('id', params.id)
    .single();

  if (!canManageShopResource(user, product?.affiliate_studio_id ?? null)) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar este producto' }, { status: 403 });
  }

  const { error } = await supabase
    .from('shop_products')
    .update({ is_active: false })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
