import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

// Helper para verificar permisos de admin
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
    return null;
  }

  return user;
}

// POST: Crear deducción
export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { model_id, period_date, period_type, concept, amount } = body;

    if (!model_id || !period_date || !period_type || !concept || amount === undefined) {
      return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calculator_deductions')
      .insert({
        model_id,
        period_date,
        period_type,
        concept,
        amount: Number(amount),
        created_by: adminUser.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, deduction: data });
  } catch (error: any) {
    console.error('❌ [DEDUCTIONS] Error creating:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Actualizar deducción
export async function PUT(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, concept, amount } = body;

    if (!id || !concept || amount === undefined) {
      return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calculator_deductions')
      .update({
        concept,
        amount: Number(amount),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, deduction: data });
  } catch (error: any) {
    console.error('❌ [DEDUCTIONS] Error updating:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Eliminar deducción
export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await verifyAdmin(request);
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('calculator_deductions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [DEDUCTIONS] Error deleting:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

