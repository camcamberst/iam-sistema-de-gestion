"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppleDropdown from "@/components/ui/AppleDropdown";
import PageHeader from "@/components/ui/PageHeader";

interface Group { id: string; name: string; }
interface InventoryRow {
  id: string;
  product_id: string;
  variant_id: string | null;
  location_type: string;
  location_id: string | null;
  quantity: number;
  reserved: number;
  shop_products: { id: string; name: string; images: string[]; min_stock_alert: number; base_price: number; };
  shop_product_variants: { id: string; name: string; } | null;
}
interface Transfer {
  id: string;
  product_id: string;
  quantity: number;
  from_location_type: string;
  from_location_id: string | null;
  to_location_type: string;
  to_location_id: string | null;
  notes: string | null;
  created_at: string;
  shop_products: { name: string };
  users: { email: string };
}

export default function ShopInventoryPage() {
  return <ShopInventoryContent isInsideHub={false} />;
}

export function ShopInventoryContent({ isInsideHub = false }: { isInsideHub?: boolean }) {
  const inputStyle = isInsideHub
    ? "w-full px-4 h-9 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-[11px] font-bold focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 shadow-inner"
    : "w-full px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 shadow-inner";

  const textareaStyle = isInsideHub
    ? "w-full px-4 py-2 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-[1.25rem] text-[11px] font-bold focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 resize-none placeholder-zinc-400 shadow-inner"
    : "w-full px-4 py-3.5 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 resize-none placeholder-zinc-400 shadow-inner";

  const actionBtnStyle = isInsideHub
    ? "px-4 h-9 flex items-center justify-center bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white text-[11px] font-bold !rounded-full transition-all shadow-md shadow-cyan-500/20 dark:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 gap-2 cursor-pointer border-none"
    : "px-5 py-3 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 dark:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer border-none";

  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userGroupId, setUserGroupId] = useState<string | null>(null);
  const [tab, setTab] = useState<"stock" | "transfer" | "history">("stock");

  // Add stock form
  const [addForm, setAddForm] = useState({
    product_id: "", variant_id: "", location_type: "sede",
    location_id: "", quantity_delta: ""
  });
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Transfer form
  const [transForm, setTransForm] = useState({
    product_id: "", variant_id: "",
    from_location_type: "bodega", from_location_id: "",
    to_location_type: "sede", to_location_id: "",
    quantity: "", notes: ""
  });
  const [transError, setTransError] = useState("");
  const [transSaving, setTransSaving] = useState(false);

  // Products for selects
  const [products, setProducts] = useState<Array<{ id: string; name: string; shop_product_variants?: Array<{ id: string; name: string }> }>>([]);
  const [filterLocation, setFilterLocation] = useState("all");
  const searchParams = useSearchParams();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const { data: profile } = await supabase.from("users").select("role, group_id").eq("id", session.user.id).single();
    setUserRole(profile?.role || "");
    setUserGroupId(profile?.group_id || null);

    const authHeader = { Authorization: `Bearer ${session.access_token}` };
    const [invRes, grpRes, prodRes, transRes] = await Promise.all([
      fetch("/api/shop/inventory", { headers: authHeader }),
      fetch("/api/groups", { headers: authHeader }),
      fetch("/api/shop/products?active_only=false", { headers: authHeader }),
      fetch("/api/shop/inventory/transfer?limit=100", { headers: authHeader })
    ]);

    if (invRes.ok) setInventory(await invRes.json());
    if (grpRes.ok) {
      const grpData = await grpRes.json();
      if (grpData?.success && grpData?.groups) setGroups(grpData.groups);
    }
    if (prodRes.ok) setProducts(await prodRes.json());
    if (transRes.ok) setTransfers(await transRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Prellenar "Agregar unidades" si se llega desde productos (duplicado o "Agregar unidades")
  useEffect(() => {
    const productId = searchParams.get("product_id");
    const add = searchParams.get("add");
    if (productId && add === "1") {
      setTab("stock");
      setAddForm(f => ({ ...f, product_id: productId }));
    }
  }, [searchParams]);

  function getLocationLabel(type: string, id: string | null) {
    if (type === "bodega") return "Bodega Principal";
    const g = groups.find(g => g.id === id);
    return g ? `Sede ${g.name}` : "Sede desconocida";
  }

  const filteredInventory = filterLocation === "all"
    ? inventory
    : filterLocation === "bodega"
    ? inventory.filter(r => r.location_type === "bodega")
    : inventory.filter(r => r.location_type === "sede" && r.location_id === filterLocation);

  async function handleAddStock() {
    setAddError("");
    if (!addForm.product_id || !addForm.quantity_delta) { setAddError("Completa todos los campos"); return; }
    setAddSaving(true);
    const res = await fetch("/api/shop/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        product_id: addForm.product_id,
        variant_id: addForm.variant_id || null,
        location_type: addForm.location_type,
        location_id: addForm.location_id || null,
        quantity_delta: parseInt(addForm.quantity_delta)
      })
    });
    if (res.ok) {
      setAddForm({ product_id: "", variant_id: "", location_type: "sede", location_id: "", quantity_delta: "" });
      loadData();
    } else {
      const err = await res.json();
      setAddError(err.error || "Error");
    }
    setAddSaving(false);
  }

  async function handleTransfer() {
    setTransError("");
    if (!transForm.product_id || !transForm.quantity) { setTransError("Completa todos los campos"); return; }
    setTransSaving(true);
    const res = await fetch("/api/shop/inventory/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        product_id: transForm.product_id,
        variant_id: transForm.variant_id || null,
        from_location_type: transForm.from_location_type,
        from_location_id: transForm.from_location_id || null,
        to_location_type: transForm.to_location_type,
        to_location_id: transForm.to_location_id || null,
        quantity: parseInt(transForm.quantity),
        notes: transForm.notes || null
      })
    });
    if (res.ok) {
      setTransForm({ product_id: "", variant_id: "", from_location_type: "bodega", from_location_id: "", to_location_type: "sede", to_location_id: "", quantity: "", notes: "" });
      loadData();
    } else {
      const err = await res.json();
      setTransError(err.error || "Error");
    }
    setTransSaving(false);
  }

  const selectedProduct = products.find(p => p.id === addForm.product_id);
  const selectedTransProduct = products.find(p => p.id === transForm.product_id);

  const canBodega = userRole === "super_admin" || userRole === "superadmin_aff";

  const productOptions = useMemo(() => [
    { value: "", label: "Seleccionar..." },
    ...products.map(p => ({ value: p.id, label: p.name }))
  ], [products]);

  const locationOptionsAdd = useMemo(() => [
    ...(canBodega ? [{ value: "bodega", label: "Bodega principal" }] : []),
    ...groups.map(g => ({ value: g.id, label: `Sede ${g.name}` }))
  ], [canBodega, groups]);

  const locationOptionsFilter = useMemo(() => [
    { value: "all", label: "Todas" },
    ...(canBodega ? [{ value: "bodega", label: "Bodega Principal" }] : []),
    ...groups.map(g => ({ value: g.id, label: `Sede ${g.name}` }))
  ], [canBodega, groups]);

  const addLocationValue = addForm.location_type === "bodega" ? "bodega" : addForm.location_id || "";
  const transFromValue = transForm.from_location_type === "bodega" ? "bodega" : transForm.from_location_id || "";
  const transToValue = transForm.to_location_type === "bodega" ? "bodega" : transForm.to_location_id || "";

  return (
    <div className={isInsideHub ? "absolute inset-0 flex flex-col overflow-hidden rounded-b-[2rem]" : "min-h-screen bg-transparent"}>
      <div className={isInsideHub ? "flex flex-col flex-1 overflow-hidden" : "max-w-7xl mx-auto pb-12"}>
        {!isInsideHub && (
          <Link href="/admin/shop" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-violet-500 mb-3 transition-colors max-sm:px-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Dashboard
          </Link>
        )}

        {!isInsideHub && (
          <PageHeader 
            title="Inventario de AIM Market"
            subtitle="Control de existencias por ubicación, gestión de entradas de stock y traslados logísticos."
            glow="superadmin"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
        )}

        {/* Tabs al estilo Apple/macOS pastilla */}
        <div className={isInsideHub ? "px-6 pt-6 pb-8 flex-shrink-0 flex items-center justify-between flex-wrap gap-3" : "mb-6 px-1 sm:px-2 flex items-center justify-between flex-wrap gap-3"}>
          <div className="flex flex-wrap gap-1.5 p-1 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-full backdrop-blur-md shadow-inner">
            {[
              { key: "stock", label: "Stock actual" },
              { key: "transfer", label: "Traslados" },
              { key: "history", label: "Historial" }
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`${isInsideHub ? "px-4 h-9 flex items-center justify-center" : "px-4 py-2"} text-[11px] font-bold rounded-full transition-all duration-300 border-none cursor-pointer gap-1.5 ${
                  tab === t.key 
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_3px_10px_rgba(139,92,246,0.3)] scale-[1.02]" 
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] bg-transparent"
                }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TAB: Stock actual */}
        {tab === "stock" && (
          <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll space-y-5" : "space-y-5"}>
            {/* Agregar unidades form */}
            <div className="glass-card !rounded-[2rem] p-6 relative z-20 border border-black/5 dark:border-white/[0.05] mb-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 relative z-10">Agregar Unidades</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5 relative z-10 leading-relaxed">Elige el producto y la sede donde se agregan las unidades (evita crear productos duplicados; si ya existe, solo agrega stock aquí).</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-20">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Producto</label>
                  <AppleDropdown
                    options={productOptions}
                    value={addForm.product_id}
                    onChange={v => setAddForm(f => ({ ...f, product_id: v, variant_id: "" }))}
                    placeholder="Seleccionar..."
                    className="w-full max-w-full"
                    variant="input"
                    pill={true}
                    theme="violet"
                    maxHeight="max-h-[124px]"
                    size={isInsideHub ? "sm" : "md"}
                  />
                </div>
                {selectedProduct?.shop_product_variants && selectedProduct.shop_product_variants.length > 0 ? (
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Variante</label>
                    <AppleDropdown
                      options={[{ value: "", label: "Sin variante" }, ...selectedProduct.shop_product_variants.map(v => ({ value: v.id, label: v.name }))]}
                      value={addForm.variant_id}
                      onChange={v => setAddForm(f => ({ ...f, variant_id: v }))}
                      placeholder="Sin variante"
                      className="w-full max-w-full"
                      variant="input"
                      pill={true}
                      theme="violet"
                      maxHeight="max-h-[124px]"
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                ) : (
                  <div className="hidden lg:block opacity-0 pointer-events-none" />
                )}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Sede</label>
                  <AppleDropdown
                    options={locationOptionsAdd}
                    value={addLocationValue}
                    onChange={v => {
                      if (v === "bodega") setAddForm(f => ({ ...f, location_type: "bodega", location_id: "" }));
                      else setAddForm(f => ({ ...f, location_type: "sede", location_id: v }));
                    }}
                    placeholder="Selecciona sede"
                    className="w-full max-w-full"
                    variant="input"
                    pill={true}
                    theme="violet"
                    maxHeight="max-h-[124px]"
                    size={isInsideHub ? "sm" : "md"}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Unidades</label>
                  <input 
                    type="number" 
                    value={addForm.quantity_delta} 
                    onChange={e => setAddForm(f => ({ ...f, quantity_delta: e.target.value }))} 
                    placeholder="Ej. 10 o -2" 
                    className={inputStyle} 
                  />
                </div>
              </div>
              
              {addError && <p className="text-rose-500 text-xs mt-3 relative z-10 font-bold text-center">{addError}</p>}
              
              <div className="flex justify-center w-full mt-4 relative z-10">
                <button 
                  onClick={handleAddStock} 
                  disabled={addSaving} 
                  className={actionBtnStyle}
                >
                  {addSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Actualizar stock
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-3 px-1 sm:px-2 mb-4">
              <span className="text-xs font-bold text-zinc-500">Filtrar por Ubicación:</span>
              <div className="min-w-[200px]">
                <AppleDropdown
                  options={locationOptionsFilter}
                  value={filterLocation}
                  onChange={setFilterLocation}
                  placeholder="Todas"
                  className="w-full max-w-full"
                  pill={isInsideHub}
                  theme="violet"
                  maxHeight="max-h-[124px]"
                  size={isInsideHub ? "sm" : "md"}
                />
              </div>
            </div>

            {/* Grid Listado */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin w-8 h-8 border-b-2 border-violet-600 rounded-full" />
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
                {/* Ambient Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                
                <div className="w-16 h-16 bg-gradient-to-tr from-violet-500/10 via-violet-500/5 to-transparent rounded-2xl border border-violet-500/20 dark:border-violet-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(139,92,246,0.08)] relative z-10">
                  <svg className="w-7 h-7 text-violet-500 dark:text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">Sin stock</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">Actualmente no existen registros de inventario para este filtro.</p>
              </div>
            ) : (
              <div className="glass-card !rounded-[2rem] p-5 border border-black/5 dark:border-white/[0.05] space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between px-2 pb-2.5 border-b border-black/[0.03] dark:border-white/[0.03]">
                  <span className="text-[10.5px] font-bold text-zinc-400">Detalle del Producto</span>
                  <span className="text-[10.5px] font-bold text-zinc-400 text-right pr-2">Disponibilidad de Unidades</span>
                </div>
                <div className="space-y-2">
                  {filteredInventory.map(row => {
                    const available = row.quantity - row.reserved;
                    const isLow = available <= row.shop_products.min_stock_alert;
                    return (
                      <div key={row.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl gap-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-200 group">
                        <div className="flex items-center gap-3">
                          {row.shop_products.images?.[0] ? (
                            <img src={row.shop_products.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-lg select-none">🛍️</div>
                          )}
                          <div>
                            <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{row.shop_products.name}</p>
                            <p className="text-[10.5px] font-bold text-zinc-400 mt-0.5">
                              {row.shop_product_variants?.name || "Sin variante"} · {getLocationLabel(row.location_type, row.location_id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-black/[0.03] dark:border-white/[0.03]">
                          <div className="flex items-center gap-4 px-4 py-1.5 bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/15 dark:border-violet-500/25 rounded-full backdrop-blur-md">
                            {/* Disponible */}
                            <div className="text-center min-w-[55px]">
                              <div className="flex items-center justify-center gap-1">
                                <span className={`text-sm font-extrabold ${isLow ? 'text-rose-500 animate-pulse' : 'text-violet-600 dark:text-violet-400'}`}>
                                  {available}
                                </span>
                                {isLow && (
                                  <svg className="w-3 h-3 text-rose-500 animate-pulse shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                )}
                              </div>
                              <p className="text-[8.5px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Disponible</p>
                            </div>
                            
                            <div className="w-px h-6 bg-violet-500/20 dark:bg-violet-500/30 self-center" />
                            
                            {/* Reservado */}
                            <div className="text-center min-w-[55px]">
                              <span className="text-sm font-bold text-violet-400 dark:text-violet-500 block">
                                {row.reserved}
                              </span>
                              <p className="text-[8.5px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Reservado</p>
                            </div>
                            
                            <div className="w-px h-6 bg-violet-500/20 dark:bg-violet-500/30 self-center" />
                            
                            {/* Total */}
                            <div className="text-center min-w-[55px]">
                              <span className="text-sm font-extrabold text-violet-800 dark:text-white block">
                                {row.quantity}
                              </span>
                              <p className="text-[8.5px] font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">Total</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Traslado */}
        {tab === "transfer" && (
          <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll" : ""}>
            <div className="glass-card !rounded-[2rem] p-6 relative z-20 border border-black/5 dark:border-white/[0.05] max-w-2xl mx-auto">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-2 relative z-10">Trasladar Stock</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5 relative z-10 leading-relaxed">Traslada unidades de un producto entre tu Bodega Principal y tus diferentes Sedes de manera inmediata.</p>
              
              <div className="space-y-5 relative z-10">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Producto</label>
                  <AppleDropdown
                    options={[{ value: "", label: "Seleccionar producto..." }, ...products.map(p => ({ value: p.id, label: p.name }))]}
                    value={transForm.product_id}
                    onChange={v => setTransForm(f => ({ ...f, product_id: v, variant_id: "" }))}
                    placeholder="Seleccionar producto..."
                    className="w-full max-w-full"
                    variant="input"
                    pill={true}
                    theme="violet"
                    maxHeight="max-h-[124px]"
                    size={isInsideHub ? "sm" : "md"}
                  />
                </div>
                {selectedTransProduct?.shop_product_variants && selectedTransProduct.shop_product_variants.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Variante</label>
                    <AppleDropdown
                      options={[{ value: "", label: "Sin variante" }, ...selectedTransProduct.shop_product_variants.map(v => ({ value: v.id, label: v.name }))]}
                      value={transForm.variant_id}
                      onChange={v => setTransForm(f => ({ ...f, variant_id: v }))}
                      placeholder="Sin variante"
                      className="w-full max-w-full"
                      variant="input"
                      pill={true}
                      theme="violet"
                      maxHeight="max-h-[124px]"
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Origen</label>
                    <AppleDropdown
                      options={locationOptionsAdd}
                      value={transFromValue}
                      onChange={v => {
                        if (v === "bodega") setTransForm(f => ({ ...f, from_location_type: "bodega", from_location_id: "" }));
                        else setTransForm(f => ({ ...f, from_location_type: "sede", from_location_id: v }));
                      }}
                      placeholder="Selecciona origen"
                      className="w-full max-w-full"
                      variant="input"
                      pill={true}
                      theme="violet"
                      maxHeight="max-h-[124px]"
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Destino</label>
                    <AppleDropdown
                      options={locationOptionsAdd}
                      value={transToValue}
                      onChange={v => {
                        if (v === "bodega") setTransForm(f => ({ ...f, to_location_type: "bodega", to_location_id: "" }));
                        else setTransForm(f => ({ ...f, to_location_type: "sede", to_location_id: v }));
                      }}
                      placeholder="Selecciona destino"
                      className="w-full max-w-full"
                      variant="input"
                      pill={true}
                      theme="violet"
                      maxHeight="max-h-[124px]"
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Cantidad</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={transForm.quantity} 
                    onChange={e => setTransForm(f => ({ ...f, quantity: e.target.value }))} 
                    className={inputStyle} 
                    placeholder="Ej. 5" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Notas (opcional)</label>
                  <textarea 
                    value={transForm.notes} 
                    onChange={e => setTransForm(f => ({ ...f, notes: e.target.value }))} 
                    rows={2} 
                    className={textareaStyle} 
                    placeholder="Razón del traslado..." 
                  />
                </div>
                
                {transError && <p className="text-rose-500 text-xs mt-2 font-bold text-center">{transError}</p>}
                
                <div className="flex justify-center w-full mt-4 relative z-10">
                  <button 
                    onClick={handleTransfer} 
                    disabled={transSaving} 
                    className={actionBtnStyle}
                  >
                    {transSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Confirmar traslado
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Historial */}
        {tab === "history" && (
          <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll" : ""}>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin w-8 h-8 border-b-2 border-violet-600 rounded-full" />
              </div>
            ) : transfers.length === 0 ? (
              <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
                {/* Ambient Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                
                <div className="w-16 h-16 bg-gradient-to-tr from-violet-500/10 via-violet-500/5 to-transparent rounded-2xl border border-violet-500/20 dark:border-violet-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(139,92,246,0.08)] relative z-10">
                  <svg className="w-7 h-7 text-violet-500 dark:text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h-2a2 2 0 00-2 2v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">Sin traslados</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">No se han registrado operaciones de traslado de inventario.</p>
              </div>
            ) : (
              <div className="glass-card !rounded-[2rem] p-5 border border-black/5 dark:border-white/[0.05] space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between px-2 pb-2.5 border-b border-black/[0.03] dark:border-white/[0.03]">
                  <span className="text-[10.5px] font-bold text-zinc-400">Detalles de la Operación</span>
                  <span className="text-[10.5px] font-bold text-zinc-400 text-right pr-2">Autorización y Cantidad</span>
                </div>
                <div className="space-y-2">
                  {transfers.map(t => (
                    <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl gap-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-200">
                      <div>
                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{t.shop_products?.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10.5px] font-bold text-zinc-400">
                          <span className="text-zinc-500">{getLocationLabel(t.from_location_type, t.from_location_id)}</span>
                          <span className="text-violet-600">➔</span>
                          <span className="text-zinc-700 dark:text-zinc-300">{getLocationLabel(t.to_location_type, t.to_location_id)}</span>
                        </div>
                        {t.notes && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 italic bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.03] dark:border-white/[0.03] px-2.5 py-1 rounded-lg w-fit">
                            &quot;{t.notes}&quot;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 border-black/[0.03] dark:border-white/[0.03]">
                        <div className="text-right min-w-[70px]">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">{t.users?.email?.split("@")[0]}</span>
                          <p className="text-[9.5px] font-bold text-zinc-400">Usuario</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                            {new Date(t.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <p className="text-[9.5px] font-bold text-zinc-400">Fecha</p>
                        </div>
                        <div className="text-right min-w-[50px]">
                          <span className="text-lg font-extrabold text-violet-600 dark:text-violet-400">{t.quantity}</span>
                          <p className="text-[9.5px] font-bold text-zinc-400">Cantidad</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
