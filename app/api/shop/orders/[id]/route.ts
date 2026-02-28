/**
 * Operaciones sobre un pedido individual:
 *   - GET: detalle completo
 *   - PUT: cambiar estado (aprobado, rechazado, en_preparacion, entregado, cancelado)
 */

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('shop_orders')
    .select(`
      *,
      users!model_id(id, email),
      shop_order_items(
        *,
        shop_products(id, name, images, base_price),
        shop_product_variants(id, name)
      ),
      shop_financing(
        *,
        shop_financing_installments(*)
      )
    `)
    .eq('id', params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('role, group_id')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });

  const body = await req.json();
  const { status } = body;

  // Obtener pedido actual
  const { data: order } = await supabase
    .from('shop_orders')
    .select(`
      *,
      shop_order_items(product_id, variant_id, quantity, source_location_type, source_location_id),
      shop_financing(id, installments, amount_per_installment, status, total_amount)
    `)
    .eq('id', params.id)
    .single();

  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

  const isAdmin = ['admin', 'super_admin'].includes(profile.role);
  const isModel = profile.role === 'modelo' && order.model_id === user.id;

  if (!isAdmin && !isModel) {
    return NextResponse.json({ error: 'No autorizado para modificar este pedido' }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status };

  // === APROBACIÓN (admin/superadmin) ===
  if (status === 'aprobado' && isAdmin) {
    if (order.status !== 'reservado') {
      return NextResponse.json({ error: 'Solo se pueden aprobar pedidos reservados' }, { status: 400 });
    }
    updates.approved_by = user.id;
    updates.approved_at = new Date().toISOString();
    updates.status = 'en_preparacion';

    // Convertir reserva en descontado real
    for (const item of order.shop_order_items) {
      if (!item.source_location_type) continue;
      const { data: inv } = await supabase
        .from('shop_inventory')
        .select('id, quantity, reserved')
        .eq('product_id', item.product_id)
        .eq('location_type', item.source_location_type)
        .eq('location_id', item.source_location_id || null)
        .is('variant_id', item.variant_id || null)
        .single();

      if (inv) {
        await supabase.from('shop_inventory').update({
          quantity: inv.quantity - item.quantity,
          reserved: Math.max(0, inv.reserved - item.quantity)
        }).eq('id', inv.id);
      }
    }

    // Actualizar financiación a aprobada + crear cuotas
    if (order.shop_financing?.[0]) {
      const fin = order.shop_financing[0];
      await supabase.from('shop_financing').update({ status: 'aprobado', approved_by: user.id, approved_at: new Date().toISOString() }).eq('id', fin.id);

      // Crear cuotas para los periodos futuros
      const { data: periods } = await supabase
        .from('periods')
        .select('id, start_date')
        .in('status', ['active', 'upcoming'])
        .order('start_date', { ascending: true })
        .limit(fin.installments);

      const installmentRows = [];
      for (let i = 0; i < fin.installments; i++) {
        installmentRows.push({
          financing_id: fin.id,
          installment_no: i + 1,
          period_id: periods?.[i]?.id || null,
          amount: fin.amount_per_installment,
          status: 'pendiente'
        });
      }
      await supabase.from('shop_financing_installments').insert(installmentRows);
    }

    // Notificar modelo
    const { sendBotNotification } = await import('@/lib/chat/bot-notifications');
    const { data: modelUser } = await supabase.from('users').select('id, email').eq('id', order.model_id).single();
    if (modelUser) {
      const msg = `✅ **Financiación aprobada — Sexshop**\n\nTu pedido ha sido aprobado y ya está en preparación. El cobro se realizará en ${order.payment_mode === '2q' ? '2' : order.payment_mode === '3q' ? '3' : '4'} quincenas.\n\nPedido ID: \`${order.id}\``;
      await sendBotNotification(modelUser.id, 'custom_message' as never, msg);
    }
  }

  // === RECHAZO (admin/superadmin) ===
  else if (status === 'rechazado' && isAdmin) {
    if (order.status !== 'reservado') {
      return NextResponse.json({ error: 'Solo se pueden rechazar pedidos reservados' }, { status: 400 });
    }
    updates.rejected_by = user.id;
    updates.rejected_at = new Date().toISOString();

    // Liberar reserva
    await reintegrarStock(order.shop_order_items, 'reserved');
    await supabase.from('shop_financing').update({ status: 'rechazado', rejected_by: user.id, rejected_at: new Date().toISOString() }).eq('order_id', order.id);

    // Notificar modelo
    const { sendBotNotification } = await import('@/lib/chat/bot-notifications');
    const { data: modelUser } = await supabase.from('users').select('id, email').eq('id', order.model_id).single();
    if (modelUser) {
      const msg = `❌ **Financiación no aprobada — Sexshop**\n\nTu solicitud de financiación fue rechazada por el administrador. El stock ha sido liberado.\n\nPedido ID: \`${order.id}\``;
      await sendBotNotification(modelUser.id, 'custom_message' as never, msg);
    }
  }

  // === ENTREGA (admin o modelo) ===
  else if (status === 'entregado') {
    if (order.status !== 'en_preparacion') {
      return NextResponse.json({ error: 'Solo se pueden entregar pedidos en preparación' }, { status: 400 });
    }
    updates.delivered_at = new Date().toISOString();
    updates.delivered_by = user.id;
  }

  // === CANCELACIÓN (modelo, solo si en_preparacion) ===
  else if (status === 'cancelado') {
    const allowedStatuses = isAdmin ? ['pendiente','reservado','en_preparacion'] : ['en_preparacion'];
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json({ error: 'No se puede cancelar este pedido en su estado actual' }, { status: 400 });
    }
    updates.cancelled_at = new Date().toISOString();
    updates.cancelled_by = user.id;

    if (order.status === 'reservado') {
      await reintegrarStock(order.shop_order_items, 'reserved');
    } else if (order.status === 'en_preparacion') {
      await reintegrarStock(order.shop_order_items, 'quantity');
    }

    // Cancelar financiación y reintegrar cuotas cobradas
    if (order.shop_financing?.[0]) {
      const fin = order.shop_financing[0];
      await supabase.from('shop_financing').update({ status: 'cancelado' }).eq('id', fin.id);
      // Marcar cuotas como reintegradas
      await supabase.from('shop_financing_installments')
        .update({ status: 'reintegrada' })
        .eq('financing_id', fin.id)
        .in('status', ['pendiente', 'cobrada']);
    }
  }

  else {
    return NextResponse.json({ error: `Transición de estado no permitida: ${status}` }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('shop_orders')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

async function reintegrarStock(
  items: Array<{ product_id: string; variant_id: string | null; quantity: number; source_location_type: string | null; source_location_id: string | null }>,
  field: 'quantity' | 'reserved'
) {
  for (const item of items) {
    if (!item.source_location_type) continue;
    const { data: inv } = await supabase
      .from('shop_inventory')
      .select('id, quantity, reserved')
      .eq('product_id', item.product_id)
      .eq('location_type', item.source_location_type)
      .eq('location_id', item.source_location_id || null)
      .is('variant_id', item.variant_id || null)
      .single();

    if (inv) {
      if (field === 'quantity') {
        await supabase.from('shop_inventory').update({ quantity: inv.quantity + item.quantity }).eq('id', inv.id);
      } else {
        await supabase.from('shop_inventory').update({ reserved: Math.max(0, inv.reserved - item.quantity) }).eq('id', inv.id);
      }
    }
  }
}
