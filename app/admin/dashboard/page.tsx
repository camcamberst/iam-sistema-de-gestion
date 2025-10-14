"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ModelCalculator from "../../../components/ModelCalculator";
import PlatformTimeline from "../../../components/PlatformTimeline";
import BillingSummary from "../../../components/BillingSummary";

type Role = 'super_admin' | 'admin' | 'modelo' | string;

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: Role; groups: string[] } | null>(null);
  // Resumen de productividad (modelo)
  const [summary, setSummary] = useState<{ usdBruto: number; usdModelo: number; copModelo: number; goalUsd: number; pct: number } | null>(null);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

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

        // Load global stats (super admin) or filtered stats (admin)
        const { data: all } = await supabase.from('users').select('id,role');
        if (all) {
          let filtered = all;
          if (current.role === 'admin' && current.groups.length) {
            // restrict to users within admin groups
            const { data: usersInMyGroups } = await supabase
              .from('user_groups')
              .select('user_id, groups(name)')
              .in('groups.name', current.groups);
            const allowedIds = new Set((usersInMyGroups || []).map((r: any) => r.user_id));
            filtered = all.filter((u: any) => allowedIds.has(u.id));
          }
          const total = filtered.length;
          const super_admin = filtered.filter((u: any) => u.role === 'super_admin').length;
          const admin = filtered.filter((u: any) => u.role === 'admin').length;
          const modelo = filtered.filter((u: any) => u.role === 'modelo').length;
          setStats({ total, super_admin, admin, modelo });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Cargar resumen de productividad para modelo
  useEffect(() => {
    const loadProductivity = async () => {
      if (!user || user.role !== 'modelo') return;
      try {
        // 1) Tasas activas
        const ratesRes = await fetch('/api/rates-v2?activeOnly=true');
        const ratesJson = await ratesRes.json();
        const rates = {
          usd_cop: ratesJson?.data?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
          eur_usd: ratesJson?.data?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
          gbp_usd: ratesJson?.data?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.2,
        };

        // 2) Configuración de plataformas habilitadas
        const cfgRes = await fetch(`/api/calculator/config-v2?userId=${user.id}`);
        const cfg = await cfgRes.json();
        const enabled = (cfg?.config?.platforms || []).filter((p: any) => p.enabled);

        // Porcentaje y cuota mínima (fallbacks sensatos)
        const percentage = (enabled[0]?.percentage_override || enabled[0]?.group_percentage || 80) as number;
        const goalUsd = (enabled[0]?.min_quota_override || enabled[0]?.group_min_quota || 470) as number;

        // 3) Valores del día usando timezone de Colombia
        const periodDate = getColombiaDate();
        const valuesRes = await fetch(`/api/calculator/model-values-v2?modelId=${user.id}&periodDate=${periodDate}`);
        const valuesJson = await valuesRes.json();
        const rows: Array<{ platform_id: string; value: number }> = valuesJson?.data || [];
        const idToValue: Record<string, number> = {};
        rows.forEach((r) => {
          idToValue[r.platform_id] = Number(r.value) || 0;
        });

        // 4) Cálculo por plataforma (mismo criterio que calculadora)
        let usdBruto = 0;
        let usdModelo = 0;
        for (const p of enabled) {
          const v = idToValue[p.id] || 0;
          if (v <= 0) continue;
          let u = 0;
          if (p.currency === 'EUR') {
            if (p.id === 'big7') u = (v * rates.eur_usd) * 0.84;
            else if (p.id === 'mondo') u = (v * rates.eur_usd) * 0.78;
            else u = v * rates.eur_usd;
          } else if (p.currency === 'GBP') {
            if (p.id === 'aw') u = (v * rates.gbp_usd) * 0.677;
            else u = v * rates.gbp_usd;
          } else {
            if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') u = v * 0.75;
            else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') u = v * 0.05;
            else if (p.id === 'dxlive') u = v * 0.60;
            else if (p.id === 'secretfriends') u = v * 0.5;
            else u = v;
          }
          usdBruto += u;
          usdModelo += (u * percentage) / 100;
        }
        const copModelo = usdModelo * rates.usd_cop;
        const pct = Math.max(0, Math.min(100, (usdBruto / goalUsd) * 100));
        setSummary({ usdBruto, usdModelo, copModelo, goalUsd, pct });
      } catch (e) {
        console.warn('⚠️ resumen productividad:', e);
      }
    };
    loadProductivity();
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
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

        {/* Panel de Tasas Activas para Super Admin y Admin */}
        {(user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <ActiveRatesPanel compact={true} />
            <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300 cursor-pointer">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-gray-900">Calculadora</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Gestiona las tasas de cambio para la calculadora</p>
              <Link 
                href="/admin/rates" 
                className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver todas las tasas →
              </Link>
            </div>
          </div>
        )}

        {/* Resumen de Facturación para Admin y Super Admin */}
        {(() => {
          console.log('🔍 [DASHBOARD] Condiciones para BillingSummary:', { 
            loading, 
            user: user ? { id: user.id, role: user.role } : null,
            shouldRender: !loading && user && (user.role === 'super_admin' || user.role === 'admin')
          });
          return !loading && user && (user.role === 'super_admin' || user.role === 'admin');
        })() && user && (
          <BillingSummary 
            userRole={user.role as 'admin' | 'super_admin'} 
            userId={user.id}
          />
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

            {/* Resumen de productividad y progreso de meta */}
            <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Resumen de Productividad</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-50 text-center">
                  <div className="text-xs text-gray-600">USD Bruto (hoy)</div>
                  <div className="text-lg font-bold text-blue-600">${summary ? summary.usdBruto.toFixed(2) : '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 text-center">
                  <div className="text-xs text-gray-600">USD Modelo (hoy)</div>
                  <div className="text-lg font-bold text-green-600">${summary ? summary.usdModelo.toFixed(2) : '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 text-center">
                  <div className="text-xs text-gray-600">COP Modelo (hoy)</div>
                  <div className="text-lg font-bold text-purple-600">{summary ? summary.copModelo.toLocaleString('es-CO', {maximumFractionDigits:0}) : '—'}</div>
                </div>
              </div>

              {/* Barra de alcance de meta (compacta) */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">Objetivo Básico</span>
                  <span className="text-xs text-gray-600">${summary ? summary.usdBruto.toFixed(0) : '—'} / ${summary ? summary.goalUsd.toFixed(0) : '—'} USD</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 transition-all" style={{ width: `${summary ? Math.min(100, summary.pct).toFixed(0) : 0}%` }}></div>
                </div>
                <div className="text-right text-xs text-gray-600 mt-1">{summary ? Math.min(100, summary.pct).toFixed(0) : 0}%</div>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Para actualizar tus valores usa el menú <a href="/model/calculator" className="text-blue-600 hover:text-blue-800 underline font-medium">Mi Calculadora</a>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}