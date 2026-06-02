"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  {
    href: "/admin/shop",
    label: "Dashboard",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 012-2h-2a2 2 0 00-2-2H6z" />
      </svg>
    )
  },
  {
    href: "/admin/shop/orders",
    label: "Pedidos",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  },
  {
    href: "/admin/shop/products",
    label: "Productos",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  },
  {
    href: "/admin/shop/inventory",
    label: "Inventario",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    )
  },
  {
    href: "/admin/shop/promotions",
    label: "Promociones",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    )
  },
  {
    href: "/admin/shop/categories",
    label: "Categorías",
    superAdminOnly: true,  // visible para super_admin y superadmin_aff
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  }
];

export default function ShopAdminNav() {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) return;
      supabase.from("users").select("role").eq("id", session.user.id).single()
        .then(({ data }: any) => setUserRole(data?.role || ""));
    });
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    item => !item.superAdminOnly || userRole === "super_admin" || userRole === "superadmin_aff"
  );

  return (
    <div className="mb-6 glass-card relative overflow-hidden backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
      {/* Glow ambiental sutil */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-pink-500/5 rounded-full blur-xl pointer-events-none mix-blend-screen" />
      
      {/* Nav items */}
      <div className="flex overflow-x-auto relative z-10 scrollbar-hide">
        {visibleItems.map(item => {
          const isActive = item.href === "/admin/shop"
            ? pathname === "/admin/shop"
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold tracking-wide border-b-[3px] whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                isActive
                  ? "border-pink-500 text-pink-600 dark:text-pink-400 bg-pink-500/5 dark:bg-pink-500/10 font-bold scale-[1.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              }`}
            >
              <span className={`transition-transform duration-300 ${isActive ? "text-pink-500 scale-110 drop-shadow-[0_0_6px_rgba(236,72,153,0.4)]" : "text-gray-400"}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
