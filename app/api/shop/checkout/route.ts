/**
 * Checkout de Sexshop
 * -------------------
 * Valida fondos, reserva stock, crea orden y financiación.
 * Pago-mode:
 *   1q → pago único esta quincena (aprobación automática si neto_disponible >= precio)
 *   2q/3q/4q → financiación multi-quincena (requiere aprobación admin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getShopUser, getStudioScope } from '@/lib/shop/auth';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Calcula el neto disponible de la modelo para el período activo
async function getNetoDisponible(modelId: string): Promise<number> {
  // Período activo — usa is_active (booleano), no status
  const { data: period } = await supabase
    .from('periods')
    .select('id, start_date, end_date')
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!period) return 0;

  // Facturado del período — tabla real: calculator_totals / total_cop_modelo
  const { data: totals } = await supabase
    .from('calculator_totals')
    .select('total_cop_modelo')
    .eq('model_id', modelId)
    .gte('period_date', period.start_date)
    .lte('period_date', period.end_date ?? period.start_date)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const facturado = Number(totals?.total_cop_modelo ?? 0);

  // Anticipos aprobados/realizados del período
  const { data: anticipos } = await supabase
    .from('anticipos')
    .select('monto_solicitado')
    .eq('model_id', modelId)
    .eq('period_id', period.id)
    .in('estado', ['aprobado', 'realizado', 'confirmado']);

  const anticiposTotal = (anticipos || []).reduce(
    (s: number, a: { monto_solicitado: number }) => s + Number(a.monto_solicitado || 0),
    0
  );

  // Cuotas de financiación sexshop pendientes en el período activo
  const { data: myFinancings } = await supabase
    .from('shop_financing')
    .select('id')
    .eq('model_id', modelId)
    .eq('status', 'aprobado');

  const financingIds = (myFinancings || []).map((f: { id: string }) => f.id);

  let installmentsTotal = 0;
  if (financingIds.length > 0) {
    const { data: installments } = await supabase
      .from('shop_financing_installments')
      .select('amount')
      .eq('period_id', period.id)
      .eq('status', 'pendiente')
      .in('financing_id', financingIds);
    installmentsTotal = (installments || []).reduce(
      (s: number, i: { amount: number }) => s + Number(i.amount || 0),
      0
    );
  }

  return facturado - anticiposTotal - installmentsTotal;
}

// Verifica si la modelo tiene financiaciones multi-quincena activas con cuotas pendientes
async function hasActiveMultiQuincenaFinancing(modelId: string): Promise<boolean> {
  const { data } = await supabase
    .from('shop_financing')
    .select('id')
    .eq('model_id', modelId)
    .in('status', ['pendiente', 'aprobado'])
    .gt('installments', 1)
    .limit(1);
  return (data || []).length > 0;
}

// Resuelve mejor precio con promoción (no acumulables)
async function applyBestPromotion(
  productId: string,
  categoryId: string | null,
  basePrice: number,
  quantity: number
): Promise<{ finalPrice: number; discount: number; promotionId: string | null }> {
  const now = new Date().toISOString();
  const { data: promos } = await supabase
    .from('shop_promotions')
    .select('*')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .or(`product_id.eq.${productId}${categoryId ? `,category_id.eq.${categoryId}` : ''}`);

  if (!promos || promos.length === 0) {
    return { finalPrice: basePrice, discount: 0, promotionId: null };
  }

  let bestFinalPrice = basePrice;
  let bestDiscount = 0;
  let bestPromoId: string | null = null;

  for (const promo of promos) {
    if (quantity < (promo.min_quantity || 1)) continue;
    let finalPrice = basePrice;
    if (promo.type === 'percentage') {
      finalPrice = basePrice * (1 - (promo.value || 0) / 100);
    } else if (promo.type === 'fixed') {
      finalPrice = Math.max(0, basePrice - (promo.value || 0));
    } else if (promo.type === '2x1' && quantity >= 2) {
      finalPrice = basePrice / 2;
    } else if (promo.type === 'category' && promo.category_id === categoryId) {
      finalPrice = basePrice * (1 - (promo.value || 0) / 100);
    }
    const disc = basePrice - finalPrice;
    if (disc > bestDiscount) {
      bestDiscount = disc;
      bestFinalPrice = finalPrice;
      bestPromoId = promo.id;
    }
  }

  return { finalPrice: bestFinalPrice, discount: bestDiscount, promotionId: bestPromoId };
}

export async function POST(req: NextRequest) {
  const shopUser = await getShopUser(req);
  if (!shopUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (shopUser.role !== 'modelo') {
    return NextResponse.json({ error: 'Solo las modelos pueden hacer pedidos' }, { status: 403 });
  }

  // Perfil de la modelo (email y scope para notificaciones)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role, email, affiliate_studio_id')
    .eq('id', shopUser.id)
    .single();

  if (profileError || !profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 });

  // Scope del negocio de la modelo
  const modelScope = profile.affiliate_studio_id ?? null;

  const body = await req.json();
  const { items, payment_mode, notes } = body;

  // items: [{ product_id, variant_id?, quantity }]
  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
  }
  if (!['1q','2q','3q','4q'].includes(payment_mode)) {
    return NextResponse.json({ error: 'Modo de pago inválido' }, { status: 400 });
  }

  const isMultiQuincena = payment_mode !== '1q';

  // Regla: si tiene financiación multi-quincena activa, no puede pedir nueva
  if (isMultiQuincena) {
    const hasPending = await hasActiveMultiQuincenaFinancing(shopUser.id);
    if (hasPending) {
      return NextResponse.json({
        error: 'Tienes financiaciones activas pendientes. Debes completarlas antes de solicitar nueva financiación.'
      }, { status: 400 });
    }
  }

  // Resolver productos y calcular total
  const orderItems: Array<{
    product_id: string;
    variant_id: string | null;
    quantity: number;
    unit_price: number;
    original_price: number;
    discount_applied: number;
    promotion_id: string | null;
    source_location_type: string | null;
    source_location_id: string | null;
  }> = [];

  let subtotal = 0;
  let totalDiscount = 0;

  for (const item of items) {
    const { data: product } = await supabase
      .from('shop_products')
      .select('id, name, base_price, category_id, allow_financing, is_active, affiliate_studio_id')
      .eq('id', item.product_id)
      .single();

    if (!product || !product.is_active) {
      return NextResponse.json({ error: `Producto no disponible: ${item.product_id}` }, { status: 400 });
    }

    // Validar que el producto pertenece al mismo negocio que la modelo
    if ((product.affiliate_studio_id ?? null) !== modelScope) {
      return NextResponse.json({
        error: `El producto "${product.name}" no pertenece a tu tienda.`
      }, { status: 403 });
    }

    if (!product.allow_financing && isMultiQuincena) {
      return NextResponse.json({ error: `El producto "${product.name}" es solo de contado (1 quincena)` }, { status: 400 });
    }

    // Precio con variante
    let basePrice = product.base_price;
    if (item.variant_id) {
      const { data: variant } = await supabase
        .from('shop_product_variants')
        .select('price_delta')
        .eq('id', item.variant_id)
        .single();
      if (variant) basePrice += variant.price_delta;
    }

    // Mejor promoción
    const { finalPrice, discount, promotionId } = await applyBestPromotion(
      product.id, product.category_id, basePrice, item.quantity
    );

    // Verificar stock disponible (agregado de todas las ubicaciones)
    const { data: invRows } = await supabase
      .from('shop_inventory')
      .select('id, quantity, reserved, location_type, location_id')
      .eq('product_id', product.id)
      .is('variant_id', item.variant_id || null);

    const totalAvailable = (invRows || []).reduce((s: number, r: { quantity: number; reserved: number }) => s + r.quantity - r.reserved, 0);
    if (totalAvailable < item.quantity) {
      return NextResponse.json({ error: `Stock insuficiente para "${product.name}". Disponible: ${totalAvailable}` }, { status: 400 });
    }

    // Seleccionar ubicación de origen (primera con stock)
    const sourceRow = (invRows || []).find((r: { quantity: number; reserved: number }) => r.quantity - r.reserved >= item.quantity);

    subtotal += basePrice * item.quantity;
    totalDiscount += discount * item.quantity;

    orderItems.push({
      product_id: product.id,
      variant_id: item.variant_id || null,
      quantity: item.quantity,
      unit_price: finalPrice,
      original_price: basePrice,
      discount_applied: discount,
      promotion_id: promotionId,
      source_location_type: sourceRow?.location_type || null,
      source_location_id: sourceRow?.location_id || null
    });
  }

  const total = subtotal - totalDiscount;

  // Validación de fondos para 1q
  if (payment_mode === '1q') {
    const neto = await getNetoDisponible(shopUser.id);
    if (neto < total * 0.9) {
      return NextResponse.json({
        error: `Fondos insuficientes. Tu neto disponible es $${neto.toLocaleString('es-CO')} y el pedido es $${total.toLocaleString('es-CO')}.`
      }, { status: 400 });
    }
  }

  const installments = parseInt(payment_mode[0]);
  const amountPerInstallment = Math.ceil(total / installments);
  const reservationExpiresAt = isMultiQuincena
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  // Determinar estado inicial
  const orderStatus = payment_mode === '1q' ? 'aprobado' : 'reservado';

  // Crear orden — sellada con el scope del negocio de la modelo
  const { data: order, error: orderError } = await supabase
    .from('shop_orders')
    .insert({
      model_id: shopUser.id,
      status: orderStatus,
      subtotal,
      discount_amount: totalDiscount,
      total,
      payment_mode,
      notes,
      reservation_expires_at: reservationExpiresAt,
      affiliate_studio_id: modelScope    // ← separa por negocio
    })
    .select()
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  // Crear líneas del pedido
  const itemRows = orderItems.map(i => ({ ...i, order_id: order.id }));
  await supabase.from('shop_order_items').insert(itemRows);

  // Reservar/descontar stock
  for (const item of orderItems) {
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
      if (payment_mode === '1q') {
        // Descontar directamente
        await supabase.from('shop_inventory').update({ quantity: inv.quantity - item.quantity }).eq('id', inv.id);
      } else {
        // Reservar (cantidad reservada aumenta)
        await supabase.from('shop_inventory').update({ reserved: inv.reserved + item.quantity }).eq('id', inv.id);
      }
    }
  }

  // Crear financiación
  const { data: financing } = await supabase
    .from('shop_financing')
    .insert({
      order_id: order.id,
      model_id: shopUser.id,
      total_amount: total,
      installments,
      amount_per_installment: amountPerInstallment,
      status: payment_mode === '1q' ? 'aprobado' : 'pendiente'
    })
    .select()
    .single();

  // Si es 1q: crear la cuota ligada al período activo (is_active, no status)
  if (payment_mode === '1q' && financing) {
    const { data: period } = await supabase
      .from('periods')
      .select('id')
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from('shop_financing_installments').insert({
      financing_id: financing.id,
      installment_no: 1,
      period_id: period?.id ?? null,
      amount: total,
      status: 'pendiente'
    });

    // Avanzar a "en_preparacion"
    await supabase.from('shop_orders').update({ status: 'en_preparacion' }).eq('id', order.id);
  }

  // Notificaciones Botty
  notifyPurchase(profile, order, total, payment_mode, isMultiQuincena).catch(console.error);

  return NextResponse.json({
    order_id: order.id,
    status: payment_mode === '1q' ? 'en_preparacion' : 'reservado',
    total,
    payment_mode,
    requires_approval: isMultiQuincena,
    message: isMultiQuincena
      ? 'Tu pedido está en espera de aprobación del administrador (máx. 48 h).'
      : '¡Pedido realizado! Tu pedido está en preparación.'
  }, { status: 201 });
}

async function notifyPurchase(
  model: { id: string; email: string; affiliate_studio_id?: string | null },
  order: { id: string; total: number },
  total: number,
  paymentMode: string,
  requiresApproval: boolean
) {
  const { sendBotNotification } = await import('@/lib/chat/bot-notifications');

  const modelName = model.email.split('@')[0];
  const totalFmt = `$${total.toLocaleString('es-CO')}`;
  const modelScope = model.affiliate_studio_id ?? null;

  // Notificar a la modelo
  const modelMsg = requiresApproval
    ? `🛍️ **Pedido recibido — Sexshop**\n\nHola **${modelName}**, tu pedido por **${totalFmt}** está pendiente de aprobación del administrador.\n\nEspera la confirmación en las próximas 48 horas.`
    : `🛍️ **¡Compra exitosa! — Sexshop**\n\nHola **${modelName}**, tu pedido por **${totalFmt}** ha sido registrado y ya está en preparación. ¡Muy pronto tendrás tu entrega! 🎉`;

  await sendBotNotification(model.id, 'custom_message' as never, modelMsg);

  // Notificar solo a admins del MISMO negocio que la modelo
  let adminsQuery = supabase
    .from('users')
    .select('id, role, affiliate_studio_id')
    .in('role', ['admin', 'super_admin', 'superadmin_aff'])
    .eq('is_active', true);

  if (modelScope === null) {
    // Modelo de Innova → notificar solo a admins de Innova (affiliate_studio_id IS NULL)
    adminsQuery = (adminsQuery as any).is('affiliate_studio_id', null);
  } else {
    // Modelo afiliada → notificar solo a admins de ese estudio
    adminsQuery = (adminsQuery as any).eq('affiliate_studio_id', modelScope);
  }

  const { data: admins } = await adminsQuery;

  const adminMsg = requiresApproval
    ? `🛍️ **Nueva solicitud de financiación — Sexshop**\n\nLa modelo **${modelName}** solicitó financiación a **${paymentMode}** cuotas por **${totalFmt}**.\n\nPedido ID: \`${order.id}\`\n\nRevisa y aprueba o rechaza en /admin/shop/orders.`
    : `🛍️ **Nueva compra — Sexshop**\n\nLa modelo **${modelName}** realizó una compra de **${totalFmt}** (pago en 1 quincena).\n\nPedido ID: \`${order.id}\``;

  for (const admin of admins || []) {
    await sendBotNotification(admin.id, 'custom_message' as never, adminMsg);
  }
}
