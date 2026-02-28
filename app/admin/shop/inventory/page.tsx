"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setToken(session.access_token);

    const { data: profile } = await supabase.from("users").select("role, group_id").eq("id", session.user.id).single();
    setUserRole(profile?.role || "");
    setUserGroupId(profile?.group_id || null);

    const [invRes, grpRes, prodRes, transRes] = await Promise.all([
      fetch("/api/shop/inventory", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      supabase.from("groups").select("id, name").order("name"),
      fetch("/api/shop/products?active_only=false", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch("/api/shop/inventory/transfer?limit=100", { headers: { Authorization: `Bearer ${session.access_token}` } })
    ]);

    if (invRes.ok) setInventory(await invRes.json());
    if (grpRes.data) setGroups(grpRes.data);
    if (prodRes.ok) setProducts(await prodRes.json());
    if (transRes.ok) setTransfers(await transRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50 to-rose-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">📦</span> Inventario — Sexshop
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control de stock por ubicación, entradas y traslados
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-1 mb-6 w-fit">
          {[
            { key: "stock", label: "Stock actual" },
            { key: "transfer", label: "Traslado" },
            { key: "history", label: "Historial" }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t.key ? "bg-pink-600 text-white shadow-sm" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: Stock actual */}
        {tab === "stock" && (
          <div className="space-y-4">
            {/* Add stock form */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Agregar / ajustar stock</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
                  <select value={addForm.product_id} onChange={e => setAddForm(f => ({ ...f, product_id: e.target.value, variant_id: "" }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="">Seleccionar...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {selectedProduct?.shop_product_variants && selectedProduct.shop_product_variants.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Variante</label>
                    <select value={addForm.variant_id} onChange={e => setAddForm(f => ({ ...f, variant_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                      <option value="">Sin variante</option>
                      {selectedProduct.shop_product_variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ubicación</label>
                  <select value={addForm.location_type === "bodega" ? "bodega" : addForm.location_id} onChange={e => {
                    if (e.target.value === "bodega") setAddForm(f => ({ ...f, location_type: "bodega", location_id: "" }));
                    else setAddForm(f => ({ ...f, location_type: "sede", location_id: e.target.value }));
                  }} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    {userRole === "super_admin" && <option value="bodega">Bodega Principal</option>}
                    {groups.map(g => <option key={g.id} value={g.id}>Sede {g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unidades (+ añadir / - retirar)</label>
                  <input type="number" value={addForm.quantity_delta} onChange={e => setAddForm(f => ({ ...f, quantity_delta: e.target.value }))} placeholder="Ej. 10 o -2" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
              </div>
              {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
              <button onClick={handleAddStock} disabled={addSaving} className="mt-3 px-5 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                {addSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Actualizar stock
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400">Filtrar por ubicación:</label>
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                <option value="all">Todas</option>
                {userRole === "super_admin" && <option value="bodega">Bodega Principal</option>}
                {groups.map(g => <option key={g.id} value={g.id}>Sede {g.name}</option>)}
              </select>
            </div>

            {/* Stock table */}
            {loading ? (
              <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" /></div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Variante</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ubicación</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Disponible</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reservado</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                    {filteredInventory.map(row => {
                      const available = row.quantity - row.reserved;
                      const isLow = available <= row.shop_products.min_stock_alert;
                      return (
                        <tr key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {row.shop_products.images?.[0] ? (
                                <img src={row.shop_products.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-sm">🛍️</div>
                              )}
                              <span className="font-medium text-gray-900 dark:text-white">{row.shop_products.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {row.shop_product_variants?.name || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {getLocationLabel(row.location_type, row.location_id)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {available}
                            {isLow && <span className="ml-1 text-xs">⚠️</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">{row.reserved}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{row.quantity}</td>
                        </tr>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin registros de inventario</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: Traslado */}
        {tab === "transfer" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 max-w-2xl">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Trasladar stock entre ubicaciones</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Producto</label>
                <select value={transForm.product_id} onChange={e => setTransForm(f => ({ ...f, product_id: e.target.value, variant_id: "" }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedTransProduct?.shop_product_variants && selectedTransProduct.shop_product_variants.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variante</label>
                  <select value={transForm.variant_id} onChange={e => setTransForm(f => ({ ...f, variant_id: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="">Sin variante</option>
                    {selectedTransProduct.shop_product_variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origen</label>
                  <select value={transForm.from_location_type === "bodega" ? "bodega" : transForm.from_location_id} onChange={e => {
                    if (e.target.value === "bodega") setTransForm(f => ({ ...f, from_location_type: "bodega", from_location_id: "" }));
                    else setTransForm(f => ({ ...f, from_location_type: "sede", from_location_id: e.target.value }));
                  }} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    {userRole === "super_admin" && <option value="bodega">Bodega Principal</option>}
                    {groups.map(g => <option key={g.id} value={g.id}>Sede {g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Destino</label>
                  <select value={transForm.to_location_type === "bodega" ? "bodega" : transForm.to_location_id} onChange={e => {
                    if (e.target.value === "bodega") setTransForm(f => ({ ...f, to_location_type: "bodega", to_location_id: "" }));
                    else setTransForm(f => ({ ...f, to_location_type: "sede", to_location_id: e.target.value }));
                  }} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none">
                    {userRole === "super_admin" && <option value="bodega">Bodega Principal</option>}
                    {groups.map(g => <option key={g.id} value={g.id}>Sede {g.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                <input type="number" min="1" value={transForm.quantity} onChange={e => setTransForm(f => ({ ...f, quantity: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none" placeholder="Ej. 5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas (opcional)</label>
                <textarea value={transForm.notes} onChange={e => setTransForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-pink-500 outline-none resize-none" placeholder="Razón del traslado..." />
              </div>
              {transError && <p className="text-red-500 text-sm">{transError}</p>}
              <button onClick={handleTransfer} disabled={transSaving} className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-sm rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {transSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirmar traslado
              </button>
            </div>
          </div>
        )}

        {/* TAB: Historial */}
        {tab === "history" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Desde</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hacia</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Uds.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Por</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {transfers.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.shop_products?.name}</td>
                    <td className="px-4 py-3 text-gray-500">{getLocationLabel(t.from_location_type, t.from_location_id)}</td>
                    <td className="px-4 py-3 text-gray-500">{getLocationLabel(t.to_location_type, t.to_location_id)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{t.quantity}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.users?.email?.split("@")[0]}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin traslados registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
