"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ModelCalculator from "../../../components/ModelCalculator";
import PlatformTimeline from "../../../components/PlatformTimeline";

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
          role: (userRow?.role as any) || 'modelo',
          groups,
        };
        setUser(current);
        
        // Load stats for admin/super_admin
        if (current.role === 'admin' || current.role === 'super_admin') {
          const { data: users } = await supabase
            .from('users')
            .select('role');
          const counts = users?.reduce((acc, u) => {
            acc.total++;
            if (u.role === 'super_admin') acc.super_admin++;
            else if (u.role === 'admin') acc.admin++;
            else if (u.role === 'modelo') acc.modelo++;
            return acc;
          }, { total: 0, super_admin: 0, admin: 0, modelo: 0 }) || { total: 0, super_admin: 0, admin: 0, modelo: 0 };
          setStats(counts);
        }
        
        // Load summary for modelo
        if (current.role === 'modelo') {
          try {
            const ratesRes = await fetch('/api/rates-v2?activeOnly=true');
            const ratesJson = await ratesRes.json();
            const rates = {
              usd_cop: ratesJson?.data?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
              eur_usd: ratesJson?.data?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
              gbp_usd: ratesJson?.data?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.2,
            };

            const cfgRes = await fetch(`/api/calculator/config-v2?userId=${current.id}`);
            const cfg = await cfgRes.json();
            const enabled = (cfg?.config?.platforms || []).filter((p: any) => p.enabled);

            const percentage = (enabled[0]?.percentage_override || enabled[0]?.group_percentage || 80) as number;
            const goalUsd = (enabled[0]?.min_quota_override || enabled[0]?.group_min_quota || 470) as number;

            const periodDate = getColombiaDate();
            const valuesRes = await fetch(`/api/calculator/model-values-v2?modelId=${current.id}&periodDate=${periodDate}`);
            const valuesJson = await valuesRes.json();
            const rows: Array<{ platform_id: string; value: number }> = valuesJson?.data || [];
            const idToValue: Record<string, number> = {};
            rows.forEach((r) => {
              idToValue[r.platform_id] = Number(r.value) || 0;
            });

            let usdBruto = 0;
            let usdModelo = 0;
            for (const p of enabled) {
              const value = idToValue[p.id] || 0;
              if (value <= 0) continue;

              let usdFromPlatform = 0;
              if (p.currency === 'EUR') {
                if (p.id === 'big7') {
                  usdFromPlatform = (value * rates.eur_usd) * 0.84;
                } else if (p.id === 'mondo') {
                  usdFromPlatform = (value * rates.eur_usd) * 0.78;
                } else if (p.id === 'superfoon') {
                  usdFromPlatform = value * rates.eur_usd;
                } else {
                  usdFromPlatform = value * rates.eur_usd;
                }
              } else if (p.currency === 'GBP') {
                if (p.id === 'aw') {
                  usdFromPlatform = (value * rates.gbp_usd) * 0.677;
                } else {
                  usdFromPlatform = value * rates.gbp_usd;
                }
              } else if (p.currency === 'USD') {
                if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
                  usdFromPlatform = value * 0.75;
                } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
                  usdFromPlatform = value * 0.05;
                } else if (p.id === 'dxlive') {
                  usdFromPlatform = value * 0.60;
                } else if (p.id === 'secretfriends') {
                  usdFromPlatform = value * 0.5;
                } else {
                  usdFromPlatform = value;
                }
              }

              usdBruto += usdFromPlatform;
            }

            usdModelo = usdBruto * (percentage / 100);
            const copModelo = usdModelo * rates.usd_cop;
            const pct = goalUsd > 0 ? Math.min((usdModelo / goalUsd) * 100, 100) : 0;

            setSummary({ usdBruto, usdModelo, copModelo, goalUsd, pct });
          } catch (error) {
            console.error('Error loading summary:', error);
          }
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No se pudo cargar la información del usuario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Dashboard</h1>
        {user && (
          <p className="text-gray-500 mb-6 text-sm">
            Bienvenido, {user.name} · Rol: {String(user.role).replace('_',' ')}
            {user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
          </p>
        )}

        {/* Stats para admin/super_admin */}
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Usuarios</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Super Admins</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.super_admin}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Admins</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.admin}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-pink-500 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Modelos</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.modelo}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel de tasas activas para admin/super_admin */}
        {(user?.role === 'admin' || user?.role === 'super_admin') && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Tasas Activas</h2>
                <Link
                  href="/admin/calculator/rates"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Ver todas las tasas →
                </Link>
              </div>
              <ActiveRatesPanel />
            </div>
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
                  <div className="text-xl font-bold text-blue-600 mb-1">
                    {summary ? `$${summary.usdBruto.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full inline-block">
                    USD Bruto (hoy)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 text-center">
                  <div className="text-xl font-bold text-green-600 mb-1">
                    {summary ? `$${summary.usdModelo.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full inline-block">
                    USD Modelo (hoy)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 text-center">
                  <div className="text-xl font-bold text-purple-600 mb-1">
                    {summary ? `$${Math.round(summary.copModelo).toLocaleString('es-CO')}` : '—'}
                  </div>
                  <div className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full inline-block">
                    COP Modelo (hoy)
                  </div>
                </div>
              </div>

              {/* Barra de alcance de meta (compacta) */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">Alcance de objetivo Básico</span>
                  <span className="text-sm text-gray-600">
                    {summary ? 
                      `$${summary.usdModelo.toFixed(2)} / $${summary.goalUsd} USD` : 
                      '— / — USD'
                    }
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300" 
                    style={{ width: `${summary?.pct || 0}%` }}
                  ></div>
                </div>
                <div className="text-right text-xs text-gray-600 mt-1">
                  {summary ? `${summary.pct.toFixed(1)}%` : '0%'}
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Para actualizar tus valores usa el menú <a href="/model/calculator" className="text-blue-600 hover:text-blue-800 underline">Mi Calculadora</a>.
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