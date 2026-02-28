"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Category { id: string; name: string; }
interface Variant { id?: string; name: string; sku: string; price_delta: number; }
interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  category_id: string | null;
  images: string[];
  allow_financing: boolean;
  min_stock_alert: number;
  is_active: boolean;
  shop_categories?: { name: string } | null;
  shop_product_variants?: Variant[];
}

export default function ShopProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", base_price: "", category_id: "",
    allow_financing: true, min_stock_alert: "2", is_active: true
  });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [userRole, setUserRole] = useState<string>("");
  const [token, setToken] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const { data: profile } = await supabase
      .from("users").select("role").eq("id", session.user.id).single();
    setUserRole(profile?.role || "");

    const [prodRes, catRes] = await Promise.all([
      fetch("/api/shop/products?active_only=false&with_inventory=true", {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }),
      fetch("/api/shop/categories")
    ]);
    if (prodRes.ok) setProducts(await prodRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openCreate() {
    setEditProduct(null);
    setForm({ name: "", description: "", base_price: "", category_id: "", allow_financing: true, min_stock_alert: "2", is_active: true });
    setVariants([]);
    setImages([]);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setForm({
      name: p.name, description: p.description || "", base_price: String(p.base_price),
      category_id: p.category_id || "", allow_financing: p.allow_financing,
      min_stock_alert: String(p.min_stock_alert), is_active: p.is_active
    });
    setVariants(p.shop_product_variants?.map(v => ({ ...v })) || []);
    setImages(p.images || []);
    setShowModal(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/shop/upload-image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    if (res.ok) {
      const { url } = await res.json();
      setImages(prev => [...prev, url]);
    } else {
      alert("Error al subir imagen");
    }
    setUploadingImage(false);
    e.target.value = "";
  }

  async function handleSave() {
    if (!form.name || !form.base_price) { alert("Nombre y precio son requeridos"); return; }
    setSaving(true);
    const payload = {
      name: form.name, description: form.description,
      base_price: parseFloat(form.base_price),
      category_id: form.category_id || null,
      allow_financing: form.allow_financing,
      min_stock_alert: parseInt(form.min_stock_alert),
      is_active: form.is_active,
      images,
      variants: variants.filter(v => v.name)
    };

    const url = editProduct ? `/api/shop/products/${editProduct.id}` : "/api/shop/products";
    const method = editProduct ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editProduct ? { id: editProduct.id, ...payload } : payload)
    });

    if (res.ok) {
      setShowModal(false);
      loadData();
    } else {
      const err = await res.json();
      alert(err.error || "Error al guardar");
    }
    setSaving(false);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category_id === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">🛍️</span> Productos — Sexshop
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {products.filter(p => p.is_active).length} productos activos · {products.length} total
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Producto
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" placeholder="Buscar producto..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
          >
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <div className="text-5xl mb-3">🛒</div>
            <p className="font-medium">No hay productos registrados</p>
            <p className="text-sm mt-1">Crea el primero usando el botón &quot;Nuevo Producto&quot;</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(product => (
              <div key={product.id} className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${product.is_active ? 'border-gray-100 dark:border-gray-700' : 'border-gray-200 dark:border-gray-600 opacity-60'} overflow-hidden hover:shadow-md transition-all`}>
                {/* Image */}
                <div className="h-40 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-gray-700 dark:to-gray-600 relative overflow-hidden">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">🛍️</div>
                  )}
                  {!product.is_active && (
                    <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                      <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded-full">Inactivo</span>
                    </div>
                  )}
                  {!product.allow_financing && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">Solo contado</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="text-xs text-pink-600 dark:text-pink-400 font-medium mb-0.5">
                    {product.shop_categories?.name || "Sin categoría"}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">{product.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 mt-0.5">{product.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-base font-bold text-gray-900 dark:text-white">
                      ${product.base_price.toLocaleString("es-CO")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {(product.shop_product_variants?.length || 0) > 0 && `${product.shop_product_variants!.length} var.`}
                    </span>
                  </div>
                  <button
                    onClick={() => openEdit(product)}
                    className="w-full mt-2.5 text-xs bg-gray-50 dark:bg-gray-700 hover:bg-pink-50 dark:hover:bg-pink-900/20 text-gray-700 dark:text-gray-300 hover:text-pink-700 dark:hover:text-pink-400 px-3 py-1.5 rounded-lg transition-colors font-medium border border-gray-100 dark:border-gray-600"
                  >
                    Editar producto
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input
                  type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="Ej. Lencería Roja Talla M"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none resize-none"
                  placeholder="Descripción del producto..."
                />
              </div>

              {/* Precio y categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio base (COP) *</label>
                  <input
                    type="number" min="0" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                  <select
                    value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Opciones */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alerta stock mínimo</label>
                  <input
                    type="number" min="0" value={form.min_stock_alert} onChange={e => setForm(f => ({ ...f, min_stock_alert: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allow_financing} onChange={e => setForm(f => ({ ...f, allow_financing: e.target.checked }))} className="rounded text-pink-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Permite financiación</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-pink-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Activo</span>
                  </label>
                </div>
              </div>

              {/* Imágenes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Imágenes</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                      >×</button>
                    </div>
                  ))}
                  <label className={`w-16 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-pink-400 transition-colors ${uploadingImage ? 'opacity-50' : ''}`}>
                    {uploadingImage ? (
                      <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              </div>

              {/* Variantes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Variantes (opcional)</label>
                  <button
                    onClick={() => setVariants(v => [...v, { name: "", sku: "", price_delta: 0 }])}
                    className="text-xs text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar
                  </button>
                </div>
                {variants.map((v, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text" placeholder="Ej. Talla S / Rojo" value={v.name}
                      onChange={e => setVariants(vv => vv.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                    />
                    <input
                      type="number" placeholder="Δ precio" value={v.price_delta}
                      onChange={e => setVariants(vv => vv.map((x, i) => i === idx ? { ...x, price_delta: parseFloat(e.target.value) || 0 } : x))}
                      className="w-24 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none"
                    />
                    <button onClick={() => setVariants(vv => vv.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 px-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editProduct ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
