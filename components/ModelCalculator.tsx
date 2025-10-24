'use client';

import { useState, useEffect } from 'react';
import { getCalculatorDate } from '@/utils/calculator-dates';

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
  // Propiedades para debugging
  percentage_override?: number | null;
  group_percentage?: number | null;
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

interface ModelCalculatorProps {
  modelId: string;
  adminView?: boolean;
  adminId?: string;
  onSave?: (platforms: Platform[]) => void;
}

export default function ModelCalculator({ 
  modelId, 
  adminView = false, 
  adminId,
  onSave 
}: ModelCalculatorProps) {
  const [user, setUser] = useState<User | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [rates, setRates] = useState<any>(null);
  // Periodo activo usando fecha de Europa Central
  const [periodDate, setPeriodDate] = useState<string>(getCalculatorDate());
  // Mantener valores escritos como texto para permitir decimales con coma y punto
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sistema V2 siempre activo (sin flags de entorno)
  // 🔧 FIX: Deshabilitar autosave para corregir problema de persistencia
  const ENABLE_AUTOSAVE = false; // Forzar deshabilitado
  
  // 🔍 DEBUG: Verificar configuración
  console.log('🔍 [MODEL-CALCULATOR] System configuration:', {
    ENABLE_AUTOSAVE,
    SYSTEM_VERSION: 'V2_ONLY',
    modelId,
    adminView,
    adminId
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // En modo admin, simular usuario de la modelo
        if (adminView && adminId) {
          const mockUser: User = {
            id: modelId,
            name: 'Modelo',
            email: 'modelo@ejemplo.com',
            role: 'modelo',
            groups: [],
            organization_id: '',
            is_active: true,
            last_login: new Date().toISOString(),
          };
          setUser(mockUser);
        }

        // Cargar configuración de calculadora
        await loadCalculatorConfig(modelId);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [modelId, adminView, adminId]);

  const loadCalculatorConfig = async (userId: string) => {
    try {
      console.log('🔍 [MODEL-CALCULATOR] Loading config for userId:', userId);

      // Cargar tasas activas
      const ratesResponse = await fetch('/api/rates-v2?activeOnly=true');
      const ratesData = await ratesResponse.json();
      console.log('🔍 [MODEL-CALCULATOR] Rates data:', ratesData);
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
      const response = await fetch(`/api/calculator/config-v2?modelId=${userId}`);
      if (!response.ok) {
        throw new Error('Error al cargar configuración');
      }

      const data = await response.json();
      console.log('🔍 [MODEL-CALCULATOR] Config data:', data);
      console.log('🔍 [MODEL-CALCULATOR] Platforms received:', data.config?.platforms);

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
          minQuota: 470,
          currency: platform.currency || 'USD',
          percentage_override: platform.percentage_override,
          group_percentage: platform.group_percentage
        }));

      console.log('🔍 [MODEL-CALCULATOR] Enabled platforms:', enabledPlatforms);
      setPlatforms(enabledPlatforms);

      // Cargar valores guardados previamente (solo sistema V2)
      try {
        console.log('🔍 [MODEL-CALCULATOR] Loading saved values - V2 system only');
        const savedResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}`);
        const savedJson = await savedResp.json();
        console.log('🔍 [MODEL-CALCULATOR] Saved values (v2):', savedJson);
        if (savedJson.success && Array.isArray(savedJson.data) && savedJson.data.length > 0) {
          const savedValues: Record<string, string> = {};
          savedJson.data.forEach((item: any) => {
            savedValues[item.platform_id] = item.value.toString();
          });
          setInputValues(savedValues);
          
          // Actualizar plataformas con valores guardados
          setPlatforms(prev => prev.map(p => ({
            ...p,
            value: parseFloat(savedValues[p.id]) || 0
          })));
        }
      } catch (savedError) {
        console.warn('⚠️ [MODEL-CALCULATOR] Error loading saved values:', savedError);
      }

    } catch (error) {
      console.error('❌ [MODEL-CALCULATOR] Error loading calculator config:', error);
      setError('Error al cargar configuración de la calculadora');
    }
  };

  const handleInputChange = (platformId: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [platformId]: value
    }));

    // Actualizar plataformas con el nuevo valor
    setPlatforms(prev => prev.map(p => 
      p.id === platformId 
        ? { ...p, value: parseFloat(value) || 0 }
        : p
    ));
  };

  const calculateResults = () => {
    if (!rates) return;

    const enabledPlatforms = platforms.filter(p => p.enabled && p.value > 0);
    if (enabledPlatforms.length === 0) {
      setResult(null);
      return;
    }

    const perPlatform = enabledPlatforms.map(platform => {
      let usdBruto = 0;
      let usdModelo = 0;

      // Aplicar fórmulas específicas por plataforma
      if (platform.currency === 'EUR') {
        if (platform.id === 'big7') {
          usdBruto = platform.value * rates.eur_usd;
          usdModelo = usdBruto * 0.84;
        } else if (platform.id === 'mondo') {
          usdBruto = platform.value * rates.eur_usd;
          usdModelo = usdBruto * 0.78;
        } else {
          usdBruto = platform.value * rates.eur_usd;
          usdModelo = usdBruto;
        }
      } else if (platform.currency === 'GBP') {
        if (platform.id === 'aw') {
          usdBruto = platform.value * rates.gbp_usd;
          usdModelo = usdBruto * 0.677;
        } else {
          usdBruto = platform.value * rates.gbp_usd;
          usdModelo = usdBruto;
        }
      } else if (platform.currency === 'USD') {
        if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
          usdBruto = platform.value;
          usdModelo = platform.value * 0.75;
        } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
          usdBruto = platform.value;
          usdModelo = platform.value * 0.05;
        } else if (platform.id === 'dxlive') {
          usdBruto = platform.value;
          usdModelo = platform.value * 0.60;
        } else if (platform.id === 'secretfriends') {
          usdBruto = platform.value;
          usdModelo = platform.value * 0.5;
        } else if (platform.id === 'superfoon') {
          usdBruto = platform.value;
          usdModelo = platform.value;
        } else {
          usdBruto = platform.value;
          usdModelo = platform.value;
        }
      }

      // Aplicar porcentaje de la modelo
      usdModelo = usdModelo * (platform.percentage / 100);
      const copModelo = usdModelo * rates.usd_cop;

      return {
        platformId: platform.id,
        usdBruto,
        usdModelo,
        copModelo
      };
    });

    const totalUsdBruto = perPlatform.reduce((sum, p) => sum + p.usdBruto, 0);
    const totalUsdModelo = perPlatform.reduce((sum, p) => sum + p.usdModelo, 0);
    const totalCopModelo = perPlatform.reduce((sum, p) => sum + p.copModelo, 0);

    // Calcular cuota mínima
    const cuotaMinima = 470;
    const cuotaMinimaAlert = {
      below: totalUsdModelo < cuotaMinima,
      percentToReach: totalUsdModelo < cuotaMinima ? ((cuotaMinima - totalUsdModelo) / cuotaMinima) * 100 : 0
    };

    const anticipoMaxCop = totalCopModelo * 0.9;

    setResult({
      perPlatform,
      totalUsdBruto,
      totalUsdModelo,
      totalCopModelo,
      cuotaMinimaAlert,
      anticipoMaxCop
    });
  };

  const saveValues = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const enabled = platforms.filter(p => p.enabled && p.value > 0);
      const values: Record<string, number> = enabled.reduce((acc, p) => {
        acc[p.id] = p.value;
        return acc;
      }, {} as Record<string, number>);

      // 1. Guardar valores individuales por plataforma
      const response = await fetch('/api/calculator/model-values-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          modelId: user.id, 
          values, 
          periodDate 
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al guardar valores');
      }

      console.log('✅ [MODEL-CALCULATOR] Values saved successfully');

      // 2. Guardar totales consolidados si hay resultado calculado
      if (result) {
        const totalsResponse = await fetch('/api/calculator/totals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: user.id,
            periodDate,
            totalUsdBruto: result.totalUsdBruto,
            totalUsdModelo: result.totalUsdModelo,
            totalCopModelo: result.totalCopModelo
          })
        });

        const totalsData = await totalsResponse.json();
        if (!totalsData.success) {
          console.error('❌ [MODEL-CALCULATOR] Error saving totals:', totalsData.error);
          // No fallar la operación principal, solo loggear el error
        } else {
          console.log('✅ [MODEL-CALCULATOR] Totals saved successfully');
        }
      }
      
      // Notificar al componente padre si hay callback
      if (onSave) {
        onSave(platforms);
      }

    } catch (error) {
      console.error('❌ [MODEL-CALCULATOR] Error saving values:', error);
      setError('Error al guardar valores');
    } finally {
      setSaving(false);
    }
  };

  // 🔧 FIX: Autosave deshabilitado para corregir problema de persistencia
  // useEffect(() => {
  //   if (!ENABLE_AUTOSAVE) return;
  //   if (!user) return;
  //   
  //   const enabled = platforms.filter(p => p.enabled && p.value > 0);
  //   const values: Record<string, number> = enabled.reduce((acc, p) => {
  //     acc[p.id] = p.value;
  //     return acc;
  //   }, {} as Record<string, number>);

  //   const hasAny = Object.keys(values).length > 0;
  //   if (!hasAny) return;

  //   const controller = new AbortController();
  //   const t = setTimeout(async () => {
  //     try {
  //       const res = await fetch('/api/calculator/model-values-v2', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ modelId: user.id, values, periodDate }),
  //         signal: controller.signal
  //       });
  //       const json = await res.json();
  //       if (!json.success) {
  //         console.warn('⚠️ [MODEL-CALCULATOR] Error guardando automáticamente:', json.error);
  //       }
  //     } catch (e) {
  //       console.warn('⚠️ [MODEL-CALCULATOR] Excepción en autosave:', e);
  //     }
  //   }, 800);

  //   return () => {
  //     controller.abort();
  //     clearTimeout(t);
  //   };
  // }, [ENABLE_AUTOSAVE, user?.id, periodDate]);

  // Recalcular cuando cambian las plataformas
  useEffect(() => {
    calculateResults();
  }, [platforms, rates]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando calculadora...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 rounded-xl border border-red-200">
          <h1 className="text-2xl font-semibold text-red-800 mb-4">Error</h1>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Mi Calculadora</h1>
            <p className="text-gray-500 dark:text-gray-300 text-sm">
              Bienvenida, {user?.name || 'Usuario'} · Ingresa tus valores por plataforma
            </p>
          </div>
        </div>

        {/* Tasas */}
        {rates && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Tasas Actualizadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">
                  ${rates.usd_cop.toLocaleString()} USD→COP
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-900">
                  {rates.eur_usd} EUR→USD
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">
                  {rates.gbp_usd} GBP→USD
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Configuradas por tu administrador</p>
          </div>
        )}

        {/* Calculadora */}
        <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm dark:shadow-lg dark:shadow-indigo-900/10 dark:ring-0.5 dark:ring-indigo-500/15 border border-gray-200 dark:border-gray-600 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Calculadora de Ingresos</h2>
          
          {platforms.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay plataformas habilitadas</h3>
              <p className="text-gray-500 dark:text-gray-300">Tu administrador aún no ha configurado las plataformas para tu calculadora.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {platforms.map((platform) => (
                <div key={platform.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={platform.enabled}
                      onChange={(e) => {
                        setPlatforms(prev => prev.map(p => 
                          p.id === platform.id ? { ...p, enabled: e.target.checked } : p
                        ));
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{platform.name}</span>
                  </div>
                  
                  {platform.enabled && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={inputValues[platform.id] || ''}
                        onChange={(e) => handleInputChange(platform.id, e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-300">{platform.currency}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-300">({platform.percentage}%)</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Resultados */}
          {result && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-100">Total USD:</span>
                  <div className="text-lg font-bold text-blue-900">
                    ${result.totalUsdModelo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-100">Total COP:</span>
                  <div className="text-lg font-bold text-green-900">
                    ${result.totalCopModelo.toLocaleString('es-CO')}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-100">Anticipo Máximo:</span>
                  <div className="text-lg font-bold text-purple-900">
                    ${result.anticipoMaxCop.toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botón de guardar */}
          {platforms.length > 0 && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={saveValues}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar Valores'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}