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
  const { data, error } = await supabase
    .from('shop_categories')
    .select('*')
    .order('name');
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

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo el super admin puede crear categorías' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: 'name requerido' }, { status: 400 });

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const { data, error } = await supabase
    .from('shop_categories')
    .insert({ name, description, slug, created_by: user.id })
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

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Solo el super admin puede editar categorías' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, description, is_active } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

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
