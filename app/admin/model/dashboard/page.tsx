'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModelCalculatorNew from '../../../../components/ModelCalculatorNew';
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import ProgressMilestone from '@/components/ui/ProgressMilestone';
import AIDashboard from '@/components/AIDashboard';
import { InfoCardGrid } from '@/components/ui/InfoCard';

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

      // 4) Cálculo por plataforma para hoy (unificado con Mi Calculadora)
      let todayUsdBruto = 0; // sin porcentaje, para barra objetivo
      let todayUsdModelo = 0; // con porcentaje por plataforma (superfoon 100%)
      for (const p of enabled) {
        const value = todayIdToValue[p.id] || 0;
        if (value <= 0) continue;

        // USD base por plataforma (igual que Mi Calculadora)
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
        // Participación para modelo (superfoon 100%)
        const share = (p.id === 'superfoon') ? usdFromPlatform : (usdFromPlatform * (p.percentage / 100));
        todayUsdModelo += share;
      }

      // 5) Cálculo por plataforma para ayer (para calcular ganancias del día)
      let yesterdayUsdBruto = 0;
      let yesterdayUsdModelo = 0;
      for (const p of enabled) {
        const value = yesterdayIdToValue[p.id] || 0;
        if (value <= 0) continue;

        // USD base por plataforma
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
        const share = (p.id === 'superfoon') ? usdFromPlatform : (usdFromPlatform * (p.percentage / 100));
        yesterdayUsdModelo += share;
      }

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Mi Dashboard
                  </h1>
                  {user && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
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
        <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Resumen de Productividad</h2>
          </div>
          
          {productivityLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Cargando datos de productividad...</p>
            </div>
          ) : (
            <>
              <InfoCardGrid
                cards={[
                  {
                    value: productivityData ? `$${productivityData.todayEarnings.toFixed(2)}` : '—',
                    label: 'Ganancias Hoy',
                    color: 'blue'
                  },
                  {
                    value: productivityData ? `$${productivityData.usdModelo.toFixed(2)}` : '—',
                    label: 'USD Modelo (hoy)',
                    color: 'green'
                  },
                  {
                    value: productivityData ? `${Math.round(productivityData.copModelo).toLocaleString('es-CO')}` : '—',
                    label: 'COP Modelo (hoy)',
                    color: 'purple'
                  }
                ]}
                columns={3}
                className="mb-4"
              />

              {/* Barra de alcance de meta - Copia exacta de Mi Calculadora */}
              <div className="mt-4">
                {(() => {
                  if (!productivityData) return null;
                  
                  const totalUsdBruto = productivityData.usdBruto;
                  const cuotaMinima = productivityData.goalUsd;
                  const porcentajeAlcanzado = (totalUsdBruto / cuotaMinima) * 100;
                  const estaPorDebajo = totalUsdBruto < cuotaMinima;
                  
                  // Color dinámico de progreso: 0% rojo (h=0) → 100% verde (h=120)
                  const progressPct = Math.max(0, Math.min(100, porcentajeAlcanzado));
                  
                  // Paleta: Rojo -> Púrpura -> Esmeralda (sin amarillos)
                  const RED = { r: 229, g: 57, b: 53 };     // #E53935
                  const PURPLE = { r: 142, g: 36, b: 170 }; // #8E24AA
                  const EMERALD = { r: 46, g: 125, b: 50 };  // #2E7D32

                  const mix = (a: any, b: any, t: number) => ({
                    r: Math.round(a.r + (b.r - a.r) * t),
                    g: Math.round(a.g + (b.g - a.g) * t),
                    b: Math.round(a.b + (b.b - a.b) * t)
                  });

                  const tint = (c: any, t: number) => mix(c, { r: 255, g: 255, b: 255 }, t);
                  const shade = (c: any, t: number) => mix(c, { r: 0, g: 0, b: 0 }, t);
                  const rgbToHex = (color: any) => 
                    `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;

                  const t = progressPct / 100;
                  // 0–60% rojo→púrpura, 60–100% púrpura→esmeralda
                  const base = t <= 0.6
                    ? mix(RED, PURPLE, t / 0.6)
                    : mix(PURPLE, EMERALD, (t - 0.6) / 0.4);

                  const progressStart = rgbToHex(shade(base, 0.05));
                  const progressEnd = rgbToHex(shade(base, 0.15));
                  const cardBgStart = rgbToHex(tint(base, 0.92));
                  const cardBgEnd = rgbToHex(tint(base, 0.88));
                  const cardBorder = rgbToHex(tint(base, 0.7));
                  const iconStart = rgbToHex(shade(base, 0.0));
                  const iconEnd = rgbToHex(shade(base, 0.2));
                  const headingColor = rgbToHex(shade(base, 0.55));
                  const subTextColor = rgbToHex(shade(base, 0.45));

                  return (
                    <div
                      className={`relative overflow-hidden rounded-2xl border transition-all duration-300`}
                      style={{
                        background: `linear-gradient(135deg, ${cardBgStart}, ${cardBgEnd})`,
                        borderColor: cardBorder,
                        boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
                      }}
                    >
                      {/* Efecto de brillo animado */}
                      <div
                        className="absolute inset-0 opacity-10 animate-pulse"
                        style={{ background: `linear-gradient(90deg, ${progressStart}, ${progressEnd})` }}
                      ></div>

                      <div className="relative p-4">
                        <div className="flex items-center space-x-3">
                          {/* Icono animado */}
                          <div className={`relative flex-shrink-0 ${estaPorDebajo ? 'animate-bounce' : 'animate-pulse'}`}>
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md`}
                              style={{
                                background: `linear-gradient(135deg, ${iconStart}, ${iconEnd})`
                              }}
                            >
                              <span className="text-white text-sm">✓</span>
                            </div>
                          </div>
                          
                          {/* Contenido compacto */}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className={`font-bold text-sm`} style={{ color: headingColor }}>
                                {estaPorDebajo ? 'Objetivo Básico en Progreso' : 'Objetivo Básico Alcanzado'}
                              </div>
                              {(() => {
                                const roundedProgress = Math.max(0, Math.min(100, Math.round(porcentajeAlcanzado)));
                                const remainingPct = Math.max(0, 100 - roundedProgress);
                                return (
                                  <div className={`text-xs font-medium`} style={{ color: subTextColor }}>
                                    {estaPorDebajo
                                      ? `Faltan $${Math.ceil(cuotaMinima - totalUsdBruto)} USD (${remainingPct}% restante)`
                                      : `Excelente +${Math.max(0, roundedProgress - 100)}%`}
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Mensaje de progreso por hito */}
                            {(() => {
                              const roundedProgress = Math.max(0, Math.min(100, Math.round(porcentajeAlcanzado)));
                              return <ProgressMilestone progress={roundedProgress} />;
                            })()}
                            
                            {/* Barra de progreso compacta */}
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-1000 ease-out`}
                                  style={{ 
                                    width: `${Math.min(porcentajeAlcanzado, 100)}%`,
                                    background: `linear-gradient(90deg, ${progressStart}, ${progressEnd})`
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 text-xs text-gray-500 dark:text-gray-300">
                Para actualizar tus valores usa el menú <a href="/admin/model/calculator" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium">Mi Calculadora</a>.
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