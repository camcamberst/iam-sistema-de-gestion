"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import ShopAdminNav from "@/components/ShopAdminNav";

interface Category {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ShopCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [token, setToken] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);
    const { data: profile } = await supabase.from("users").select("role").eq("id", session.user.id).single();
    setUserRole(profile?.role || "");
    const res = await fetch("/api/shop/categories");
    if (res.ok) setCategories(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() {
    setEditCat(null);
    setForm({ name: "", description: "", is_active: true });
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditCat(c);
    setForm({ name: c.name, description: c.description || "", is_active: c.is_active });
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
    else { const e = await res.json(); alert(e.error || "Error"); }
    setSaving(false);
  }

  if (userRole && userRole !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-64 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <p className="font-medium">Solo el Super Admin puede gestionar categorías</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <ShopAdminNav />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🏷️</span> Categorías
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Solo el Super Admin puede crear y modificar categorías</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva categoría
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-3">🏷️</div>
            <p className="font-medium">No hay categorías aún</p>
            <p className="text-sm mt-1">Crea la primera usando el botón superior</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => (
              <div
                key={cat.id}
                className={`flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border ${cat.is_active ? "border-gray-100 dark:border-gray-700" : "border-gray-200 dark:border-gray-600 opacity-60"} shadow-sm`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 flex items-center justify-center">
                    <span className="text-lg">🏷️</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{cat.name}</p>
                    {cat.description && <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>}
                    {cat.slug && <p className="text-xs text-gray-400 font-mono">/{cat.slug}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!cat.is_active && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
                  )}
                  <button
                    onClick={() => openEdit(cat)}
                    className="px-3 py-1.5 text-xs font-medium text-pink-600 hover:text-pink-700 border border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-xl transition-colors"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">{editCat ? "Editar" : "Nueva"} Categoría</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input
                  type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="Ej. Lencería"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                  placeholder="Descripción opcional..."
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-pink-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Categoría activa</span>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2">
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
