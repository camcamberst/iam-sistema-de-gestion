"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import PillTabs from "@/components/ui/PillTabs";
import ModelAuroraBackground from "@/components/ui/ModelAuroraBackground";

interface Category { id: string; name: string; }
interface Variant { id: string; name: string; price_delta: number; is_active: boolean; }
interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  category_id: string | null;
  images: string[];
  allow_financing: boolean;
  shop_categories?: { name: string } | null;
  shop_product_variants?: Variant[];
  stock?: { available: number; reserved: number };
}

type CartItem = {
  product: Product;
  variant: Variant | null;
  quantity: number;
};

function formatPriceK(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return (value / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + "K";
  }
  return value.toLocaleString("es-CO");
}

const MobilePillCarousel = ({ order, statusLabel }: { order: any, statusLabel: { label: string; color: string } }) => {
  const [index, setIndex] = useState(0);

  const formattedDate = new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const formattedInstallments = order.payment_mode === "1q" ? "1 Cuota" : `Cuotas: ${order.payment_mode[0]}`;

  const GLASS_COLOR = "bg-white dark:bg-white/20 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] ring-1 ring-inset ring-black/[0.06] dark:ring-white/40 text-gray-800 dark:text-white border-none";

  const itemsData = [
    { text: statusLabel.label, color: statusLabel.color, isStatus: true },
    { text: formattedDate, color: GLASS_COLOR, isStatus: false },
    { text: formattedInstallments, color: GLASS_COLOR, isStatus: false }
  ];

  return (
    <div 
      className="sm:hidden relative inline-flex overflow-hidden h-[20px] rounded-full cursor-pointer ml-1.5 active:scale-[0.97] transition-transform"
      style={{ minWidth: '85px' }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex((i) => i + 1); }}
    >
      <div 
        className="absolute bottom-0 w-full flex flex-col-reverse gap-2 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateY(${index * 28}px)` }}
      >
        {Array.from({ length: index + 2 }).map((_, i) => {
          const item = itemsData[i % 3];
          return (
            <div key={i} className={`relative shrink-0 h-[20px] px-2.5 flex items-center justify-center text-[9px] font-bold tracking-wider whitespace-nowrap rounded-full w-full ${item.color}`}>
              {item.isStatus && order.status === "en_preparacion" && (
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-fuchsia-500 rounded-full blur-[4px] animate-pulse opacity-70 pointer-events-none" />
              )}
              <span className="relative z-10">{item.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};


export default function ShopStorefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartInitialized, setIsCartInitialized] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [paymentMode, setPaymentMode] = useState<"1q" | "2q" | "3q" | "4q">("1q");
  const [notes, setNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{ success: boolean; message: string } | null>(null);
  const [netoDisponible, setNetoDisponible] = useState<number | null>(null);
  const [token, setToken] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "orders">("catalog");
  const [cartCarouselIndex, setCartCarouselIndex] = useState(0);
  const [paymentCarouselIndex, setPaymentCarouselIndex] = useState(0);

  useEffect(() => {
    setCartCarouselIndex(0);
  }, [cart.length]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const authHeader = { Authorization: `Bearer ${session.access_token}` };

    // active_only=false para mostrar también productos sin stock como "No disponible"
    const [prodRes, catRes, netoRes] = await Promise.all([
      fetch("/api/shop/products?active_only=false&with_inventory=true", { headers: authHeader }),
      fetch("/api/shop/categories", { headers: authHeader }),
      fetch("/api/shop/neto-disponible", { headers: authHeader })
    ]);

    if (prodRes.ok) setProducts(await prodRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    if (netoRes.ok) {
      const nd = await netoRes.json();
      setNetoDisponible(nd.neto_disponible ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function addToCart(product: Product, variant: Variant | null) {
    setCart(prev => {
      const key = `${product.id}__${variant?.id || "null"}`;
      const existing = prev.find(i => `${i.product.id}__${i.variant?.id || "null"}` === key);
      const available = product.stock?.available || 0;

      if (existing) {
        if (existing.quantity >= available) return prev;
        return prev.map(i => `${i.product.id}__${i.variant?.id || "null"}` === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (available < 1) return prev;
      return [...prev, { product, variant, quantity: 1 }];
    });
    setSelectedProduct(null);
    setSelectedVariant(null);
    setShowCart(true);
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  function updateQty(idx: number, delta: number) {
    setCart(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const available = item.product.stock?.available || 0;
      let newQty = item.quantity + delta;
      if (newQty > available) newQty = available;
      if (newQty <= 0) return null as unknown as CartItem;
      return { ...item, quantity: newQty };
    }).filter(Boolean));
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aim_market_cart');
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch (e) {}
    setIsCartInitialized(true);
  }, []);

  useEffect(() => {
    if (!isCartInitialized) return;
    localStorage.setItem('aim_market_cart', JSON.stringify(cart));
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: count }));
  }, [cart, isCartInitialized]);

  const cartTotal = cart.reduce((sum, item) => {
    const price = item.product.base_price + (item.variant?.price_delta || 0);
    return sum + price * item.quantity;
  }, 0);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setCheckoutResult(null);

    const items = cart.map(item => ({
      product_id: item.product.id,
      variant_id: item.variant?.id || null,
      quantity: item.quantity
    }));

    const res = await fetch("/api/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items, payment_mode: paymentMode, notes: notes || null })
    });

    const data = await res.json();
    if (res.ok) {
      setCheckoutResult({ success: true, message: data.message });
      setCart([]);
      localStorage.removeItem('aim_market_cart');
      setShowCheckout(false);
      setShowCart(false);
      loadData();
      setActiveTab("orders");
    } else {
      if (data.error === 'INVENTORY_SHORTAGE') {
        setCheckoutResult({ success: false, message: "Lo sentimos, la última unidad de este producto se agotó." });
        if (data.failed_product_id) {
          setCart(prev => prev.filter(i => i.product.id !== data.failed_product_id));
        }
        await loadData(); // refresh products and stock visually
      } else {
        setCheckoutResult({ success: false, message: data.error || "Error al procesar pedido" });
      }
    }
    setCheckoutLoading(false);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category_id === filterCategory;
    return matchSearch && matchCat;
  });

  if (loading) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="text-center relative z-10 flex flex-col items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-xl rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] border border-white/40 mb-4 animate-bounce">
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-600 dark:text-gray-300 mt-3 text-sm">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-6xl mx-auto max-sm:px-0 sm:px-6 lg:px-8 pb-4 sm:pb-2 pt-6 sm:pt-2 relative z-10">
        {/* Estilos para el efecto 'Ola' Sutil (Solo en Hover) */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes subtleWave {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-3px); }
          }
          .hover-wave-text span {
            display: inline-block;
            transition: transform 0.3s ease;
          }
          .group:hover .hover-wave-text span, .force-wave span {
            animation: subtleWave 1.5s ease-in-out infinite;
          }
          .group:hover .hover-wave-text span:nth-child(1), .force-wave span:nth-child(1) { animation-delay: 0.0s; }
          .group:hover .hover-wave-text span:nth-child(2), .force-wave span:nth-child(2) { animation-delay: 0.1s; }
          .group:hover .hover-wave-text span:nth-child(3), .force-wave span:nth-child(3) { animation-delay: 0.2s; }
          .group:hover .hover-wave-text span:nth-child(4), .force-wave span:nth-child(4) { animation-delay: 0.3s; }
          .group:hover .hover-wave-text span:nth-child(5), .force-wave span:nth-child(5) { animation-delay: 0.4s; }
          .group:hover .hover-wave-text span:nth-child(6), .force-wave span:nth-child(6) { animation-delay: 0.5s; }
        `}} />

        {/* SEXSHOP HERO VIBRANTE */}
        <div className="relative mb-5 sm:mb-8 overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-pink-600 via-fuchsia-600 to-rose-500 shadow-xl border border-white/20 group">
          {/* Decorative Background Elements & Dynamic Animations */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white opacity-20 rounded-full blur-3xl pointer-events-none transition-transform duration-1000 group-hover:scale-125 group-hover:opacity-30"></div>
          <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-pink-300 opacity-20 rounded-full blur-2xl pointer-events-none transition-transform duration-1000 group-hover:translate-x-10"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-rose-400 opacity-40 rounded-full blur-3xl pointer-events-none transition-transform duration-1000 group-hover:translate-x-10 group-hover:-translate-y-10"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

          <div className="relative z-10 p-4 sm:p-8 flex flex-row items-center justify-between gap-3 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="flex-shrink-0 w-12 h-12 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-xl rounded-[1rem] sm:rounded-[1.5rem] flex items-center justify-center shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] border border-white/40 transform transition-all duration-500 hover:rotate-6 hover:scale-105">
                <svg className="w-6 h-6 sm:w-10 sm:h-10 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-5xl font-black tracking-tighter mb-0.5 sm:mb-1 drop-shadow-md cursor-default">
                  <span className="text-white">AIM </span>
                  <span className={`hover-wave-text text-pink-100 inline-block font-bold ${cartCount > 0 ? 'force-wave' : ''}`}>
                    {"Market".split("").map((char, i) => (
                      <span key={i}>{char}</span>
                    ))}
                  </span>
                </h1>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {netoDisponible !== null && (
                <div className="hidden md:block bg-black/20 backdrop-blur-md rounded-2xl px-5 py-2.5 text-center border border-white/20 shadow-lg">
                  <p className="text-[11px] text-pink-200 font-semibold uppercase tracking-wider">Tu billetera</p>
                  <p className="text-xl font-bold text-white drop-shadow-sm">${netoDisponible.toLocaleString("es-CO", { maximumFractionDigits: 0 })}</p>
                </div>
              )}
              {/* Cart button */}
              <button
                onClick={() => setShowCart(true)}
                className="relative bg-white/95 text-fuchsia-600 hover:bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:scale-95 group"
              >
                <svg className="w-5 h-5 sm:w-7 sm:h-7 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-tr from-gray-900 to-black text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6 sm:mb-8 mt-4">
          <PillTabs
            tabs={[
              { id: 'catalog', label: 'Catálogo' },
              { id: 'orders', label: 'Mis pedidos' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
          />
        </div>

        {/* Resultado del checkout */}
        {checkoutResult && (
          <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${checkoutResult.success ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"}`}>
            <span className="text-xl">{checkoutResult.success ? "✅" : "❌"}</span>
            <div>
              <p className="font-medium text-sm">{checkoutResult.message}</p>
            </div>
            <button onClick={() => setCheckoutResult(null)} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}

        {/* === CATÁLOGO === */}
        {activeTab === "catalog" && (
          <>
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text" placeholder="Buscar productos..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button
                  onClick={() => setFilterCategory("all")}
                  className={`flex-shrink-0 px-4 py-2 text-sm rounded-xl border transition-all ${filterCategory === "all" ? "bg-pink-600 text-white border-pink-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-pink-400"}`}
                >
                  Todos
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCategory(c.id)}
                    className={`flex-shrink-0 px-4 py-2 text-sm rounded-xl border transition-all ${filterCategory === c.id ? "bg-pink-600 text-white border-pink-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-pink-400"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <div className="text-6xl mb-3">🛒</div>
                <p className="font-medium">No hay productos disponibles</p>
                <p className="text-sm mt-1">Intenta con otra categoría o búsqueda</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filtered.map(product => {
                  const hasVariants = (product.shop_product_variants?.length || 0) > 0;
                  const available = product.stock?.available || 0;
                  const noDisponible = available <= 0;
                  return (
                    <GlassCard
                      as="button"
                      padding="none"
                      key={product.id}
                      onClick={() => { setSelectedProduct(product); setSelectedVariant(null); }}
                      className={`w-full overflow-hidden text-left transition-all duration-300 group ${noDisponible ? "opacity-80" : "hover:shadow-xl hover:-translate-y-1 hover:bg-white/95 dark:hover:bg-gray-600/80"}`}
                    >
                      <div className="relative h-36 sm:h-44 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-gray-700 dark:to-gray-600 overflow-hidden">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className={`w-full h-full object-cover transition-transform duration-300 ${noDisponible ? "opacity-70" : "group-hover:scale-105"}`} />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-4xl sm:text-5xl">🛍️</span>
                          </div>
                        )}
                        {noDisponible && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="px-4 py-1.5 text-xs font-semibold bg-white/20 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] ring-1 ring-inset ring-white/40 text-white rounded-full">No disponible</span>
                          </div>
                        )}
                        {!product.allow_financing && !noDisponible && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-orange-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium">Solo 1Q</span>
                          </div>
                        )}
                        {available <= 3 && available > 0 && (
                          <div className="absolute top-2 right-2">
                            <span className="bg-red-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium">¡Últimas {available}!</span>
                          </div>
                        )}
                      </div>
                      <div className="p-2.5 sm:p-3">
                        {product.shop_categories && (
                          <p className="text-[10px] sm:text-xs text-pink-500 font-medium mb-0.5 truncate">{product.shop_categories.name}</p>
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-2 leading-tight h-[32px] sm:h-[40px]">{product.name}</h3>
                        <div className="flex items-center justify-between mt-1.5 sm:mt-2">
                          <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                            ${formatPriceK(product.base_price)}
                          </span>
                          {!noDisponible && hasVariants ? (
                            <span className="text-[9px] sm:text-xs text-gray-400">{product.shop_product_variants!.length} opc.</span>
                          ) : null}
                        </div>
                        <div className={`mt-2 w-full text-[11px] sm:text-xs py-1.5 rounded-lg text-center font-bold transition-colors ${noDisponible ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-default" : "bg-pink-600 hover:bg-pink-700 text-white"}`}>
                          Ver producto
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* === MIS PEDIDOS === */}
        {activeTab === "orders" && (
          <ModelOrders token={token} onOrderCancelled={loadData} />
        )}
      </div>

      {/* Product Detail Modal (Apple Style 2) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
          {/* Overlay oscuro con blur */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-fade-in" onClick={() => setSelectedProduct(null)} />
          
          <div className="relative bg-white/95 dark:bg-[#0a0f1a]/95 backdrop-blur-3xl w-full md:max-w-4xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col md:flex-row overflow-hidden max-h-[85vh] animate-scale-in border border-black/5 dark:border-white/10">

            {/* Glowing Aurora Orbs Background for Modal */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 dark:bg-pink-600/5 rounded-full blur-[80px] pointer-events-none" />

            {/* Zona de Imagen (Arriba en móvil, Izquierda en desktop) */}
            <div className="relative w-full md:w-1/2 flex items-center justify-center bg-transparent shrink-0 p-4 md:p-10 z-10">
              <div className="w-full h-[220px] sm:h-[300px] md:h-full relative flex items-center justify-center bg-gradient-to-br from-pink-50 to-rose-50 dark:from-white/5 dark:to-transparent rounded-2xl md:rounded-none overflow-hidden border border-black/5 dark:border-white/5 shadow-inner">
                {selectedProduct.images?.[0] ? (
                  <img
                    src={selectedProduct.images[0]}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain p-2 drop-shadow-xl"
                  />
                ) : (
                  <div className="flex items-center justify-center min-h-[200px] text-8xl drop-shadow-lg">🛍️</div>
                )}
              </div>
              
              {/* Botón cerrar para móvil */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="md:hidden absolute top-6 right-6 w-8 h-8 bg-black/20 hover:bg-black/40 dark:bg-white/10 dark:hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-md z-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Zona de Detalles (Abajo en móvil, Derecha en desktop) */}
            <div className="w-full md:w-1/2 p-5 md:p-10 flex flex-col overflow-y-auto relative pb-safe">
              {/* Botón cerrar para desktop */}
              <button
                onClick={() => setSelectedProduct(null)}
                className="hidden md:flex absolute top-5 right-5 w-8 h-8 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 rounded-full items-center justify-center transition-colors backdrop-blur-md z-10"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {selectedProduct.shop_categories && (
                <div className="mb-3">
                  <span className="inline-block px-3 py-1 text-[10px] sm:text-xs font-bold bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 rounded-full shadow-[inset_0_0_15px_rgba(236,72,153,0.1)] ring-1 ring-inset ring-pink-500/20">
                    {selectedProduct.shop_categories.name}
                  </span>
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
              {selectedProduct.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{selectedProduct.description}</p>
              )}

              <div className="flex items-center gap-2 mt-3">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${formatPriceK(selectedProduct.base_price + (selectedVariant?.price_delta || 0))}
                </span>
                {selectedVariant?.price_delta !== 0 && selectedVariant && (
                  <span className="text-sm text-gray-400 line-through">${formatPriceK(selectedProduct.base_price)}</span>
                )}
              </div>

              {/* Variantes */}
              {selectedProduct.shop_product_variants && selectedProduct.shop_product_variants.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecciona una opción:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.shop_product_variants.filter(v => v.is_active).map(v => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${selectedVariant?.id === v.id ? "bg-pink-600 text-white border-pink-600" : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-pink-400"}`}
                      >
                        {v.name}
                        {v.price_delta !== 0 && <span className="ml-1 text-xs opacity-75">{v.price_delta > 0 ? "+" : ""}${formatPriceK(v.price_delta)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock info */}
              <div className="mt-3 flex items-center gap-2 text-sm">
                {(selectedProduct.stock?.available || 0) > 0 ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-gray-500">
                      {selectedProduct.stock!.available} disponible(s)
                    </span>
                  </>
                ) : (
                  <span className="px-4 py-1.5 text-xs font-semibold bg-black/40 dark:bg-white/20 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(0,0,0,0.2)] dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] ring-1 ring-inset ring-black/10 dark:ring-white/40 text-gray-800 dark:text-white rounded-full">
                    No disponible
                  </span>
                )}
              </div>

              {!selectedProduct.allow_financing && (selectedProduct.stock?.available || 0) > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-2.5">
                  <span>⚠️</span>
                  <span>Este producto es solo de contado (1 quincena, aprobación automática si tienes fondos).</span>
                </div>
              )}

              {(() => {
                const available = selectedProduct.stock?.available || 0;
                const needsVariant = selectedProduct.shop_product_variants && selectedProduct.shop_product_variants.length > 0;
                
                // Calculamos cuántos ya hay en el carrito para la variante seleccionada (o sin variante)
                const currentVariantId = needsVariant ? (selectedVariant?.id || "null") : "null";
                const key = `${selectedProduct.id}__${currentVariantId}`;
                const inCart = cart.find(i => `${i.product.id}__${i.variant?.id || "null"}` === key)?.quantity || 0;
                
                const isMaxedOut = inCart >= available;

                if (available <= 0) {
                  return (
                    <div className="w-full mt-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-xl font-semibold text-center text-sm cursor-not-allowed">
                      No disponible
                    </div>
                  );
                }

                if (isMaxedOut && (!needsVariant || selectedVariant)) {
                   return (
                    <div className="w-full mt-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-xl font-semibold text-center text-sm cursor-not-allowed">
                      Límite de stock alcanzado en el carrito
                    </div>
                  );
                }

                return (
                  <button
                    onClick={() => {
                      if (needsVariant && !selectedVariant) { alert("Por favor selecciona una opción"); return; }
                      addToCart(selectedProduct, selectedVariant);
                    }}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md text-sm"
                  >
                    Agregar al carrito
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end p-2 pb-[90px] md:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-fade-in" onClick={() => setShowCart(false)} />
          
          <div className="relative bg-white/95 dark:bg-[#0a0f1a]/95 backdrop-blur-3xl w-full md:w-[400px] max-h-[85vh] md:max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-[32px] md:rounded-3xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.5)] md:shadow-2xl border md:border border-black/5 dark:border-white/10 z-10 animate-slide-up md:animate-scale-in">
            
            {/* Pull handle para móvil */}
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-4 mb-2 md:hidden shrink-0" />

            {/* Glowing Aurora Orbs Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 dark:bg-pink-600/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-fuchsia-500/10 dark:bg-fuchsia-600/5 rounded-full blur-[60px] pointer-events-none" />

            <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between relative z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Mi carrito
                {cartCount > 0 && <span className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs px-2 py-0.5 rounded-full shadow-sm">{cartCount}</span>}
              </h2>
              <button onClick={() => setShowCart(false)} className="w-8 h-8 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 rounded-full flex items-center justify-center transition-colors backdrop-blur-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 pb-safe scrollbar-hide">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-80">
                  <div className="w-20 h-20 mb-4 bg-gradient-to-br from-pink-100 to-rose-50 dark:from-gray-800 dark:to-gray-700 rounded-3xl flex items-center justify-center shadow-inner border border-white/50 dark:border-white/5">
                    <span className="text-4xl drop-shadow-md">🛒</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">Tu carrito está vacío</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Descubre productos increíbles en el catálogo</p>
                </div>
              ) : (
                <div 
                  className="relative overflow-hidden rounded-2xl cursor-pointer bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-white/40 dark:border-white/5 shadow-sm hover:shadow-md transition-all h-[82px] active:scale-[0.98] group"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    setCartCarouselIndex(prev => prev + 1);
                  }}
                >
                  <div 
                    className="absolute bottom-0 w-full flex flex-col-reverse transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ transform: `translateY(${cartCarouselIndex * 82}px)` }}
                  >
                    {Array(50).fill(cart).flat().map((item, rawIdx) => {
                      const idx = rawIdx % cart.length;
                      return (
                        <div key={rawIdx} className="h-[82px] flex-shrink-0 flex items-center gap-3 p-3">
                          {item.product.images?.[0] ? (
                            <img src={item.product.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover shadow-sm transition-transform" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 flex items-center justify-center text-2xl shadow-inner border border-white/20 dark:border-white/5">🛍️</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">{item.product.name}</p>
                            {item.variant && <p className="text-[10px] sm:text-xs text-pink-500 dark:text-pink-400 font-medium">{item.variant.name}</p>}
                            <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">${formatPriceK((item.product.base_price + (item.variant?.price_delta || 0)) * item.quantity)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 rounded-full p-0.5 border border-black/5 dark:border-white/5">
                              <button onClick={(e) => { e.stopPropagation(); updateQty(idx, -1); }} className="w-6 h-6 rounded-full bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-bold flex items-center justify-center shadow-sm text-gray-700 dark:text-gray-200">−</button>
                              <span className="w-5 text-center text-xs font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); updateQty(idx, 1); }} 
                                disabled={item.quantity >= (item.product.stock?.available || 0)}
                                className={`w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center transition-colors shadow-sm ${item.quantity >= (item.product.stock?.available || 0) ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {cart.length > 1 && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      {(cartCarouselIndex % cart.length) + 1}/{cart.length}
                    </div>
                  )}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 border-t border-black/5 dark:border-white/5 space-y-3 relative z-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
                {netoDisponible !== null && (
                  <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
                    <span>Tu billetera</span>
                    <span className={cartTotal > netoDisponible * 0.9 ? "text-red-500 font-bold" : "text-green-600 dark:text-green-400 font-bold"}>
                      ${netoDisponible.toLocaleString("es-CO", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-1 mb-2">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">Total</span>
                  <span className="text-xl font-black text-gray-900 dark:text-white">${formatPriceK(cartTotal)}</span>
                </div>
                <button
                  onClick={() => { 
                    setPaymentMode("1q"); 
                    setPaymentCarouselIndex(0);
                    setShowCart(false); 
                    setShowCheckout(true); 
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] text-sm"
                >
                  Continuar al pago
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md transition-opacity">
          <div className="bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 w-full max-w-md overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-300">
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl mix-blend-screen pointer-events-none" />
            
            <div className="p-6 pb-4 flex items-center justify-between relative z-10">
              <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Confirmar compra</h2>
              <button onClick={() => setShowCheckout(false)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-300 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 pt-0 space-y-5 relative z-10 max-h-[70vh] overflow-y-auto scrollbar-hide">
              {/* Resumen */}
              <div className="bg-black/5 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-4 ring-1 ring-inset ring-black/5 dark:ring-white/10 space-y-2">
                <div 
                  className="relative overflow-hidden cursor-pointer group"
                  style={{ height: '24px' }}
                  onClick={() => setCartCarouselIndex(prev => prev + 1)}
                >
                  <div 
                    className="absolute bottom-0 w-full flex flex-col-reverse transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ transform: `translateY(${cartCarouselIndex * 24}px)` }}
                  >
                    {Array(20).fill(cart).flat().map((item, rawIdx) => (
                      <div key={rawIdx} className="flex justify-between items-center text-sm flex-shrink-0" style={{ height: '24px' }}>
                        <span className="text-gray-600 dark:text-gray-300 line-clamp-1 font-medium pr-2">
                          {item.product.name} {item.variant ? `(${item.variant.name})` : ""} <span className="text-pink-500 font-bold ml-1">×{item.quantity}</span>
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white shrink-0">
                          ${formatPriceK((item.product.base_price + (item.variant?.price_delta || 0)) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {cart.length > 1 && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                       <span className="text-white text-[10px] font-bold bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full shadow-sm">
                         {(cartCarouselIndex % cart.length) + 1} de {cart.length}
                       </span>
                    </div>
                  )}
                </div>
                <div className="border-t border-black/10 dark:border-white/10 pt-2 mt-2 flex justify-between font-black text-lg text-gray-900 dark:text-white">
                  <span>Total</span>
                  <span>${formatPriceK(cartTotal)}</span>
                </div>
              </div>

              {/* Forma de pago */}
              <div>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Forma de pago</p>
                <div 
                  className="relative overflow-hidden rounded-2xl cursor-pointer bg-white dark:bg-white/10 ring-2 ring-inset ring-pink-500 shadow-md shadow-pink-500/10 dark:shadow-pink-500/20 transition-all h-[68px] active:scale-[0.98] group"
                  onClick={() => {
                    const availableModes = (["1q", "2q", "3q", "4q"] as const).filter(mode => !(mode !== "1q" && cart.some(i => !i.product.allow_financing)));
                    const nextIndex = paymentCarouselIndex + 1;
                    setPaymentCarouselIndex(nextIndex);
                    setPaymentMode(availableModes[nextIndex % availableModes.length]);
                  }}
                >
                  <div 
                    className="absolute bottom-0 w-full flex flex-col-reverse transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ transform: `translateY(${paymentCarouselIndex * 68}px)` }}
                  >
                    {Array(20).fill((["1q", "2q", "3q", "4q"] as const).filter(mode => !(mode !== "1q" && cart.some(i => !i.product.allow_financing)))).flat().map((mode, rawIdx) => {
                      const installments = parseInt(mode[0]);
                      const perInstallment = Math.ceil(cartTotal / installments);
                      const coversWithNeto = netoDisponible !== null && cartTotal <= netoDisponible * 0.9;
                      
                      return (
                        <div key={rawIdx} className="h-[68px] flex-shrink-0 flex items-center gap-3 p-3.5">
                          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors border-pink-500">
                            <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {mode === "1q" ? "1 quincena (pago único)" : `${installments} quincenas`}
                            </p>
                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                              {mode === "1q"
                                ? coversWithNeto 
                                  ? <><span className="text-green-500">✅</span> Aprobación automática</> 
                                  : <><span className="text-red-500">❌</span> <span className="truncate">Fondos insuficientes</span></>
                                : `$${formatPriceK(perInstallment)}/quinc. · Req. admin`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {((["1q", "2q", "3q", "4q"] as const).filter(mode => !(mode !== "1q" && cart.some(i => !i.product.allow_financing))).length > 1) && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 text-pink-500 opacity-60 group-hover:opacity-100 transition-opacity">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-[13px] font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Notas (opcional)</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="Instrucciones de entrega, etc."
                  className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 backdrop-blur-xl border-none ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-2xl text-sm focus:ring-2 focus:ring-inset focus:ring-pink-500 outline-none resize-none text-gray-900 dark:text-white placeholder-gray-400 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                />
              </div>

              {/* Info pago */}
              <div className="bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/20 rounded-2xl p-3.5 text-xs text-cyan-700 dark:text-cyan-400 font-medium flex items-start gap-2">
                <span className="text-cyan-500 text-lg leading-none">💳</span>
                <p>El pago se descuenta directamente de tu producido. No se realizan pagos en efectivo.</p>
              </div>

              {checkoutResult && !checkoutResult.success && (
                <div className="bg-red-500/10 ring-1 ring-inset ring-red-500/20 rounded-2xl p-3.5 text-xs text-red-600 dark:text-red-400 font-bold flex items-start gap-2 animate-shake">
                  <span className="text-red-500 text-lg leading-none">⚠️</span>
                  <p>{checkoutResult.message}</p>
                </div>
              )}
            </div>

            <div className="p-6 pt-4 flex gap-3 relative z-10 bg-white/50 dark:bg-black/20 backdrop-blur-xl border-t border-black/5 dark:border-white/5">
              <button 
                onClick={() => setShowCheckout(false)} 
                className="flex-1 relative overflow-hidden min-h-[44px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center tracking-widest uppercase bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white border-none shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="group flex-[1.5] relative overflow-hidden min-h-[44px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center gap-2 tracking-widest uppercase bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none backdrop-blur-md shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!checkoutLoading && (
                  <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
                  }}></div>
                )}
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {checkoutLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Confirmar pedido
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de "Mis pedidos" para modelos
function ModelOrders({ token, onOrderCancelled }: { token: string; onOrderCancelled?: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<"activos" | "historial">("activos");
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; action: "cancel" | "receive" | "hide"; title: string; desc: string } | null>(null);
  const [hiddenOrders, setHiddenOrders] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomedProduct, setZoomedProduct] = useState<{name: string, description?: string} | null>(null);

  type Order = {
    id: string;
    status: string;
    total: number;
    discount_amount: number;
    payment_mode: string;
    created_at: string;
    shop_order_items: Array<{
      id: string;
      quantity: number;
      unit_price: number;
      shop_products: { name: string; description?: string; images: string[] };
      shop_product_variants: { name: string } | null;
    }>;
    shop_financing: Array<{
      installments: number;
      amount_per_installment: number;
      status: string;
    }> | null;
  };

  useEffect(() => {
    if (!token) return;
    fetch("/api/shop/orders", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setOrders(d);
        } else {
          console.error("Orders API returned non-array:", d);
          setOrders([]);
        }
      })
      .catch(e => {
        console.error("Error fetching orders:", e);
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aim_market_hidden_orders');
      if (saved) setHiddenOrders(JSON.parse(saved));
    } catch (e) {}
  }, []);

  async function executeAction(id: string, action: "cancel" | "receive" | "hide") {
    if (action === "hide") {
      const newHidden = [...hiddenOrders, id];
      setHiddenOrders(newHidden);
      localStorage.setItem('aim_market_hidden_orders', JSON.stringify(newHidden));
      setConfirmDialog(null);
      return;
    }
    setCancelling(id);
    const status = action === "cancel" ? "cancelado" : "entregado";
    try {
      const res = await fetch(`/api/shop/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setOrders(prev => Array.isArray(prev) ? prev.map(o => o.id === id ? { ...o, status } : o) : prev);
        if (action === "cancel") onOrderCancelled?.();
      }
    } catch (e) {
      console.error("Error ejecutando acción:", e);
    }
    setCancelling(null);
    setConfirmDialog(null);
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pendiente:      { label: "Pendiente",            color: "bg-amber-500 text-white shadow-md shadow-amber-500/20 border-none" },
    reservado:      { label: "Esperando aprobación", color: "bg-blue-500 text-white shadow-md shadow-blue-500/20 border-none" },
    aprobado:       { label: "Aprobado",             color: "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 border-none" },
    en_preparacion: { label: "En preparación",       color: "bg-gradient-to-br from-pink-600 via-fuchsia-600 to-rose-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] dark:shadow-[0_0_20px_rgba(217,70,239,0.6)] border-none" },
    entregado:      { label: "Entregado ✓",          color: "bg-green-600 text-white shadow-md shadow-green-600/20 border-none" },
    cancelado:      { label: "Cancelado",            color: "bg-red-500 text-white shadow-md shadow-red-500/20 border-none" },
    expirado:       { label: "Expirado",             color: "bg-gray-500 text-white shadow-md shadow-gray-500/20 border-none" }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" /></div>;

  const filteredOrders = Array.isArray(orders) ? orders.filter(o => {
    if (hiddenOrders.includes(o.id)) return false;
    if (orderFilter === "activos") return o.status !== "entregado" && o.status !== "cancelado" && o.status !== "expirado";
    return o.status === "entregado" || o.status === "cancelado" || o.status === "expirado";
  }) : [];

  if (!Array.isArray(orders) || orders.length === 0) return (
    <div className="text-center py-16 text-gray-500">
      <div className="text-5xl mb-3">📋</div>
      <p className="font-medium">No tienes pedidos aún</p>
      <p className="text-sm mt-1">Explora el catálogo para hacer tu primera compra</p>
    </div>
  );

  return (
    <>
    <div className="flex flex-col gap-5">
      <div className="flex justify-center w-full pt-1">
        <PillTabs
          tabs={[
            { id: 'activos', label: 'En Curso' },
            { id: 'historial', label: 'Historial' }
          ]}
          activeTab={orderFilter}
          onTabChange={(tab) => setOrderFilter(tab as "activos" | "historial")}
          compact={true}
        />
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-10 bg-white/40 dark:bg-[#1C1C1E]/40 backdrop-blur-xl rounded-[1.5rem] border border-white/50 dark:border-white/[0.08]">
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {orderFilter === "activos" ? "No tienes pedidos en curso." : "No hay pedidos en el historial."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="relative overflow-hidden bg-white/70 dark:bg-[#1C1C1E]/40 backdrop-blur-3xl rounded-[1.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/50 dark:border-white/[0.08] p-2.5 sm:p-3 transition-all duration-300 hover:shadow-xl group">
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            
            {/* Sección Izquierda: Info & Productos */}
            <div className="flex-1 w-full flex flex-col">
              
              <div className="flex flex-col h-full gap-2 sm:gap-2.5">
                {/* Header Info & Metadata Pills (SOLO DESKTOP) */}
                <div className="hidden sm:flex flex-wrap items-center gap-1.5 sm:gap-2.5 px-0.5 sm:px-1 shrink-0">
                  <div className="relative inline-flex">
                    {order.status === "en_preparacion" && (
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-fuchsia-500 rounded-full blur-[6px] animate-pulse opacity-70"></div>
                    )}
                    <span className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-semibold ${STATUS_LABELS[order.status]?.color}`}>
                      {STATUS_LABELS[order.status]?.label}
                    </span>
                  </div>
                  
                  {/* Fecha */}
                  <span className="hidden sm:inline-flex px-4 py-1.5 text-xs font-semibold bg-white dark:bg-white/20 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] ring-1 ring-inset ring-black/[0.06] dark:ring-white/40 text-gray-800 dark:text-white rounded-full">
                    {new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                  </span>
                  
                  {/* Cuotas */}
                  <span className="hidden sm:inline-flex px-4 py-1.5 text-xs font-semibold bg-white dark:bg-white/20 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] ring-1 ring-inset ring-black/[0.06] dark:ring-white/40 text-gray-800 dark:text-white rounded-full">
                    Cuotas: {order.payment_mode === "1q" ? "1" : order.payment_mode[0]}
                  </span>
                  
                  {/* Detalles de financiación */}
                  {order.shop_financing?.[0] && order.payment_mode !== "1q" && (
                    <span className="hidden sm:inline-flex px-4 py-1.5 text-xs font-semibold uppercase bg-white dark:bg-white/20 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] ring-1 ring-inset ring-black/[0.06] dark:ring-white/40 text-gray-800 dark:text-white rounded-full">
                      💳 {order.shop_financing[0].installments} cuotas de ${formatPriceK(order.shop_financing[0].amount_per_installment)}
                    </span>
                  )}
                </div>
                
                {/* Body Row (Móvil: Productos + Caja Derecha | Desktop: Solo Productos) */}
                <div className="flex flex-row gap-2 mt-0">
                  {/* Lista de Productos */}
                  <div className="flex-1 flex flex-col justify-start gap-2.5 sm:gap-3">
                    {order.shop_order_items.slice(0, 3).map((item, index, arr) => (
                      <div key={item.id} className="w-full flex items-center gap-3.5 sm:gap-5 sm:bg-white/40 sm:dark:bg-white/[0.03] sm:rounded-[1.25rem] pt-5 pb-1 sm:p-6 sm:border sm:border-white/60 sm:dark:border-white/[0.06] sm:shadow-sm transition-colors sm:hover:bg-white/60 sm:dark:hover:bg-white/[0.08]">
                        {item.shop_products?.images?.[0] ? (
                          <div 
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-gray-200/50 dark:border-gray-700/50 bg-white dark:bg-gray-800 cursor-pointer"
                            onClick={() => setZoomedImage(item.shop_products?.images[0] || null)}
                          >
                            <img src={item.shop_products.images[0]} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex-shrink-0 border border-gray-200/50 dark:border-gray-700/50" />
                        )}
                        <div className="flex flex-col flex-1 min-w-0">
                          <span 
                            className="text-[15px] sm:text-[19px] font-bold text-gray-900 dark:text-[#E4E4E7] truncate tracking-tight leading-tight cursor-pointer hover:text-pink-500 transition-colors"
                            onClick={() => setZoomedProduct(item.shop_products || null)}
                          >
                            {item.shop_products?.name}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-1.5">
                            {item.shop_product_variants && (
                              <span className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 font-medium truncate">
                                {item.shop_product_variants.name}
                              </span>
                            )}
                            {/* Desktop: Badge | Mobile: Texto ultra-limpio */}
                            <span className="hidden sm:inline text-sm text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 rounded-md">
                              x{item.quantity}
                            </span>
                            <span className="sm:hidden text-[13px] text-indigo-500 dark:text-indigo-400 font-bold">
                              x{item.quantity}
                            </span>
                            {/* Status Pill Móvil (Solo en el último producto, junto al x1) */}
                            {index === arr.length - 1 && STATUS_LABELS[order.status] && (
                              <MobilePillCarousel order={order} statusLabel={STATUS_LABELS[order.status]} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Panel Derecho (Solo Móvil) */}
                  <div className="sm:hidden flex flex-col justify-center items-center w-auto min-w-[76px] shrink-0 bg-[#13131A] dark:bg-[#13131A] rounded-[1.25rem] p-3 border border-black/[0.03] dark:border-white/[0.03]">
                    {/* Botones */}
                    {order.status === "en_preparacion" && (
                      <div className="w-full flex flex-row items-center justify-center gap-1.5 mb-2">
                        <button
                          onClick={() => setConfirmDialog({ id: order.id, action: "receive", title: "¿Marcar como Recibido?", desc: "Confirma que has recibido los productos de este pedido en buen estado." })}
                          title="Marcar Recibido"
                          className="w-9 h-9 relative overflow-hidden rounded-full transition-all duration-300 transform active:scale-95 touch-manipulation flex items-center justify-center group bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                        >
                          <span className="relative z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </span>
                        </button>
                        <button
                          onClick={() => setConfirmDialog({ id: order.id, action: "cancel", title: "¿Cancelar Pedido?", desc: "El pedido será cancelado, y el stock junto con cualquier descuento aplicado serán reintegrados." })}
                          disabled={cancelling === order.id}
                          title="Cancelar Pedido"
                          className="w-9 h-9 relative rounded-full transition-all duration-300 transform active:scale-95 touch-manipulation flex items-center justify-center bg-white/10 backdrop-blur-xl ring-1 ring-inset ring-white/20 shadow-[inset_0_0_15px_rgba(255,255,255,0.1)] text-white disabled:opacity-50"
                        >
                          {cancelling === order.id ? (
                            <span className="text-[12px] animate-pulse">...</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          )}
                        </button>
                      </div>
                    )}
                    {(order.status === "cancelado" || order.status === "entregado") && (
                      <div className="w-full flex flex-row items-center justify-center gap-1.5 mb-2">
                        <button
                          onClick={() => setConfirmDialog({ id: order.id, action: "hide", title: "¿Ocultar Pedido?", desc: "Este pedido desaparecerá de tu historial visualmente. No podrás deshacer esta acción." })}
                          title="Eliminar del Historial"
                          className="w-9 h-9 relative overflow-hidden rounded-full transition-all duration-300 transform active:scale-95 touch-manipulation flex items-center justify-center bg-white/5 backdrop-blur-xl ring-1 ring-inset ring-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)] text-gray-400 hover:text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex flex-col justify-center items-center text-center w-full">
                      <p className="text-[9px] text-[#8E8E93] uppercase tracking-widest font-bold mb-0.5">Total</p>
                      <p className="text-[15px] font-black text-white tracking-tighter leading-none">
                        ${formatPriceK(order.total)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sección Derecha: Total & Botones Centrados (SOLO DESKTOP) */}
            <div className="hidden sm:flex sm:w-56 flex-shrink-0 flex-col items-center justify-center bg-[#13131A] rounded-[1.25rem] p-3 border border-white/[0.03]">
              <div className="text-center w-full mb-3">
                <p className="text-[10px] text-[#8E8E93] uppercase tracking-widest font-bold mb-1">Total del Pedido</p>
                <p className="text-[26px] font-black text-white tracking-tighter leading-none">
                  ${formatPriceK(order.total)}
                </p>
              </div>
              
              <div className="w-auto sm:w-full flex flex-col gap-1.5 sm:gap-2">
                {order.status === "en_preparacion" && (
                  <>
                    <button
                      onClick={() => setConfirmDialog({ id: order.id, action: "receive", title: "¿Marcar como Recibido?", desc: "Confirma que has recibido los productos de este pedido en buen estado." })}
                      className="w-full relative overflow-hidden min-h-[38px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center group bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] tracking-widest uppercase"
                    >
                      <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                        background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                        backgroundSize: '200% 100%',
                        animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
                      }}></div>
                      <span className="relative z-10 flex items-center">RECIBIDO</span>
                    </button>
                    <button
                      onClick={() => setConfirmDialog({ id: order.id, action: "cancel", title: "¿Cancelar Pedido?", desc: "El pedido será cancelado, y el stock junto con cualquier descuento aplicado serán reintegrados." })}
                      disabled={cancelling === order.id}
                      className="w-full relative min-h-[38px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center tracking-widest uppercase bg-white/20 hover:bg-white/30 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] border border-white/40 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] disabled:opacity-50"
                    >
                      {cancelling === order.id ? "CANCELANDO..." : "CANCELAR"}
                    </button>
                  </>
                )}
                {(order.status === "cancelado" || order.status === "entregado") && (
                  <button
                    onClick={() => setConfirmDialog({ id: order.id, action: "hide", title: "¿Ocultar Pedido?", desc: "Este pedido desaparecerá de tu historial visualmente. No podrás deshacer esta acción." })}
                    className="w-full relative min-h-[38px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center tracking-widest uppercase bg-white/5 hover:bg-white/10 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(255,255,255,0.05)] border border-white/10 text-gray-400 hover:text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                  >
                    ELIMINAR
                  </button>
                )}
              </div>
            </div>
            
          </div>
        </div>
      ))}
    </div>
  )}
  </div>

    {/* Modal de Zoom de Imagen */}
    {zoomedImage && (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity cursor-pointer p-4"
        onClick={() => setZoomedImage(null)}
      >
        <div 
          className="relative w-[260px] h-[340px] sm:w-[320px] sm:h-[420px] rounded-[1.5rem] overflow-hidden shadow-2xl border border-white/20 transform scale-100 animate-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <img src={zoomedImage} alt="Producto ampliado" className="w-full h-full object-cover" />
          <button 
            onClick={() => setZoomedImage(null)}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white shadow-lg border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    )}

    {/* Modal de Descripción de Producto */}
    {zoomedProduct && (
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity cursor-pointer p-4"
        onClick={() => setZoomedProduct(null)}
      >
        <div 
          className="relative w-full max-w-[320px] bg-white/90 dark:bg-[#13131A]/95 backdrop-blur-xl rounded-[1.5rem] p-6 shadow-2xl border border-white/20 transform scale-100 animate-in zoom-in duration-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => setZoomedProduct(null)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/5 dark:bg-white/10 rounded-full text-gray-500 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
          
          <h3 className="text-xl font-black text-gray-900 dark:text-white pr-8 mb-4 leading-tight">
            {zoomedProduct.name}
          </h3>
          
          <div className="overflow-y-auto max-h-[300px] text-[15px] leading-relaxed text-gray-600 dark:text-gray-300 font-medium">
            {zoomedProduct.description ? (
              <p className="whitespace-pre-wrap">{zoomedProduct.description}</p>
            ) : (
              <p className="italic text-gray-400 dark:text-gray-500">Sin descripción disponible.</p>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Custom Confirmation Modal */}
    {confirmDialog && (
      <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setConfirmDialog(null)} />
        <div className="relative bg-white/70 dark:bg-[#1C1C1E]/60 backdrop-blur-3xl w-full max-w-sm rounded-[2rem] p-7 shadow-[0_30px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.6)] border border-white/50 dark:border-white/[0.08] z-10 animate-scale-in flex flex-col items-center text-center">
          
          {/* Orbe Flotante de Ícono */}
          <div className={`w-14 h-14 rounded-full mb-5 flex items-center justify-center shadow-lg ${
            confirmDialog.action === 'cancel' || confirmDialog.action === 'hide'
              ? 'bg-white/10 backdrop-blur-xl ring-1 ring-inset ring-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
              : 'bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/5 backdrop-blur-md ring-1 ring-inset ring-cyan-500/30 text-cyan-400 shadow-cyan-500/20'
          }`}>
            <svg className="w-6 h-6 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {confirmDialog.action === 'cancel' || confirmDialog.action === 'hide' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              )}
            </svg>
          </div>

          <h3 className="text-[20px] font-black text-gray-900 dark:text-white mb-2 tracking-tight">{confirmDialog.title}</h3>
          <p className="text-gray-500 dark:text-gray-300 text-[13px] font-medium mb-7 leading-relaxed px-2">{confirmDialog.desc}</p>
          
          <div className="flex gap-3 w-full justify-center">
            {/* Botón Volver */}
            <button 
              onClick={() => setConfirmDialog(null)}
              className={`flex-1 relative overflow-hidden min-h-[38px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center tracking-widest uppercase ${
                confirmDialog.action === 'cancel' || confirmDialog.action === 'hide'
                  ? 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(255,255,255,0.2)] border border-white/20 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]'
              }`}
            >
              VOLVER
            </button>
            
            {/* Botón Acción */}
            <button 
              onClick={() => executeAction(confirmDialog.id, confirmDialog.action)}
              disabled={cancelling === confirmDialog.id}
              className={`flex-1 relative overflow-hidden min-h-[38px] px-4 py-2 text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center tracking-widest uppercase disabled:opacity-50 ${
                confirmDialog.action === 'cancel' || confirmDialog.action === 'hide'
                  ? 'bg-white/10 hover:bg-white/20 backdrop-blur-xl shadow-[inset_0_0_15px_rgba(255,255,255,0.2)] border border-white/20 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                  : 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)]'
              }`}
            >
              {cancelling === confirmDialog.id ? "PROCESANDO..." : confirmDialog.action === 'hide' ? 'SÍ, OCULTAR' : confirmDialog.action === 'cancel' ? 'SÍ, CANCELAR' : 'CONFIRMAR'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
