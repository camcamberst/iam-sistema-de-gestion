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
import ProductivityWidget from "../../../components/ProductivityWidget";
import DynamicTimeIsland from "../../../components/ui/DynamicTimeIsland";
import ModelAuroraBackground from "../../../components/ui/ModelAuroraBackground";
import PageHeader from "@/components/ui/PageHeader";
import AdminWidgetsMobileCarousel from "@/components/ui/AdminWidgetsMobileCarousel";

type Role = 'super_admin' | 'admin' | 'modelo' | string;

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: Role; groups: string[] } | null>(null);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  // Resumen de productividad (modelo)
  const [summary, setSummary] = useState<{ usdBruto: number; usdModelo: number; copModelo: number; goalUsd: number; pct: number } | null>(null);

  // Tasas para el ticker (admin)
  const [adminRates, setAdminRates] = useState<Array<{ kind: string; value: number }>>([]);

  

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

  // Cargar tasas para el ticker (Admin / Super Admin)
  useEffect(() => {
    const loadAdminRates = async () => {
      if (!user || user.role === 'modelo') return;
      try {
        const ratesRes = await fetch('/api/rates-v2?activeOnly=true');
        const ratesJson = await ratesRes.json();
        
        // Filtrar duplicados por 'kind' con normalización agresiva para evitar problemas de codificación (ej. 'USD??COP' vs 'USD→COP')
        const uniqueRates: any[] = [];
        const seenKinds = new Set();
        
        if (ratesJson?.data) {
          for (const rate of ratesJson.data) {
            if (!rate || !rate.kind) continue;
            
            // Extraer solo las letras (ej: USDCOP) para identificar inequívocamente el par de divisas
            const normalizedKind = String(rate.kind).replace(/[^A-Za-z]/g, '').toUpperCase();
            
            if (!seenKinds.has(normalizedKind)) {
              seenKinds.add(normalizedKind);
              
              // Restaurar un nombre bonito para la vista si está corrupto
              let displayKind = rate.kind;
              if (normalizedKind === 'USDCOP') displayKind = 'USD→COP';
              else if (normalizedKind === 'EURUSD') displayKind = 'EUR→USD';
              else if (normalizedKind === 'GBPUSD') displayKind = 'GBP→USD';
              
              uniqueRates.push({ ...rate, kind: displayKind });
            }
          }
        }
        
        setAdminRates(uniqueRates);
      } catch (e) {
        console.warn('⚠️ No se pudieron cargar las tasas de admin:', e);
      }
    };
    loadAdminRates();
  }, [user]);

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

  // El fondo general es provisto por admin/layout.tsx
  const isModelo = user?.role === 'modelo';

  return (
    <>
      {isModelo && <ModelAuroraBackground />}
      <div className={`max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16 ${isModelo ? 'relative z-10' : ''}`}>
        {/* Header */}
        <PageHeader
          title="Dashboard"
          subtitle={user ? `Bienvenido, ${user.name} · Rol: ${String(user.role).replace('_',' ')}${user.role !== 'super_admin' && user.groups.length > 0 ? ` · Grupos: ${user.groups.join(', ')}` : ''}` : undefined}
          glow="admin"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Barra de Isla Dinámica - Tiempos del Mundo y Cierre */}
        <DynamicTimeIsland 
          extraMessages={adminRates.map(r => ({
            text: `Tasa activa: ${r.kind} = ${r.value}`,
            urgent: false,
            closed: false
          }))}
        />

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

        {/* Carrusel (Facturación, Productividad) + What's News (Abajo en Móvil) */}
        {(user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'superadmin_aff') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <AdminWidgetsMobileCarousel
              mobileChildren={[
                <BillingSummaryCompact
                  key="1"
                  userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'}
                  userId={user.id}
                  userGroups={user.groups}
                />,
                <ProductivityWidget
                  key="2"
                  userId={user.id}
                  userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'}
                  forceSlide={0}
                />,
                <ProductivityWidget
                  key="3"
                  userId={user.id}
                  userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'}
                  forceSlide={1}
                />
              ]}
              desktopChildren={
                <>
                  <BillingSummaryCompact
                    userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'}
                    userId={user.id}
                    userGroups={user.groups}
                  />
                  <ProductivityWidget
                    userId={user.id}
                    userRole={user.role as 'admin' | 'super_admin' | 'superadmin_aff'}
                  />
                </>
              }
            />
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
              userId={user.id}
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
                    <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide hidden sm:block">
                      Revisa tu información
                    </span>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 sm:p-6 flex-1">
                <div className="space-y-2">
                  <div className="text-sm text-gray-900 dark:text-gray-100">Email: {user.email}</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">Grupo: {user.groups[0] || '—'}</div>
                </div>
              </div>
            </div>

            {/* Resumen de productividad y progreso de meta */}
            <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
              {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
                  <div className="flex items-center justify-center text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                    <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="relative flex items-center">
                    <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                      Resumen de Productividad
                    </h2>
                  </div>
                </div>
              </div>
              <div className="glass-card p-4 sm:p-6 flex-1">
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
          </div>
        )}
      </div>
    </>
  );
}
