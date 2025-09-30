'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";

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

interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  value: number;
  percentage: number;
  minQuota: number;
  currency?: string;
}

interface CalculatorResult {
  perPlatform: Array<{
    platformId: string;
    usdBruto: number;
    usdModelo: number;
    copModelo: number;
  }>;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalCopModelo: number;
  cuotaMinimaAlert: {
    below: boolean;
    percentToReach: number;
  };
  anticipoMaxCop: number;
}

export default function ModelCalculatorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [rates, setRates] = useState<any>(null);
  // Mantener valores escritos como texto para permitir decimales con coma y punto
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
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
        
        // Cargar configuración de calculadora
        await loadCalculatorConfig(current.id);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadCalculatorConfig = async (userId: string) => {
    try {
      console.log('🔍 [CALCULATOR] Loading config for userId:', userId);

      // Debug específico del flujo de calculadora
      const calculatorFlowResponse = await fetch(`/api/debug/calculator-flow?userId=${userId}`);
      const calculatorFlowData = await calculatorFlowResponse.json();
      console.log('🔍 [CALCULATOR] Calculator flow data:', calculatorFlowData);

      // Cargar tasas activas
      const ratesResponse = await fetch('/api/rates-v2?activeOnly=true');
      const ratesData = await ratesResponse.json();
      console.log('🔍 [CALCULATOR] Rates data:', ratesData);
      if (ratesData.success && ratesData.data) {
        // Formatear tasas para la calculadora
        const formattedRates = {
          usd_cop: ratesData.data.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
          eur_usd: ratesData.data.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
          gbp_usd: ratesData.data.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
        };
        setRates(formattedRates);
      }

      // Cargar configuración desde API v2
      const response = await fetch(`/api/calculator/config-v2?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Error al cargar configuración');
      }

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Config data:', data);
      console.log('🔍 [CALCULATOR] Platforms received:', data.config?.platforms);

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar configuración');
      }

      // Procesar plataformas habilitadas
      const enabledPlatforms = data.config.platforms
        .filter((p: any) => p.enabled)
        .map((platform: any) => ({
          id: platform.id,
          name: platform.name,
          enabled: true,
          value: 0,
          percentage: platform.percentage_override || platform.group_percentage || 80,
          minQuota: platform.min_quota_override || platform.group_min_quota || 470,
          currency: platform.currency || 'USD' // CRÍTICO: Agregar currency
        }));

      console.log('🔍 [CALCULATOR] Enabled platforms:', enabledPlatforms);
      console.log('🔍 [CALCULATOR] Platform details:', enabledPlatforms.map((p: Platform) => ({
        id: p.id,
        name: p.name,
        currency: p.currency,
        percentage: p.percentage,
        value: p.value
      })));
      setPlatforms(enabledPlatforms);
      // Inicializar inputs de texto vacíos
      setInputValues(
        enabledPlatforms.reduce((acc: Record<string, string>, p) => {
          acc[p.id] = p.value ? String(p.value) : '';
          return acc;
        }, {})
      );

    } catch (err: any) {
      console.error('❌ [CALCULATOR] Error:', err);
      setError(err.message || 'Error al cargar configuración');
    }
  };

  const handleValueChange = (platformId: string, value: number) => {
    setPlatforms(prev => prev.map(p => 
      p.id === platformId ? { ...p, value } : p
    ));
  };

  const calculateTotals = async () => {
    try {
      setCalculating(true);
      setError(null);

      // Preparar datos para el cálculo
      const enabledPlatforms = platforms.filter(p => p.enabled);
      const values = enabledPlatforms.reduce((acc, platform) => {
        acc[platform.id] = platform.value;
        return acc;
      }, {} as Record<string, number>);

      console.log('🔍 [CALCULATOR] Calculating with values:', values);

      // Llamar al endpoint de preview
      const response = await fetch('/api/calculator/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
          demo: false
        }),
      });

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Calculation result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al calcular');
      }

      setResult(data.data);
    } catch (err: any) {
      console.error('❌ [CALCULATOR] Calculation error:', err);
      setError(err.message || 'Error al calcular');
    } finally {
      setCalculating(false);
    }
  };

  const saveValues = async () => {
    try {
      setSaving(true);
      setError(null);

      const values = platforms.reduce((acc, platform) => {
        if (platform.enabled && platform.value > 0) {
          acc[platform.id] = platform.value;
        }
        return acc;
      }, {} as Record<string, number>);

      console.log('🔍 [CALCULATOR] Saving values:', values);

      const response = await fetch('/api/calculator/model-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          values
        }),
      });

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Save result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      alert('Valores guardados correctamente');
    } catch (err: any) {
      console.error('❌ [CALCULATOR] Save error:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando calculadora...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'modelo') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Mi Calculadora</h1>
            <p className="text-gray-500 text-sm">
              Bienvenida, {user.name} · Ingresa tus valores por plataforma
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
          >
            ← Volver
          </button>
        </div>

        {/* Rates actualizadas - COMPACTO */}
        <div className="apple-card mb-3">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Tasas Actualizadas</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-blue-50 rounded-md">
              <div className="text-lg font-bold text-blue-600">
                ${rates?.usd_cop || 3900}
              </div>
              <div className="text-xs text-gray-600">USD→COP</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-md">
              <div className="text-lg font-bold text-green-600">
                {rates?.eur_usd || 1.01}
              </div>
              <div className="text-xs text-gray-600">EUR→USD</div>
            </div>
            <div className="text-center p-2 bg-purple-50 rounded-md">
              <div className="text-lg font-bold text-purple-600">
                {rates?.gbp_usd || 1.20}
              </div>
              <div className="text-xs text-gray-600">GBP→USD</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-center">
            Configuradas por tu administrador
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="apple-card mb-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 text-2xl">⚠️</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Error al cargar calculadora</h4>
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={() => loadCalculatorConfig(user.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Tabla de Calculadora */}
        <div className="apple-card mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Calculadora de Ingresos</h2>
          
          {platforms.filter(p => p.enabled).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-gray-400 text-2xl">📊</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No hay plataformas habilitadas</h4>
              <p className="text-gray-500 mb-4">
                Tu administrador aún no ha configurado las plataformas para tu calculadora.
              </p>
              <p className="text-sm text-gray-400">
                Contacta a tu administrador para que habilite las plataformas que usarás.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">PLATAFORMAS</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">VALORES</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">DÓLARES</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">COP MODELO</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.filter(p => p.enabled).map(platform => {
                    // Calcular dólares y COP para esta plataforma usando fórmulas específicas
                    const usdBruto = platform.value;
                    
                    // Aplicar fórmula específica según la plataforma
                    console.log('🔍 [CALCULATOR] Calculating for platform:', {
                      id: platform.id,
                      name: platform.name,
                      currency: platform.currency,
                      value: platform.value,
                      percentage: platform.percentage
                    });
                    
                    let usdModelo = 0;
                    if (platform.currency === 'EUR') {
                      // EUR→USD→COP
                      if (platform.id === 'big7') {
                        usdModelo = (platform.value * (rates?.eur_usd || 1.01)) * 0.84; // 16% impuesto
                      } else if (platform.id === 'mondo') {
                        usdModelo = (platform.value * (rates?.eur_usd || 1.01)) * 0.78; // 22% descuento
                      } else if (platform.id === 'modelka' || platform.id === 'xmodels' || platform.id === '777' || platform.id === 'vx' || platform.id === 'livecreator' || platform.id === 'mow') {
                        usdModelo = platform.value * (rates?.eur_usd || 1.01); // EUR directo
                      } else {
                        usdModelo = platform.value * (rates?.eur_usd || 1.01); // EUR directo por defecto
                      }
                    } else if (platform.currency === 'GBP') {
                      // GBP→USD→COP
                      if (platform.id === 'aw') {
                        usdModelo = (platform.value * (rates?.gbp_usd || 1.20)) * 0.677; // 32.3% descuento
                      } else {
                        usdModelo = platform.value * (rates?.gbp_usd || 1.20); // GBP directo
                      }
                    } else if (platform.currency === 'USD') {
                      // USD→USD→COP
                      if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
                        usdModelo = platform.value * 0.75; // 25% descuento
                      } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
                        usdModelo = platform.value * 0.05; // 100 tokens = 5 USD
                      } else if (platform.id === 'dxlive') {
                        usdModelo = platform.value * 0.60; // 100 pts = 60 USD
                      } else if (platform.id === 'secretfriends') {
                        usdModelo = platform.value * 0.5; // 50% descuento
                      } else if (platform.id === 'superfoon') {
                        usdModelo = platform.value; // 100% directo
                      } else if (platform.id === 'mdh' || platform.id === 'livejasmin' || platform.id === 'imlive' || platform.id === 'hegre' || platform.id === 'dirtyfans' || platform.id === 'camcontacts') {
                        usdModelo = platform.value; // USD directo
                      } else {
                        usdModelo = platform.value; // USD directo por defecto
                      }
                    }
                    
                    // Aplicar porcentaje de reparto del modelo
                    const usdModeloFinal = (usdModelo * platform.percentage) / 100;
                    const copModelo = usdModeloFinal * (rates?.usd_cop || 3900); // Usar tasa real
                    
                    return (
                      <tr key={platform.id} className="border-b border-gray-100">
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900 text-sm">{platform.name}</div>
                          <div className="text-xs text-gray-500">Reparto: {platform.percentage}%</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="relative">
                            {/* INPUT DE PRUEBA COMPLETAMENTE AISLADO */}
                            <input
                              type="text"
                              inputMode="decimal"
                              value={inputValues[platform.id] ?? ''}
                              onChange={(e) => {
                                const raw = e.target.value;
                                // Permitir solo dígitos, puntos y comas, y un solo separador decimal
                                const cleaned = raw.replace(/[^0-9.,]/g, '');
                                // Reemplazar comas por puntos para normalizar
                                const normalized = cleaned.replace(',', '.');
                                // Evitar múltiples puntos (mantener el primero)
                                const parts = normalized.split('.');
                                const safeNormalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
                                setInputValues(prev => ({ ...prev, [platform.id]: safeNormalized }));

                                // Convertir a número si es válido
                                const numeric = Number.parseFloat(safeNormalized);
                                const value = Number.isFinite(numeric) ? numeric : 0;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value } : p));
                              }}
                              onKeyDown={(e) => {
                                console.log('🔍 [DEBUG] TECLA PRESIONADA:', e.key);
                                console.log('🔍 [DEBUG] CÓDIGO DE TECLA:', e.keyCode);
                              }}
                              onKeyUp={(e) => {
                                console.log('🔍 [DEBUG] TECLA SOLTADA:', e.key);
                              }}
                              onInput={(e) => {
                                console.log('🔍 [DEBUG] INPUT EVENT:', e.currentTarget.value);
                              }}
                              style={{
                                width: '112px',
                                height: '32px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '14px',
                                backgroundColor: 'white'
                              }}
                              placeholder="0.00"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                              <span className="text-gray-500 text-xs">
                                {platform.currency || 'USD'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-600 font-medium text-sm">
                            ${usdModelo.toFixed(2)} USD
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-600 font-medium text-sm">
                            ${copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="apple-card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Cálculo de Totales</h3>
              <p className="text-sm text-gray-500">Calcula tus ingresos totales</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={calculateTotals}
                disabled={calculating || platforms.filter(p => p.enabled).length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
              >
                {calculating ? 'Calculando...' : 'Calcular'}
              </button>
              <button
                onClick={saveValues}
                disabled={saving || platforms.filter(p => p.enabled).length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>

        {/* Totales y Alertas - COMPACTO */}
        <div className="apple-card">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Totales y Alertas</h3>
          
          {/* Totales principales - COMPACTO */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-md">
              <div className="text-xl font-bold text-blue-600 mb-1">
                ${platforms.reduce((sum, p) => {
                  // Calcular USD bruto usando fórmulas específicas
                  let usdBruto = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdBruto = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (p.id === 'mondo') {
                      usdBruto = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                    } else if (p.id === 'modelka' || p.id === 'xmodels' || p.id === '777' || p.id === 'vx' || p.id === 'livecreator' || p.id === 'mow') {
                      usdBruto = p.value * (rates?.eur_usd || 1.01);
                    } else {
                      usdBruto = p.value * (rates?.eur_usd || 1.01);
                    }
                  } else if (p.currency === 'GBP') {
                    if (p.id === 'aw') {
                      usdBruto = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                    } else {
                      usdBruto = p.value * (rates?.gbp_usd || 1.20);
                    }
                  } else if (p.currency === 'USD') {
                    if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
                      usdBruto = p.value * 0.75;
                    } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
                      usdBruto = p.value * 0.05;
                    } else if (p.id === 'dxlive') {
                      usdBruto = p.value * 0.60;
                    } else if (p.id === 'secretfriends') {
                      usdBruto = p.value * 0.5;
                    } else if (p.id === 'superfoon') {
                      usdBruto = p.value;
                    } else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') {
                      usdBruto = p.value;
                    } else {
                      usdBruto = p.value;
                    }
                  }
                  return sum + usdBruto;
                }, 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-600">USD Bruto</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-md">
              <div className="text-xl font-bold text-green-600 mb-1">
                ${platforms.reduce((sum, p) => {
                  // Calcular USD modelo usando fórmulas específicas + porcentaje
                  let usdModelo = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (p.id === 'mondo') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                    } else {
                      usdModelo = p.value * (rates?.eur_usd || 1.01);
                    }
                  } else if (p.currency === 'GBP') {
                    if (p.id === 'aw') {
                      usdModelo = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                    } else {
                      usdModelo = p.value * (rates?.gbp_usd || 1.20);
                    }
                  } else if (p.currency === 'USD') {
                    if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
                      usdModelo = p.value * 0.75;
                    } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
                      usdModelo = p.value * 0.05;
                    } else if (p.id === 'dxlive') {
                      usdModelo = p.value * 0.60;
                    } else if (p.id === 'secretfriends') {
                      usdModelo = p.value * 0.5;
                    } else if (p.id === 'superfoon') {
                      usdModelo = p.value;
                    } else {
                      usdModelo = p.value;
                    }
                  }
                  return sum + (usdModelo * p.percentage / 100);
                }, 0).toFixed(2)}
              </div>
              <div className="text-xs text-gray-600">USD Modelo</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-md">
              <div className="text-xl font-bold text-purple-600 mb-1">
                ${(platforms.reduce((sum, p) => {
                  // Calcular USD modelo usando fórmulas específicas + porcentaje
                  let usdModelo = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (p.id === 'mondo') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                    } else {
                      usdModelo = p.value * (rates?.eur_usd || 1.01);
                    }
                  } else if (p.currency === 'GBP') {
                    if (p.id === 'aw') {
                      usdModelo = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                    } else {
                      usdModelo = p.value * (rates?.gbp_usd || 1.20);
                    }
                  } else if (p.currency === 'USD') {
                    if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
                      usdModelo = p.value * 0.75;
                    } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
                      usdModelo = p.value * 0.05;
                    } else if (p.id === 'dxlive') {
                      usdModelo = p.value * 0.60;
                    } else if (p.id === 'secretfriends') {
                      usdModelo = p.value * 0.5;
                    } else if (p.id === 'superfoon') {
                      usdModelo = p.value;
                    } else {
                      usdModelo = p.value;
                    }
                  }
                  return sum + (usdModelo * p.percentage / 100);
                }, 0) * (rates?.usd_cop || 3900)).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-gray-600">COP Modelo</div>
            </div>
          </div>
          
          {/* 90% de anticipo */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>90% de anticipo disponible:</strong> ${(platforms.reduce((sum, p) => {
                // Calcular USD modelo usando fórmulas específicas + porcentaje
                let usdModelo = 0;
                if (p.currency === 'EUR') {
                  if (p.id === 'big7') {
                    usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                  } else if (p.id === 'mondo') {
                    usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                  } else {
                    usdModelo = p.value * (rates?.eur_usd || 1.01);
                  }
                } else if (p.currency === 'GBP') {
                  if (p.id === 'aw') {
                    usdModelo = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                  } else {
                    usdModelo = p.value * (rates?.gbp_usd || 1.20);
                  }
                } else if (p.currency === 'USD') {
                  if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
                    usdModelo = p.value * 0.75;
                  } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
                    usdModelo = p.value * 0.05;
                  } else if (p.id === 'dxlive') {
                    usdModelo = p.value * 0.60;
                  } else if (p.id === 'secretfriends') {
                    usdModelo = p.value * 0.5;
                  } else if (p.id === 'superfoon') {
                    usdModelo = p.value;
                  } else {
                    usdModelo = p.value;
                  }
                }
                return sum + (usdModelo * p.percentage / 100);
              }, 0) * (rates?.usd_cop || 3900) * 0.9).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
            </div>
          </div>
          
          {/* Alerta de cuota mínima - COMPACTA UNA LÍNEA */}
          {(() => {
            const totalUsdModelo = platforms.reduce((sum, p) => {
              // Calcular USD modelo usando fórmulas específicas + porcentaje
              let usdModelo = 0;
              if (p.currency === 'EUR') {
                if (p.id === 'big7') {
                  usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                } else if (p.id === 'mondo') {
                  usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                } else {
                  usdModelo = p.value * (rates?.eur_usd || 1.01);
                }
              } else if (p.currency === 'GBP') {
                if (p.id === 'aw') {
                  usdModelo = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                } else {
                  usdModelo = p.value * (rates?.gbp_usd || 1.20);
                }
              } else if (p.currency === 'USD') {
                if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
                  usdModelo = p.value * 0.75;
                } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
                  usdModelo = p.value * 0.05;
                } else if (p.id === 'dxlive') {
                  usdModelo = p.value * 0.60;
                } else if (p.id === 'secretfriends') {
                  usdModelo = p.value * 0.5;
                } else if (p.id === 'superfoon') {
                  usdModelo = p.value;
                } else {
                  usdModelo = p.value;
                }
              }
              return sum + (usdModelo * p.percentage / 100);
            }, 0);
            const cuotaMinima = platforms[0]?.minQuota || 470;
            const porcentajeAlcanzado = (totalUsdModelo / cuotaMinima) * 100;
            const estaPorDebajo = totalUsdModelo < cuotaMinima;
            
            return (
              <div className={`relative overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                estaPorDebajo 
                  ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-300 shadow-red-100' 
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-green-100'
              }`}>
                {/* Efecto de brillo animado */}
                <div className={`absolute inset-0 opacity-20 ${
                  estaPorDebajo ? 'bg-gradient-to-r from-red-400 to-pink-400' : 'bg-gradient-to-r from-green-400 to-emerald-400'
                } animate-pulse`}></div>
                
                <div className="relative p-3">
                  <div className="flex items-center space-x-3">
                    {/* Icono animado */}
                    <div className={`relative flex-shrink-0 ${
                      estaPorDebajo ? 'animate-bounce' : 'animate-pulse'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        estaPorDebajo 
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-200' 
                          : 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-200'
                      }`}>
                        <span className="text-white text-sm">
                          {estaPorDebajo ? '⚡' : '🎯'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Contenido compacto */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className={`font-bold text-sm ${
                          estaPorDebajo ? 'text-red-800' : 'text-green-800'
                        }`}>
                          {estaPorDebajo ? 'Cuota Mínima Pendiente' : 'Cuota Mínima Alcanzada'}
                        </div>
                        <div className={`text-xs font-medium ${
                          estaPorDebajo ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {estaPorDebajo 
                            ? `Faltan $${Math.ceil(cuotaMinima - totalUsdModelo)} USD (${Math.ceil(100 - porcentajeAlcanzado)}% restante)`
                            : `¡Excelente! +${Math.ceil(porcentajeAlcanzado - 100)}%`
                          }
                        </div>
                      </div>
                      
                      {/* Barra de progreso compacta */}
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ease-out ${
                              estaPorDebajo 
                                ? 'bg-gradient-to-r from-red-500 to-pink-500' 
                                : 'bg-gradient-to-r from-green-500 to-emerald-500'
                            }`}
                            style={{ width: `${Math.min(porcentajeAlcanzado, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-right text-xs text-gray-600 mt-1">
                          {Math.ceil(porcentajeAlcanzado)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
