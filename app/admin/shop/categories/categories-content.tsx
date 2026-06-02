"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import AppleDropdown from "@/components/ui/AppleDropdown";

interface Aisle {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  is_active: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  is_active: boolean;
  created_at: string;
  aisle_id: string | null;
  shop_aisles?: {
    id: string;
    name: string;
  } | null;
}

export default function ShopCategoriesPage() {
  return <ShopCategoriesContent isInsideHub={false} />;
}

export function ShopCategoriesContent({ isInsideHub = false }: { isInsideHub?: boolean }) {
  const inputStyle = isInsideHub
    ? "w-full px-4 h-9 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-[11px] font-bold focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner"
    : "w-full px-4 h-11 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-full text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner";

  const textareaStyle = isInsideHub
    ? "w-full px-4 py-2 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-[1.25rem] text-[11px] font-bold focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner"
    : "w-full px-4 py-3 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-[1.25rem] text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner";

  const cancelBtnStyle = isInsideHub
    ? "px-5 h-9 flex items-center justify-center text-[11px] font-bold border border-black/10 dark:border-white/10 !rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
    : "px-5 py-2.5 text-xs font-bold border border-black/10 dark:border-white/10 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer";

  const saveBtnStyle = isInsideHub
    ? "px-6 h-9 flex items-center justify-center text-[11px] font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white !rounded-full transition-all shadow-md shadow-cyan-500/25 dark:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 gap-2 cursor-pointer border-none"
    : "px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full transition-all shadow-md shadow-cyan-500/25 dark:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer border-none";

  // Tabs: 'aisles' | 'categories'
  const [activeTab, setActiveTab] = useState<"aisles" | "categories">("aisles");

  // Core data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");

  // Category Modal State
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; is_active: boolean; aisle_id: string | null }>({
    name: "",
    description: "",
    is_active: true,
    aisle_id: null
  });
  const [saving, setSaving] = useState(false);

  // Aisle Modal State
  const [showAisleModal, setShowAisleModal] = useState(false);
  const [editAisle, setEditAisle] = useState<Aisle | null>(null);
  const [aisleForm, setAisleForm] = useState({ name: "", description: "", is_active: true });
  const [savingAisle, setSavingAisle] = useState(false);

  // Filter Categories
  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
    (c.slug && c.slug.toLowerCase().includes(search.toLowerCase()))
  );

  // Filter Aisles
  const filteredAisles = aisles.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.description && a.description.toLowerCase().includes(search.toLowerCase())) ||
    (a.slug && a.slug.toLowerCase().includes(search.toLowerCase()))
  );

  // Group Categories by Aisle
  const groupedCategories: Record<string, { aisleName: string; isAisleActive: boolean; categories: Category[] }> = {};

  filteredCategories.forEach(cat => {
    const aisleId = cat.aisle_id || "unassigned";
    const aisleName = cat.shop_aisles?.name || "Pasillo General / Sin Asignar";
    const isAisleActive = cat.aisle_id ? (aisles.find(a => a.id === cat.aisle_id)?.is_active ?? true) : true;

    if (!groupedCategories[aisleId]) {
      groupedCategories[aisleId] = {
        aisleName,
        isAisleActive,
        categories: []
      };
    }
    groupedCategories[aisleId].categories.push(cat);
  });

  // Aisle Options for Dropdown Select
  const aisleOptions = useMemo(() => [
    { value: "", label: "-- Pasillo General (Sin Asignar) --" },
    ...aisles.map(a => ({ value: a.id, label: a.name + (!a.is_active ? " (Inactivo)" : "") }))
  ], [aisles]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);
      
      const { data: profile } = await supabase.from("users").select("role").eq("id", session.user.id).single();
      setUserRole(profile?.role || "");
      
      // Fetch categories
      const resCat = await fetch("/api/shop/categories");
      if (resCat.ok) {
        setCategories(await resCat.json());
      }
      
      // Fetch aisles (crash-proof)
      try {
        const resAisle = await fetch("/api/shop/aisles");
        if (resAisle.ok) {
          setAisles(await resAisle.json());
        }
      } catch (err) {
        console.warn("Table shop_aisles might not be created yet. Run the SQL migration.", err);
      }
    } catch (error) {
      console.error("Error loading shop data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Category Actions ---
  function openCreate() {
    setEditCat(null);
    setForm({ name: "", description: "", is_active: true, aisle_id: null });
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditCat(c);
    setForm({ name: c.name, description: c.description || "", is_active: c.is_active, aisle_id: c.aisle_id || null });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name) { alert("El nombre es requerido"); return; }
    setSaving(true);
    const res = await fetch("/api/shop/categories", {
      method: editCat ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editCat ? { id: editCat.id, ...form } : form)
    });
    if (res.ok) { setShowModal(false); loadData(); }
    else { const e = await res.json(); alert(e.error || "Error al guardar"); }
    setSaving(false);
  }

  async function toggleActive(cat: Category) {
    const res = await fetch("/api/shop/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: cat.id, is_active: !cat.is_active })
    });
    if (res.ok) {
      loadData();
    } else {
      const e = await res.json();
      alert(e.error || "Error al actualizar el estado de la categoría");
    }
  }

  // --- Aisle Actions ---
  function openCreateAisle() {
    setEditAisle(null);
    setAisleForm({ name: "", description: "", is_active: true });
    setShowAisleModal(true);
  }

  function openEditAisle(a: Aisle) {
    setEditAisle(a);
    setAisleForm({ name: a.name, description: a.description || "", is_active: a.is_active });
    setShowAisleModal(true);
  }

  async function handleSaveAisle() {
    if (!aisleForm.name) { alert("El nombre del pasillo es requerido"); return; }
    setSavingAisle(true);
    const res = await fetch("/api/shop/aisles", {
      method: editAisle ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editAisle ? { id: editAisle.id, ...aisleForm } : aisleForm)
    });
    if (res.ok) { setShowAisleModal(false); loadData(); }
    else { const e = await res.json(); alert(e.error || "Error al guardar el pasillo"); }
    setSavingAisle(false);
  }

  async function toggleActiveAisle(aisle: Aisle) {
    const res = await fetch("/api/shop/aisles", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: aisle.id, is_active: !aisle.is_active })
    });
    if (res.ok) {
      loadData();
    } else {
      const e = await res.json();
      alert(e.error || "Error al actualizar el estado del pasillo");
    }
  }

  if (userRole && userRole !== "super_admin" && userRole !== "superadmin_aff") {
    return (
      <div className="flex items-center justify-center min-h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <p className="font-medium">Solo los Super Admins pueden gestionar pasillos y categorías</p>
        </div>
      </div>
    );
  }

  return (
    <div className={isInsideHub ? "absolute inset-0 flex flex-col overflow-hidden rounded-b-[2rem]" : "min-h-screen bg-transparent"}>
      <div className={isInsideHub ? "flex flex-col flex-1 overflow-hidden w-full" : "flex flex-col flex-1 overflow-hidden max-w-3xl mx-auto w-full pb-12 px-1 sm:px-4"}>
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
            title="Distribución de AIM Market"
            subtitle="Organiza tu tienda virtual en pasillos principales y categorías agrupadas."
            glow="superadmin"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            actions={
              <div className="flex gap-2">
                <button
                  onClick={openCreateAisle}
                  className="flex items-center bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-full font-bold transition-all border border-zinc-700 active:scale-95 text-xs cursor-pointer"
                >
                  <span>Nuevo Pasillo</span>
                </button>
                <button
                  onClick={openCreate}
                  className="flex items-center bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-5 py-2.5 rounded-full font-bold transition-all shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95 border-none cursor-pointer text-xs"
                >
                  <span>Nueva Categoría</span>
                </button>
              </div>
            }
          />
        )}

        {/* Tab Switcher */}
        <div className="flex justify-center mt-4 mb-2 shrink-0">
          <div className="bg-black/5 dark:bg-white/5 border border-pink-500/10 dark:border-pink-500/20 p-0.5 rounded-full flex gap-0.5 shadow-inner relative z-10">
            <button
              onClick={() => setActiveTab("aisles")}
              className={`px-5 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer border-none ${
                activeTab === "aisles"
                  ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20"
                  : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              Pasillos
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`px-5 py-1.5 rounded-full text-[11px] font-black transition-all cursor-pointer border-none ${
                activeTab === "categories"
                  ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-500/20"
                  : "bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              Categorías
            </button>
          </div>
        </div>

        {/* Header de Búsqueda y Acción */}
        <div className={isInsideHub ? "px-6 pt-3 pb-8 flex-shrink-0 flex flex-col sm:flex-row gap-3 items-center justify-between" : "flex flex-col sm:flex-row gap-3 mb-4 px-1 sm:px-2 items-center"}>
          <div className="relative flex-1 w-full">
            <svg className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 ${isInsideHub ? "left-3.5 w-3.5 h-3.5" : "left-3.5 w-4 h-4"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" 
              placeholder={activeTab === "categories" ? "Buscar categoría..." : "Buscar pasillo..."}
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className={`w-full pr-4 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus:ring-2 focus:ring-pink-500 outline-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all shadow-inner ${isInsideHub ? "rounded-full h-9 pl-9 text-[11px] font-bold" : "rounded-xl h-10 pl-10 text-sm"}`}
            />
          </div>
          {isInsideHub && (
            <div className="flex gap-2 shrink-0 max-sm:w-full">
              <button 
                onClick={openCreateAisle} 
                className="flex items-center justify-center bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-3.5 h-9 rounded-full font-bold transition-all shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95 cursor-pointer border-none text-[11px] max-sm:flex-1"
              >
                <span>Nuevo Pasillo</span>
              </button>
              <button 
                onClick={openCreate} 
                className="flex items-center justify-center bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-4 h-9 rounded-full font-bold transition-all shadow-md shadow-pink-500/20 hover:shadow-lg hover:shadow-rose-500/30 active:scale-95 cursor-pointer border-none text-[11px] shrink-0 max-sm:flex-1"
              >
                <span>Nueva Categoría</span>
              </button>
            </div>
          )}
        </div>

        {/* Database Migration Alert Card (visible only when aisles is empty in Dev/Admin context) */}
        {aisles.length === 0 && !loading && (
          <div className="mx-6 mb-4 p-4 bg-pink-500/5 border border-pink-500/15 rounded-2xl text-[11px] text-pink-600 dark:text-pink-400 leading-relaxed relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-12 h-12 bg-pink-500/10 rounded-full blur-xl pointer-events-none" />
            <p className="font-bold flex items-center gap-1.5">
              <span>💡</span> Pasillos del Market no inicializados
            </p>
            <p className="mt-1 font-medium">
              Si es la primera vez que ingresas tras el cambio de paradigma, debes ejecutar el script SQL para crear la tabla de pasillos. Puedes encontrarlo en su directorio de proyecto: <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono font-bold text-[10px]">db/shop/migration_add_aisles.sql</code>. Ejecútelo en su Editor SQL de Supabase y recargue la página.
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll" : ""}>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin w-8 h-8 border-b-2 border-pink-600 rounded-full" />
            </div>
          ) : activeTab === "categories" ? (
            /* --- CATEGORIES TAB VIEW --- */
            filteredCategories.length === 0 ? (
              <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                <div className="w-16 h-16 bg-gradient-to-tr from-pink-500/10 via-pink-500/5 to-transparent rounded-2xl border border-pink-500/20 dark:border-pink-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(236,72,153,0.08)] relative z-10">
                  <svg className="w-7 h-7 text-pink-500 dark:text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM9 16h6M9 12h6" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">No hay categorías</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">
                  {search ? "No se encontraron categorías que coincidan con tu búsqueda." : "Crea la primera categoría del catálogo usando el botón superior."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedCategories).map(([aisleId, group]) => (
                  <div key={aisleId} className="space-y-2.5">
                    {/* Glowing Section Header */}
                    <div className="flex items-center gap-2 px-1 pb-1 pt-2">
                      <div className={`w-1.5 h-3.5 rounded-full drop-shadow-[0_0_5px_rgba(236,72,153,0.8)] ${group.isAisleActive ? "bg-pink-500" : "bg-zinc-400"}`} />
                      <span className={`text-[10px] font-black tracking-widest uppercase ${group.isAisleActive ? "text-pink-600 dark:text-pink-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                        {group.aisleName}
                      </span>
                      {!group.isAisleActive && (
                        <span className="text-[8.5px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full select-none leading-none">Pasillo Inactivo</span>
                      )}
                      <div className="flex-1 h-[1px] bg-gradient-to-r from-pink-500/15 dark:from-pink-500/25 to-transparent ml-2" />
                    </div>

                    <div className="glass-card !rounded-[2rem] p-4 border border-black/5 dark:border-white/[0.05] space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
                      <div className="space-y-2">
                        {group.categories.map(cat => (
                          <div
                            key={cat.id}
                            className={`flex items-center justify-between p-3.5 bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.04] rounded-2xl gap-3 hover:bg-black/[0.035] dark:hover:bg-white/[0.035] transition-all duration-200 group ${cat.is_active && group.isAisleActive ? "" : "opacity-60"}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                                <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.562 3.007c0-1.077.873-1.95 1.95-1.95h6.002c1.077 0 1.95.873 1.95 1.95v6.002c0 1.077-.873 1.95-1.95 1.95h-6.002c-1.077 0-1.95-.873-1.95-1.95V3.007z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.562 6.008L3.25 12.32a2.76 2.76 0 000 3.904l4.526 4.526a2.76 2.76 0 003.904 0l6.312-6.312" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 4.75h.008v.008h-.008V4.75z" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-bold text-xs text-zinc-800 dark:text-zinc-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{cat.name}</p>
                                {cat.description && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{cat.description}</p>}
                                {cat.slug && <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono tracking-wider mt-0.5">/{cat.slug}</p>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                              {(!cat.is_active || !group.isAisleActive) && (
                                <span className="text-[9px] font-black bg-black/[0.05] dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5 select-none uppercase">
                                  {!cat.is_active ? "Inactiva" : "Pasillo Off"}
                                </span>
                              )}
                              
                              {/* Zero-Bubble Glass Capsule Secondary Actions */}
                              <div className="bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md rounded-full border border-pink-500/20 dark:border-pink-500/30 p-0.5 flex items-center gap-0.5 shadow-sm shrink-0">
                                {/* Editar */}
                                <button
                                  onClick={() => openEdit(cat)}
                                  className="w-6 h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all duration-200 hover:scale-115 active:scale-90 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.7)] cursor-pointer border-none bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-pink-500/10 dark:border-pink-500/20 rounded-full"
                                  title="Editar categoría"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                  </svg>
                                </button>
                                
                                {/* Activar / Desactivar */}
                                <button
                                  onClick={() => toggleActive(cat)}
                                  className={`w-6 h-6 flex items-center justify-center transition-all duration-200 hover:scale-115 active:scale-90 cursor-pointer border-none bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-pink-500/10 dark:border-pink-500/20 rounded-full ${
                                    cat.is_active
                                      ? "text-zinc-400 dark:text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400 hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                                      : "text-rose-500 dark:text-rose-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                                  }`}
                                  title={cat.is_active ? "Desactivar categoría" : "Activar categoría"}
                                >
                                  {cat.is_active ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.895 7.895L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.754C3.08 7.94 7.244 4.5 12 4.5c4.756 0 8.773 3.162 10.065 7.498a1.012 1.012 0 010 .754a11.934 11.934 0 01-10.065 7.498a11.934 11.934 0 01-10.065-7.498z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* --- AISLES TAB VIEW --- */
            filteredAisles.length === 0 ? (
              <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
                <div className="w-16 h-16 bg-gradient-to-tr from-pink-500/10 via-pink-500/5 to-transparent rounded-2xl border border-pink-500/20 dark:border-pink-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(236,72,153,0.08)] relative z-10">
                  <svg className="w-7 h-7 text-pink-500 dark:text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">No hay pasillos</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">
                  {search ? "No se encontraron pasillos que coincidan con tu búsqueda." : "Crea el primer pasillo global (ej: SexShop, Skincare, Belleza) para agrupar categorías."}
                </p>
              </div>
            ) : (
              <div className="glass-card !rounded-[2rem] p-5 border border-black/5 dark:border-white/[0.05] space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between px-2 pb-2.5 border-b border-black/[0.03] dark:border-white/[0.03]">
                  <span className="text-[10.5px] font-bold text-zinc-400">Detalles del Pasillo</span>
                  <span className="text-[10.5px] font-bold text-zinc-400 text-right pr-2">Acciones</span>
                </div>
                <div className="space-y-2">
                  {filteredAisles.map(aisle => (
                    <div
                      key={aisle.id}
                      className={`flex items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl gap-3 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors duration-200 group ${aisle.is_active ? "" : "opacity-60"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform shrink-0">
                          <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">{aisle.name}</p>
                          {aisle.description && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{aisle.description}</p>}
                          {aisle.slug && <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tracking-wider mt-0.5">/pasillo/{aisle.slug}</p>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        {!aisle.is_active && (
                          <span className="text-[9.5px] font-extrabold bg-black/[0.05] dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5 select-none">Inactivo</span>
                        )}
                        
                        {/* Zero-Bubble Glass Capsule Secondary Actions */}
                        <div className="bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md rounded-full border border-pink-500/20 dark:border-pink-500/30 p-0.5 flex items-center gap-0.5 shadow-sm shrink-0">
                          {/* Editar */}
                          <button
                            onClick={() => openEditAisle(aisle)}
                            className="w-6 h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all duration-200 hover:scale-115 active:scale-90 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.7)] cursor-pointer border-none bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-pink-500/10 dark:border-pink-500/20 rounded-full"
                            title="Editar pasillo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          
                          {/* Activar / Desactivar */}
                          <button
                            onClick={() => toggleActiveAisle(aisle)}
                            className={`w-6 h-6 flex items-center justify-center transition-all duration-200 hover:scale-115 active:scale-90 cursor-pointer border-none bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-pink-500/10 dark:border-pink-500/20 rounded-full ${
                              aisle.is_active
                                ? "text-zinc-400 dark:text-zinc-500 hover:text-amber-500 dark:hover:text-amber-400 hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                                : "text-rose-500 dark:text-rose-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                            }`}
                            title={aisle.is_active ? "Desactivar pasillo" : "Activar pasillo"}
                          >
                            {aisle.is_active ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.895 7.895L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.754C3.08 7.94 7.244 4.5 12 4.5c4.756 0 8.773 3.162 10.065 7.498a1.012 1.012 0 010 .754a11.934 11.934 0 01-10.065 7.498a11.934 11.934 0 01-10.065-7.498z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* --- CATEGORY CREATION / EDIT MODAL --- */}
      {showModal && (
        <div className={isInsideHub ? "absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm rounded-b-[2rem]" : "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md"}>
          <div className="bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 w-full max-w-md relative flex flex-col overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between p-6 border-b border-black/[0.05] dark:border-white/[0.05] relative z-10">
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">{editCat ? "Editar" : "Nueva"} Categoría</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-pink-500/10 hover:text-pink-500 hover:border-pink-500/30 hover:shadow-[0_0_12px_rgba(236,72,153,0.4)] transition-all duration-300 cursor-pointer text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4 relative z-10 max-h-[60vh] overflow-y-auto apple-scroll">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Nombre *</label>
                <input
                  type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputStyle}
                  placeholder="Ej. Dildos, Exfoliante, etc."
                />
              </div>

              {/* Aisle Selector Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Pasillo Principal (Distribución Market)</label>
                <AppleDropdown
                  options={aisleOptions}
                  value={form.aisle_id || ""}
                  onChange={v => setForm(f => ({ ...f, aisle_id: v || null }))}
                  placeholder="Pasillo General (Sin Asignar)"
                  className="w-full max-w-full"
                  variant="input"
                  theme="fuchsia"
                  maxHeight="max-h-[160px]"
                  pill={true}
                  size={isInsideHub ? "sm" : "md"}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Descripción</label>
                <textarea
                  value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className={textareaStyle}
                  placeholder="Descripción opcional de los productos incluidos..."
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-pink-600 bg-black/[0.05] dark:bg-white/[0.05] border-black/10 dark:border-white/10 w-4 h-4 focus:ring-pink-500" />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Categoría Activa</span>
              </label>
            </div>
            
            <div className="p-6 border-t border-black/[0.05] dark:border-white/[0.05] flex gap-3 justify-end relative z-10 shrink-0">
              <button onClick={() => setShowModal(false)} className={cancelBtnStyle}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className={saveBtnStyle}>
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- AISLE CREATION / EDIT MODAL --- */}
      {showAisleModal && (
        <div className={isInsideHub ? "absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm rounded-b-[2rem]" : "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md"}>
          <div className="bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 w-full max-w-md relative flex flex-col overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between p-6 border-b border-black/[0.05] dark:border-white/[0.05] relative z-10">
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">{editAisle ? "Editar" : "Nuevo"} Pasillo</h2>
              <button onClick={() => setShowAisleModal(false)} className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-pink-500/10 hover:text-pink-500 hover:border-pink-500/30 hover:shadow-[0_0_12px_rgba(236,72,153,0.4)] transition-all duration-300 cursor-pointer text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4 relative z-10">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Nombre del Pasillo *</label>
                <input
                  type="text" value={aisleForm.name} onChange={e => setAisleForm(f => ({ ...f, name: e.target.value }))}
                  className={inputStyle}
                  placeholder="Ej. SexShop, Skincare, Belleza, etc."
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Descripción</label>
                <textarea
                  value={aisleForm.description} onChange={e => setAisleForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className={textareaStyle}
                  placeholder="Descripción del pasillo..."
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={aisleForm.is_active} onChange={e => setAisleForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-pink-600 bg-black/[0.05] dark:bg-white/[0.05] border-black/10 dark:border-white/10 w-4 h-4 focus:ring-pink-500" />
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Pasillo Activo</span>
              </label>
            </div>
            
            <div className="p-6 border-t border-black/[0.05] dark:border-white/[0.05] flex gap-3 justify-end relative z-10 shrink-0">
              <button onClick={() => setShowAisleModal(false)} className={cancelBtnStyle}>Cancelar</button>
              <button onClick={handleSaveAisle} disabled={savingAisle} className={saveBtnStyle}>
                {savingAisle && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
