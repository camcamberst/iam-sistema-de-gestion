"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ShopAdminNav from "@/components/ShopAdminNav";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  discount_applied: number;
  shop_products: { name: string; images: string[] };
  shop_product_variants: { name: string } | null;
}

interface Financing {
  id: string;
  installments: number;
  amount_per_installment: number;
  status: string;
  shop_financing_installments: Array<{ installment_no: number; amount: number; status: string; period_id: string | null }>;
}

interface Order {
  id: string;
  model_id: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_mode: string;
  notes: string | null;
  created_at: string;
  reservation_expires_at: string | null;
  users: { email: string };
  shop_order_items: OrderItem[];
  shop_financing: Financing[] | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendiente:      { label: "Pendiente",       color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
  reservado:      { label: "Reservado",        color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  aprobado:       { label: "Aprobado",         color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
  en_preparacion: { label: "En preparación",   color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" },
  entregado:      { label: "Entregado",        color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  cancelado:      { label: "Cancelado",        color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
  expirado:       { label: "Expirado",         color: "bg-gray-100 dark:bg-gray-700 text-gray-500" }
};

const PAYMENT_LABELS: Record<string, string> = {
  "1q": "1 quincena", "2q": "2 quincenas", "3q": "3 quincenas", "4q": "4 quincenas"
};

export default function ShopOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
    const res = await fetch(`/api/shop/orders${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function updateOrderStatus(orderId: string, status: string) {
    setActionLoading(true);
    const res = await fetch(`/api/shop/orders/${orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      setSelectedOrder(null);
      loadOrders();
    } else {
      const err = await res.json();
      alert(err.error || "Error al actualizar pedido");
    }
    setActionLoading(false);
  }

  async function handleProrrogar(installmentId: string) {
    // Prorrogar cuota al siguiente período
    const res = await fetch(`/api/shop/financing/installments/${installmentId}/prorrogar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) { loadOrders(); }
    else { const e = await res.json(); alert(e.error || "Error"); }
  }

  const filteredOrders = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);

  function getExpiresIn(dateStr: string | null) {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff < 0) return "Expirado";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m restantes`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <ShopAdminNav />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📋</span> Pedidos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona pedidos, aprueba financiaciones y marca entregas</p>
        </div>

        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[["all","Todos"], ...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilterStatus(k)}
              className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${filterStatus === k ? "bg-pink-600 text-white border-pink-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-pink-400"}`}
            >
              {label}
              {k !== "all" && <span className="ml-1.5 text-xs opacity-70">{orders.filter(o => o.status === k).length}</span>}
            </button>
          ))}
        </div>

        {/* Alerta de reservados próximos a expirar */}
        {orders.filter(o => o.status === "reservado").length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">{orders.filter(o => o.status === "reservado").length}</span> pedido(s) esperan aprobación de financiación. Las reservas expiran en 48 h si no se responden.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" /></div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-3">📋</div>
            <p className="font-medium">No hay pedidos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const fin = order.shop_financing?.[0];
              const expiresIn = getExpiresIn(order.reservation_expires_at);
              return (
                <div key={order.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">
                            {order.users?.email?.split("@")[0]}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[order.status]?.color}`}>
                            {STATUS_LABELS[order.status]?.label}
                          </span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                            {PAYMENT_LABELS[order.payment_mode]}
                          </span>
                          {order.status === "reservado" && expiresIn && (
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">⏳ {expiresIn}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {order.shop_order_items.length} producto(s)
                        </div>
                        {/* Items preview */}
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {order.shop_order_items.slice(0, 3).map(item => (
                            <span key={item.id} className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">
                              {item.shop_products?.name} {item.shop_product_variants ? `(${item.shop_product_variants.name})` : ""} ×{item.quantity}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          ${order.total.toLocaleString("es-CO")}
                        </div>
                        {order.discount_amount > 0 && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            -{order.discount_amount.toLocaleString("es-CO")} dto.
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-sm text-pink-600 hover:text-pink-700 font-medium border border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-900/20 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer: detalle del pedido */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white dark:bg-gray-800 w-full max-w-lg h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalle del Pedido</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Modelo y estado */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Modelo</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedOrder.users?.email?.split("@")[0]}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABELS[selectedOrder.status]?.color}`}>
                  {STATUS_LABELS[selectedOrder.status]?.label}
                </span>
              </div>

              {/* Productos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Productos</h3>
                <div className="space-y-2">
                  {selectedOrder.shop_order_items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      {item.shop_products?.images?.[0] ? (
                        <img src={item.shop_products.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center">🛍️</div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.shop_products?.name} {item.shop_product_variants ? `· ${item.shop_product_variants.name}` : ""}
                        </p>
                        <p className="text-xs text-gray-500">
                          ×{item.quantity} · ${item.unit_price.toLocaleString("es-CO")} c/u
                          {item.discount_applied > 0 && <span className="text-green-600 ml-1">(−${item.discount_applied.toLocaleString("es-CO")} dto.)</span>}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${(item.unit_price * item.quantity).toLocaleString("es-CO")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>${selectedOrder.subtotal.toLocaleString("es-CO")}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuentos</span>
                    <span>−${selectedOrder.discount_amount.toLocaleString("es-CO")}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-1 mt-1">
                  <span>Total</span>
                  <span>${selectedOrder.total.toLocaleString("es-CO")}</span>
                </div>
                <div className="text-xs text-gray-500 text-center">{PAYMENT_LABELS[selectedOrder.payment_mode]}</div>
              </div>

              {/* Financiación */}
              {selectedOrder.shop_financing?.[0] && selectedOrder.payment_mode !== "1q" && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Cuotas de financiación</h3>
                  <div className="space-y-1.5">
                    {selectedOrder.shop_financing[0].shop_financing_installments?.map(inst => (
                      <div key={inst.installment_no} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Cuota {inst.installment_no}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">${inst.amount.toLocaleString("es-CO")}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${inst.status === "cobrada" ? "bg-green-100 text-green-700" : inst.status === "prorrogada" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {inst.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Notas</h3>
                  <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Acciones */}
              <div className="space-y-2">
                {selectedOrder.status === "reservado" && (
                  <>
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, "aprobado")}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      ✅ Aprobar financiación
                    </button>
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, "rechazado")}
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      ❌ Rechazar solicitud
                    </button>
                  </>
                )}
                {selectedOrder.status === "en_preparacion" && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, "entregado")}
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    📦 Marcar como entregado
                  </button>
                )}
                {["pendiente","reservado","en_preparacion"].includes(selectedOrder.status) && (
                  <button
                    onClick={() => { if (confirm("¿Cancelar este pedido?")) updateOrderStatus(selectedOrder.id, "cancelado"); }}
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    Cancelar pedido
                  </button>
                )}
                {actionLoading && (
                  <div className="flex justify-center">
                    <div className="animate-spin w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
