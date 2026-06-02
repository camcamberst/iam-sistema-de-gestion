"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppleDropdown from "@/components/ui/AppleDropdown";
import PageHeader from "@/components/ui/PageHeader";

interface Promotion {
  id: string;
  name: string;
  type: string;
  value: number | null;
  product_id: string | null;
  category_id: string | null;
  min_quantity: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  shop_products?: { name: string } | null;
  shop_categories?: { name: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  percentage: "% Descuento",
  fixed: "Descuento fijo",
  "2x1": "2×1",
  category: "Categoría %"
};

export default function ShopPromotionsPage() {
  return <ShopPromotionsContent isInsideHub={false} />;
}

export function ShopPromotionsContent({ isInsideHub = false }: { isInsideHub?: boolean }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPromo, setEditPromo] = useState<Promotion | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [search, setSearch] = useState("");

  const filteredPromotions = useMemo(() => {
    return promotions.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.type && TYPE_LABELS[p.type]?.toLowerCase().includes(search.toLowerCase())) ||
      (p.shop_products?.name && p.shop_products.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.shop_categories?.name && p.shop_categories.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [promotions, search]);

  const [form, setForm] = useState({
    name: "", type: "percentage", value: "",
    product_id: "", category_id: "", min_quantity: "1",
    starts_at: "", ends_at: "", is_active: true
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);
    const { data: profile } = await supabase.from("users").select("role").eq("id", session.user.id).single();
    setUserRole(profile?.role || "");

    const [promoRes, prodRes, catRes] = await Promise.all([
      fetch("/api/shop/promotions?active_only=false", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch("/api/shop/products?active_only=false"),
      fetch("/api/shop/categories")
    ]);
    if (promoRes.ok) setPromotions(await promoRes.json());
    if (prodRes.ok) setProducts(await prodRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!showModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showModal]);

  function openCreate() {
    setEditPromo(null);
    setForm({ name: "", type: "percentage", value: "", product_id: "", category_id: "", min_quantity: "1", starts_at: "", ends_at: "", is_active: true });
    setShowModal(true);
  }

  function openEdit(p: Promotion) {
    setEditPromo(p);
    setForm({
      name: p.name, type: p.type, value: p.value !== null ? String(p.value) : "",
      product_id: p.product_id || "", category_id: p.category_id || "",
      min_quantity: String(p.min_quantity),
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : "",
      is_active: p.is_active
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.type) { alert("Nombre y tipo son requeridos"); return; }
    setSaving(true);
    const payload = {
      id: editPromo?.id,
      name: form.name, type: form.type,
      value: form.value ? parseFloat(form.value) : null,
      product_id: form.product_id || null,
      category_id: form.category_id || null,
      min_quantity: parseInt(form.min_quantity),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: form.is_active
    };

    const res = await fetch("/api/shop/promotions", {
      method: editPromo ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });

    if (res.ok) { setShowModal(false); loadData(); }
    else { const err = await res.json(); alert(err.error || "Error"); }
    setSaving(false);
  }

  function getStatusBadge(p: Promotion) {
    const now = new Date();
    if (!p.is_active) return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">Inactiva</span>;
    if (p.ends_at && new Date(p.ends_at) < now) return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Vencida</span>;
    if (p.starts_at && new Date(p.starts_at) > now) return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Programada</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Activa</span>;
  }

  const typeOptions = useMemo(() => [
    { value: "percentage", label: "% Descuento" },
    { value: "fixed", label: "Monto fijo" },
    { value: "2x1", label: "2×1" },
    { value: "category", label: "Categoría %" }
  ], []);
  const productOptions = useMemo(() => [
    { value: "", label: "Todos" },
    ...products.map(p => ({ value: p.id, label: p.name }))
  ], [products]);
  const categoryOptions = useMemo(() => [
    { value: "", label: "Todas" },
    ...categories.map(c => ({ value: c.id, label: c.name }))
  ], [categories]);

  return (
    <div className={isInsideHub ? "absolute inset-0 flex flex-col overflow-hidden rounded-b-[2rem]" : "min-h-screen bg-transparent"}>
      <div className={isInsideHub ? "flex flex-col flex-1 overflow-hidden" : "max-w-7xl mx-auto pb-12"}>
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
            title="Promociones de AIM Market"
            subtitle="Crea cupones, descuentos de porcentaje, montos fijos o campañas de 2x1."
            glow="superadmin"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 3h2zm-5 8h10M5 21h14a2 2 0 002-2V11a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            }
            actions={
              <button 
                onClick={openCreate} 
                className="flex items-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-full font-bold transition-all shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 border-none cursor-pointer text-xs"
              >
                <span>Nueva promoción</span>
              </button>
            }
          />
        )}

        {/* Header de Búsqueda y Acción */}
        <div className={isInsideHub ? "px-6 pt-6 pb-8 flex-shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between" : "flex flex-col sm:flex-row gap-3 mb-6 px-1 sm:px-2 items-center"}>
          <div className="relative flex-1 w-full">
            <svg className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 ${isInsideHub ? "left-3.5 w-3.5 h-3.5" : "left-3.5 w-4 h-4"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" 
              placeholder="Buscar promoción..."
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className={`w-full pr-4 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus:ring-2 focus:ring-purple-500 outline-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all shadow-inner ${isInsideHub ? "rounded-full h-9 pl-9 text-[11px] font-bold" : "rounded-xl h-10 pl-10 text-sm"}`}
            />
          </div>
          <button 
            onClick={openCreate} 
            className="flex items-center justify-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 h-9 rounded-full font-bold transition-all shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 cursor-pointer border-none text-[11px] shrink-0 max-sm:w-full"
          >
            <span>Nueva promoción</span>
          </button>
        </div>

        {/* Promotions Content */}
        <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll" : ""}>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-8 h-8 border-b-2 border-pink-600 rounded-full" />
            </div>
          ) : promotions.length === 0 ? (
            <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
              {/* Ambient Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
              
              <div className="w-16 h-16 bg-gradient-to-tr from-purple-500/10 via-purple-500/5 to-transparent rounded-2xl border border-purple-500/20 dark:border-purple-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(168,85,247,0.08)] relative z-10">
                <svg className="w-7 h-7 text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM9 16h6M9 12h6" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">No hay promociones</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">Crea la primera campaña de descuento usando el botón superior.</p>
            </div>
          ) : (
            <div className="glass-card !rounded-[2rem] p-5 border border-black/5 dark:border-white/[0.05] space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between px-2 pb-2.5 border-b border-black/[0.03] dark:border-white/[0.03]">
                <span className="text-[10.5px] font-bold text-zinc-400">Detalles de la Campaña</span>
                <span className="text-[10.5px] font-bold text-zinc-400 text-right pr-2">Monto y Estatus</span>
              </div>
              <div className="space-y-2">
                {filteredPromotions.map(p => (
                  <div 
                    key={p.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl gap-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-200 group ${
                      p.is_active ? "" : "opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{p.name}</span>
                        <span className="text-[9.5px] font-extrabold bg-pink-600/10 text-pink-600 px-2 py-0.5 rounded-md">
                          {TYPE_LABELS[p.type] || p.type}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 leading-relaxed">
                        Aplica a: <strong className="text-zinc-700 dark:text-zinc-300">{p.shop_products?.name || p.shop_categories?.name || "Todos los productos"}</strong>
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-medium">
                        Vigencia: {p.starts_at ? new Date(p.starts_at).toLocaleDateString("es-CO") : "Inmediato"} —{" "}
                        {p.ends_at ? new Date(p.ends_at).toLocaleDateString("es-CO") : "Sin vencimiento"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-black/[0.03] dark:border-white/[0.03]">
                      <div className="text-right min-w-[70px]">
                        <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                          {p.type === "2x1" ? "2×1" : p.value !== null ? (p.type === "fixed" ? `$${p.value.toLocaleString("es-CO")}` : `${p.value}%`) : "—"}
                        </span>
                        <p className="text-[9.5px] font-bold text-zinc-400">Beneficio</p>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <div className="flex justify-end">{getStatusBadge(p)}</div>
                        <p className="text-[9.5px] font-bold text-zinc-400 mt-0.5">Estatus</p>
                      </div>
                      <button 
                        onClick={() => openEdit(p)} 
                        className="px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer text-center bg-black/[0.03] dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white border border-black/5 dark:border-white/5 shadow-inner"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {showModal && (() => {
        const inputClass = isInsideHub 
          ? "w-full px-4 py-2 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-[11px] font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner" 
          : "w-full px-4 h-11 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner";
        
        const dateInputClass = isInsideHub 
          ? "w-full px-4 py-2 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-[11px] font-bold focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 shadow-inner cursor-pointer" 
          : "w-full px-4 h-11 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 shadow-inner cursor-pointer";

        const modalContent = (
          <div className={isInsideHub ? "absolute -inset-4 sm:-inset-6 md:-inset-8 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm rounded-[2rem]" : "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md"} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
            <div className={`bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 w-full relative flex flex-col overflow-hidden ${isInsideHub ? 'max-w-md' : 'max-w-lg'}`} onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className={`flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05] relative z-10 ${isInsideHub ? 'p-4 sm:p-5' : 'p-6'}`}>
                <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">{editPromo ? "Editar" : "Nueva"} Promoción</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-purple-500/10 hover:text-purple-500 hover:border-purple-500/30 hover:shadow-[0_0_12px_rgba(168,85,247,0.4)] transition-all duration-300 cursor-pointer text-zinc-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className={`space-y-3.5 relative z-10 overflow-y-auto apple-scroll ${isInsideHub ? 'p-4 sm:p-5 max-h-[55vh]' : 'p-6 max-h-[60vh]'}`}>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Nombre</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Ej. 20% descuento Belleza" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Tipo</label>
                    <AppleDropdown
                      options={typeOptions}
                      value={form.type}
                      onChange={v => setForm(f => ({ ...f, type: v }))}
                      placeholder="Tipo"
                      className="w-full max-w-full"
                      variant="input"
                      theme="violet"
                      maxHeight="max-h-[160px]"
                      pill={true}
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                  {form.type !== "2x1" ? (
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">
                        {form.type === "fixed" ? "Descuento (COP)" : "Porcentaje (%)"}
                      </label>
                      <input type="number" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className={inputClass} placeholder="0" />
                    </div>
                  ) : (
                    <div className="hidden sm:block opacity-0 pointer-events-none" />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Producto (opcional)</label>
                    <AppleDropdown
                      options={productOptions}
                      value={form.product_id}
                      onChange={v => setForm(f => ({ ...f, product_id: v }))}
                      placeholder="Todos"
                      className="w-full max-w-full"
                      variant="input"
                      theme="violet"
                      maxHeight="max-h-[160px]"
                      pill={true}
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Categoría (opcional)</label>
                    <AppleDropdown
                      options={categoryOptions}
                      value={form.category_id}
                      onChange={v => setForm(f => ({ ...f, category_id: v }))}
                      placeholder="Todas"
                      className="w-full max-w-full"
                      variant="input"
                      theme="violet"
                      maxHeight="max-h-[160px]"
                      pill={true}
                      size={isInsideHub ? "sm" : "md"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Inicio</label>
                    <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className={dateInputClass} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Vencimiento</label>
                    <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className={dateInputClass} />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-purple-600 bg-black/[0.05] dark:bg-white/[0.05] border-black/10 dark:border-white/10 w-4 h-4 focus:ring-purple-500" />
                  <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Promoción Activa</span>
                </label>
              </div>
              
              <div className={`border-t border-black/[0.05] dark:border-white/[0.05] flex gap-3 justify-end relative z-10 ${isInsideHub ? 'p-4 sm:p-5' : 'p-6'}`}>
                <button onClick={() => setShowModal(false)} className={isInsideHub ? "px-4 py-2 text-[11px] font-bold border border-black/10 dark:border-white/10 !rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer" : "px-5 py-2.5 text-xs font-bold border border-black/10 dark:border-white/10 !rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} className={isInsideHub ? "px-4 py-2 text-[11px] font-bold text-white transition-all shadow-md shadow-cyan-500/25 dark:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer border-none !bg-gradient-to-r !from-cyan-600 !to-fuchsia-600 hover:!from-cyan-500 hover:!to-fuchsia-500 !rounded-full" : "px-6 py-2.5 text-xs font-bold text-white transition-all shadow-md shadow-cyan-500/25 dark:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer border-none !bg-gradient-to-r !from-cyan-600 !to-fuchsia-600 hover:!from-cyan-500 hover:!to-fuchsia-500 !rounded-full"}>
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </div>
        );

        return isInsideHub 
          ? modalContent 
          : typeof document !== "undefined" && document.body 
            ? createPortal(modalContent, document.body) 
            : null;
      })()}
    </div>
  );
}
