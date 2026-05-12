"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ModelCalculator from "../../../components/ModelCalculator";
import PlatformTimeline from "../../../components/PlatformTimeline";
import BillingSummaryCompact from "../../../components/BillingSummaryCompact";
import ProductivityWidget from "../../../components/ProductivityWidget";
import DynamicTimeIsland from "../../../components/ui/DynamicTimeIsland";
import PageHeader from "@/components/ui/PageHeader";

type Role = 'super_admin' | 'admin' | 'modelo' | string;

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: Role; groups: string[] } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Load current user
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setUser(null);
          setLoading(false);
          return;
        }
        const { data: userRow } = await supabase
          .from('users')
          .select('id,name,email,role')
          .eq('id', uid)
          .single();
        let groups: string[] = [];
        if (userRow && userRow.role !== 'super_admin') {
          const { data: ug } = await supabase
            .from('user_groups')
            .select('groups(name)')
            .eq('user_id', uid);
          groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
        }
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as Role) || 'modelo',
          groups,
        };
        setUser(current);

        // Super Admin ve todas las estadísticas globales sin filtros
        const { data: all } = await supabase.from('users').select('id,role');
        if (all) {
          const total = all.length;
          const super_admin = all.filter((u: any) => u.role === 'super_admin').length;
          const admin = all.filter((u: any) => u.role === 'admin').length;
          const modelo = all.filter((u: any) => u.role === 'modelo').length;
          setStats({ total, super_admin, admin, modelo });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <PageHeader
          title="Dashboard"
          subtitle={user ? `Bienvenido, ${user.name} · Rol: ${String(user.role).replace('_',' ')}${user.role !== 'super_admin' && user.groups.length > 0 ? ` · Grupos: ${user.groups.join(', ')}` : ''}` : undefined}
          glow="superadmin"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Barra de Isla Dinámica - Tiempos del Mundo y Cierre */}
        <DynamicTimeIsland />

        {/* Tarjetas de conteo eliminadas por irrelevantes en el dashboard */}

        {/* Tasas de calculadora + Resumen de facturación + Widget de productividad */}
        {(user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <ActiveRatesPanel compact={true} />
            <BillingSummaryCompact
              userRole={user.role as 'admin' | 'super_admin'}
              userId={user.id}
              userGroups={user.groups}
            />
            <ProductivityWidget
              userId={user.id}
              userRole={user.role as 'admin' | 'super_admin'}
            />
          </div>
        )}

        {/* Timeline Portafolio Modelos de Plataformas para Super Admin y Admin */}
        {(user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="mb-10">
            <PlatformTimeline 
              userRole={user.role as 'admin' | 'super_admin'} 
              userGroups={user.groups}
            />
          </div>
        )}

        {/* Módulo de accesos rápidos retirado para dashboards admin/superadmin */}

        {user?.role === 'modelo' && (
          <div className="space-y-6">
            {/* Panel de perfil */}
            <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
              {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
                  <div className="flex items-center justify-center text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="relative flex items-center">
                    <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                      Mi perfil
                    </h2>
                  </div>
                </div>
              </div>
              <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-6 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Revisa tu información</p>
                <div className="space-y-2">
                  <div className="text-sm text-gray-700 dark:text-gray-200">Email: {user.email}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">Grupo: {user.groups[0] || '—'}</div>
                </div>
              </div>
            </div>

            {/* Calculadora para modelos */}
            <ModelCalculator 
              modelId={user.id}
              adminView={false}
            />
          </div>
        )}
      </div>
    );
}
