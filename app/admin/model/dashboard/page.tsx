'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModelCalculatorNew from '../../../../components/ModelCalculatorNew';
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import ProgressMilestone from '@/components/ui/ProgressMilestone';
import AIDashboard from '@/components/AIDashboard';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo';
  groups: string[];
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

interface ProductivityData {
  usdBruto: number;
  usdModelo: number;
  todayEarnings: number; // Nuevo: ganancias del día
  copModelo: number;
  goalUsd: number;
  goalProgress: number;
}

export default function ModelDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [productivityData, setProductivityData] = useState<ProductivityData | null>(null);
  const [productivityLoading, setProductivityLoading] = useState(false);
  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

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
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        setUser(current);
        
        // Cargar datos de productividad si es modelo
        if (current.role === 'modelo') {
          await loadProductivityData(current.id);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 🔧 NUEVO: Posicionar scrollbar al inicio al cargar la página
  useEffect(() => {
    const positionScrollbar = () => {
      // Esperar a que el contenido se haya renderizado completamente
      setTimeout(() => {
        // Posición al inicio (0% desde arriba)
        const targetPosition = 0;
        
        // Hacer scroll suave a esa posición
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        console.log('🔍 [DASHBOARD] Scrollbar positioned at start:', targetPosition);
      }, 1000); // Delay para asegurar que el contenido esté renderizado
    };

    // Solo posicionar si no hay error y los datos están cargados
    if (!loading && !productivityLoading && user) {
      positionScrollbar();
    }
  }, [loading, productivityLoading, user]);

  const loadProductivityData = async (userId: string) => {
    try {
      setProductivityLoading(true);
      console.log('🔍 [DASHBOARD] Loading productivity data for user:', userId);

      // 1) Tasas activas
      const ratesRes = await fetch('/api/rates-v2?activeOnly=true');
      const ratesJson = await ratesRes.json();
      const rates = {
        usd_cop: ratesJson?.data?.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
        eur_usd: ratesJson?.data?.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
        gbp_usd: ratesJson?.data?.find((r: any) => r.kind === 'GBP→USD')?.value || 1.2,
      };

      // 2) Configuración de plataformas habilitadas
      const cfgRes = await fetch(`/api/calculator/config-v2?userId=${userId}`);
      const cfg = await cfgRes.json();
      const enabled = (cfg?.config?.platforms || []).filter((p: any) => p.enabled);

      // Porcentaje y cuota mínima (fallbacks sensatos)
      const percentage = (enabled[0]?.percentage_override || enabled[0]?.group_percentage || 80) as number;
      const goalUsd = (enabled[0]?.min_quota_override || enabled[0]?.group_min_quota || 470) as number;

      // 3) Valores de hoy y ayer usando timezone de Colombia
      const todayDate = getColombiaDate();
      const yesterdayDate = new Date(new Date(todayDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Obtener valores de hoy
      const todayValuesRes = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${todayDate}`);
      const todayValuesJson = await todayValuesRes.json();
      const todayRows: Array<{ platform_id: string; value: number }> = todayValuesJson?.data || [];
      const todayIdToValue: Record<string, number> = {};
      todayRows.forEach((r) => {
        todayIdToValue[r.platform_id] = Number(r.value) || 0;
      });

      // Obtener valores de ayer
      const yesterdayValuesRes = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${yesterdayDate}`);
      const yesterdayValuesJson = await yesterdayValuesRes.json();
      const yesterdayRows: Array<{ platform_id: string; value: number }> = yesterdayValuesJson?.data || [];
      const yesterdayIdToValue: Record<string, number> = {};
      yesterdayRows.forEach((r) => {
        yesterdayIdToValue[r.platform_id] = Number(r.value) || 0;
      });

      // 4) Cálculo por plataforma para hoy (mismo criterio que calculadora)
      let todayUsdBruto = 0;
      let todayUsdModelo = 0;
      for (const p of enabled) {
        const value = todayIdToValue[p.id] || 0;
        if (value <= 0) continue;

        // Calcular USD bruto con fórmulas específicas por plataforma (igual que Mi Calculadora)
        let usdFromPlatform = 0;
        if (p.currency === 'EUR') {
          if (p.id === 'big7') {
            usdFromPlatform = (value * rates.eur_usd) * 0.84; // 16% impuesto
          } else if (p.id === 'mondo') {
            usdFromPlatform = (value * rates.eur_usd) * 0.78; // 22% descuento
          } else {
            usdFromPlatform = value * rates.eur_usd; // EUR directo
          }
        } else if (p.currency === 'GBP') {
          if (p.id === 'aw') {
            usdFromPlatform = (value * rates.gbp_usd) * 0.677; // 32.3% descuento
          } else {
            usdFromPlatform = value * rates.gbp_usd; // GBP directo
          }
        } else if (p.currency === 'USD') {
          if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
            usdFromPlatform = value * 0.75; // 25% descuento
          } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
            usdFromPlatform = value * 0.05; // 100 tokens = 5 USD
          } else if (p.id === 'dxlive') {
            usdFromPlatform = value * 0.60; // 100 pts = 60 USD
          } else if (p.id === 'secretfriends') {
            usdFromPlatform = value * 0.5; // 50% descuento
          } else if (p.id === 'superfoon') {
            usdFromPlatform = value; // 100% directo
          } else {
            usdFromPlatform = value; // USD directo por defecto
          }
        }

        todayUsdBruto += usdFromPlatform;
      }

      todayUsdModelo = todayUsdBruto * (percentage / 100);

      // 5) Cálculo por plataforma para ayer (para calcular ganancias del día)
      let yesterdayUsdBruto = 0;
      let yesterdayUsdModelo = 0;
      for (const p of enabled) {
        const value = yesterdayIdToValue[p.id] || 0;
        if (value <= 0) continue;

        // Calcular USD bruto con fórmulas específicas por plataforma (igual que Mi Calculadora)
        let usdFromPlatform = 0;
        if (p.currency === 'EUR') {
          if (p.id === 'big7') {
            usdFromPlatform = (value * rates.eur_usd) * 0.84; // 16% impuesto
          } else if (p.id === 'mondo') {
            usdFromPlatform = (value * rates.eur_usd) * 0.78; // 22% descuento
          } else {
            usdFromPlatform = value * rates.eur_usd; // EUR directo
          }
        } else if (p.currency === 'GBP') {
          if (p.id === 'aw') {
            usdFromPlatform = (value * rates.gbp_usd) * 0.677; // 32.3% descuento
          } else {
            usdFromPlatform = value * rates.gbp_usd; // GBP directo
          }
        } else if (p.currency === 'USD') {
          if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
            usdFromPlatform = value * 0.75; // 25% descuento
          } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
            usdFromPlatform = value * 0.05; // 100 tokens = 5 USD
          } else if (p.id === 'dxlive') {
            usdFromPlatform = value * 0.60; // 100 pts = 60 USD
          } else if (p.id === 'secretfriends') {
            usdFromPlatform = value * 0.5; // 50% descuento
          } else if (p.id === 'superfoon') {
            usdFromPlatform = value; // 100% directo
          } else {
            usdFromPlatform = value; // USD directo por defecto
          }
        }

        yesterdayUsdBruto += usdFromPlatform;
      }

      yesterdayUsdModelo = yesterdayUsdBruto * (percentage / 100);

      // 6) Calcular ganancias del día (diferencia entre hoy y ayer)
      const todayEarnings = todayUsdModelo - yesterdayUsdModelo;
      const copModelo = todayUsdModelo * rates.usd_cop;
      const goalProgress = goalUsd > 0 ? Math.min((todayUsdModelo / goalUsd) * 100, 100) : 0;

      console.log('🔍 [DASHBOARD] Calculated productivity:', {
        todayUsdBruto,
        todayUsdModelo,
        todayEarnings,
        copModelo,
        goalUsd,
        goalProgress
      });

      setProductivityData({
        usdBruto: todayUsdBruto, // Mantener para la barra de objetivo
        usdModelo: todayUsdModelo,
        todayEarnings: todayEarnings, // Nuevo: ganancias del día
        copModelo,
        goalUsd,
        goalProgress
      });

    } catch (error) {
      console.error('❌ [DASHBOARD] Error loading productivity data:', error);
    } finally {
      setProductivityLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen theme-bg-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="theme-text-secondary">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen theme-bg-gradient">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl dark:from-blue-400/20 dark:to-indigo-400/20"></div>
            <div className="relative theme-card backdrop-blur-sm rounded-xl p-6 theme-border theme-shadow">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold theme-text-primary">
                    Mi Dashboard
                  </h1>
                  {user && (
                    <p className="mt-1 text-sm theme-text-secondary">
                      Bienvenida, {user.name} · Rol: {String(user.role).replace('_',' ')}
                      {user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de productividad y progreso de meta */}
        <div className="relative theme-card backdrop-blur-sm rounded-xl theme-shadow theme-border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold theme-text-primary">Resumen de Productividad</h2>
          </div>
          
          {productivityLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm theme-text-secondary">Cargando datos de productividad...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-800/60 text-center border border-blue-200/30 dark:border-blue-500/50 shadow-sm dark:shadow-blue-500/10">
                  <div className="text-xs text-gray-600 dark:text-blue-100">Ganancias Hoy</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-200">
                    {productivityData ? `$${productivityData.todayEarnings.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-800/60 text-center border border-green-200/30 dark:border-green-500/50 shadow-sm dark:shadow-green-500/10">
                  <div className="text-xs text-gray-600 dark:text-green-100">USD Modelo (hoy)</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-200">
                    {productivityData ? `$${productivityData.usdModelo.toFixed(2)}` : '—'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-800/60 text-center border border-purple-200/30 dark:border-purple-500/50 shadow-sm dark:shadow-purple-500/10">
                  <div className="text-xs text-gray-600 dark:text-purple-100">COP Modelo (hoy)</div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-200">
                    {productivityData ? `${Math.round(productivityData.copModelo).toLocaleString('es-CO')}` : '—'}
                  </div>
                </div>
              </div>

              {/* Barra de alcance de meta (compacta) */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium theme-text-primary">Objetivo Básico</span>
                  <span className="text-xs theme-text-secondary">${productivityData ? productivityData.usdBruto.toFixed(0) : '—'} / ${productivityData ? productivityData.goalUsd.toFixed(0) : '—'} USD</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 transition-all" style={{ width: `${productivityData ? Math.min(100, (productivityData.usdBruto / productivityData.goalUsd) * 100).toFixed(0) : 0}%` }}></div>
                </div>
                <div className="text-right text-xs theme-text-secondary mt-1">{productivityData ? Math.min(100, (productivityData.usdBruto / productivityData.goalUsd) * 100).toFixed(0) : 0}%</div>
              </div>

              <div className="mt-4 text-xs theme-text-secondary">
                Para actualizar tus valores usa el menú <a href="/model/calculator" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium">Mi Calculadora</a>.
              </div>
            </>
          )}
        </div>

        {/* AI Dashboard */}
        <div className="mt-6">
          <AIDashboard userId={user.id} userRole={user.role} />
        </div>

      </div>
    </div>
  );
}