"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ModelCalculator from "../../../components/ModelCalculator";
import PlatformTimeline from "../../../components/PlatformTimeline";
import BillingSummaryCompact from "../../../components/BillingSummaryCompact";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Dashboard
                  </h1>
                  {user && (
                    <p className="mt-1 text-sm text-gray-600">
                      Bienvenido, {user.name} · Rol: {String(user.role).replace('_',' ')}
                      {user.role !== 'super_admin' && user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas de conteo eliminadas por irrelevantes en el dashboard */}

        {/* Panel de Tasas Activas y Resumen de Facturación para Super Admin y Admin */}
        {(user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <ActiveRatesPanel compact={true} />
            <BillingSummaryCompact 
              userRole={user.role as 'admin' | 'super_admin'} 
              userId={user.id}
              userGroups={user.groups}
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
            <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Mi perfil</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Revisa tu información</p>
              <div className="space-y-2">
                <div className="text-sm text-gray-700">Email: {user.email}</div>
                <div className="text-sm text-gray-700">Grupo: {user.groups[0] || '—'}</div>
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
    </div>
  );
}