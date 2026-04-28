'use client';

import { useState, useEffect, useMemo } from 'react';
import { getCalculatorDate, normalizeToPeriodStartDate } from '@/utils/calculator-dates';

const P2_ENERO_PERIOD_DATE = '2026-01-16';

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

interface AdminModelCalculatorProps {
  modelId: string;
  adminId: string;
  modelName: string;
}

export default function AdminModelCalculator({ 
  modelId, 
  adminId,
  modelName 
}: AdminModelCalculatorProps) {
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isUserEditing, setIsUserEditing] = useState(false);
  const [editingTimeout, setEditingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Sistema V2 siempre activo (sin flags de entorno)
  // 🔧 FIX: Deshabilitar autosave para corregir problema de persistencia
  const ENABLE_AUTOSAVE = false; // Forzar deshabilitado
  
  // 🔍 DEBUG: Verificar configuración
  console.log('🔍 [ADMIN-MODEL-CALCULATOR] System configuration:', {
    ENABLE_AUTOSAVE,
    SYSTEM_VERSION: 'V2_ONLY',
    modelId,
    adminId,
    modelName
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // Simular usuario de la modelo para el admin
        const mockUser: User = {
          id: modelId,
          name: modelName,
          email: 'modelo@ejemplo.com',
          role: 'modelo',
          groups: [],
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        setUser(mockUser);

        // Cargar configuración de calculadora
        await loadCalculatorConfig(modelId);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [modelId, adminId, modelName]);

  // ELIMINADO: Polling automático - Solo actualizar manualmente
  // useEffect(() => {
  //   if (!user) return;
  //   const interval = setInterval(async () => {
  //     await loadModelValuesOnly(modelId);
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [user, modelId, editingTimeout]);

  // Función para cargar valores manualmente (sin polling automático)
  const loadModelValuesOnly = async (userId: string) => {
    try {
      console.log('🔄 [ADMIN-MODEL-CALCULATOR] Manual refresh - loading values for userId:', userId);
      
      // Cargar valores guardados
      const savedResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}&t=${Date.now()}`);
      const savedJson = await savedResp.json();
      const isP2EneroCerrado = normalizeToPeriodStartDate(periodDate) === P2_ENERO_PERIOD_DATE;

      if (isP2EneroCerrado) {
        setInputValues({});
        setPlatforms(prev => prev.map(p => ({ ...p, value: 0 })));
        setResult(null);
        console.log('ℹ️ [ADMIN-MODEL-CALCULATOR] P2 enero cerrado - valores en 0');
      } else if (savedJson.success && Array.isArray(savedJson.data) && savedJson.data.length > 0) {
        const savedValues: Record<string, string> = {};
        savedJson.data.forEach((item: any) => {
          savedValues[item.platform_id] = item.value.toString();
        });
        console.log('🔄 [ADMIN-MODEL-CALCULATOR] Values loaded from server:', savedValues);
        setInputValues(savedValues);
        setPlatforms(prev => prev.map(p => ({
          ...p,
          value: parseFloat(savedValues[p.id]) || 0
        })));
        setLastSaved(new Date());
        console.log('✅ [ADMIN-MODEL-CALCULATOR] Values updated successfully');
      } else {
        console.log('ℹ️ [ADMIN-MODEL-CALCULATOR] No saved values found');
      }
    } catch (error) {
      console.warn('⚠️ [ADMIN-MODEL-CALCULATOR] Error loading values:', error);
    }
  };

  const loadCalculatorConfig = async (userId: string) => {
    try {
      console.log('🔍 [ADMIN-MODEL-CALCULATOR] Loading config for userId:', userId);

      // Cargar tasas activas
      const ratesResponse = await fetch('/api/rates-v2?activeOnly=true');
      const ratesData = await ratesResponse.json();
      console.log('🔍 [ADMIN-MODEL-CALCULATOR] Rates data:', ratesData);
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
      console.log('🔍 [ADMIN-MODEL-CALCULATOR] Config data:', data);
      console.log('🔍 [ADMIN-MODEL-CALCULATOR] Platforms received:', data.config?.platforms);

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

      console.log('🔍 [ADMIN-MODEL-CALCULATOR] Enabled platforms:', enabledPlatforms);
      setPlatforms(enabledPlatforms);

      // Cargar valores guardados previamente (solo sistema V2)
      try {
        console.log('🔍 [ADMIN-MODEL-CALCULATOR] Loading saved values - V2 system only');
        const savedResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}&t=${Date.now()}`);
        const savedJson = await savedResp.json();
        console.log('🔍 [ADMIN-MODEL-CALCULATOR] Saved values (v2):', savedJson);
        const isP2EneroCerrado = normalizeToPeriodStartDate(periodDate) === P2_ENERO_PERIOD_DATE;
        if (isP2EneroCerrado) {
          setInputValues({});
          setPlatforms(prev => prev.map(p => ({ ...p, value: 0 })));
          setResult(null);
        } else if (savedJson.success && Array.isArray(savedJson.data) && savedJson.data.length > 0) {
          const savedValues: Record<string, string> = {};
          savedJson.data.forEach((item: any) => {
            savedValues[item.platform_id] = item.value.toString();
          });
          setInputValues(savedValues);
          setPlatforms(prev => prev.map(p => ({
            ...p,
            value: parseFloat(savedValues[p.id]) || 0
          })));
        }
      } catch (savedError) {
        console.warn('⚠️ [ADMIN-MODEL-CALCULATOR] Error loading saved values:', savedError);
      }

    } catch (error) {
      console.error('❌ [ADMIN-MODEL-CALCULATOR] Error loading calculator config:', error);
      setError('Error al cargar configuración de la calculadora');
    }
  };

  const handleInputChange = (platformId: string, value: string) => {
    // Marcar que el usuario está editando
    setIsUserEditing(true);
    
    // Limpiar timeout anterior si existe
    if (editingTimeout) {
      clearTimeout(editingTimeout);
    }
    
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
    
    // Crear nuevo timeout para resetear flag de edición
    const newTimeout = setTimeout(() => {
      console.log('⏰ [ADMIN-MODEL-CALCULATOR] User editing timeout - resuming polling');
      setIsUserEditing(false);
      setEditingTimeout(null);
    }, 5000); // 5 segundos después de la última edición
    setEditingTimeout(newTimeout);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
      saveValues();
    }
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

      console.log('💾 [ADMIN-MODEL-CALCULATOR] Saving values:', {
        modelId,
        values,
        periodDate,
        enabledPlatforms: enabled.length
      });

      // 1. Guardar valores individuales por plataforma
      const response = await fetch('/api/calculator/model-values-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          modelId: modelId, 
          values, 
          periodDate 
        })
      });

      const data = await response.json();
      console.log('💾 [ADMIN-MODEL-CALCULATOR] Save response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      console.log('✅ [ADMIN-MODEL-CALCULATOR] Values saved successfully');

      // 2. Actualizar calculator_totals si hay resultado calculado
      // Esto es crítico para que los dashboards muestren los datos actualizados
      if (result) {
        console.log('💾 [ADMIN-MODEL-CALCULATOR] Updating calculator_totals:', {
          totalUsdBruto: result.totalUsdBruto,
          totalUsdModelo: result.totalUsdModelo,
          totalCopModelo: result.totalCopModelo
        });

        const totalsResponse = await fetch('/api/calculator/totals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: modelId,
            periodDate,
            totalUsdBruto: result.totalUsdBruto,
            totalUsdModelo: result.totalUsdModelo,
            totalCopModelo: result.totalCopModelo
          })
        });

        const totalsData = await totalsResponse.json();
        if (!totalsData.success) {
          console.error('❌ [ADMIN-MODEL-CALCULATOR] Error saving totals:', totalsData.error);
          // No fallar la operación principal, solo loggear el error
        } else {
          console.log('✅ [ADMIN-MODEL-CALCULATOR] Totals saved successfully');
        }
      } else {
        console.warn('⚠️ [ADMIN-MODEL-CALCULATOR] No result calculated, skipping totals update');
      }

      setLastSaved(new Date());
      
      // Limpiar timeout y resetear flag de edición
      if (editingTimeout) {
        clearTimeout(editingTimeout);
        setEditingTimeout(null);
      }
      setIsUserEditing(false);

    } catch (error) {
      console.error('❌ [ADMIN-MODEL-CALCULATOR] Error saving values:', error);
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
  //         body: JSON.stringify({ modelId: modelId, values, periodDate }),
  //         signal: controller.signal
  //       });
  //       const json = await res.json();
  //       if (!json.success) {
  //         console.warn('⚠️ [ADMIN-MODEL-CALCULATOR] Error guardando automáticamente:', json.error);
  //       } else {
  //         setLastSaved(new Date());
  //         setIsUserEditing(false); // Resetear flag de edición después de autosave
  //       }
  //     } catch (e) {
  //       console.warn('⚠️ [ADMIN-MODEL-CALCULATOR] Excepción en autosave:', e);
  //     }
  //   }, 800);

  //   return () => {
  //     controller.abort();
  //     clearTimeout(t);
  //   };
  // }, [ENABLE_AUTOSAVE, user?.id, periodDate, platforms]);

  // Optimizar cálculos con useMemo para evitar parpadeo
  const calculatedResults = useMemo(() => {
    if (!rates) return null;

    const enabledPlatforms = platforms.filter(p => p.enabled && p.value > 0);
    if (enabledPlatforms.length === 0) {
      return null;
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

    return {
      perPlatform,
      totalUsdBruto,
      totalUsdModelo,
      totalCopModelo,
      cuotaMinimaAlert,
      anticipoMaxCop
    };
  }, [platforms, rates]);

  // Actualizar resultado cuando cambian los cálculos
  useEffect(() => {
    setResult(calculatedResults);
  }, [calculatedResults]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 rounded-xl border border-red-200">
          <h1 className="text-2xl font-semibold text-red-800 mb-4">Error</h1>
          <p className="text-red-700">{error}</p>
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
              Bienvenida, {modelName} · Ingresa tus valores por plataforma
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {lastSaved && (
              <div className="text-sm text-green-600">
                Última actualización: {lastSaved.toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={async () => {
                console.log('🔄 [ADMIN-MODEL-CALCULATOR] Manual refresh triggered');
                await loadModelValuesOnly(modelId);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-[0.98] text-sm font-medium transition-all duration-200"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Tasas */}
        {rates && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Tasas Actualizadas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* USD to COP */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-blue-50/70 dark:bg-blue-900/10 backdrop-blur-md border border-blue-200/50 dark:border-blue-800/30 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/20 group">
                <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-400 tracking-tight mb-2 group-hover:scale-105 transition-transform duration-300">
                  ${rates.usd_cop.toLocaleString('es-CO')}
                </div>
                <div className="w-full text-center py-1.5 bg-blue-100/60 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold rounded-xl tracking-wide">
                  USD → COP
                </div>
              </div>

              {/* EUR to USD */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-emerald-50/70 dark:bg-emerald-900/10 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-800/30 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 group">
                <div className="text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight mb-2 group-hover:scale-105 transition-transform duration-300">
                  {rates.eur_usd}
                </div>
                <div className="w-full text-center py-1.5 bg-emerald-100/60 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-semibold rounded-xl tracking-wide">
                  EUR → USD
                </div>
              </div>

              {/* GBP to USD */}
              <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-purple-50/70 dark:bg-purple-900/10 backdrop-blur-md border border-purple-200/50 dark:border-purple-800/30 rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-purple-50 dark:hover:bg-purple-900/20 group">
                <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-400 tracking-tight mb-2 group-hover:scale-105 transition-transform duration-300">
                  {rates.gbp_usd}
                </div>
                <div className="w-full text-center py-1.5 bg-purple-100/60 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300 text-xs sm:text-sm font-semibold rounded-xl tracking-wide">
                  GBP → USD
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Configuradas por tu administrador</p>
          </div>
        )}

        {/* Calculadora - REPLICAR ESTRUCTURA EXACTA DE LA MODELO */}
        <div className="apple-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Calculadora de Ingresos</h2>
          
          {platforms.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No hay plataformas habilitadas</h3>
              <p className="text-gray-500">Tu administrador aún no ha configurado las plataformas para tu calculadora.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">PLATAFORMAS</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">VALORES</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">DÓLARES</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-700">COP MODELO</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((platform) => {
                    // Calcular USD modelo usando fórmulas específicas + porcentaje
                    let usdModelo = 0;
                    if (platform.currency === 'EUR') {
                      if (platform.id === 'big7') {
                        usdModelo = (platform.value * (rates?.eur_usd || 1.01)) * 0.84;
                      } else if (platform.id === 'mondo') {
                        usdModelo = (platform.value * (rates?.eur_usd || 1.01)) * 0.78;
                      } else {
                        usdModelo = platform.value * (rates?.eur_usd || 1.01);
                      }
                    } else if (platform.currency === 'GBP') {
                      if (platform.id === 'aw') {
                        usdModelo = (platform.value * (rates?.gbp_usd || 1.20)) * 0.677;
                      } else {
                        usdModelo = platform.value * (rates?.gbp_usd || 1.20);
                      }
                    } else if (platform.currency === 'USD') {
                      if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
                        usdModelo = platform.value * 0.75;
                      } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
                        usdModelo = platform.value * 0.05;
                      } else if (platform.id === 'dxlive') {
                        usdModelo = platform.value * 0.60;
                      } else if (platform.id === 'secretfriends') {
                        usdModelo = platform.value * 0.5;
                      } else if (platform.id === 'superfoon') {
                        usdModelo = platform.value;
                      } else {
                        usdModelo = platform.value;
                      }
                    }
                    
                    // Aplicar porcentaje de la modelo
                    usdModelo = usdModelo * (platform.percentage / 100);
                    const copModelo = usdModelo * (rates?.usd_cop || 3900);

                    return (
                      <tr key={platform.id} className="border-b border-gray-100">
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900 text-sm">{platform.name}</div>
                          <div className="text-xs text-gray-500">
                            Reparto: {platform.id === 'superfoon' ? '100%' : `${platform.percentage}%`}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={inputValues[platform.id] ?? ''}
                              onKeyDown={handleInputKeyDown}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const cleaned = raw.replace(/[^0-9.,]/g, '');
                                const normalized = cleaned.replace(',', '.');
                                const parts = normalized.split('.');
                                const safeNormalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
                                setInputValues(prev => ({ ...prev, [platform.id]: safeNormalized }));

                                const numeric = Number.parseFloat(safeNormalized);
                                const value = Number.isFinite(numeric) ? numeric : 0;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value } : p));
                              }}
                              style={{
                                width: '112px',
                                height: '32px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                padding: '4px 8px',
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

        {/* Totales y Alertas - COMPACTO */}
        <div className="apple-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Totales y Alertas</h3>
            <button
              onClick={saveValues}
              disabled={saving || platforms.filter(p => p.enabled).length === 0}
              className="px-4 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          
          {/* Totales principales - Estilo Apple Glass 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* USD Bruto */}
            <div className="flex flex-col items-center justify-center p-4 sm:p-5 bg-blue-50/70 dark:bg-blue-900/10 backdrop-blur-md border border-blue-200/50 dark:border-blue-800/30 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-blue-50/90 dark:hover:bg-blue-900/20 group">
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-400 tracking-tight mb-3 group-hover:scale-105 transition-transform duration-300">
                ${platforms.reduce((sum, p) => {
                  let usdBruto = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdBruto = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (p.id === 'mondo') {
                      usdBruto = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
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
                    } else {
                      usdBruto = p.value;
                    }
                  }
                  return sum + usdBruto;
                }, 0).toFixed(2)} USD
              </div>
              <div className="w-full text-center py-2 bg-blue-100/60 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-semibold rounded-xl tracking-wider uppercase">
                USD Bruto
              </div>
            </div>

            {/* USD Modelo */}
            <div className="flex flex-col items-center justify-center p-4 sm:p-5 bg-emerald-50/70 dark:bg-emerald-900/10 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-800/30 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-emerald-50/90 dark:hover:bg-emerald-900/20 group">
              <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400 tracking-tight mb-3 group-hover:scale-105 transition-transform duration-300">
                ${platforms.reduce((sum, p) => {
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
                }, 0).toFixed(2)} USD
              </div>
              <div className="w-full text-center py-2 bg-emerald-100/60 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-semibold rounded-xl tracking-wider uppercase">
                USD Modelo
              </div>
            </div>

            {/* COP Modelo */}
            <div className="flex flex-col items-center justify-center p-4 sm:p-5 bg-purple-50/70 dark:bg-purple-900/10 backdrop-blur-md border border-purple-200/50 dark:border-purple-800/30 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-purple-50/90 dark:hover:bg-purple-900/20 group">
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-400 tracking-tight mb-3 group-hover:scale-105 transition-transform duration-300">
                ${(platforms.reduce((sum, p) => {
                  let usdModelo = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (p.id === 'mondo') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                    } else if (p.id === 'superfoon') {
                      usdModelo = p.value * (rates?.eur_usd || 1.01);
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
                    } else {
                      usdModelo = p.value;
                    }
                  }
                  
                  if (p.id === 'superfoon') {
                    return sum + usdModelo;
                  }
                  
                  return sum + (usdModelo * p.percentage / 100);
                }, 0) * (rates?.usd_cop || 3900)).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
              </div>
              <div className="w-full text-center py-2 bg-purple-100/60 dark:bg-purple-800/40 text-purple-700 dark:text-purple-300 text-xs sm:text-sm font-semibold rounded-xl tracking-wider uppercase">
                COP Modelo
              </div>
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
                  } else if (p.id === 'superfoon') {
                    usdModelo = p.value * (rates?.eur_usd || 1.01); // EUR a USD directo
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
                  } else {
                    usdModelo = p.value;
                  }
                }
                
                // SUPERFOON: Aplicar 100% para la modelo (especial)
                if (p.id === 'superfoon') {
                  return sum + usdModelo; // 100% directo, sin porcentaje
                }
                
                return sum + (usdModelo * p.percentage / 100);
              }, 0) * (rates?.usd_cop || 3900) * 0.9).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
