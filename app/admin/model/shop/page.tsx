"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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

export default function ShopStorefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const authHeader = { Authorization: `Bearer ${session.access_token}` };

    const [prodRes, catRes, netoRes] = await Promise.all([
      fetch("/api/shop/products?active_only=true&with_inventory=true", { headers: authHeader }),
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
      if (existing) {
        return prev.map(i => `${i.product.id}__${i.variant?.id || "null"}` === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
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
      const newQty = item.quantity + delta;
      if (newQty <= 0) return null as unknown as CartItem;
      return { ...item, quantity: newQty };
    }).filter(Boolean));
  }

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
      setShowCheckout(false);
      setShowCart(false);
      loadData();
      setActiveTab("orders");
    } else {
      setCheckoutResult({ success: false, message: data.error || "Error al procesar pedido" });
    }
    setCheckoutLoading(false);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category_id === filterCategory;
    const hasStock = (p.stock?.available || 0) > 0;
    return matchSearch && matchCat && hasStock;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3 animate-bounce">🛍️</div>
          <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 md:-mt-8">
      {/* Hero header de la tienda */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 text-white px-4 md:px-8 py-8 md:py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl">🛍️</span>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AIM Sexshop</h1>
              </div>
              <p className="text-pink-100 text-sm">Descuentos directos de tu producido</p>
            </div>
            <div className="flex items-center gap-3">
              {netoDisponible !== null && (
                <div className="hidden md:block bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
                  <p className="text-xs text-pink-100">Neto disponible</p>
                  <p className="text-lg font-bold">${netoDisponible.toLocaleString("es-CO")}</p>
                </div>
              )}
              {/* Cart button */}
              <button
                onClick={() => setShowCart(true)}
                className="relative bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl p-3 transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-1 w-fit">
            {[{ key: "catalog", label: "Catálogo" }, { key: "orders", label: "Mis pedidos" }].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === t.key ? "bg-white text-pink-600 shadow-sm" : "text-white/80 hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
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
              <div className="flex gap-2 overflow-x-auto pb-1">
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(product => {
                  const hasVariants = (product.shop_product_variants?.length || 0) > 0;
                  const available = product.stock?.available || 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => { setSelectedProduct(product); setSelectedVariant(null); }}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden text-left hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
                    >
                      <div className="relative h-44 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-gray-700 dark:to-gray-600 overflow-hidden">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-5xl">🛍️</span>
                          </div>
                        )}
                        {!product.allow_financing && (
                          <div className="absolute top-2 left-2">
                            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Solo 1Q</span>
                          </div>
                        )}
                        {available <= 3 && available > 0 && (
                          <div className="absolute top-2 right-2">
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">¡Últimas {available}!</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        {product.shop_categories && (
                          <p className="text-xs text-pink-500 font-medium mb-0.5">{product.shop_categories.name}</p>
                        )}
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight">{product.name}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-base font-bold text-gray-900 dark:text-white">
                            ${product.base_price.toLocaleString("es-CO")}
                          </span>
                          {hasVariants && (
                            <span className="text-xs text-gray-400">{product.shop_product_variants!.length} opciones</span>
                          )}
                        </div>
                        <div className="mt-2 w-full bg-pink-600 hover:bg-pink-700 text-white text-xs py-1.5 rounded-lg text-center font-medium transition-colors">
                          Ver producto
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* === MIS PEDIDOS === */}
        {activeTab === "orders" && (
          <ModelOrders token={token} />
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="relative h-56 bg-gradient-to-br from-pink-50 to-rose-100 dark:from-gray-700 dark:to-gray-600">
              {selectedProduct.images?.[0] ? (
                <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-6xl">🛍️</div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              {selectedProduct.shop_categories && (
                <p className="text-xs text-pink-500 font-medium mb-1">{selectedProduct.shop_categories.name}</p>
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h2>
              {selectedProduct.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{selectedProduct.description}</p>
              )}

              <div className="flex items-center gap-2 mt-3">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(selectedProduct.base_price + (selectedVariant?.price_delta || 0)).toLocaleString("es-CO")}
                </span>
                {selectedVariant?.price_delta !== 0 && selectedVariant && (
                  <span className="text-sm text-gray-400 line-through">${selectedProduct.base_price.toLocaleString("es-CO")}</span>
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
                        {v.price_delta !== 0 && <span className="ml-1 text-xs opacity-75">{v.price_delta > 0 ? "+" : ""}${v.price_delta.toLocaleString("es-CO")}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock info */}
              <div className="mt-3 flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${(selectedProduct.stock?.available || 0) > 0 ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-gray-500">
                  {(selectedProduct.stock?.available || 0) > 0
                    ? `${selectedProduct.stock!.available} disponible(s)`
                    : "Sin stock"}
                </span>
              </div>

              {!selectedProduct.allow_financing && (
                <div className="mt-2 flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-2.5">
                  <span>⚠️</span>
                  <span>Este producto es solo de contado (1 quincena, aprobación automática si tienes fondos).</span>
                </div>
              )}

              <button
                onClick={() => {
                  const needsVariant = selectedProduct.shop_product_variants && selectedProduct.shop_product_variants.length > 0;
                  if (needsVariant && !selectedVariant) { alert("Por favor selecciona una opción"); return; }
                  if ((selectedProduct.stock?.available || 0) <= 0) { alert("Producto sin stock"); return; }
                  addToCart(selectedProduct, selectedVariant);
                }}
                className="w-full mt-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md text-sm"
              >
                Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative bg-white dark:bg-gray-800 w-full max-w-sm h-full shadow-2xl flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Mi carrito
                {cartCount > 0 && <span className="bg-pink-600 text-white text-xs px-1.5 py-0.5 rounded-full">{cartCount}</span>}
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-5xl mb-3">🛒</div>
                  <p className="text-sm">Tu carrito está vacío</p>
                </div>
              ) : cart.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  {item.product.images?.[0] ? (
                    <img src={item.product.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-xl">🛍️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{item.product.name}</p>
                    {item.variant && <p className="text-xs text-gray-400">{item.variant.name}</p>}
                    <p className="text-sm font-semibold text-pink-600">${((item.product.base_price + (item.variant?.price_delta || 0)) * item.quantity).toLocaleString("es-CO")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm font-bold flex items-center justify-center">+</button>
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                {netoDisponible !== null && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Neto disponible</span>
                    <span className={cartTotal > netoDisponible * 0.9 ? "text-red-500" : "text-green-600"}>
                      ${netoDisponible.toLocaleString("es-CO")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white">
                  <span>Total</span>
                  <span>${cartTotal.toLocaleString("es-CO")}</span>
                </div>
                <button
                  onClick={() => { setShowCart(false); setShowCheckout(true); }}
                  className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-semibold transition-all shadow-sm text-sm"
                >
                  Ir a pagar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Confirmar compra</h2>
              <button onClick={() => setShowCheckout(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Resumen */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1.5">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 line-clamp-1">
                      {item.product.name} {item.variant ? `(${item.variant.name})` : ""} ×{item.quantity}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${((item.product.base_price + (item.variant?.price_delta || 0)) * item.quantity).toLocaleString("es-CO")}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-600 pt-1.5 flex justify-between font-bold text-gray-900 dark:text-white">
                  <span>Total</span>
                  <span>${cartTotal.toLocaleString("es-CO")}</span>
                </div>
              </div>

              {/* Forma de pago */}
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Forma de pago</p>
                <div className="space-y-2">
                  {(["1q", "2q", "3q", "4q"] as const).map(mode => {
                    const isDisabled = mode !== "1q" && cart.some(i => !i.product.allow_financing);
                    const installments = parseInt(mode[0]);
                    const perInstallment = Math.ceil(cartTotal / installments);
                    const coversWithNeto = netoDisponible !== null && cartTotal <= netoDisponible * 0.9;
                    return (
                      <label key={mode} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isDisabled ? "opacity-40 cursor-not-allowed" : paymentMode === mode ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20" : "border-gray-200 dark:border-gray-600 hover:border-pink-300"}`}>
                        <input
                          type="radio" name="paymentMode" value={mode}
                          checked={paymentMode === mode}
                          disabled={isDisabled}
                          onChange={() => setPaymentMode(mode)}
                          className="text-pink-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {mode === "1q" ? "1 quincena (pago único)" : `${installments} quincenas`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {mode === "1q"
                              ? coversWithNeto ? "✅ Aprobación automática" : "❌ Fondos insuficientes para aprobación automática"
                              : `$${perInstallment.toLocaleString("es-CO")}/quincena · Requiere aprobación admin`}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas (opcional)</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="Instrucciones de entrega, etc."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                />
              </div>

              {/* Info pago */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-600 dark:text-blue-400">
                💳 El pago se descuenta directamente de tu producido. No se realizan pagos en efectivo.
              </div>

              {checkoutResult && !checkoutResult.success && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                  {checkoutResult.message}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="flex-1 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {checkoutLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirmar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de "Mis pedidos" para modelos
function ModelOrders({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
      shop_products: { name: string; images: string[] };
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
      .then(d => setOrders(d))
      .finally(() => setLoading(false));
  }, [token]);

  async function cancelOrder(id: string) {
    if (!confirm("¿Cancelar este pedido? El stock y cualquier descuento será reintegrado.")) return;
    setCancelling(id);
    const res = await fetch(`/api/shop/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "cancelado" })
    });
    if (res.ok) {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "cancelado" } : o));
    } else {
      const e = await res.json();
      alert(e.error || "Error al cancelar");
    }
    setCancelling(null);
  }

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pendiente:      { label: "Pendiente",       color: "bg-yellow-100 text-yellow-700" },
    reservado:      { label: "Esperando aprobación", color: "bg-blue-100 text-blue-700" },
    aprobado:       { label: "Aprobado",         color: "bg-emerald-100 text-emerald-700" },
    en_preparacion: { label: "En preparación",   color: "bg-indigo-100 text-indigo-700" },
    entregado:      { label: "Entregado ✓",      color: "bg-green-100 text-green-700" },
    cancelado:      { label: "Cancelado",        color: "bg-red-100 text-red-700" },
    expirado:       { label: "Expirado",         color: "bg-gray-100 text-gray-500" }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" /></div>;

  if (orders.length === 0) return (
    <div className="text-center py-16 text-gray-500">
      <div className="text-5xl mb-3">📋</div>
      <p className="font-medium">No tienes pedidos aún</p>
      <p className="text-sm mt-1">Explora el catálogo para hacer tu primera compra</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <div key={order.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[order.status]?.color}`}>
                  {STATUS_LABELS[order.status]?.label}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                  {order.payment_mode === "1q" ? "1 quincena" : `${order.payment_mode[0]} quincenas`}
                </span>
              </div>
              <div className="space-y-1">
                {order.shop_order_items.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    {item.shop_products?.images?.[0] && (
                      <img src={item.shop_products.images[0]} alt="" className="w-6 h-6 rounded object-cover" />
                    )}
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.shop_products?.name} {item.shop_product_variants ? `· ${item.shop_product_variants.name}` : ""} ×{item.quantity}
                    </span>
                  </div>
                ))}
              </div>
              {order.shop_financing?.[0] && order.payment_mode !== "1q" && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  💳 {order.shop_financing[0].installments} cuotas de ${order.shop_financing[0].amount_per_installment.toLocaleString("es-CO")}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-gray-900 dark:text-white">${order.total.toLocaleString("es-CO")}</p>
              {order.status === "en_preparacion" && (
                <button
                  onClick={() => cancelOrder(order.id)}
                  disabled={cancelling === order.id}
                  className="mt-2 text-xs text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-1 rounded-xl transition-colors disabled:opacity-50"
                >
                  {cancelling === order.id ? "..." : "Cancelar"}
                </button>
              )}
              {order.status === "en_preparacion" && (
                <button
                  onClick={async () => {
                    const res = await fetch(`/api/shop/orders/${order.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ status: "entregado" })
                    });
                    if (res.ok) setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "entregado" } : o));
                  }}
                  className="mt-1 block text-xs text-green-600 hover:text-green-700 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 px-2.5 py-1 rounded-xl transition-colors"
                >
                  Marcar recibido
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
