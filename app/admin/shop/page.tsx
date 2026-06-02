"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";

// Import modules to render inside portals (headless mode)
import { ShopOrdersContent } from "./orders/orders-content";
import { ShopProductsContent } from "./products/products-content";
import { ShopInventoryContent } from "./inventory/inventory-content";
import { ShopPromotionsContent } from "./promotions/promotions-content";
import { ShopCategoriesContent } from "./categories/categories-content";

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  activeProducts: number;
  totalProducts: number;
  totalStock: number;
  activePromotions: number;
  totalCategories: number;
}

type HubType = "orders" | "products" | "inventory" | "promotions" | "categories";

interface HubWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  activeHub: HubType | null;
  onNavigate: (hub: HubType) => void;
}

function HubWindow({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  activeHub,
  onNavigate
}: HubWindowProps) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !activeHub) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    if (Math.abs(diffX) > 60) {
      const hubList: HubType[] = ["orders", "products", "inventory", "categories", "promotions"];
      const currentIndex = hubList.indexOf(activeHub);
      if (currentIndex !== -1) {
        if (diffX > 0) {
          // Swipe left -> Next Hub
          const nextIndex = (currentIndex + 1) % hubList.length;
          onNavigate(hubList[nextIndex]);
        } else {
          // Swipe right -> Prev Hub
          const prevIndex = (currentIndex - 1 + hubList.length) % hubList.length;
          onNavigate(hubList[prevIndex]);
        }
      }
    }
    setTouchStartX(null);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getAmbientGlow = () => {
    switch (activeHub) {
      case "orders": // Lush Neon Rose-Red
        return "bg-rose-500/10 dark:bg-rose-500/10";
      case "products": // Lush Neon Fuchsia (#FF13F0 equivalent)
        return "bg-fuchsia-500/10 dark:bg-fuchsia-500/10";
      case "inventory": // Lush Neon Violet
        return "bg-violet-500/10 dark:bg-violet-500/10";
      case "promotions": // Lush Neon Purple
        return "bg-purple-500/10 dark:bg-purple-500/10";
      case "categories": // Lush Neon Pink
        return "bg-pink-500/10 dark:bg-pink-500/10";
      default:
        return "bg-fuchsia-500/10 dark:bg-fuchsia-500/10";
    }
  };

  const getHubNeonLineStyle = () => {
    switch (activeHub) {
      case "orders": // Lush Neon Rose-Red
        return "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.75),0_0_3px_rgba(244,63,94,0.85)]";
      case "products": // Lush Neon Fuchsia (#FF13F0)
        return "bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.85),0_0_3px_rgba(217,70,239,0.95)]";
      case "inventory": // Lush Neon Violet
        return "bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.75),0_0_3px_rgba(139,92,246,0.85)]";
      case "promotions": // Lush Neon Purple
        return "bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.75),0_0_3px_rgba(168,85,247,0.85)]";
      case "categories": // Lush Neon Pink
        return "bg-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.75),0_0_3px_rgba(236,72,153,0.85)]";
      default:
        return "bg-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.75),0_0_3px_rgba(217,70,239,0.85)]";
    }
  };

  const getHubXGlowClass = () => {
    switch (activeHub) {
      case "orders":
        return "hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 hover:shadow-[0_0_12px_rgba(244,63,94,0.4)]";
      case "products":
        return "hover:text-fuchsia-500 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 hover:shadow-[0_0_12px_rgba(217,70,239,0.4)]";
      case "inventory":
        return "hover:text-violet-500 hover:bg-violet-500/10 hover:border-violet-500/30 hover:shadow-[0_0_12px_rgba(139,92,246,0.4)]";
      case "categories":
        return "hover:text-pink-500 hover:bg-pink-500/10 hover:border-pink-500/30 hover:shadow-[0_0_12px_rgba(236,72,153,0.4)]";
      case "promotions":
        return "hover:text-purple-500 hover:bg-purple-500/10 hover:border-purple-500/30 hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]";
      default:
        return "hover:text-fuchsia-500 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 hover:shadow-[0_0_12px_rgba(217,70,239,0.4)]";
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans">
      {/* Overlay backdrop blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-3xl transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      {/* Window container */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-7xl h-[85vh] md:h-[80vh] bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-scale-up"
      >
        {/* Glow ambient representation */}
        <div className={`absolute top-0 right-0 w-80 h-80 ${getAmbientGlow()} rounded-full blur-3xl mix-blend-screen pointer-events-none transition-all duration-700`} />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md select-none relative z-10">
          <style dangerouslySetInnerHTML={{ __html: `
            .apple-dock-zoom {
              transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease, box-shadow 0.25s ease, border-color 0.25s ease;
            }
          ` }} />

          {/* Symmetrical Apple Dots with Hub Navigation (Colored dots switcher) */}
          <div className="flex items-center space-x-3 w-1/4 relative z-20 h-8">
            <div className="hidden md:flex items-center space-x-3">
              {/* Pedidos (Lush Neon Rose-Red) */}
              <button
                onClick={() => onNavigate("orders")}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === "orders"
                    ? "border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.85),0_0_4px_rgba(244,63,94,0.95)] scale-110 opacity-100"
                    : "border-rose-500/40 shadow-[0_0_6px_rgba(244,63,94,0.15)] opacity-60 hover:opacity-100 hover:border-rose-500 hover:shadow-[0_0_14px_rgba(244,63,94,0.7)]"
                }`}
                title="Pedidos"
              />
              {/* Productos (Lush Pure Neon Fuchsia) */}
              <button
                onClick={() => onNavigate("products")}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === "products"
                    ? "border-2 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.85),0_0_4px_rgba(217,70,239,0.95)] scale-110 opacity-100"
                    : "border-fuchsia-500/40 shadow-[0_0_6px_rgba(217,70,239,0.15)] opacity-60 hover:opacity-100 hover:border-fuchsia-500 hover:shadow-[0_0_14px_rgba(217,70,239,0.7)]"
                }`}
                title="Productos"
              />
              {/* Inventario (Lush Neon Violet) */}
              <button
                onClick={() => onNavigate("inventory")}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === "inventory"
                    ? "border-2 border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.85),0_0_4px_rgba(139,92,246,0.95)] scale-110 opacity-100"
                    : "border-violet-500/40 shadow-[0_0_6px_rgba(139,92,246,0.15)] opacity-60 hover:opacity-100 hover:border-violet-500 hover:shadow-[0_0_14px_rgba(139,92,246,0.7)]"
                }`}
                title="Inventario"
              />
              {/* Categorías (Lush Neon Pink) */}
              <button
                onClick={() => onNavigate("categories")}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === "categories"
                    ? "border-2 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.85),0_0_4px_rgba(236,72,153,0.95)] scale-110 opacity-100"
                    : "border-pink-500/40 shadow-[0_0_6px_rgba(236,72,153,0.15)] opacity-60 hover:opacity-100 hover:border-pink-500 hover:shadow-[0_0_14px_rgba(236,72,153,0.7)]"
                }`}
                title="Categorías"
              />
              {/* Promociones (Lush Neon Purple) */}
              <button
                onClick={() => onNavigate("promotions")}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === "promotions"
                    ? "border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.85),0_0_4px_rgba(168,85,247,0.95)] scale-110 opacity-100"
                    : "border-purple-500/40 shadow-[0_0_6px_rgba(168,85,247,0.15)] opacity-60 hover:opacity-100 hover:border-purple-500 hover:shadow-[0_0_14px_rgba(168,85,247,0.7)]"
                }`}
                title="Promociones"
              />
            </div>
          </div>

          {/* Centered Title */}
          <div className="text-center flex-1 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-wide truncate">
              {title}
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 font-medium truncate mt-0.5">
              {subtitle}
            </p>
          </div>

          {/* Close button on the right */}
          <div className="w-1/4 flex justify-end relative z-20">
            <button
              onClick={onClose}
              className={`w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-zinc-400 transition-all duration-300 active:scale-95 cursor-pointer ${getHubXGlowClass()}`}
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dynamic Glowing Line Separator */}
        <div className={`h-[1.5px] w-full ${getHubNeonLineStyle()} pointer-events-none opacity-80 relative z-20`} />

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-transparent text-gray-900 dark:text-white relative z-10 apple-scroll">
          <div className="max-w-7xl mx-auto h-full relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopAdminIndex() {
  const router = useRouter();
  const [activeHub, setActiveHub] = useState<HubType | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    pendingOrders: 0,
    activeProducts: 0,
    totalProducts: 0,
    totalStock: 0,
    activePromotions: 0,
    totalCategories: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el carrusel móvil rotativo
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const [showMobileDescription, setShowMobileDescription] = useState(false);
  const [lastTapMobile, setLastTapMobile] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Estados y referencias para la interactividad táctil de la isla informativa (ticker)
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const tickerOffsetRef = useRef<number>(0);
  const tickerIsPausedRef = useRef<boolean>(false);
  const tickerIsDraggingRef = useRef<boolean>(false);
  const tickerTouchStartXRef = useRef<number>(0);
  const tickerStartOffsetRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [tickerIsPaused, setTickerIsPaused] = useState<boolean>(false);
  const [lastTickerTap, setLastTickerTap] = useState<number>(0);

  const handleTickerTouchStart = (e: React.TouchEvent) => {
    tickerTouchStartXRef.current = e.touches[0].clientX;
    tickerStartOffsetRef.current = tickerOffsetRef.current;
    tickerIsDraggingRef.current = false;
  };

  const handleTickerTouchMove = (e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - tickerTouchStartXRef.current;
    if (Math.abs(diffX) > 5) {
      tickerIsDraggingRef.current = true;
      const nextOffset = tickerStartOffsetRef.current + diffX;
      tickerOffsetRef.current = nextOffset;
      if (tickerTrackRef.current) {
        tickerTrackRef.current.style.transform = `translateX(${nextOffset}px)`;
      }
    }
  };

  const handleTickerTouchEnd = (e: React.TouchEvent, hub: HubType) => {
    if (tickerIsDraggingRef.current) {
      tickerIsDraggingRef.current = false;
      // Pausar automáticamente tras arrastrar para que se quede exactamente donde está
      tickerIsPausedRef.current = true;
      setTickerIsPaused(true);
      return;
    }

    // Prevenir eventos de click emulados en pantallas táctiles
    if (e) {
      e.preventDefault();
    }

    const now = Date.now();
    if (now - lastTickerTap < 300) {
      // Es un Doble Tap
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (hub) {
        setActiveHub(hub);
      }
    } else {
      // Es un Tap simple
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        const nextPaused = !tickerIsPausedRef.current;
        tickerIsPausedRef.current = nextPaused;
        setTickerIsPaused(nextPaused);
        tapTimeoutRef.current = null;
      }, 250);
    }
    setLastTickerTap(now);
  };

  // Bucle de animación por JavaScript (requestAnimationFrame) de alto rendimiento
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      if (!tickerIsPausedRef.current && !tickerIsDraggingRef.current && tickerTrackRef.current) {
        const halfWidth = tickerTrackRef.current.scrollWidth / 2;
        if (halfWidth > 0) {
          tickerOffsetRef.current -= 0.8; // Velocidad del desplazamiento automático
          if (tickerOffsetRef.current <= -halfWidth) {
            tickerOffsetRef.current += halfWidth;
          } else if (tickerOffsetRef.current > 0) {
            tickerOffsetRef.current -= halfWidth;
          }
          tickerTrackRef.current.style.transform = `translateX(${tickerOffsetRef.current}px)`;
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Escuchar ESC para cerrar la ventana modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveHub(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sesión no válida o expirada. Por favor, inicia sesión de nuevo.");
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [ordersRes, productsRes, categoriesRes, promotionsRes, inventoryRes] = await Promise.all([
        fetch("/api/shop/orders", { headers }),
        fetch("/api/shop/products?active_only=false", { headers }),
        fetch("/api/shop/categories", { headers }),
        fetch("/api/shop/promotions?active_only=false", { headers }),
        fetch("/api/shop/inventory", { headers })
      ]);

      const [orders, products, categories, promotions, inventory] = await Promise.all([
        ordersRes.ok ? ordersRes.json() : [],
        productsRes.ok ? productsRes.json() : [],
        categoriesRes.ok ? categoriesRes.json() : [],
        promotionsRes.ok ? promotionsRes.json() : [],
        inventoryRes.ok ? inventoryRes.json() : []
      ]);

      const totalStock = (inventory || []).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
      const pendingOrders = (orders || []).filter((o: any) => o.status === "pendiente").length;
      const activeProducts = (products || []).filter((p: any) => p.is_active).length;
      const activePromotions = (promotions || []).filter((p: any) => p.is_active).length;

      setStats({
        totalOrders: orders?.length || 0,
        pendingOrders,
        activeProducts,
        totalProducts: products?.length || 0,
        totalStock,
        activePromotions,
        totalCategories: categories?.length || 0
      });
    } catch (err: any) {
      console.error("Error loading shop dashboard stats:", err);
      setError("Ocurrió un error al cargar las estadísticas del AIM Market.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderMetricsCapsule = () => {
    const tickerItems = [
      {
        id: "orders_stat",
        title: "Pedidos del Mes",
        detail: `${stats.totalOrders} pedidos totales · ${stats.pendingOrders} pendientes de atención`,
        icon: (
          <svg className="w-3.5 h-3.5 text-rose-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        ),
        bgClass: "bg-rose-500/10 text-rose-500 border border-rose-500/10",
        hub: "orders" as HubType
      },
      {
        id: "products_stat",
        title: "Catálogo de Productos",
        detail: `${stats.totalProducts} productos cargados · ${stats.activeProducts} en exhibición activa`,
        icon: (
          <svg className="w-3.5 h-3.5 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        bgClass: "bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/10",
        hub: "products" as HubType
      },
      {
        id: "stock_stat",
        title: "Control de Inventario",
        detail: `${stats.totalStock.toLocaleString()} unidades en stock · Existencias físicas verificadas`,
        icon: (
          <svg className="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
        bgClass: "bg-violet-500/10 text-violet-500 border border-violet-500/10",
        hub: "inventory" as HubType
      },
      {
        id: "categories_stat",
        title: "Secciones del Market",
        detail: `${stats.totalCategories} categorías configuradas · Belleza, Bienestar y Cuidado`,
        icon: (
          <svg className="w-3.5 h-3.5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
        bgClass: "bg-pink-500/10 text-pink-500 border border-pink-500/10",
        hub: "categories" as HubType
      },
      {
        id: "promotions_stat",
        title: "Campañas Activas",
        detail: `${stats.activePromotions} ofertas vigentes · Descuentos especiales y promociones 2x1`,
        icon: (
          <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
        bgClass: "bg-purple-500/10 text-purple-500 border border-purple-500/10",
        hub: "promotions" as HubType
      },
      {
        id: "financing_info",
        title: "Financiación Habilitada",
        detail: "Pagos diferidos en 1, 2, 3 o 4 quincenas · Descuentos directos en nómina",
        icon: (
          <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        bgClass: "bg-rose-500/10 text-rose-500 border border-rose-500/10",
        hub: "orders" as HubType
      }
    ];

    const doubledItems = [...tickerItems, ...tickerItems];

    const getTickerItemBorderClass = (hub: HubType) => {
      switch (hub) {
        case "orders":
          return "border-rose-500/25 dark:border-rose-500/15 hover:border-rose-500 dark:hover:border-rose-400 hover:shadow-[0_0_12px_rgba(244,63,94,0.3)] dark:hover:shadow-[0_0_12px_rgba(244,63,94,0.4)] bg-rose-500/[0.04] dark:bg-rose-500/[0.02]";
        case "products":
          return "border-fuchsia-500/25 dark:border-fuchsia-500/15 hover:border-fuchsia-500 dark:hover:border-fuchsia-400 hover:shadow-[0_0_12px_rgba(217,70,239,0.3)] dark:hover:shadow-[0_0_12px_rgba(217,70,239,0.4)] bg-fuchsia-500/[0.04] dark:bg-fuchsia-500/[0.02]";
        case "inventory":
          return "border-violet-500/25 dark:border-violet-500/15 hover:border-violet-500 dark:hover:border-violet-400 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] dark:hover:shadow-[0_0_12px_rgba(139,92,246,0.4)] bg-violet-500/[0.04] dark:bg-violet-500/[0.02]";
        case "categories":
          return "border-pink-500/25 dark:border-pink-500/15 hover:border-pink-500 dark:hover:border-pink-400 hover:shadow-[0_0_12px_rgba(236,72,153,0.3)] dark:hover:shadow-[0_0_12px_rgba(236,72,153,0.4)] bg-pink-500/[0.04] dark:bg-pink-500/[0.02]";
        case "promotions":
          return "border-purple-500/25 dark:border-purple-500/15 hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] dark:hover:shadow-[0_0_12px_rgba(168,85,247,0.4)] bg-purple-500/[0.04] dark:bg-purple-500/[0.02]";
        default:
          return "border-fuchsia-500/25 dark:border-fuchsia-500/15 hover:border-fuchsia-500 dark:hover:border-fuchsia-400 hover:shadow-[0_0_12px_rgba(217,70,239,0.3)] bg-fuchsia-500/[0.04] dark:bg-fuchsia-500/[0.02]";
      }
    };

    return (
      <div className="relative rounded-full h-14 sm:h-16 bg-black/90 dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/[0.08] dark:border-white/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(255,255,255,0.02)] flex items-center overflow-hidden w-full select-none">
        <style dangerouslySetInnerHTML={{ __html: `
          .ticker-track {
            display: flex;
            width: max-content;
            will-change: transform;
          }
          .ticker-item {
            transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
          }
          .ticker-item:hover {
            transform: scale(1.02);
          }
        ` }} />

        {/* Ambient glows inside marquee capsule */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-full">
          <div className="absolute -top-10 -left-10 w-28 h-28 bg-pink-500/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute -bottom-10 right-20 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "5s" }} />
        </div>

        {/* Scrolling Track */}
        <div 
          className="w-full overflow-hidden relative z-10 py-1"
          onTouchStart={handleTickerTouchStart}
          onTouchMove={handleTickerTouchMove}
        >
          <div 
            ref={tickerTrackRef}
            className="ticker-track"
            style={{ willChange: 'transform' }}
          >
            {doubledItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => {
                  // En escritorios o clicks normales que no sean táctiles
                  setActiveHub(item.hub);
                }}
                onTouchEnd={(e) => handleTickerTouchEnd(e, item.hub)}
                className={`ticker-item flex items-center space-x-3 px-5 py-2 border rounded-full mx-3 flex-shrink-0 cursor-pointer backdrop-blur-md select-none ${getTickerItemBorderClass(item.hub)}`}
                title={`Abrir Hub de ${item.title}`}
              >
                <div className={`w-7 h-7 rounded-full ${item.bgClass} flex items-center justify-center flex-shrink-0 relative overflow-hidden p-1.5`}>
                  <div className="absolute inset-0 bg-current opacity-10" />
                  {item.icon}
                </div>
                <div className="flex items-baseline space-x-2 select-none">
                  <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap tracking-tight select-none">
                    {item.title}
                  </span>
                  <span className="text-zinc-400 text-[10px] sm:text-xs font-semibold whitespace-nowrap select-none">
                    {item.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHubCardsGrid = () => {
    const cards = [
      {
        title: "Pedidos",
        subtitle: "Financiaciones",
        desc: "Gestiona las órdenes, aprueba financiación quincenal y controla cuotas.",
        metric: `${stats.totalOrders}`,
        submetric: `${stats.pendingOrders} pendientes`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        ),
        badge: "Ventas",
        badgeColor: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
        ledColor: "bg-rose-500",
        hub: "orders" as HubType,
        colorClass: "border-rose-500/30 dark:border-rose-500/20 hover:border-rose-500 dark:hover:border-rose-400 hover:shadow-[0_0_25px_rgba(244,63,94,0.35)] dark:hover:shadow-[0_0_30px_rgba(244,63,94,0.45)] text-rose-500",
        glowGradient: "from-rose-500/0 via-rose-500/0 to-rose-500/[0.08]"
      },
      {
        title: "Productos",
        subtitle: "Catálogo",
        desc: "Registra nuevos artículos, maneja precios base, variaciones e imágenes.",
        metric: `${stats.totalProducts}`,
        submetric: `${stats.activeProducts} activos`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        badge: "Catálogo",
        badgeColor: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
        ledColor: "bg-fuchsia-500",
        hub: "products" as HubType,
        colorClass: "border-fuchsia-500/30 dark:border-fuchsia-500/20 hover:border-fuchsia-500 dark:hover:border-fuchsia-400 hover:shadow-[0_0_25px_rgba(217,70,239,0.35)] dark:hover:shadow-[0_0_30px_rgba(217,70,239,0.45)] text-fuchsia-500",
        glowGradient: "from-fuchsia-500/0 via-fuchsia-500/0 to-fuchsia-500/[0.08]"
      },
      {
        title: "Inventarios",
        subtitle: "Existencias",
        desc: "Administra el stock en sedes o bodega y aprueba traslados del catálogo.",
        metric: `${stats.totalStock.toLocaleString()}`,
        submetric: "Unidades totales",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
        badge: "Existencias",
        badgeColor: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
        ledColor: "bg-violet-500",
        hub: "inventory" as HubType,
        colorClass: "border-violet-500/30 dark:border-violet-500/20 hover:border-violet-500 dark:hover:border-violet-400 hover:shadow-[0_0_25px_rgba(139,92,246,0.35)] dark:hover:shadow-[0_0_30px_rgba(139,92,246,0.45)] text-violet-500",
        glowGradient: "from-violet-500/0 via-violet-500/0 to-violet-500/[0.08]"
      },
      {
        title: "Categorías",
        subtitle: "Secciones",
        desc: "Crea y organiza secciones temáticas: belleza, bienestar, lencería, etc.",
        metric: `${stats.totalCategories}`,
        submetric: "Distribuciones",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
        badge: "Estructura",
        badgeColor: "bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400",
        ledColor: "bg-pink-500",
        hub: "categories" as HubType,
        colorClass: "border-pink-500/30 dark:border-pink-500/20 hover:border-pink-500 dark:hover:border-pink-400 hover:shadow-[0_0_25px_rgba(236,72,153,0.35)] dark:hover:shadow-[0_0_30px_rgba(236,72,153,0.45)] text-pink-500",
        glowGradient: "from-pink-500/0 via-pink-500/0 to-pink-500/[0.08]"
      },
      {
        title: "Promociones",
        subtitle: "Descuentos",
        desc: "Crea cupones y rebajas temporales fijas y porcentuales.",
        metric: `${stats.activePromotions}`,
        submetric: "Campañas activas",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
        badge: "Ofertas",
        badgeColor: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
        ledColor: "bg-purple-500",
        hub: "promotions" as HubType,
        colorClass: "border-purple-500/30 dark:border-purple-500/20 hover:border-purple-500 dark:hover:border-purple-400 hover:shadow-[0_0_25px_rgba(168,85,247,0.35)] dark:hover:shadow-[0_0_30px_rgba(168,85,247,0.45)] text-purple-500",
        glowGradient: "from-purple-500/0 via-purple-500/0 to-purple-500/[0.08]"
      }
    ];

    return (
      <div className="flex flex-row overflow-x-auto pb-6 gap-5 mb-12 lg:grid lg:grid-cols-5 lg:overflow-x-visible lg:gap-5 snap-x scrollbar-thin snap-mandatory select-none max-sm:px-4">
        {cards.map((c) => (
          <div
            key={c.hub}
            onClick={() => setActiveHub(c.hub)}
            className={`flex-shrink-0 w-[285px] sm:w-[320px] lg:w-auto min-h-[330px] snap-start group relative cursor-pointer overflow-hidden rounded-[2.2rem] bg-white/70 dark:bg-[#1a1a1c]/50 hover:bg-white/90 dark:hover:bg-[#1a1a1c]/75 border p-6 shadow-2xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 backdrop-blur-md flex flex-col justify-between ${c.colorClass}`}
          >
            {/* Ambient hover glow gradient inside the card */}
            <div className={`absolute inset-0 bg-gradient-to-br ${c.glowGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

            <div className="relative flex flex-col gap-6">
              <div className="flex items-center justify-between">
                {/* Modern Symmetrical Glass Icon Container */}
                <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-md">
                  {c.icon}
                </div>
                {/* Micro LED status badge */}
                <div className={`inline-flex items-center justify-center h-7 gap-1.5 px-3.5 rounded-full border animate-pulse select-none ${c.badgeColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.ledColor}`} />
                  <span className="text-[11px] font-bold tracking-wide leading-none">{c.badge}</span>
                </div>
              </div>

              {/* Title & Desc */}
              <div className="space-y-2.5">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-zinc-100 tracking-tight leading-snug">
                    {c.title}
                  </h3>
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 mt-1.5 leading-none">
                    {c.subtitle}
                  </span>
                </div>
                <p className="text-[12.5px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0 opacity-0 max-h-0 -translate-y-2 group-hover:opacity-100 group-hover:max-h-20 group-hover:mt-2.5 group-hover:translate-y-0 overflow-hidden transition-all duration-500 ease-out">
                  {c.desc}
                </p>
              </div>
            </div>

            {/* Bottom Section: Metric Counter & Action Link */}
            <div className="relative pt-6 border-t border-black/[0.04] dark:border-white/[0.04] flex flex-col gap-4">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white leading-none">
                  {c.metric}
                </span>
                <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 whitespace-nowrap bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                  {c.submetric}
                </span>
              </div>

              <div className="flex items-center text-xs font-bold transition-all duration-300 group-hover:translate-x-1">
                <span>Entrar al Hub</span>
                <svg className="w-3.5 h-3.5 ml-1 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Carrusel Móvil Rotativo 3D para los Hubs del Market
  const renderMobileHubCarousel = () => {
    const cards = [
      {
        title: "Pedidos",
        subtitle: "Financiaciones",
        desc: "Gestiona las órdenes, aprueba financiación quincenal y controla cuotas.",
        metric: `${stats.totalOrders}`,
        submetric: `${stats.pendingOrders} pendientes`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        ),
        badge: "Ventas",
        badgeColor: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
        ledColor: "bg-rose-500",
        hub: "orders" as HubType,
        colorClass: "border-rose-500/30 dark:border-rose-500/20 text-rose-500",
        activeGlowClass: "border-rose-500/70 dark:border-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.25)] dark:shadow-[0_0_35px_rgba(244,63,94,0.3)] text-rose-500",
        glowGradient: "from-rose-500/0 via-rose-500/0 to-rose-500/[0.08]"
      },
      {
        title: "Productos",
        subtitle: "Catálogo",
        desc: "Registra nuevos artículos, maneja precios base, variaciones e imágenes.",
        metric: `${stats.totalProducts}`,
        submetric: `${stats.activeProducts} activos`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        badge: "Catálogo",
        badgeColor: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
        ledColor: "bg-fuchsia-500",
        hub: "products" as HubType,
        colorClass: "border-fuchsia-500/30 dark:border-fuchsia-500/20 text-fuchsia-500",
        activeGlowClass: "border-fuchsia-500/70 dark:border-fuchsia-500/60 shadow-[0_0_30px_rgba(217,70,239,0.25)] dark:shadow-[0_0_35px_rgba(217,70,239,0.3)] text-fuchsia-500",
        glowGradient: "from-fuchsia-500/0 via-fuchsia-500/0 to-fuchsia-500/[0.08]"
      },
      {
        title: "Inventarios",
        subtitle: "Existencias",
        desc: "Administra el stock en sedes o bodega y aprueba traslados del catálogo.",
        metric: `${stats.totalStock.toLocaleString()}`,
        submetric: "Unidades totales",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
        badge: "Existencias",
        badgeColor: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
        ledColor: "bg-violet-500",
        hub: "inventory" as HubType,
        colorClass: "border-violet-500/30 dark:border-violet-500/20 text-violet-500",
        activeGlowClass: "border-violet-500/70 dark:border-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.25)] dark:shadow-[0_0_35px_rgba(139,92,246,0.3)] text-violet-500",
        glowGradient: "from-violet-500/0 via-violet-500/0 to-violet-500/[0.08]"
      },
      {
        title: "Categorías",
        subtitle: "Secciones",
        desc: "Crea y organiza secciones temáticas: belleza, bienestar, lencería, etc.",
        metric: `${stats.totalCategories}`,
        submetric: "Distribuciones",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
        badge: "Estructura",
        badgeColor: "bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400",
        ledColor: "bg-pink-500",
        hub: "categories" as HubType,
        colorClass: "border-pink-500/30 dark:border-pink-500/20 text-pink-500",
        activeGlowClass: "border-pink-500/70 dark:border-pink-500/60 shadow-[0_0_30px_rgba(236,72,153,0.25)] dark:shadow-[0_0_35px_rgba(236,72,153,0.3)] text-pink-500",
        glowGradient: "from-pink-500/0 via-pink-500/0 to-pink-500/[0.08]"
      },
      {
        title: "Promociones",
        subtitle: "Descuentos",
        desc: "Crea cupones y rebajas temporales fijas y porcentuales.",
        metric: `${stats.activePromotions}`,
        submetric: "Campañas activas",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
        badge: "Ofertas",
        badgeColor: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
        ledColor: "bg-purple-500",
        hub: "promotions" as HubType,
        colorClass: "border-purple-500/30 dark:border-purple-500/20 text-purple-500",
        activeGlowClass: "border-purple-500/70 dark:border-purple-500/60 shadow-[0_0_30px_rgba(168,85,247,0.25)] dark:shadow-[0_0_35px_rgba(168,85,247,0.3)] text-purple-500",
        glowGradient: "from-purple-500/0 via-purple-500/0 to-purple-500/[0.08]"
      }
    ];

    const getCardStyle = (index: number) => {
      const diff = index - activeMobileIndex;
      let offset = diff;
      if (offset > 2) offset -= 5;
      if (offset < -2) offset += 5;

      const absOffset = Math.abs(offset);
      
      const translateX = offset * 135; 
      const scale = 1 - absOffset * 0.12; 
      const opacity = 1 - absOffset * 0.20; // 80% opacity for side cards to make text super crisp and readable!
      const zIndex = 10 - absOffset;
      const isCenter = offset === 0;

      const height = isCenter && showMobileDescription ? 330 : 250;

      return {
        transform: `translateX(${translateX}px) scale(${scale})`,
        opacity: opacity > 0 ? opacity : 0,
        zIndex,
        height: `${height}px`,
        cursor: isCenter ? 'pointer' : 'default',
        pointerEvents: absOffset <= 1 ? ('auto' as const) : ('none' as const),
      };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartX === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStartX - touchEndX;

      if (diffX > 50) {
        // Swipe left -> next
        setActiveMobileIndex((prev) => (prev + 1) % 5);
        setShowMobileDescription(false);
      } else if (diffX < -50) {
        // Swipe right -> prev
        setActiveMobileIndex((prev) => (prev - 1 + 5) % 5);
        setShowMobileDescription(false);
      }
      setTouchStartX(null);
    };

    const handleCardTap = (hub: HubType, isCenter: boolean) => {
      if (!isCenter) {
        const idx = cards.findIndex(c => c.hub === hub);
        if (idx !== -1) {
          setActiveMobileIndex(idx);
          setShowMobileDescription(false);
        }
        return;
      }

      const now = Date.now();
      if (now - lastTapMobile < 300) {
        setActiveHub(hub);
      } else {
        if (showMobileDescription) {
          setActiveHub(hub);
        } else {
          setShowMobileDescription(true);
        }
      }
      setLastTapMobile(now);
    };

    const activeCard = cards[activeMobileIndex];

    return (
      <div className="w-full flex flex-col items-center py-4 relative overflow-hidden select-none">
        <style dangerouslySetInnerHTML={{ __html: `
          .carousel-container-3d {
            position: relative;
            width: 100%;
            height: 350px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: visible;
          }
          .carousel-card-3d {
            position: absolute;
            width: 230px;
            transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease, height 0.6s cubic-bezier(0.25, 1, 0.5, 1);
          }
        ` }} />

        {/* 3D Carousel Window */}
        <div 
          className="carousel-container-3d"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {cards.map((c, index) => {
            const isCenter = index === activeMobileIndex;
            const cardStyle = getCardStyle(index);

            return (
              <div
                key={c.hub}
                style={cardStyle}
                onClick={() => handleCardTap(c.hub, isCenter)}
                className={`carousel-card-3d flex-shrink-0 group relative overflow-hidden rounded-[2.2rem] bg-white dark:bg-zinc-900 border p-6 transition-all duration-300 flex flex-col justify-between ${isCenter ? c.activeGlowClass : `${c.colorClass} shadow-md`}`}
              >
                {/* Glow ambient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${c.glowGradient} opacity-20`} />

                <div className="relative flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shadow-md">
                      {c.icon}
                    </div>
                    <div className="flex items-center justify-center h-6 select-none pr-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.ledColor} animate-pulse`} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100 tracking-tight leading-snug">
                      {c.title}
                    </h3>
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 block leading-none pt-0.5">
                      {c.subtitle}
                    </span>
                    <div 
                      className={`overflow-hidden transition-all duration-500 ease-out ${
                        isCenter && showMobileDescription 
                          ? "max-h-24 opacity-100 mt-2.5 translate-y-0" 
                          : "max-h-0 opacity-0 mt-0 -translate-y-2 pointer-events-none"
                      }`}
                    >
                      <p className="text-[10.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white leading-none whitespace-nowrap">
                      {c.metric}
                    </span>
                  </div>

                  <div className="flex items-center text-[9px] font-bold text-pink-500/80">
                    <span>
                      {isCenter && showMobileDescription 
                        ? "Tap de nuevo para ingresar" 
                        : "Tap para info · Doble tap para entrar"
                      }
                    </span>
                    <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Swipe Indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {cards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveMobileIndex(idx);
                setShowMobileDescription(false);
              }}
              className={`w-1.5 h-1.5 rounded-full border-none transition-all duration-300 ${
                idx === activeMobileIndex
                  ? "bg-pink-500 w-3 shadow-[0_0_8px_rgba(236,72,153,0.8)]"
                  : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
              }`}
              title={`Ver hub ${idx + 1}`}
            />
          ))}
        </div>


      </div>
    );
  };

  const renderShimmerLoader = () => {
    return (
      <div className="animate-pulse space-y-8">
        {/* Shimmer capsule */}
        <div className="h-16 w-full bg-black/5 dark:bg-white/5 rounded-full border border-black/10 dark:border-white/10" />

        {/* Shimmer grid of 5 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[330px] rounded-[2.2rem] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="w-10 h-10 rounded-2xl bg-black/10 dark:bg-white/10" />
                  <div className="w-16 h-5.5 rounded-full bg-black/10 dark:bg-white/10" />
                </div>
                <div className="space-y-3">
                  <div className="h-5 w-24 bg-black/10 dark:bg-white/10 rounded-md" />
                  <div className="h-3 w-16 bg-black/10 dark:bg-white/10 rounded-md" />
                  <div className="h-12 w-full bg-black/10 dark:bg-white/10 rounded-md" />
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
                <div className="flex justify-between items-baseline">
                  <div className="h-8 w-12 bg-black/10 dark:bg-white/10 rounded-md" />
                  <div className="h-4 w-20 bg-black/10 dark:bg-white/10 rounded-md" />
                </div>
                <div className="h-3 w-28 bg-black/10 dark:bg-white/10 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <div className="max-w-7xl mx-auto">
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
          .group:hover .hover-wave-text span {
            animation: subtleWave 1.5s ease-in-out infinite;
          }
          .group:hover .hover-wave-text span:nth-child(1) { animation-delay: 0.0s; }
          .group:hover .hover-wave-text span:nth-child(2) { animation-delay: 0.1s; }
          .group:hover .hover-wave-text span:nth-child(3) { animation-delay: 0.2s; }
          .group:hover .hover-wave-text span:nth-child(4) { animation-delay: 0.3s; }
          .group:hover .hover-wave-text span:nth-child(5) { animation-delay: 0.4s; }
          .group:hover .hover-wave-text span:nth-child(6) { animation-delay: 0.5s; }
        `}} />

        {/* HERO VIBRANTE ADAPTADO PARA ADMIN */}
        <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-pink-600 via-fuchsia-600 to-rose-500 shadow-[0_12px_45px_rgba(217,70,239,0.25)] border border-white/20 group">
          {/* Decorative Background Elements & Dynamic Animations */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-20 rounded-full blur-3xl pointer-events-none transition-transform duration-1000 group-hover:scale-125 group-hover:opacity-30"></div>
          <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-pink-300 opacity-20 rounded-full blur-2xl pointer-events-none transition-transform duration-1000 group-hover:translate-x-10"></div>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-rose-400 opacity-40 rounded-full blur-3xl pointer-events-none transition-transform duration-1000 group-hover:translate-x-10 group-hover:-translate-y-10"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>

          <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 select-none">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="flex-shrink-0 w-14 h-14 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-xl rounded-[1.2rem] sm:rounded-[1.5rem] flex items-center justify-center shadow-[inset_0_0_15px_rgba(255,255,255,0.4)] border border-white/40 transform transition-all duration-500 hover:rotate-6 hover:scale-105">
                <svg className="w-7 h-7 sm:w-10 sm:h-10 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tighter mb-0.5 sm:mb-1 drop-shadow-md cursor-default text-white">
                  <span>AIM </span>
                  <span className="hover-wave-text text-pink-100 inline-block font-bold">
                    {"Market".split("").map((char, i) => (
                      <span key={i}>{char}</span>
                    ))}
                  </span>
                  <span className="text-white text-lg sm:text-2xl font-medium tracking-tight ml-2 opacity-90 block sm:inline-block sm:mt-0 mt-1">
                    Dashboard
                  </span>
                </h1>
              </div>
            </div>

            {/* Admin Live Stats Widgets */}
            <div className="flex flex-row items-center gap-2 sm:gap-2.5">
              {/* Pedidos Totales */}
              <div className="bg-black/20 backdrop-blur-md rounded-xl px-3 py-1 sm:px-3.5 sm:py-1.5 text-center border border-white/10 shadow-md min-w-[75px] sm:min-w-[85px]">
                <p className="text-[10px] text-pink-200 font-semibold tracking-wide">Pedidos</p>
                <p className="text-sm sm:text-base font-extrabold text-white drop-shadow-sm mt-0.5 leading-none">{stats.totalOrders}</p>
              </div>

              {/* Pedidos Pendientes */}
              <div className="bg-black/20 backdrop-blur-md rounded-xl px-3 py-1 sm:px-3.5 sm:py-1.5 text-center border border-white/10 shadow-md min-w-[75px] sm:min-w-[85px] border-rose-500/20">
                <p className="text-[10px] text-rose-200 font-semibold tracking-wide">Pendientes</p>
                <p className="text-sm sm:text-base font-extrabold text-rose-100 drop-shadow-sm animate-pulse mt-0.5 leading-none">{stats.pendingOrders}</p>
              </div>

              {/* Productos */}
              <div className="bg-black/20 backdrop-blur-md rounded-xl px-3 py-1 sm:px-3.5 sm:py-1.5 text-center border border-white/10 shadow-md min-w-[75px] sm:min-w-[85px]">
                <p className="text-[10px] text-pink-200 font-semibold tracking-wide">Productos</p>
                <p className="text-sm sm:text-base font-extrabold text-white drop-shadow-sm mt-0.5 leading-none">{stats.totalProducts}</p>
              </div>
            </div>
          </div>
        </div>


        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-600 dark:text-red-400 font-bold">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          renderShimmerLoader()
        ) : (
          <div className="space-y-8">
            {/* Concentric Metrics Capsule ticker */}
            <div className="px-1 sm:px-2">
              {renderMetricsCapsule()}
            </div>

            {/* Hub grid cards launchpad - DESKTOP VERSION */}
            <div className="px-1 sm:px-2 hidden md:block">
              {renderHubCardsGrid()}
            </div>

            {/* Hub cards launchpad - MOBILE ROTARY CAROUSEL VERSION */}
            <div className="px-1 sm:px-2 md:hidden">
              {renderMobileHubCarousel()}
            </div>
          </div>
        )}

        {/* IMMERSIVE INTERACTIVE DOCK PORTAL HUBS (DYNAMIC MODAL WINDOWS LIKE SEDES DASHBOARD) */}
        {activeHub && (
          <HubWindow
            isOpen={activeHub !== null}
            onClose={() => setActiveHub(null)}
            title={
              activeHub === "orders"
                ? "Hub de Pedidos y Financiaciones"
                : activeHub === "products"
                ? "Hub de Catálogo de Productos"
                : activeHub === "inventory"
                ? "Hub de Control de Inventario"
                : activeHub === "categories"
                ? "Hub de Categorías del Market"
                : activeHub === "promotions"
                ? "Hub de Campañas y Promociones"
                : ""
            }
            subtitle={
              activeHub === "orders"
                ? "Gestión de órdenes de compra, cuotas de financiación quincenal y auditoría de estado."
                : activeHub === "products"
                ? "Control total del catálogo, creación de artículos, variantes, precios base y galería multimedia."
                : activeHub === "inventory"
                ? "Control de stock locativo por sede física, traslado de mercancías e histórico detallado."
                : activeHub === "categories"
                ? "Estructuración de secciones comerciales (Belleza, Bienestar, Lencería, Cuidado de la Piel, etc.)."
                : activeHub === "promotions"
                ? "Diseño y administración de cupones, descuentos fijos/porcentuales y campañas masivas 2x1."
                : ""
            }
            activeHub={activeHub}
            onNavigate={setActiveHub}
          >
            {activeHub === "orders" && <ShopOrdersContent isInsideHub={true} />}
            {activeHub === "products" && <ShopProductsContent isInsideHub={true} />}
            {activeHub === "inventory" && <ShopInventoryContent isInsideHub={true} />}
            {activeHub === "promotions" && <ShopPromotionsContent isInsideHub={true} />}
            {activeHub === "categories" && <ShopCategoriesContent isInsideHub={true} />}
          </HubWindow>
        )}
      </div>
    </div>
  );
}
