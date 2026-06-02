"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";

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
  return <ShopOrdersContent isInsideHub={false} />;
}

export function ShopOrdersContent({ isInsideHub = false }: { isInsideHub?: boolean }) {
  const actionBtnStyle = isInsideHub
    ? "px-4 h-9 text-[11px] font-bold !rounded-full transition-all duration-300 border-none cursor-pointer flex items-center justify-center gap-1.5 text-pink-600 dark:text-pink-400 bg-black/5 dark:bg-white/5 border border-pink-500/20 hover:bg-black/10 dark:hover:bg-white/10"
    : "px-4 py-1.5 text-xs font-bold rounded-full border border-pink-500/30 text-pink-600 dark:text-pink-400 hover:text-white hover:bg-pink-600 dark:hover:bg-pink-500 hover:border-transparent transition-all duration-300 shadow-sm active:scale-95 cursor-pointer";

  const drawerBtnStyle = (baseColor: 'emerald' | 'rose' | 'pink' | 'zinc') => {
    const isComp = isInsideHub;
    if (baseColor === 'emerald') {
      return isComp
        ? "w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white !rounded-full font-bold text-[11px] transition-all duration-300 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer border-none flex items-center justify-center"
        : "w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all duration-300 shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer border-none flex items-center justify-center";
    } else if (baseColor === 'rose') {
      return isComp
        ? "w-full h-9 bg-rose-600 hover:bg-rose-700 text-white !rounded-full font-bold text-[11px] transition-all duration-300 shadow-md shadow-rose-500/10 active:scale-95 cursor-pointer border-none flex items-center justify-center"
        : "w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-sm transition-all duration-300 shadow-md shadow-rose-500/10 active:scale-95 cursor-pointer border-none flex items-center justify-center";
    } else if (baseColor === 'pink') {
      return isComp
        ? "w-full h-9 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white !rounded-full font-bold text-[11px] transition-all duration-300 shadow-md shadow-pink-500/10 active:scale-95 cursor-pointer border-none flex items-center justify-center"
        : "w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-bold text-sm transition-all duration-300 shadow-md shadow-pink-500/10 active:scale-95 cursor-pointer border-none flex items-center justify-center";
    } else {
      return isComp
        ? "w-full h-9 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 !rounded-full font-bold text-[11px] transition-all duration-300 active:scale-95 cursor-pointer border-none flex items-center justify-center"
        : "w-full py-3 bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-zinc-700 dark:text-zinc-300 rounded-xl font-semibold text-sm transition-all duration-300 active:scale-95 cursor-pointer border-none flex items-center justify-center";
    }
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [filterStatus, setFilterStatus] = useState("pendiente");
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
    <div className={isInsideHub ? "absolute inset-0 flex flex-col overflow-hidden rounded-b-[2rem]" : "min-h-screen bg-transparent"}>
      <div className={isInsideHub ? "flex flex-col flex-1 overflow-hidden" : "max-w-7xl mx-auto"}>
        {!isInsideHub && (
          <Link href="/admin/shop" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-pink-500 mb-3 transition-colors max-sm:px-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Dashboard
          </Link>
        )}

        {!isInsideHub && (
          <PageHeader 
            title="Pedidos de AIM Market"
            subtitle="Gestiona pedidos, aprueba financiaciones quincenales, prorroga cuotas y audita entregas."
            glow="superadmin"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
          />
        )}

        {/* Contenedor de filtros superior (fijo en Hub) */}
        <div className={isInsideHub ? "px-6 pt-6 pb-2 flex-shrink-0" : ""}>
          {/* Filtros rápidos estilo Apple pastilla */}
          <div className="mb-6 px-1 sm:px-2 flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-wrap gap-1.5 p-1 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-full backdrop-blur-md shadow-inner">
              {[...Object.entries(STATUS_LABELS).map(([k, v]) => [k, v.label]), ["all","Todos"]].map(([k, label]) => {
                const count = k === "all" ? orders.length : orders.filter(o => o.status === k).length;
                return (
                  <button
                    key={k}
                    onClick={() => setFilterStatus(k)}
                    className={`${isInsideHub ? "px-4 h-9 flex items-center justify-center" : "px-4 py-2"} text-[11px] font-bold rounded-full transition-all duration-300 border-none cursor-pointer gap-1.5 ${
                      filterStatus === k 
                        ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-[0_3px_10px_rgba(236,72,153,0.3)] scale-[1.02]" 
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-full ${
                        filterStatus === k 
                          ? "bg-white/25 text-white" 
                          : "bg-black/[0.05] dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alerta de reservados próximos a expirar en formato Aurora */}
          {orders.filter(o => o.status === "reservado").length > 0 && (
            <div className="bg-pink-500/10 dark:bg-pink-500/15 border border-pink-500/30 rounded-2xl p-4 mb-5 flex items-start gap-3.5 relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-xl pointer-events-none" />
              <svg className="w-5 h-5 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] animate-pulse flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-pink-700 dark:text-pink-300 font-medium leading-relaxed z-10">
                Hay <span className="font-bold">{orders.filter(o => o.status === "reservado").length} pedido(s)</span> en espera de aprobación de financiación. Las reservas expiran automáticamente en 48 h para liberar stock si no se responden.
              </p>
            </div>
          )}
        </div>

        <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll" : ""}>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-8 h-8 border-b-2 border-blue-600 rounded-full" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
              {/* Ambient Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
              
              <div className="w-16 h-16 bg-gradient-to-tr from-rose-500/10 via-rose-500/5 to-transparent rounded-2xl border border-rose-500/20 dark:border-rose-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(244,63,94,0.08)] relative z-10">
                <svg className="w-7 h-7 text-rose-500 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">No hay pedidos</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">Actualmente no existen registros en esta categoría de pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map(order => {
                const fin = order.shop_financing?.[0];
                const expiresIn = getExpiresIn(order.reservation_expires_at);
                return (
                  <div key={order.id} className="glass-card !rounded-[2rem] p-5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:scale-[1.01] hover:bg-white/95 dark:hover:bg-zinc-800/95 transition-all duration-300 border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/10 transition-colors" />
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                          <svg className="w-5 h-5 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                              {order.users?.email?.split("@")[0]}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide ${STATUS_LABELS[order.status]?.color}`}>
                              {STATUS_LABELS[order.status]?.label}
                            </span>
                            <span className="text-[10.5px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-gray-600 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full">
                              {PAYMENT_LABELS[order.payment_mode]}
                            </span>
                            {order.status === "reservado" && expiresIn && (
                              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold bg-orange-500/10 dark:bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/20">⏳ {expiresIn}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                            {new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {order.shop_order_items.length} producto(s)
                          </div>
                          {/* Items preview */}
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {order.shop_order_items.slice(0, 3).map(item => (
                              <span key={item.id} className="text-[10px] font-bold text-zinc-500 bg-black/[0.03] dark:bg-white/[0.03] px-2.5 py-1 rounded-full border border-black/[0.05] dark:border-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                {item.shop_products?.name} {item.shop_product_variants ? `(${item.shop_product_variants.name})` : ""} ×{item.quantity}
                              </span>
                            ))}
                            {order.shop_order_items.length > 3 && (
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 px-2.5 py-1">
                                +{order.shop_order_items.length - 3} más
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                        <div className="text-right">
                          <div className="text-lg font-black text-gray-900 dark:text-white">
                            ${order.total.toLocaleString("es-CO")}
                          </div>
                          {order.discount_amount > 0 && (
                            <div className="text-xs text-green-600 dark:text-green-400 font-bold">
                              -${order.discount_amount.toLocaleString("es-CO")} dto.
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className={actionBtnStyle}
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
      </div>

      {/* Drawer: detalle del pedido */}
      {selectedOrder && (
        <div className={isInsideHub ? "absolute inset-0 z-50 flex justify-end overflow-hidden rounded-b-[2rem]" : "fixed inset-0 z-50 flex justify-end"}>
          {/* Overlay oscuro con blur */}
          <div 
            className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-300 ${isInsideHub ? "rounded-b-[2rem]" : ""}`} 
            onClick={() => setSelectedOrder(null)} 
          />
          
          <div className={`relative bg-white/95 dark:bg-[#111115]/95 backdrop-blur-3xl w-full max-w-lg h-full overflow-y-auto overflow-x-hidden shadow-[0_0_60px_rgba(0,0,0,0.18)] dark:shadow-[0_0_60px_rgba(0,0,0,0.7)] border-l border-white/10 dark:border-white/5 animate-in slide-in-from-right duration-300 flex flex-col ${isInsideHub ? "rounded-br-[2rem]" : ""}`}>
            
            {/* Resplandor ambiental de fondo */}
            <div className="absolute top-[-100px] right-[-100px] w-80 h-80 rounded-full bg-gradient-to-br from-pink-500/10 to-rose-500/10 blur-3xl pointer-events-none mix-blend-screen opacity-70 dark:opacity-40" />

            {/* Header del Drawer */}
            <div className="sticky top-0 bg-white/50 dark:bg-black/50 backdrop-blur-xl border-b border-black/[0.05] dark:border-white/[0.05] px-6 py-5 flex items-center justify-between z-10">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Detalle del Pedido</h2>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 hover:shadow-[0_0_12px_rgba(244,63,94,0.4)] transition-all duration-300 cursor-pointer text-zinc-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Contenido del Drawer */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto relative z-10 apple-scroll">
              {/* Modelo y estado */}
              <div className="flex items-center justify-between bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl p-4">
                <div>
                  <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">Modelo</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{selectedOrder.users?.email?.split("@")[0]}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_LABELS[selectedOrder.status]?.color}`}>
                  {STATUS_LABELS[selectedOrder.status]?.label}
                </span>
              </div>

              {/* Productos */}
              <div>
                <h3 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-2.5 ml-1">Productos</h3>
                <div className="space-y-2">
                  {selectedOrder.shop_order_items.map(item => (
                    <div key={item.id} className="flex items-center gap-3.5 p-3 bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl">
                      {item.shop_products?.images?.[0] ? (
                        <img src={item.shop_products.images[0]} alt="" className="w-12 h-12 rounded-xl object-cover border border-black/5 dark:border-white/10" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-pink-50/50 dark:bg-pink-900/10 flex items-center justify-center text-xl shadow-inner border border-black/5 dark:border-white/10">🛍️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-zinc-100 line-clamp-1">
                          {item.shop_products?.name} {item.shop_product_variants ? `· ${item.shop_product_variants.name}` : ""}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                          ×{item.quantity} · ${item.unit_price.toLocaleString("es-CO")} c/u
                          {item.discount_applied > 0 && <span className="text-green-600 dark:text-green-400 ml-1 font-bold">(−${item.discount_applied.toLocaleString("es-CO")} dto.)</span>}
                        </p>
                      </div>
                      <span className="text-sm font-black text-gray-900 dark:text-white flex-shrink-0">
                        ${(item.unit_price * item.quantity).toLocaleString("es-CO")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div>
                <h3 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-2.5 ml-1">Resumen del Pago</h3>
                <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.1] rounded-2xl p-4 space-y-2 shadow-inner">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900 dark:text-zinc-200">${selectedOrder.subtotal.toLocaleString("es-CO")}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-xs font-bold text-green-600 dark:text-green-400">
                      <span>Descuentos</span>
                      <span>−${selectedOrder.discount_amount.toLocaleString("es-CO")}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-gray-900 dark:text-white border-t border-black/5 dark:border-white/10 pt-2 mt-2">
                    <span>Total</span>
                    <span>${selectedOrder.total.toLocaleString("es-CO")}</span>
                  </div>
                  <div className="text-[10.5px] text-pink-600 dark:text-pink-400 font-bold text-center py-1 rounded-lg border border-pink-500/10 mt-2">{PAYMENT_LABELS[selectedOrder.payment_mode]}</div>
                </div>
              </div>

              {/* Financiación */}
              {selectedOrder.shop_financing?.[0] && selectedOrder.payment_mode !== "1q" && (
                <div>
                  <h3 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-2.5 ml-1">Cuotas de Financiación</h3>
                  <div className="space-y-1.5">
                    {selectedOrder.shop_financing[0].shop_financing_installments?.map(inst => (
                      <div key={inst.installment_no} className="flex items-center justify-between p-3 bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Cuota {inst.installment_no}</span>
                        <span className="text-sm font-black text-gray-900 dark:text-white">${inst.amount.toLocaleString("es-CO")}</span>
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                          inst.status === "cobrada" 
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" 
                            : inst.status === "prorrogada" 
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" 
                              : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20"
                        }`}>
                          {inst.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div>
                  <h3 className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-2.5 ml-1">Notas del Pedido</h3>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl p-3.5 leading-relaxed">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Acciones */}
              <div className="space-y-2 mt-4">
                {selectedOrder.status === "reservado" && (
                  <>
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, "aprobado")}
                      disabled={actionLoading}
                      className={drawerBtnStyle('emerald')}
                    >
                      ✅ Aprobar financiación
                    </button>
                    <button
                      onClick={() => updateOrderStatus(selectedOrder.id, "rechazado")}
                      disabled={actionLoading}
                      className={drawerBtnStyle('rose')}
                    >
                      ❌ Rechazar solicitud
                    </button>
                  </>
                )}
                {selectedOrder.status === "en_preparacion" && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, "entregado")}
                    disabled={actionLoading}
                    className={drawerBtnStyle('pink')}
                  >
                    📦 Marcar como entregado
                  </button>
                )}
                {["pendiente","reservado","en_preparacion"].includes(selectedOrder.status) && (
                  <button
                    onClick={() => { if (confirm("¿Cancelar este pedido?")) updateOrderStatus(selectedOrder.id, "cancelado"); }}
                    disabled={actionLoading}
                    className={drawerBtnStyle('zinc')}
                  >
                    Cancelar pedido
                  </button>
                )}
                {actionLoading && (
                  <div className="flex justify-center mt-3">
                    <div className="animate-spin w-5 h-5 border-b-2 border-pink-500 rounded-full" />
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
