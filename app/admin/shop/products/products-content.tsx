"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppleDropdown from "@/components/ui/AppleDropdown";
import PageHeader from "@/components/ui/PageHeader";
import StandardModal from "@/components/ui/StandardModal";

interface Category {
  id: string;
  name: string;
  shop_aisles?: {
    id: string;
    name: string;
  } | null;
}
interface Group { id: string; name: string; }
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
  stock?: { available: number; reserved: number };
}

interface InventoryRow {
  id: string;
  location_type: string;
  location_id: string | null;
  quantity: number;
  reserved: number;
}

export default function ShopProductsPage() {
  return <ShopProductsContent isInsideHub={false} />;
}

export function ShopProductsContent({ isInsideHub = false }: { isInsideHub?: boolean }) {
  const inputStyle = isInsideHub
    ? "w-full px-4 h-9 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-full text-[11px] font-bold focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner"
    : "w-full px-3.5 h-11 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner";

  const textareaStyle = isInsideHub
    ? "w-full px-4 py-2 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 !rounded-[1.25rem] text-[11px] font-bold focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner"
    : "w-full px-3.5 py-3 bg-black/[0.03] dark:bg-white/[0.04] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none transition-all text-zinc-800 dark:text-zinc-100 resize-none placeholder-zinc-400 dark:placeholder-zinc-500 shadow-inner";

  const cancelBtnStyle = isInsideHub
    ? "px-5 h-9 flex items-center justify-center text-[11px] font-bold border border-black/10 dark:border-white/10 !rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
    : "px-5 py-3 text-xs font-bold border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer";

  const saveBtnStyle = isInsideHub
    ? "px-6 h-9 flex items-center justify-center text-[11px] font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white !rounded-full transition-all shadow-md shadow-cyan-500/25 dark:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 gap-2 cursor-pointer border-none"
    : "px-6 py-3 text-xs font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full transition-all shadow-md shadow-cyan-500/25 dark:shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer border-none";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", base_price: "", category_id: "",
    allow_financing: true, min_stock_alert: "2", is_active: true
  });
  const [initialStock, setInitialStock] = useState({
    quantity: "",
    location_type: "sede" as "bodega" | "sede",
    location_id: ""
  });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [userRole, setUserRole] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [detailInventory, setDetailInventory] = useState<InventoryRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const router = useRouter();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const { data: profile } = await supabase
      .from("users").select("role").eq("id", session.user.id).single();
    setUserRole(profile?.role || "");

    const authHeader = { Authorization: `Bearer ${session.access_token}` };
    const [prodRes, catRes, grpRes] = await Promise.all([
      fetch("/api/shop/products?active_only=false&with_inventory=true", { headers: authHeader }),
      fetch("/api/shop/categories", { headers: authHeader }),
      fetch("/api/groups", { headers: authHeader })
    ]);
    if (prodRes.ok) setProducts(await prodRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    if (grpRes.ok) {
      const grpData = await grpRes.json();
      if (grpData?.success && grpData?.groups) setGroups(grpData.groups);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!detailProduct || !token) return;
    setDetailLoading(true);
    fetch(`/api/shop/inventory?product_id=${detailProduct.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((rows: InventoryRow[]) => setDetailInventory(rows || []))
      .catch(() => setDetailInventory([]))
      .finally(() => setDetailLoading(false));
  }, [detailProduct?.id, token]);

  function getLocationLabel(locationType: string, locationId: string | null) {
    if (locationType === "bodega") return "Bodega principal";
    const g = groups.find(gr => gr.id === locationId);
    return g ? `Sede ${g.name}` : (locationId ? `Sede ${locationId}` : "Sede");
  }

  const canBodega = userRole === "super_admin" || userRole === "superadmin_aff";
  const categoryFilterOptions = useMemo(() => [
    { value: "all", label: "Todas las categorías" },
    ...categories.map(c => {
      const aisleName = c.shop_aisles?.name;
      const label = aisleName ? `[${aisleName}] ${c.name}` : c.name;
      return { value: c.id, label };
    })
  ], [categories]);
  const categoryFormOptions = useMemo(() => [
    { value: "", label: "Sin categoría" },
    ...categories.map(c => {
      const aisleName = c.shop_aisles?.name;
      const label = aisleName ? `[${aisleName}] ${c.name}` : c.name;
      return { value: c.id, label };
    })
  ], [categories]);
  const locationOptions = useMemo(() => [
    ...(canBodega ? [{ value: "bodega", label: "Bodega principal" }] : []),
    ...groups.map(g => ({ value: g.id, label: `Sede ${g.name}` }))
  ], [canBodega, groups]);
  const initialStockLocationValue = initialStock.location_type === "bodega" ? "bodega" : (initialStock.location_id || "");

  function openCreate() {
    setEditProduct(null);
    setForm({ name: "", description: "", base_price: "", category_id: "", allow_financing: true, min_stock_alert: "2", is_active: true });
    setInitialStock({ quantity: "", location_type: "sede", location_id: "" });
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

  async function handleDelete(product: Product) {
    setProductToDelete(product);
  }

  async function confirmDelete() {
    if (!productToDelete) return;
    const targetId = productToDelete.id;
    setProductToDelete(null);
    setDeletingId(targetId);
    const res = await fetch(`/api/shop/products/${targetId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    setDeletingId(null);
    if (res.ok) loadData();
    else {
      const err = await res.json();
      alert(err.error || "Error al eliminar");
    }
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

    if (!res.ok) {
      const err = await res.json();
      if (res.status === 409 && err.existing_product_id) {
        const go = confirm(
          "Ya existe un producto con ese nombre en tu catálogo. Los demás admins deben agregar sus unidades a ese producto.\n\n¿Ir a Inventario para agregar unidades a ese producto?"
        );
        if (go) router.push(`/admin/shop/inventory?product_id=${err.existing_product_id}&add=1`);
      } else {
        alert(err.error || "Error al guardar");
      }
      setSaving(false);
      return;
    }

    const createdProduct = !editProduct ? await res.json() : null;

    const qty = parseInt(initialStock.quantity, 10);
    if (!editProduct && createdProduct?.id && !isNaN(qty) && qty > 0) {
      const locationType = initialStock.location_type;
      const locationId = locationType === "sede" ? (initialStock.location_id || null) : null;
      if (locationType === "sede" && !locationId) {
        alert("Selecciona una sede para el stock inicial o elige Bodega principal.");
        setSaving(false);
        return;
      }
      const invRes = await fetch("/api/shop/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          product_id: createdProduct.id,
          quantity_delta: qty,
          location_type: locationType,
          location_id: locationId ?? undefined
        })
      });
      if (!invRes.ok) {
        const invErr = await invRes.json();
        alert(`Producto creado, pero no se pudo registrar el stock: ${invErr.error || "Error"}`);
      }
    }

    setShowModal(false);
    loadData();
    setSaving(false);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || p.category_id === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className={isInsideHub ? "absolute inset-0 flex flex-col overflow-hidden rounded-b-[2rem]" : "min-h-screen bg-transparent"}>
      <div className={isInsideHub ? "flex flex-col flex-1 overflow-hidden" : "max-w-7xl mx-auto pb-12"}>
        {!isInsideHub && (
          <Link href="/admin/shop" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-fuchsia-500 mb-3 transition-colors max-sm:px-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Dashboard
          </Link>
        )}

        {!isInsideHub && (
          <PageHeader
            title="Productos de AIM Market"
            subtitle={`${products.filter(p => p.is_active).length} productos activos · ${products.length} total`}
            glow="superadmin"
            icon={
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            actions={
              <button
                onClick={openCreate}
                className="flex items-center bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white px-5 py-2.5 rounded-full font-bold transition-all shadow-[0_3px_15px_rgba(34,211,238,0.4)] hover:scale-[1.02] border-none cursor-pointer text-xs"
              >
                <span>Nuevo producto</span>
              </button>
            }
          />
        )}

        {/* Filters */}
        <div className={isInsideHub ? "px-6 pt-6 pb-8 flex-shrink-0 flex flex-col sm:flex-row gap-3 items-center" : "flex flex-col sm:flex-row gap-3 mb-6 px-1 sm:px-2 items-center"}>
          <div className="relative flex-1 w-full">
            <svg className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 ${isInsideHub ? "left-3 w-3.5 h-3.5" : "left-3.5 w-4 h-4"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text" placeholder="Buscar producto..."
              value={search} onChange={e => setSearch(e.target.value)}
              className={`w-full pr-4 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] focus:ring-2 focus:ring-fuchsia-500 outline-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 transition-all shadow-inner ${isInsideHub ? "rounded-full h-9 pl-9 text-[11px] font-bold" : "rounded-xl h-10 pl-10 text-sm"}`}
            />
          </div>
          <div className="min-w-[200px] w-full sm:w-auto">
            <AppleDropdown
              options={categoryFilterOptions}
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="Todas las categorías"
              className="w-full max-w-full"
              pill={isInsideHub}
              theme="fuchsia"
              maxHeight="max-h-[124px]"
              size={isInsideHub ? "sm" : "md"}
            />
          </div>
          {isInsideHub && (
            <button
              onClick={openCreate}
              className="flex items-center justify-center bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white px-4 py-2 rounded-full font-bold transition-all shadow-[0_3px_10px_rgba(34,211,238,0.3)] hover:scale-[1.02] cursor-pointer shrink-0 w-full sm:w-auto border-none text-[11px]"
            >
              <span>Nuevo producto</span>
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className={isInsideHub ? "flex-1 overflow-y-auto overflow-x-hidden px-6 pb-8 apple-scroll" : ""}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-b-2 border-fuchsia-600 rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card text-center py-16 text-zinc-400 dark:text-zinc-500 !rounded-[2rem] border border-black/5 dark:border-white/[0.05] relative overflow-hidden group">
              {/* Ambient Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
              
              <div className="w-16 h-16 bg-gradient-to-tr from-fuchsia-500/10 via-fuchsia-500/5 to-transparent rounded-2xl border border-fuchsia-500/20 dark:border-fuchsia-500/15 flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(217,70,239,0.08)] relative z-10">
                <svg className="w-7 h-7 text-fuchsia-500 dark:text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.4)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1 relative z-10">No hay productos</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto relative z-10">Crea el primer producto de tu catálogo usando el botón &quot;Nuevo Producto&quot;.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-1 sm:px-2">
              {filtered.map(product => {
                const isLowStock = product.stock && product.stock.available <= product.min_stock_alert;
                return (
                  <div 
                    key={product.id} 
                    className={`glass-card !rounded-[2rem] p-4 flex flex-col relative overflow-hidden transition-all duration-300 border border-black/5 dark:border-white/[0.05] group hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] hover:scale-[1.01] ${
                      product.is_active ? "" : "opacity-60"
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-fuchsia-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-fuchsia-500/10 transition-colors" />
                    
                    {/* Clic en imagen + datos abre detalle */}
                    <button
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      className="flex-1 text-left min-w-0 mb-4 cursor-pointer border-none bg-transparent p-0 w-full"
                    >
                      <div className="w-full h-40 bg-gradient-to-br from-fuchsia-500/5 to-pink-500/5 dark:from-zinc-800/30 dark:to-zinc-800/20 rounded-2xl relative overflow-hidden border border-black/[0.05] dark:border-white/[0.05] mb-3">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-4xl select-none">🛍️</div>
                        )}
                        {!product.is_active && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="bg-zinc-900/90 text-white text-[10.5px] font-bold tracking-wide px-2.5 py-1 rounded-full border border-white/10 shadow-lg">Inactivo</span>
                          </div>
                        )}
                        {!product.allow_financing && (
                          <div className="absolute top-2.5 right-2.5">
                            <span className="bg-orange-500/90 backdrop-blur-md border border-white/10 text-white text-[9.5px] font-bold tracking-wide px-2 py-0.5 rounded-full shadow-lg">Solo Contado</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="px-1">
                        <span className="text-[10.5px] font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-0.5 block">
                          {product.shop_categories?.name || "Sin categoría"}
                        </span>
                        <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm line-clamp-1 group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-400 transition-colors">{product.name}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-xs line-clamp-2 mt-1 leading-relaxed">{product.description}</p>
                        
                        <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-black/[0.03] dark:border-white/[0.03]">
                          <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-50">
                            ${product.base_price.toLocaleString("es-CO")}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            {(product.shop_product_variants?.length || 0) > 0 && (
                              <span className="text-[9.5px] font-extrabold bg-fuchsia-500/5 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 px-2 py-0.5 rounded-full border border-fuchsia-500/10 dark:border-fuchsia-500/20">
                                {product.shop_product_variants!.length} var.
                              </span>
                            )}
                            
                            {product.stock && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isLowStock 
                                  ? "bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20 animate-pulse" 
                                  : "bg-fuchsia-500/5 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/10 dark:border-fuchsia-500/20"
                              }`}>
                                {product.stock.available} uds.
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-2 text-center group-hover:text-zinc-500 transition-colors">Clic para ver unidades por sede</p>
                      </div>
                    </button>
                    
                    <div className="flex gap-2 relative z-10">
                      <button
                        onClick={() => openEdit(product)}
                        className="flex-1 py-2 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer text-center bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold transition-all shadow-md shadow-fuchsia-500/20 hover:shadow-lg hover:shadow-pink-500/30 border-none"
                      >
                        Editar
                      </button>
                      {(userRole === "super_admin" || userRole === "superadmin_aff") && (
                        <button
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product.id}
                          title="Eliminar producto (se borra del sistema)"
                          className="py-2 px-3 text-xs font-bold rounded-full transition-all duration-300 cursor-pointer bg-transparent text-fuchsia-500 border border-fuchsia-500/20 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/40 disabled:opacity-50 flex items-center justify-center"
                        >
                          {deletingId === product.id ? (
                            <span className="inline-block w-3.5 h-3.5 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            "Eliminar"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle: unidades por sede (sin editar) */}
      {detailProduct && (
        <div 
          className={isInsideHub ? "absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm rounded-b-[2rem]" : "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md"} 
          onClick={() => setDetailProduct(null)}
        >
          <div 
            className={`bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 w-full max-w-lg overflow-hidden flex flex-col relative ${isInsideHub ? "max-h-[90%] rounded-b-[2rem]" : "max-h-[90vh]"}`} 
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between p-6 border-b border-black/[0.05] dark:border-white/[0.05] relative z-10">
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white truncate pr-2">{detailProduct.name}</h2>
              <button onClick={() => setDetailProduct(null)} className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-fuchsia-500/10 hover:text-fuchsia-500 hover:border-fuchsia-500/30 hover:shadow-[0_0_12px_rgba(217,70,239,0.4)] transition-all duration-300 cursor-pointer text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 relative z-10 apple-scroll">
              <p className="text-xs font-bold text-zinc-400 mb-4">Stock por Ubicación</p>
              {detailLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full" /></div>
              ) : detailInventory.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 py-4 text-center">Aún no hay stock registrado en ninguna sede.</p>
              ) : (
                <div className="space-y-2">
                  {detailInventory.map(row => (
                    <div key={row.id} className="flex items-center justify-between p-3.5 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{getLocationLabel(row.location_type, row.location_id)}</p>
                        <div className="flex gap-2.5 mt-1 text-[10.5px] font-bold text-zinc-400">
                          <span>Disponible: <strong className="text-zinc-700 dark:text-zinc-300 font-extrabold">{row.quantity - row.reserved}</strong></span>
                          <span>·</span>
                          <span>Reservado: <strong className="text-orange-500 font-extrabold">{row.reserved}</strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-extrabold text-zinc-950 dark:text-white">{row.quantity}</span>
                        <p className="text-[9.5px] font-bold text-zinc-400">Total</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-black/[0.05] dark:border-white/[0.05] flex gap-3 relative z-10">
              <button
                onClick={() => { setDetailProduct(null); router.push(`/admin/shop/inventory?product_id=${detailProduct.id}&add=1`); }}
                className={isInsideHub ? "flex-1 py-2 text-[11px] font-bold !rounded-full transition-all cursor-pointer bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-500/20 hover:shadow-lg hover:shadow-pink-500/30 hover:scale-[1.01] border-none" : "flex-1 py-3 text-sm font-bold rounded-xl transition-all cursor-pointer bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-md shadow-fuchsia-500/20 hover:shadow-lg hover:shadow-pink-500/30 hover:scale-[1.01]"}
              >
                Agregar unidades
              </button>
              <button onClick={() => setDetailProduct(null)} className={isInsideHub ? "px-6 py-2 text-[11px] font-bold border border-black/10 dark:border-white/10 !rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer" : "px-6 py-3 text-sm font-bold border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div 
          className={isInsideHub ? "absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm rounded-b-[2rem]" : "fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-md"}
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div 
            className={`bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10 w-full max-w-2xl flex flex-col relative overflow-hidden ${isInsideHub ? "max-h-[90%] rounded-b-[2rem]" : "max-h-[90vh]"}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between p-6 border-b border-black/[0.05] dark:border-white/[0.05] relative z-10">
              <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white">
                {editProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 hover:bg-fuchsia-500/10 hover:text-fuchsia-500 hover:border-fuchsia-500/30 hover:shadow-[0_0_12px_rgba(217,70,239,0.4)] transition-all duration-300 cursor-pointer text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6 relative z-10 apple-scroll">
              {/* Nombre */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Nombre *</label>
                <input
                  type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputStyle}
                  placeholder="Ej. Crema Hidratante Facial Velvet"
                />
              </div>
 
              {/* Descripción */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Descripción</label>
                <textarea
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className={textareaStyle}
                  placeholder="Descripción detallada de ingredientes, usos y beneficios..."
                />
              </div>
 
              {/* Precio y categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Precio Base (COP) *</label>
                  <input
                    type="number" min="0" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                    className={inputStyle}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Categoría</label>
                  <AppleDropdown
                    options={categoryFormOptions}
                    value={form.category_id}
                    onChange={v => setForm(f => ({ ...f, category_id: v }))}
                    placeholder="Sin categoría"
                    className="w-full max-w-full"
                    variant="input"
                    theme="fuchsia"
                    maxHeight="max-h-[124px]"
                    pill={true}
                    size={isInsideHub ? "sm" : "md"}
                  />
                </div>
              </div>
 
              {/* Opciones */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Alerta Stock Mínimo</label>
                  <input
                    type="number" min="0" value={form.min_stock_alert} onChange={e => setForm(f => ({ ...f, min_stock_alert: e.target.value }))}
                    className={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-3 pt-5">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.allow_financing} onChange={e => setForm(f => ({ ...f, allow_financing: e.target.checked }))} className="rounded text-fuchsia-600 bg-black/[0.05] dark:bg-white/[0.05] border-black/10 dark:border-white/10 w-4 h-4 focus:ring-fuchsia-500" />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Permite Financiación</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded text-fuchsia-600 bg-black/[0.05] dark:bg-white/[0.05] border-black/10 dark:border-white/10 w-4 h-4 focus:ring-fuchsia-500" />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Activo</span>
                  </label>
                </div>
              </div>
 
              {/* Stock inicial (solo al crear) */}
              {!editProduct && (
                <div className="p-5 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] space-y-4">
                  <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Stock Inicial (Opcional)</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">Indica la cantidad y en qué sede o bodega quedará el producto para el manejo interno inicial.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Cantidad en Existencias</label>
                      <input
                        type="number"
                        min="0"
                        value={initialStock.quantity}
                        onChange={e => setInitialStock(s => ({ ...s, quantity: e.target.value }))}
                        className={inputStyle}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-1.5">Ubicación</label>
                      <AppleDropdown
                        options={locationOptions.length ? locationOptions : [{ value: "", label: "Sin sedes asignadas" }]}
                        value={initialStockLocationValue}
                        onChange={v => {
                          if (v === "bodega") setInitialStock(s => ({ ...s, location_type: "bodega", location_id: "" }));
                          else setInitialStock(s => ({ ...s, location_type: "sede", location_id: v }));
                        }}
                        placeholder="Sin sedes asignadas"
                        className="w-full max-w-full"
                        variant="input"
                        theme="fuchsia"
                        maxHeight="max-h-[124px]"
                        pill={true}
                        size={isInsideHub ? "sm" : "md"}
                      />
                    </div>
                  </div>
                </div>
              )}
  
              {/* Imágenes */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 mb-2.5">Imágenes</label>
                <div className="flex flex-wrap gap-2.5 mb-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.08] group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-extrabold cursor-pointer border-none text-xs"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                  <label className={`w-16 h-16 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl flex items-center justify-center cursor-pointer hover:border-fuchsia-500 dark:hover:border-fuchsia-500 hover:bg-fuchsia-500/5 transition-all ${uploadingImage ? 'opacity-50' : ''}`}>
                    {uploadingImage ? (
                      <div className="w-4 h-4 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  </label>
                </div>
              </div>
  
              {/* Variantes */}
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">Variantes (Opcional)</label>
                  <button
                    onClick={() => setVariants(v => [...v, { name: "", sku: "", price_delta: 0 }])}
                    className={isInsideHub ? "px-3 py-1.5 text-[11px] font-bold rounded-full bg-fuchsia-600/10 hover:bg-fuchsia-600 text-fuchsia-600 hover:text-white transition-all cursor-pointer border-none flex items-center gap-1" : "px-3 py-1 text-xs font-bold rounded-xl bg-fuchsia-600/10 hover:bg-fuchsia-600 text-fuchsia-600 hover:text-white transition-all cursor-pointer border-none flex items-center gap-1"}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar
                  </button>
                </div>
                
                {variants.length > 0 && (
                  <div className="p-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] space-y-2">
                    {variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text" placeholder="Ej. Talla S / Color Azul" value={v.name}
                          onChange={e => setVariants(vv => vv.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                          className={inputStyle + " flex-1"}
                        />
                        <input
                          type="number" placeholder="Δ precio" value={v.price_delta}
                          onChange={e => setVariants(vv => vv.map((x, i) => i === idx ? { ...x, price_delta: parseFloat(e.target.value) || 0 } : x))}
                          className={inputStyle + " w-28"}
                        />
                        <button onClick={() => setVariants(vv => vv.filter((_, i) => i !== idx))} className="text-fuchsia-500 hover:bg-fuchsia-500/10 p-2 rounded-xl transition-all cursor-pointer border-none bg-transparent">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
  
            {/* Footer */}
            <div className="p-6 border-t border-black/[0.05] dark:border-white/[0.05] flex gap-3 justify-end relative z-10">
              <button onClick={() => setShowModal(false)} className={cancelBtnStyle}>
                Cancelar
              </button>
              <button
                onClick={handleSave} disabled={saving}
                className={saveBtnStyle}
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{editProduct ? "Guardar cambios" : "Crear producto"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      <StandardModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        title="Confirmar eliminación"
        maxWidthClass="max-w-md"
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-fuchsia-500">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-2">¿Eliminar producto?</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            ¿Eliminar el producto <span className="font-bold text-zinc-800 dark:text-zinc-200">&quot;{productToDelete?.name}&quot;</span>?
            <br />
            Se borrará por completo del sistema (no quedará como inactivo) y esta acción no se puede deshacer.
          </p>
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <button
            onClick={() => setProductToDelete(null)}
            className="px-5 py-2.5 text-xs font-bold border border-black/10 dark:border-white/10 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDelete}
            className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white rounded-full transition-all shadow-md shadow-fuchsia-500/20 hover:shadow-lg hover:shadow-fuchsia-500/30 cursor-pointer border-none"
          >
            Eliminar
          </button>
        </div>
      </StandardModal>
    </div>
  );
}
