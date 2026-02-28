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
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active_only') !== 'false';
  const now = new Date().toISOString();

  let query = supabase
    .from('shop_promotions')
    .select(`*, shop_products(id, name), shop_categories(id, name)`)
    .order('created_at', { ascending: false });

  if (activeOnly) {
    query = query
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
  const { name, type, value, product_id, category_id, min_quantity, starts_at, ends_at } = body;

  if (!name || !type) return NextResponse.json({ error: 'name y type son requeridos' }, { status: 400 });

  const { data, error } = await supabase
    .from('shop_promotions')
    .insert({ name, type, value, product_id, category_id, min_quantity, starts_at, ends_at, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
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
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

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
