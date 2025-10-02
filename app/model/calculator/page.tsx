'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
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

export default function ModelCalculatorPage() {
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
  const [valuesLoaded, setValuesLoaded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const router = useRouter();
  // Eliminado: Ya no maneja parámetros de admin
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
  // Sistema V2 siempre activo (sin flags de entorno)
  // 🔧 FIX: Deshabilitar autosave para corregir problema de persistencia
  const ENABLE_AUTOSAVE = false; // Forzar deshabilitado
  
  // 🔧 HELPER: Funciones de sincronización bidireccional
  const syncPlatformsToInputs = (platforms: Platform[]) => {
    const newInputValues: Record<string, string> = {};
    platforms.forEach(p => {
      if (p.enabled) {
        // 🔧 FIX: Permitir valor 0 - solo ocultar si es undefined/null
        newInputValues[p.id] = (p.value !== undefined && p.value !== null) ? String(p.value) : '';
      }
    });
    setInputValues(prev => ({ ...prev, ...newInputValues }));
  };

  const syncInputsToPlatforms = (inputValues: Record<string, string>) => {
    setPlatforms(prev => prev.map(p => {
      const inputValue = inputValues[p.id];
      const numeric = Number.parseFloat(inputValue || '0');
      const value = Number.isFinite(numeric) ? numeric : 0;
      return { ...p, value };
    }));
  };
  
  // 🔍 DEBUG: Verificar configuración
  console.log('🔍 [CALCULATOR] System configuration:', {
    ENABLE_AUTOSAVE,
    SYSTEM_VERSION: 'V2_ONLY'
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Load current auth user
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
          last_login: new Date().toISOString(), // Usar fecha del servidor para last_login
        };
        setUser(current);

        // 🔧 FIX: Solo cargar configuración del usuario actual (modelo) si no se ha cargado antes
        if (!configLoaded) {
          await loadCalculatorConfig(current.id);
          setConfigLoaded(true);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadCalculatorConfig = async (userId: string) => {
    // 🔧 FIX: Prevenir doble carga usando estado
    if (configLoaded) {
      console.log('🔍 [CALCULATOR] Config already loaded, skipping');
      return;
    }
    
    try {
      console.log('🔍 [CALCULATOR] Loading config for userId:', userId);

      // Código legacy eliminado - ya no hay parámetros de admin

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
      console.log('🔍 [CALCULATOR] Fetching config for userId:', userId);
      
      const response = await fetch(`/api/calculator/config-v2?modelId=${userId}`);
      console.log('🔍 [CALCULATOR] Config response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Error al cargar configuración: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Config data:', data);
      console.log('🔍 [CALCULATOR] Platforms received:', data.config?.platforms);
      console.log('🔍 [CALCULATOR] Config success:', data.success);

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar configuración');
      }

      // Procesar plataformas habilitadas
      const enabledPlatforms = data.config.platforms
        .filter((p: any) => p.enabled)
        .map((platform: any) => {
          // DEBUG PROFUNDO: Verificar valores antes del fallback
          console.log('🔍 [CALCULATOR] DEBUG - Platform raw data:', {
            id: platform.id,
            name: platform.name,
            percentage_override: platform.percentage_override,
            group_percentage: platform.group_percentage,
            percentage_override_type: typeof platform.percentage_override,
            group_percentage_type: typeof platform.group_percentage
          });
          
          const finalPercentage = platform.percentage_override || platform.group_percentage || 80;
          
          console.log('🔍 [CALCULATOR] DEBUG - Final percentage calculation:', {
            id: platform.id,
            percentage_override: platform.percentage_override,
            group_percentage: platform.group_percentage,
            final_percentage: finalPercentage,
            using_fallback: !platform.percentage_override && !platform.group_percentage
          });
          
          return {
            id: platform.id,
            name: platform.name,
            enabled: true,
            value: 0,
            percentage: finalPercentage,
            minQuota: platform.min_quota_override || platform.group_min_quota || 470,
            currency: platform.currency || 'USD', // CRÍTICO: Agregar currency
            // Propiedades para debugging
            percentage_override: platform.percentage_override,
            group_percentage: platform.group_percentage
          };
        });

      console.log('🔍 [CALCULATOR] Enabled platforms:', enabledPlatforms);
      console.log('🔍 [CALCULATOR] Platform details:', enabledPlatforms.map((p: Platform) => ({
        id: p.id,
        name: p.name,
        currency: p.currency,
        percentage: p.percentage,
        value: p.value
      })));
      
      // DEBUG PROFUNDO: Verificar datos de porcentaje
      console.log('🔍 [CALCULATOR] DEBUG - Platform percentage data:', enabledPlatforms.map((p: Platform) => ({
        id: p.id,
        name: p.name,
        percentage_override: p.percentage_override,
        group_percentage: p.group_percentage,
        final_percentage: p.percentage
      })));
      setPlatforms(enabledPlatforms);
      // Inicializar inputs de texto vacíos
      setInputValues(
        enabledPlatforms.reduce((acc: Record<string, string>, p: Platform) => {
          acc[p.id] = p.value ? String(p.value) : '';
          return acc;
        }, {} as Record<string, string>)
      );

      // Cargar valores guardados previamente (solo sistema V2) - MEJORADO
      try {
        console.log('🔍 [CALCULATOR] Loading saved values - V2 system only');
        const savedResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}`);
        const savedJson = await savedResp.json();
      console.log('🔍 [CALCULATOR] Saved values (v2):', savedJson);
      
      // 🔧 FIX: Delay para asegurar que la base de datos se actualice completamente
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (savedJson.success && Array.isArray(savedJson.data) && savedJson.data.length > 0) {
          const platformToValue: Record<string, number> = {};
          for (const row of savedJson.data) {
            if (row && row.platform_id) {
              const parsed = Number.parseFloat(String(row.value));
              platformToValue[row.platform_id] = Number.isFinite(parsed) ? parsed : 0;
            }
          }
          
          // 🔧 FIX: Cargar valores guardados solo si no se han cargado antes
          if (!valuesLoaded) {
            console.log('🔍 [CALCULATOR] Cargando valores guardados');
            
            // 1. Actualizar platforms.value con valores guardados
            setPlatforms(prev => prev.map(p => ({
              ...p,
              value: platformToValue[p.id] ?? p.value
            })));
            
            // 2. La sincronización automática se encargará de actualizar inputValues
            // No necesitamos hacerlo manualmente aquí
            console.log('🔍 [CALCULATOR] Valores guardados aplicados a platforms, sincronización automática activada');
            
            setValuesLoaded(true);
          }
        }
      } catch (e) {
        console.warn('⚠️ [CALCULATOR] No se pudieron cargar valores guardados:', e);
      }

    } catch (err: any) {
      console.error('❌ [CALCULATOR] Error:', err);
      setError(err.message || 'Error al cargar configuración');
    } finally {
      // Carga completada
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
      
      // CRÍTICO: Deshabilitar autosave durante guardado manual
      console.log('🔒 [CALCULATOR] Disabling autosave during manual save');

      const values = platforms.reduce((acc, platform) => {
        // 🔧 FIX: Permitir guardar valor 0 - solo excluir si es undefined/null
        if (platform.enabled && platform.value !== undefined && platform.value !== null) {
          acc[platform.id] = platform.value;
        }
        return acc;
      }, {} as Record<string, number>);

      console.log('🔍 [CALCULATOR] Saving values:', values);
      console.log('🔍 [CALCULATOR] Using V2 system for saving');
      console.log('🔍 [CALCULATOR] User ID:', user?.id);

      const endpoint = '/api/calculator/model-values-v2';
      // Solo usar el ID del usuario actual (modelo)
      const payload = { modelId: user?.id, values, periodDate };
      
      console.log('🔍 [CALCULATOR] Using endpoint:', endpoint);
      console.log('🔍 [CALCULATOR] Payload:', payload);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Save result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      // Marcar que se han guardado nuevos valores
      alert('Valores guardados correctamente');
      
      // CRÍTICO: NO actualizar automáticamente - los valores ya están en el estado
      console.log('✅ [CALCULATOR] Valores guardados exitosamente - no se necesita recarga');
      
      // CRÍTICO: Rehabilitar autosave después del guardado
      console.log('🔓 [CALCULATOR] Re-enabling autosave after manual save');
    } catch (err: any) {
      console.error('❌ [CALCULATOR] Save error:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // 🔧 AUTOMATIC SYNC: Sincronización automática platforms → inputValues
  useEffect(() => {
    if (platforms.length > 0) {
      console.log('🔍 [SYNC] Sincronizando platforms → inputValues automáticamente');
      syncPlatformsToInputs(platforms);
    }
  }, [platforms]);

  // 🔧 FIX: Autosave deshabilitado para corregir problema de persistencia
  // useEffect(() => {
  //   if (!ENABLE_AUTOSAVE) return;
  //   if (!user) return;
  //   if (saving) return; // CRÍTICO: No ejecutar autosave durante guardado manual
  //   
  //   // Preparar mapa de valores a guardar
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
  //       // Autosave solo para el usuario actual (modelo)
  //       const res = await fetch('/api/calculator/model-values-v2', {
  //         method: 'POST',
  //         headers: { 'Content-Type': 'application/json' },
  //         body: JSON.stringify({ modelId: user.id, values, periodDate }),
  //         signal: controller.signal
  //       });
  //       const json = await res.json();
  //       if (!json.success) {
  //         console.warn('⚠️ [AUTOSAVE] Error guardando automáticamente:', json.error);
  //       }
  //     } catch (e) {
  //       console.warn('⚠️ [AUTOSAVE] Excepción en autosave:', e);
  //     }
  //   }, 800);

  //   return () => {
  //     controller.abort();
  //     clearTimeout(t);
  //   };
  // }, [ENABLE_AUTOSAVE, user?.id, periodDate]); // OPTIMIZADO: Removido 'platforms' para evitar bucle infinito

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

  // Solo permitir acceso a modelos
  const allowed = Boolean(user && user.role === 'modelo');

  if (!allowed) {
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
              Bienvenida, {user?.name || 'Usuario'} · Ingresa tus valores por plataforma
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
            >
              ← Volver
            </button>
          </div>
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
                onClick={() => {
                  if (user?.id) {
                    setValuesLoaded(false); // Resetear para permitir recarga
                    setConfigLoaded(false); // Resetear para permitir recarga de config
                    loadCalculatorConfig(user.id);
                  }
                }}
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
                                // 🔧 SYNC: Actualizar inputValues
                                setInputValues(prev => ({ ...prev, [platform.id]: safeNormalized }));

                                // 🔧 SYNC: Convertir a número y actualizar platforms.value
                                const numeric = Number.parseFloat(safeNormalized);
                                const value = Number.isFinite(numeric) ? numeric : 0;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value } : p));
                                
                                console.log('🔍 [SYNC] Usuario escribió:', { platform: platform.id, input: safeNormalized, numeric: value });
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

        {/* Botón Guardar integrado en Totales y Alertas (autosave deshabilitado) */}

        {/* Totales y Alertas - COMPACTO */}
        <div className="apple-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Totales y Alertas</h3>
            <button
              onClick={saveValues}
              disabled={saving || platforms.filter(p => p.enabled).length === 0}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          
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
            const totalUsdBruto = platforms.reduce((sum, p) => {
              // Calcular USD bruto usando fórmulas específicas (sin porcentaje de reparto)
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
                } else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') {
                  usdBruto = p.value;
                } else {
                  usdBruto = p.value;
                }
              }
              return sum + usdBruto;
            }, 0);
            const cuotaMinima = platforms[0]?.minQuota || 470;
            const porcentajeAlcanzado = (totalUsdBruto / cuotaMinima) * 100;
            const estaPorDebajo = totalUsdBruto < cuotaMinima;
            
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
                          {estaPorDebajo ? 'Objetivo básico Pendiente' : 'Objetivo básico Alcanzado'}
                        </div>
                        <div className={`text-xs font-medium ${
                          estaPorDebajo ? 'text-red-700' : 'text-green-700'
                        }`}>
                          {estaPorDebajo 
                            ? `Faltan $${Math.ceil(cuotaMinima - totalUsdBruto)} USD (${Math.ceil(100 - porcentajeAlcanzado)}% restante)`
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
