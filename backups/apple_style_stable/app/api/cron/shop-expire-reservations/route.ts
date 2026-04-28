/**
 * Cron: expira reservas de pedidos que superaron 48 h sin aprobación.
 * Ejecutar cada hora vía vercel.json o equivalente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  const now = new Date().toISOString();

  // Pedidos reservados cuya reserva ya expiró
  const { data: expiredOrders, error } = await supabase
    .from('shop_orders')
    .select(`
      id, model_id, total, payment_mode,
      shop_order_items(product_id, variant_id, quantity, source_location_type, source_location_id)
    `)
    .eq('status', 'reservado')
    .lte('reservation_expires_at', now);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expiredOrders || expiredOrders.length === 0) {
    return NextResponse.json({ processed: 0, message: 'Sin reservas expiradas' });
  }

  let processed = 0;

  for (const order of expiredOrders) {
    // Liberar reserva de stock
    for (const item of order.shop_order_items || []) {
      if (!item.source_location_type) continue;
      const { data: inv } = await supabase
        .from('shop_inventory')
        .select('id, reserved')
        .eq('product_id', item.product_id)
        .eq('location_type', item.source_location_type)
        .eq('location_id', item.source_location_id || null)
        .is('variant_id', item.variant_id || null)
        .maybeSingle();

      if (inv) {
        await supabase.from('shop_inventory')
          .update({ reserved: Math.max(0, inv.reserved - item.quantity) })
          .eq('id', inv.id);
      }
    }

    // Marcar orden y financiación como expiradas
    await supabase.from('shop_orders').update({ status: 'expirado' }).eq('id', order.id);
    await supabase.from('shop_financing').update({ status: 'cancelado' }).eq('order_id', order.id);

    // Notificar modelo
    const { data: modelUser } = await supabase.from('users').select('id, email').eq('id', order.model_id).single();
    if (modelUser) {
      const msg = `⏰ **Reserva expirada — Sexshop**\n\nTu pedido por **$${order.total.toLocaleString('es-CO')}** no fue aprobado en 48 horas y ha sido cancelado automáticamente. El stock fue liberado.\n\nPuedes volver a realizar el pedido cuando gustes.`;
      await sendBotNotification(modelUser.id, 'custom_message' as never, msg);
    }

    processed++;
  }

  return NextResponse.json({ processed, message: `${processed} reserva(s) expirada(s) procesada(s)` });
}
