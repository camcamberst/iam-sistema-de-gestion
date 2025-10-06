'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModelCalculatorNew from '../../../../components/ModelCalculatorNew';
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';

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

      // 3) Valores del día usando timezone de Colombia
      const periodDate = getColombiaDate();
      const valuesRes = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}`);
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
        const value = idToValue[p.id] || 0;
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

        usdBruto += usdFromPlatform;
      }

      usdModelo = usdBruto * (percentage / 100);
      const copModelo = usdModelo * rates.usd_cop;
      const goalProgress = goalUsd > 0 ? Math.min((usdModelo / goalUsd) * 100, 100) : 0;

      console.log('🔍 [DASHBOARD] Calculated productivity:', {
        usdBruto,
        usdModelo,
        copModelo,
        goalUsd,
        goalProgress
      });

      setProductivityData({
        usdBruto,
        usdModelo,
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Mi Dashboard</h1>
        {user && (
          <p className="text-gray-500 mb-6 text-sm">
            Bienvenida, {user.name} · Rol: {String(user.role).replace('_',' ')}
            {user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
          </p>
        )}

        {/* Panel de perfil */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Mi perfil</h2>
          <p className="text-sm text-gray-500">Revisa tu información</p>
          <div className="mt-4 text-sm text-gray-700">Email: {user.email}</div>
          <div className="text-sm text-gray-700">Grupo: {user.groups[0] || '—'}</div>
        </div>

        {/* Resumen de productividad y progreso de meta */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Productividad</h2>
          
          {productivityLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Cargando datos de productividad...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-md bg-blue-50 text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {productivityData ? `$${productivityData.usdBruto.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full inline-block">
                    USD Bruto (hoy)
                  </div>
                </div>
                <div className="p-4 rounded-md bg-green-50 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {productivityData ? `$${productivityData.usdModelo.toFixed(2)}` : '—'}
                  </div>
                  <div className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full inline-block">
                    USD Modelo (hoy)
                  </div>
                </div>
                <div className="p-4 rounded-md bg-purple-50 text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {productivityData ? `$${Math.round(productivityData.copModelo).toLocaleString('es-CO')}` : '—'}
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
                    {productivityData ? 
                      `$${productivityData.usdModelo.toFixed(2)} / $${productivityData.goalUsd} USD` : 
                      '— / — USD'
                    }
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300" 
                    style={{ width: `${productivityData?.goalProgress || 0}%` }}
                  ></div>
                </div>
                <div className="text-right text-xs text-gray-600 mt-1">
                  {productivityData ? `${productivityData.goalProgress.toFixed(1)}%` : '0%'}
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Para actualizar tus valores usa el menú <a href="/model/calculator" className="text-blue-600 hover:text-blue-800 underline">Mi Calculadora</a>.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}