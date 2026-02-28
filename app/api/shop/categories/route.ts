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

  let query = supabase.from('shop_categories').select('*').order('name');

  if (user) {
    query = applyShopAffiliateFilter(query as any, user) as any;
  }
  // Sin token (storefront público de catálogo): el filtro se aplica en /api/shop/products

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.role !== 'super_admin' && user.role !== 'superadmin_aff') {
    return NextResponse.json({ error: 'Solo super admins pueden crear categorías' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: 'name requerido' }, { status: 400 });

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const scope = getStudioScope(user);

  const { data, error } = await supabase
    .from('shop_categories')
    .insert({ name, description, slug, created_by: user.id, affiliate_studio_id: scope })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await getShopUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.role !== 'super_admin' && user.role !== 'superadmin_aff') {
    return NextResponse.json({ error: 'Solo super admins pueden editar categorías' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, description, is_active } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  // Verificar que la categoría pertenece al mismo estudio
  const { data: cat } = await supabase
    .from('shop_categories')
    .select('affiliate_studio_id')
    .eq('id', id)
    .single();

  const scope = getStudioScope(user);
  if (user.role !== 'super_admin' && cat?.affiliate_studio_id !== scope) {
    return NextResponse.json({ error: 'No autorizado para esta categoría' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    updates.name = name;
    updates.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  if (description !== undefined) updates.description = description;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('shop_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
