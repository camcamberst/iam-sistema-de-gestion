import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Solo admins pueden prorrogar cuotas' }, { status: 403 });
  }

  const { data: installment } = await supabase
    .from('shop_financing_installments')
    .select('id, status, prorogued_count, financing_id')
    .eq('id', params.id)
    .single();

  if (!installment) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 });
  if (installment.status !== 'pendiente') {
    return NextResponse.json({ error: 'Solo se pueden prorrogar cuotas pendientes' }, { status: 400 });
  }

  // Buscar siguiente período disponible
  const { data: nextPeriod } = await supabase
    .from('periods')
    .select('id, start_date')
    .in('status', ['upcoming', 'active'])
    .order('start_date', { ascending: true })
    .limit(2);

  // Seleccionar un período diferente al actual
  const current = await supabase
    .from('shop_financing_installments')
    .select('period_id')
    .eq('id', params.id)
    .single();

  const targetPeriod = (nextPeriod || []).find(p => p.id !== current.data?.period_id);

  const { data: updated, error } = await supabase
    .from('shop_financing_installments')
    .update({
      status: 'prorrogada',
      prorogued_count: installment.prorogued_count + 1,
      period_id: targetPeriod?.id || null
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
