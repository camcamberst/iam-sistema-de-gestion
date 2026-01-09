"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getColombiaDate } from '@/utils/calculator-dates';
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ModelCalculator from "../../../components/ModelCalculator";
import PlatformTimeline from "../../../components/PlatformTimeline";
import BillingSummaryCompact from "../../../components/BillingSummaryCompact";
import AnnouncementBoardWidget from "../../../components/AnnouncementBoardWidget";

type Role = 'super_admin' | 'admin' | 'modelo' | string;

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: Role; groups: string[] } | null>(null);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  // Resumen de productividad (modelo)
  const [summary, setSummary] = useState<{ usdBruto: number; usdModelo: number; copModelo: number; goalUsd: number; pct: number } | null>(null);

  

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
          .select('id,name,email,role,affiliate_studio_id')
          .eq('id', uid)
          .single();
        let groups: string[] = [];
        let groupIds: string[] = [];
        if (userRow && userRow.role !== 'super_admin') {
          const { data: ug } = await supabase
            .from('user_groups')
            .select('group_id, groups(name)')
            .eq('user_id', uid);
          groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
          groupIds = (ug || []).map((r: any) => r.group_id).filter(Boolean);
        }
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as Role) || 'modelo',
          groups,
        };
        setUser(current);
        setUserGroupIds(groupIds);

        // Load global stats (super admin) or filtered stats (admin/superadmin_aff)
        let query = supabase.from('users').select('id,role,affiliate_studio_id');
        
        // Aplicar filtro de afiliado si es superadmin_aff
        if (current.role === 'superadmin_aff' && userRow?.affiliate_studio_id) {
          query = query.eq('affiliate_studio_id', userRow.affiliate_studio_id);
        }
        
        const { data: all } = await query;
        if (all) {
          let filtered = all;
          
          // Aplicar filtros de jerarquía según el rol
          if (current.role === 'admin') {
            if (current.groups.length === 0) {
              // Admin sin grupos no puede ver estadísticas
              setStats({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
              return;
            }
            
            // Restrict to users within admin groups
            const { data: usersInMyGroups } = await supabase
              .from('user_groups')
              .select('user_id, groups(name)')
              .in('groups.name', current.groups);
            
            if (!usersInMyGroups || usersInMyGroups.length === 0) {
              // No hay usuarios en los grupos del admin
              setStats({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
              return;
            }
            
            const allowedIds = new Set((usersInMyGroups || []).map((r: any) => r.user_id));
            filtered = all.filter((u: any) => allowedIds.has(u.id));
          }
          // Super admin ve todos los usuarios sin filtros
          // Superadmin_aff ya está filtrado por affiliate_studio_id en la query
          
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Dashboard
                    </h1>
                    {user && (
                      <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                        Bienvenido, {user.name} · Rol: {String(user.role).replace('_',' ')}
                        {user.role !== 'super_admin' && user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje informativo para Admin sin grupos */}
        {user?.role === 'admin' && user.groups.length === 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Sin grupos asignados
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>No tienes grupos asignados. Contacta al Super Admin para obtener acceso a los datos de gestión.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tarjetas de conteo eliminadas por irrelevantes en el dashboard */}

        {/* Panel de Tasas Activas y Resumen de Facturación para Super Admin, Admin y Superadmin AFF */}
        {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'superadmin_aff') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            <ActiveRatesPanel compact={true} />
            <BillingSummaryCompact 
              userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'} 
              userId={user.id}
              userGroups={user.groups}
            />
          </div>
        )}

        {/* Corcho Informativo - Widget de Visualización */}
        {user && (user.role === 'super_admin' || user.role === 'admin' || user.role === 'superadmin_aff') && (
          <div className="mb-8">
            <AnnouncementBoardWidget 
              userId={user.id}
              userGroups={userGroupIds}
              userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'}
            />
          </div>
        )}


        {/* Timeline Portafolio Modelos de Plataformas para Super Admin, Admin y Superadmin AFF */}
        {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'superadmin_aff') && (
          <div className="mb-10">
            <PlatformTimeline 
              userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'} 
              userGroups={user.groups}
            />
          </div>
        )}

        {/* Módulo de accesos rápidos retirado para dashboards admin/superadmin */}

        {user?.role === 'modelo' && (
          <div className="space-y-6">
            {/* Panel de perfil */}
            <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Mi perfil</h2>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">Revisa tu información</p>
              <div className="space-y-2">
                <div className="text-sm text-gray-900 dark:text-gray-100">Email: {user.email}</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">Grupo: {user.groups[0] || '—'}</div>
              </div>
            </div>

            {/* Resumen de productividad y progreso de meta */}
            <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Resumen de Productividad</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-50 text-center">
                  <div className="text-xs text-gray-600 dark:text-gray-300">USD Bruto (hoy)</div>
                  <div className="text-lg font-bold text-blue-600">${summary ? summary.usdBruto.toFixed(2) : '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 text-center">
                  <div className="text-xs text-gray-600 dark:text-gray-300">USD Modelo (hoy)</div>
                  <div className="text-lg font-bold text-green-600">${summary ? summary.usdModelo.toFixed(2) : '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 text-center">
                  <div className="text-xs text-gray-600 dark:text-gray-300">COP Modelo (hoy)</div>
                  <div className="text-lg font-bold text-purple-600">{summary ? summary.copModelo.toLocaleString('es-CO', {maximumFractionDigits:0}) : '—'}</div>
                </div>
              </div>

              {/* Barra de alcance de meta (compacta) */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">Objetivo Básico</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">${summary ? summary.usdBruto.toFixed(0) : '—'} / ${summary ? summary.goalUsd.toFixed(0) : '—'} USD</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 transition-all" style={{ width: `${summary ? Math.min(100, summary.pct).toFixed(0) : 0}%` }}></div>
                </div>
                <div className="text-right text-xs text-gray-600 dark:text-gray-300 mt-1">{summary ? Math.min(100, summary.pct).toFixed(0) : 0}%</div>
              </div>

              <div className="mt-4 text-xs text-gray-600 dark:text-gray-300">
                Para actualizar tus valores usa el menú <a href="/model/calculator" className="text-blue-600 hover:text-blue-800 underline font-medium">Mi Calculadora</a>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}