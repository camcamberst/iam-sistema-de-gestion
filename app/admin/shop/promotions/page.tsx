"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPromo, setEditPromo] = useState<Promotion | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("");

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🏷️</span> Promociones — Sexshop
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Los descuentos no son acumulables — siempre aplica el mejor.</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva promoción
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" /></div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-3">🏷️</div>
            <p className="font-medium">No hay promociones</p>
            <p className="text-sm mt-1">Crea la primera usando el botón superior</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Aplica a</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vigencia</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {promotions.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{TYPE_LABELS[p.type] || p.type}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.shop_products?.name || p.shop_categories?.name || "Todos"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                      {p.type === "2x1" ? "2×1" : p.value !== null ? (p.type === "fixed" ? `$${p.value.toLocaleString("es-CO")}` : `${p.value}%`) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.starts_at ? new Date(p.starts_at).toLocaleDateString("es-CO") : "Inmediato"} —{" "}
                      {p.ends_at ? new Date(p.ends_at).toLocaleDateString("es-CO") : "Sin vencimiento"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(p)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(p)} className="text-pink-600 hover:text-pink-700 text-xs font-medium">Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editPromo ? "Editar" : "Nueva"} Promoción</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none" placeholder="Ej. 20% descuento lencería" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="percentage">% Descuento</option>
                    <option value="fixed">Monto fijo</option>
                    <option value="2x1">2×1</option>
                    <option value="category">Categoría %</option>
                  </select>
                </div>
                {form.type !== "2x1" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {form.type === "fixed" ? "Descuento (COP)" : "Porcentaje (%)"}
                    </label>
                    <input type="number" min="0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none" placeholder="0" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Producto (opcional)</label>
                  <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="">Todos</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría (opcional)</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="">Todas</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inicio</label>
                  <input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vencimiento</label>
                  <input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-pink-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Promoción activa</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
