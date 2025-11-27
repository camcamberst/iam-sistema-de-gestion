'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { getColombiaDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';
import { isClosureDay, isEarlyFreezeRelevantDay } from '@/utils/period-closure-dates';

// 🔧 FORCE DYNAMIC: Mantener para asegurar datos frescos
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
  payment_frequency?: 'quincenal' | 'mensual'; // 🔧 NUEVO: Frecuencia de pago
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
  anticipoSugeridoCop: number;
}

export default function ModelCalculatorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [rates, setRates] = useState<any>(null);
  // 🔧 Usar fecha de INICIO DEL PERIODO para cargar/guardar siempre en el mismo "bucket"
  // Esto evita que los valores se reinicien diariamente.
  const [periodDate, setPeriodDate] = useState<string>(getColombiaPeriodStartDate());
  
  // 🔧 CRÍTICO: Actualizar periodDate cada vez que se monte el componente
  useEffect(() => {
    const currentStart = getColombiaPeriodStartDate();
    console.log('🔍 [CALCULATOR] Initializing periodDate:', currentStart);
    setPeriodDate(currentStart);
  }, []);

  const [results, setResults] = useState<CalculatorResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [valuesLoaded, setValuesLoaded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  // 🔧 FIX: Usar estado para valores iniciales para detectar cambios reales
  const [initialValues, setInitialValues] = useState<Record<string, number>>({});
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [frozenPlatforms, setFrozenPlatforms] = useState<string[]>([]); // 🔒 Plataformas congeladas
  // 🔧 NUEVO: Estados para plataformas mensuales en P2
  const [p1Values, setP1Values] = useState<Record<string, number>>({}); // Valores de P1 para plataformas mensuales
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, string>>({}); // Total mensual ingresado
  const [isPeriod2, setIsPeriod2] = useState<boolean>(false); // Si estamos en P2
  // 🔧 NUEVO: Estado para input flotante de P1
  const [editingP1Platform, setEditingP1Platform] = useState<string | null>(null); // ID de plataforma siendo editada
  const [p1InputValue, setP1InputValue] = useState<string>(''); // Valor temporal del input
  const [p1InputPosition, setP1InputPosition] = useState<{ top: number; left: number } | null>(null); // Posición del input flotante
  const router = useRouter();
  // Eliminado: Ya no maneja parámetros de admin
  // Sistema V2 siempre activo (sin flags de entorno)
  // 🔧 FIX: Autosave solo después de 2 minutos de inactividad
  const ENABLE_AUTOSAVE = true; // Habilitado con delay de inactividad
  // Animaciones deshabilitadas: sin lógica extra
  useEffect(() => {}, []);
  // 🔧 HELPER: Funciones de sincronización bidireccional
  const syncPlatformsToInputs = (platforms: Platform[]) => {
    const newInputValues: Record<string, string> = {};
    platforms.forEach(p => {
      if (p.enabled) {
        // 🔧 FIX: Mostrar todos los valores reales, incluyendo 0
        newInputValues[p.id] = (p.value !== undefined && p.value !== null) ? String(p.value) : '';
      }
    });
    setInputValues(prev => ({ ...prev, ...newInputValues }));
  };

  // 🔧 NUEVO: Cerrar input flotante al hacer click fuera o presionar Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingP1Platform && p1InputPosition) {
        const target = e.target as HTMLElement;
        // Cerrar si el click no es dentro del input flotante
        if (!target.closest('.fixed.z-50')) {
          setEditingP1Platform(null);
          setP1InputPosition(null);
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingP1Platform) {
        setEditingP1Platform(null);
        setP1InputPosition(null);
      }
    };

    if (editingP1Platform) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [editingP1Platform, p1InputPosition]);

  // Derivado único: filas computadas exactamente como se muestran en la tabla
  const computedRows = useMemo(() => {
    if (!rates) return [] as Array<{ id: string; name: string; usdModelo: number; copModelo: number; percentageLabel: string; currency?: string; value: number }>;
    const rows = platforms
      .filter(p => p.enabled)
      .map(p => {
        const usdBase = getUsdBaseFromPlatform(p, p.value, rates);
        const usdModelo = getModeloShare(p, usdBase);
        const copModelo = usdModelo * (rates?.usd_cop || 3900);
        const pct = getFinalPercentage(p);
        const isSuper = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim() === 'superfoon' || String(p.id || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim() === 'superfoon';
        const percentageLabel = isSuper ? '100%' : `${pct}%`;
        return { id: p.id, name: p.name, usdModelo, copModelo, percentageLabel, currency: p.currency, value: p.value };
      });
    return rows;
  }, [platforms, rates]);

  // Total exacto mostrado en la tabla
  const exactUsdFromTable = useMemo(() => {
    return computedRows.reduce((s, r) => s + r.usdModelo, 0);
  }, [computedRows]);

  const syncInputsToPlatforms = (inputValues: Record<string, string>) => {
    setPlatforms(prev => prev.map(p => {
      const inputValue = inputValues[p.id];
      const numeric = Number.parseFloat(inputValue || '0');
      const value = Number.isFinite(numeric) ? numeric : 0;
      return { ...p, value };
    }));
  };

  // Helpers unificados de cálculo
  const getUsdBaseFromPlatform = (p: any, value: number, rates: any): number => {
    const id = String(p.id || '').toLowerCase();
    const currency = p.currency || 'USD';
    if (currency === 'EUR') {
      if (id === 'big7') return (value * (rates?.eur_usd || 1.01)) * 0.84;
      if (id === 'mondo') return (value * (rates?.eur_usd || 1.01)) * 0.78;
      return value * (rates?.eur_usd || 1.01);
    }
    if (currency === 'GBP') {
      if (id === 'aw') return (value * (rates?.gbp_usd || 1.20)) * 0.677;
      return value * (rates?.gbp_usd || 1.20);
    }
    if (currency === 'USD') {
      if (id === 'cmd' || id === 'camlust' || id === 'skypvt') return value * 0.75;
      if (id === 'chaturbate' || id === 'myfreecams' || id === 'stripchat') return value * 0.05;
      if (id === 'dxlive') return value * 0.60;
      if (id === 'secretfriends') return value * 0.5;
      return value;
    }
    return value;
  };

  const getFinalPercentage = (p: any): number => {
    const isSuper = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim() === 'superfoon' || String(p.id || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim() === 'superfoon';
    if (isSuper) return 100;
    if (typeof p.percentage_override === 'number') return p.percentage_override;
    if (typeof p.group_percentage === 'number') return p.group_percentage;
    return p.percentage || 60;
  };

  const getModeloShare = (p: any, usdBase: number): number => {
    const pct = getFinalPercentage(p);
    return (usdBase * pct) / 100;
  };

  // Calcular totales consolidados
  const calculateAndSaveTotals = async (currentPlatforms: Platform[]) => {
    if (!user || !rates) return;

    const totalUsdBruto = currentPlatforms.reduce((sum, p) => {
      if (!p.enabled) return sum;
      return sum + getUsdBaseFromPlatform(p, p.value, rates);
    }, 0);

    const totalUsdModelo = currentPlatforms.reduce((sum, p) => {
        if (!p.enabled) return sum;
        const usdBase = getUsdBaseFromPlatform(p, p.value, rates);
        const share = getModeloShare(p, usdBase);
        return sum + share;
      }, 0);
  };

  // 🔧 NUEVO: Función para calcular ganancias del día
  const calculateTodayEarnings = async (platforms: Platform[], yesterdayValues: Record<string, number>, rates: any) => {
    // Calcular USD modelo de hoy
    let todayUsdModelo = 0;
    for (const p of platforms) {
      if (!p.enabled || p.value <= 0) continue;
      
      let usdModelo = 0;
      if (p.currency === 'EUR') {
        if (p.id === 'big7') {
          usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
        } else if (p.id === 'mondo') {
          usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
        } else if (p.id === 'superfoon') {
          usdModelo = p.value * (rates?.eur_usd || 1.01); // EUR a USD directo
        } else if (p.id === 'modelka' || p.id === 'xmodels' || p.id === '777' || p.id === 'vx' || p.id === 'livecreator' || p.id === 'mow') {
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
        } else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') {
          usdModelo = p.value;
        } else {
          usdModelo = p.value;
        }
      }
      
      // Aplicar porcentaje (excepto superfoon que es 100%)
      if (p.id === 'superfoon') {
        todayUsdModelo += usdModelo; // 100% directo
      } else {
        todayUsdModelo += usdModelo * p.percentage / 100;
      }
    }

    // Calcular USD modelo de ayer
    let yesterdayUsdModelo = 0;
    for (const p of platforms) {
      if (!p.enabled) continue;
      
      const yesterdayValue = yesterdayValues[p.id] || 0;
      if (yesterdayValue <= 0) continue;
      
      let usdModelo = 0;
      if (p.currency === 'EUR') {
        if (p.id === 'big7') {
          usdModelo = (yesterdayValue * (rates?.eur_usd || 1.01)) * 0.84;
        } else if (p.id === 'mondo') {
          usdModelo = (yesterdayValue * (rates?.eur_usd || 1.01)) * 0.78;
        } else if (p.id === 'superfoon') {
          usdModelo = yesterdayValue * (rates?.eur_usd || 1.01); // EUR a USD directo
        } else if (p.id === 'modelka' || p.id === 'xmodels' || p.id === '777' || p.id === 'vx' || p.id === 'livecreator' || p.id === 'mow') {
          usdModelo = yesterdayValue * (rates?.eur_usd || 1.01);
        } else {
          usdModelo = yesterdayValue * (rates?.eur_usd || 1.01);
        }
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') {
          usdModelo = (yesterdayValue * (rates?.gbp_usd || 1.20)) * 0.677;
        } else {
          usdModelo = yesterdayValue * (rates?.gbp_usd || 1.20);
        }
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
          usdModelo = yesterdayValue * 0.75;
        } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
          usdModelo = yesterdayValue * 0.05;
        } else if (p.id === 'dxlive') {
          usdModelo = yesterdayValue * 0.60;
        } else if (p.id === 'secretfriends') {
          usdModelo = yesterdayValue * 0.5;
        } else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') {
          usdModelo = yesterdayValue;
        } else {
          usdModelo = yesterdayValue;
        }
      }
      
      // Aplicar porcentaje (excepto superfoon que es 100%)
      if (p.id === 'superfoon') {
        yesterdayUsdModelo += usdModelo; // 100% directo
      } else {
        yesterdayUsdModelo += usdModelo * p.percentage / 100;
      }
    }

    const earnings = todayUsdModelo - yesterdayUsdModelo;
    setTodayEarnings(earnings);
    console.log('🔍 [CALCULATOR] Today earnings calculated:', { todayUsdModelo, yesterdayUsdModelo, earnings });
    
    // 🔧 NUEVO: Guardar ganancias del día en la base de datos
    if (user?.id && earnings !== 0) {
      try {
        const response = await fetch('/api/daily-earnings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: user.id,
            earnings: earnings,
            date: new Date().toISOString().split('T')[0]
          })
        });
        
        if (response.ok) {
          console.log('✅ [CALCULATOR] Daily earnings saved to database:', earnings);
        } else {
          console.warn('⚠️ [CALCULATOR] Failed to save daily earnings to database');
        }
      } catch (error) {
        console.error('❌ [CALCULATOR] Error saving daily earnings:', error);
      }
    }
    
    return earnings;
  };
  
  // Estado para almacenar valores de ayer
  const [yesterdayValues, setYesterdayValues] = useState<Record<string, number>>({});

  // 🔧 NUEVO: Recalcular ganancias cuando cambien los valores o las tasas
  useEffect(() => {
    const recalculate = async () => {
      if (platforms.length > 0 && rates) {
        console.log('🔍 [CALCULATOR] Recalculating today earnings from database data...', {
          platformsCount: platforms.length,
          hasRates: !!rates,
          yesterdayValuesCount: Object.keys(yesterdayValues).length
        });
        await calculateTodayEarnings(platforms, yesterdayValues, rates);
      }
    };
    recalculate();
  }, [platforms, rates, yesterdayValues]);

  const loadCalculatorConfig = async (userId: string) => {
    try {
      console.log('🔍 [CALCULATOR] Loading config for userId:', userId);
      
      // 1. Get Config
      console.log('🔍 [CALCULATOR] Fetching config for userId:', userId);
      const configRes = await fetch(`/api/calculator/config-v2?userId=${userId}`);
      console.log('🔍 [CALCULATOR] Config response status:', configRes.status);
      const configData = await configRes.json();
      console.log('🔍 [CALCULATOR] Config data:', configData);

      if (!configData.success) {
        console.error('❌ [CALCULATOR] Config error:', configData.error);
        throw new Error(configData.error || 'Error cargando configuración');
      }

      console.log('🔍 [CALCULATOR] Platforms received:', configData.config?.platforms);
      
      if (configData.success) {
        console.log('🔍 [CALCULATOR] Config success: true');
        const defaultPlatforms: Platform[] = (configData.config?.platforms || []).map((platform: any) => {
          // DEBUG: Log de datos crudos de plataforma
          console.log('🔍 [CALCULATOR] DEBUG - Platform raw data:', platform);
          
          // Lógica de prioridad para el porcentaje:
          // 1. Si es superfoon (por nombre o ID) -> 100% siempre
          // 2. Override manual específico (percentage_override)
          // 3. Porcentaje del grupo (group_percentage)
          // 4. Porcentaje base de la plataforma (percentage)
          // 5. Fallback a 60%
          
          const isSuper = String(platform.name || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim() === 'superfoon' || String(platform.id || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim() === 'superfoon';
          
          let finalPercentage = 60; // Fallback
          
          if (isSuper) {
            finalPercentage = 100;
          } else if (typeof platform.percentage_override === 'number' && platform.percentage_override >= 0) {
            finalPercentage = platform.percentage_override;
          } else if (typeof platform.group_percentage === 'number' && platform.group_percentage >= 0) {
            finalPercentage = platform.group_percentage;
          } else if (typeof platform.percentage === 'number') {
            finalPercentage = platform.percentage;
          }

          console.log('🔍 [CALCULATOR] DEBUG - Final percentage calculation:', {
            id: platform.id,
            percentage_override: platform.percentage_override,
            group_percentage: platform.group_percentage,
            final_percentage: finalPercentage,
            using_fallback: finalPercentage === 60 && platform.percentage !== 60
          });

          return {
            id: platform.id,
            name: platform.name,
            enabled: true,
            value: 0,
            percentage: finalPercentage,
            minQuota: platform.min_quota_override || platform.group_min_quota || 470,
            currency: platform.currency || 'USD', // CRÍTICO: Agregar currency
            // Guardar valores originales para debug
            percentage_override: platform.percentage_override,
            group_percentage: platform.group_percentage,
            payment_frequency: platform.payment_frequency || 'quincenal' // 🔧 NUEVO
          };
        });

        console.log('🔍 [CALCULATOR] Enabled platforms:', defaultPlatforms);
        
        // Debug detallado de porcentajes
        console.log('🔍 [CALCULATOR] Platform details:', defaultPlatforms.map(p => ({
          id: p.id,
          name: p.name,
          percentage: p.percentage,
          percentage_override: p.percentage_override,
          group_percentage: p.group_percentage
        })));

        console.log('🔍 [CALCULATOR] DEBUG - Platform percentage data:', defaultPlatforms.map(p => ({
          id: p.id,
          name: p.name,
          final_percentage: p.percentage,
          raw_override: p.percentage_override,
          raw_group: p.group_percentage
        })));

        setRates(configData.config?.rates);
        console.log('🔍 [CALCULATOR] setPlatforms called with:', defaultPlatforms.length, 'platforms');
        setPlatforms(defaultPlatforms);
        
        // 🔧 SYNC: Sincronizar inputs con plataformas cargadas (inicialmente 0)
        // syncPlatformsToInputs(defaultPlatforms);
        
        setConfigLoaded(true); // Marcar configuración como cargada
        return defaultPlatforms;
      }
    } catch (err: any) {
      console.error('Error loading config:', err);
      setError(err.message || 'Error al cargar configuración');
      return [];
    }
  };

  const loadSavedValues = async (userId: string, currentPlatforms: Platform[]) => {
    try {
      console.log('🔍 [CALCULATOR] Loading saved values - V2 system only');
      
      // Cargar valores del día actual
      console.log('🔍 [CALCULATOR] Fetching saved values (v2) for date:', periodDate);
      const valuesRes = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}`);
      const valuesData = await valuesRes.json();
      console.log('🔍 [CALCULATOR] Saved values (v2):', valuesData);

      // Cargar valores de P1 si estamos en P2
      // Determinar si estamos en P2 (16-fin de mes)
      const day = new Date(periodDate).getDate();
      const isP2 = day >= 16;
      setIsPeriod2(isP2);
      
      if (isP2) {
        const p1Date = new Date(periodDate);
        p1Date.setDate(1); // Primer día del mes
        const p1DateStr = p1Date.toISOString().split('T')[0];
        
        console.log('🔍 [CALCULATOR] Fetching P1 values for monthly logic:', p1DateStr);
        const p1Res = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${p1DateStr}`);
        const p1Data = await p1Res.json();
        
        if (p1Data.success && p1Data.data) {
          const p1Map: Record<string, number> = {};
          p1Data.data.forEach((item: any) => {
            p1Map[item.platform_id] = item.value;
          });
          setP1Values(p1Map);
          console.log('🔍 [CALCULATOR] P1 Values loaded:', p1Map);
        }
      }

      if (valuesData.success && valuesData.data) {
        // Crear mapa de valores encontrados
        const savedValuesMap = valuesData.data.reduce((acc: any, item: any) => {
          acc[item.platform_id] = item.value;
          return acc;
        }, {});
        
        console.log('🔍 [CALCULATOR] Valores encontrados en API:', savedValuesMap);

        // Actualizar plataformas con valores guardados
        console.log('🔍 [CALCULATOR] Plataformas habilitadas:', currentPlatforms);
        const updatedPlatforms = currentPlatforms.map(p => {
          const savedValue = savedValuesMap[p.id];
          // Usar savedValue si existe (incluso si es 0), sino mantener 0
          const finalValue = (savedValue !== undefined && savedValue !== null) ? Number(savedValue) : 0;
          return {
            ...p,
            value: finalValue
          };
        });
        
        // Guardar estado de congelación si existe
        // V2 usa is_frozen en la respuesta de valores o un endpoint separado
        // Por ahora asumimos que no hay congelación en V2 hasta implementar esa lógica
        // if (valuesData.frozen) setFrozenPlatforms(valuesData.frozen);

        console.log('🔍 [CALCULATOR] Plataformas actualizadas:', updatedPlatforms);
        setPlatforms(updatedPlatforms);
        
        // 🔧 FIX: Actualizar inputs explícitamente con los valores cargados
        syncPlatformsToInputs(updatedPlatforms);
        
        // 🔧 FIX: Guardar valores iniciales para comparación de cambios
        const initialVals: Record<string, number> = {};
        updatedPlatforms.forEach(p => {
          initialVals[p.id] = p.value;
        });
        setInitialValues(initialVals);
        
        setValuesLoaded(true);
        
        // 🔧 NUEVO: Cargar valores de ayer para calcular ganancias del día
        // Calcular fecha de ayer
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        console.log('🔍 [CALCULATOR] Loading yesterday values for date:', yesterdayStr);
        const yesterdayRes = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${yesterdayStr}`);
        const yesterdayData = await yesterdayRes.json();
        console.log('🔍 [CALCULATOR] Yesterday values response:', yesterdayData);
        
        if (yesterdayData.success && yesterdayData.data) {
          const yesterdayMap = yesterdayData.data.reduce((acc: any, item: any) => {
            acc[item.platform_id] = item.value;
            return acc;
          }, {});
          setYesterdayValues(yesterdayMap);
          console.log('🔍 [CALCULATOR] Yesterday values loaded successfully:', yesterdayMap);
          
          // Calcular ganancias iniciales
          if (rates) {
            await calculateTodayEarnings(updatedPlatforms, yesterdayMap, rates);
          }
        }
        
        console.log('🔍 [CALCULATOR] Valores guardados aplicados y sincronizados');
      }
    } catch (err: any) {
      console.error('Error loading saved values:', err);
      setError(err.message || 'Error al cargar valores guardados');
    } finally {
      setLoading(false);
    }
  };

  // Efecto de carga inicial
  useEffect(() => {
    const load = async () => {
      try {
        // 1. Check session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth/login');
          return;
        }

        // 2. Get User Profile
        const { data: userProfile, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userProfile) {
          console.error('Error fetching user profile:', userError);
          return;
        }

        // Verificar que el rol sea 'modelo'
        if (userProfile.role !== 'modelo') {
          console.warn('Usuario no es modelo:', userProfile.role);
          setError('Acceso denegado: Solo para modelos');
          setLoading(false);
          return;
        }

        setUser(userProfile as User);

        // 3. Load Config & Values (Sequential to ensure config exists first)
        const platforms = await loadCalculatorConfig(userProfile.id);
        if (platforms.length > 0) {
          await loadSavedValues(userProfile.id, platforms);
        } else {
          setLoading(false);
        }
        
        // 4. Check frozen status (early freeze)
        try {
          // Verificar si estamos en periodo de cierre temprano para las plataformas
          // Esto es para saber si debemos bloquear la edición
          const checkFreeze = await fetch(`/api/calculator/check-freeze?userId=${userProfile.id}&date=${periodDate}`);
          const freezeData = await checkFreeze.json();
          if (freezeData.success && freezeData.frozenPlatforms) {
            console.log('🔒 [CALCULATOR] Plataformas congeladas:', freezeData.frozenPlatforms);
            setFrozenPlatforms(freezeData.frozenPlatforms);
          }
        } catch (freezeErr) {
          console.warn('⚠️ [CALCULATOR] Error checking freeze status:', freezeErr);
          // No bloquear si hay error en este check no crítico
          setFrozenPlatforms([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodDate]);

  // 🔒 ACTUALIZACIÓN PERIÓDICA: Actualizar estado de congelación durante días relevantes para early freeze
  // Esto asegura que si el usuario tiene la página abierta cuando pasa la medianoche Europa Central,
  // el estado se actualice automáticamente sin necesidad de recargar la página
  useEffect(() => {
    // Actualizar durante días relevantes para early freeze (1, 16, 31, 15)
    // El día 31/15 es cuando puede pasar medianoche Europa Central y activarse el early freeze
    if (!isEarlyFreezeRelevantDay() || !user?.id) return;
    
    console.log('🔒 [CALCULATOR] Día relevante para early freeze detectado - activando actualización periódica de congelación');
    
    const updateFrozenStatus = async () => {
      try {
        const checkFreeze = await fetch(`/api/calculator/check-freeze?userId=${user.id}&date=${periodDate}`);
        const freezeData = await checkFreeze.json();
        if (freezeData.success && freezeData.frozenPlatforms) {
          const currentFrozen = JSON.stringify(frozenPlatforms.sort());
          const newFrozen = JSON.stringify(freezeData.frozenPlatforms.sort());
          
          if (currentFrozen !== newFrozen) {
            console.log('🔒 [CALCULATOR] Estado de congelación actualizado:', freezeData.frozenPlatforms);
            setFrozenPlatforms(freezeData.frozenPlatforms);
            
            // Si hay nuevas plataformas congeladas, recargar la página para mostrar alertas
            if (freezeData.frozenPlatforms.length > frozenPlatforms.length) {
              // Opcional: Mostrar toast/alerta antes
              console.log('🔒 [CALCULATOR] Nuevas plataformas congeladas, actualizando UI...');
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ [CALCULATOR] Error actualizando estado de congelación:', e);
      }
    };

    // Revisar cada 60 segundos
    const interval = setInterval(updateFrozenStatus, 60000);
    return () => clearInterval(interval);
  }, [user, periodDate, frozenPlatforms]);

  // Log de sistema para debugging
  useEffect(() => {
    console.log('🔍 [CALCULATOR] System configuration:', {
      ENABLE_AUTOSAVE,
      SYSTEM_VERSION: 'V2_ONLY' // Solo usamos V2 ahora
    });
  }, []);

  // Handlers
  const handleInputChange = (id: string, rawValue: string) => {
    // Si la plataforma está congelada, no permitir cambios
    if (frozenPlatforms.includes(id.toLowerCase())) {
      console.log(`🔒 [CALCULATOR] Plataforma ${id} está congelada, edición bloqueada`);
      return;
    }

    // Permitir input vacío o números con decimales
    if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
      // Actualizar input state inmediatamente para UX fluida
      setInputValues(prev => ({ ...prev, [id]: rawValue }));
      
      // Actualizar platform value
      const numericValue = rawValue === '' ? 0 : parseFloat(rawValue);
      setPlatforms(prev => prev.map(p => {
        if (p.id === id) {
          return { ...p, value: numericValue };
        }
        return p;
      }));
    }
  };

  const handleSaveP1Value = (platformId: string) => {
    const value = Number.parseFloat(p1InputValue) || 0;
    setP1Values(prev => ({ ...prev, [platformId]: value }));
    
    // Si ya hay un total mensual, recalcular P2
    if (monthlyTotals[platformId]) {
      const monthlyTotal = Number.parseFloat(monthlyTotals[platformId]) || 0;
      const p2Value = monthlyTotal - value;
      
      setInputValues(prev => ({ ...prev, [platformId]: p2Value > 0 ? String(p2Value) : '' }));
      setPlatforms(prev => prev.map(p => p.id === platformId ? { ...p, value: p2Value } : p));
    }
    
    setEditingP1Platform(null);
    setP1InputPosition(null);
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      setError(null);

      // 1. Guardar valores actuales (V2)
      // Filtrar plataformas congeladas para no sobrescribirlas accidentalmente
      // (aunque el backend también debería proteger esto)
      const enabled = platforms.filter(p => {
        const isFrozen = frozenPlatforms.includes(p.id.toLowerCase());
        if (isFrozen) return false; // No guardar congeladas
        return p.enabled && p.value > 0; // Guardar solo valores positivos > 0 para ahorrar espacio
      });
      
      // Construir objeto de valores: { [platformId]: value }
      const valuesToSave = enabled.reduce((acc, p) => {
        acc[p.id] = p.value;
        return acc;
      }, {} as Record<string, number>);

      const payload = {
        modelId: user.id,
        values: valuesToSave,
        periodDate: periodDate // Usar fecha de inicio de periodo
      };

      const endpoint = '/api/calculator/model-values-v2';
      
      console.log('🔍 [CALCULATOR] Saving to endpoint:', endpoint);
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

      // 2. Calcular y guardar totales consolidados usando función auxiliar
      console.log('🔍 [CALCULATOR] Calculating totals for billing summary...');
      await calculateAndSaveTotals(platforms);

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

  // 🔧 SYNC DISABLED: Sincronización automática deshabilitada para evitar interferencia con decimales
  // useEffect(() => {
  //   if (platforms.length > 0 && !valuesLoaded) {
  //     console.log('🔍 [SYNC] Sincronizando platforms → inputValues automáticamente (carga inicial)');
  //     syncPlatformsToInputs(platforms);
  //   }
  // }, [platforms, valuesLoaded]);

  // 🔧 FIX: Autosave con 2 minutos de inactividad para persistencia
  useEffect(() => {
    if (!ENABLE_AUTOSAVE) return;
    if (!user) return;
    if (saving) return; // CRÍTICO: No ejecutar autosave durante guardado manual
    
    // 🔒 Preparar mapa de valores a guardar (excluir plataformas congeladas del autosave)
    const enabled = platforms.filter(p => {
      const isFrozen = frozenPlatforms.includes(p.id.toLowerCase());
      return p.enabled && p.value > 0 && !isFrozen;
    });
    const values: Record<string, number> = enabled.reduce((acc, p) => {
      acc[p.id] = p.value;
      return acc;
    }, {} as Record<string, number>);

    const hasAny = Object.keys(values).length > 0;
    if (!hasAny) return;

    const controller = new AbortController();
    // 🔧 NUEVO: 40 segundos (40,000ms) de inactividad antes de autosave
    const t = setTimeout(async () => {
      try {
        console.log('🔄 [AUTOSAVE] Guardando después de 40 segundos de inactividad...');
        // Autosave solo para el usuario actual (modelo)
        const res = await fetch('/api/calculator/model-values-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: user.id, values, periodDate }),
          signal: controller.signal
        });
        const json = await res.json();
        if (!json.success) {
          console.warn('⚠️ [AUTOSAVE] Error guardando automáticamente:', json.error);
        } else {
          console.log('✅ [AUTOSAVE] Valores guardados automáticamente después de inactividad');
          
          // 🔧 CRÍTICO: Calcular y guardar totales después del autosave
          // Usar todas las plataformas (incluyendo congeladas) para el cálculo de totales
          await calculateAndSaveTotals(platforms);
          console.log('✅ [AUTOSAVE] Totales calculados y guardados automáticamente');
        }
      } catch (e) {
        console.warn('⚠️ [AUTOSAVE] Excepción en autosave:', e);
      }
    }, 40000); // 40 segundos = 40,000ms

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [platforms, user, saving, periodDate, rates]); // Incluir rates para calcular totales

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando calculadora...</p>
        </div>
      </div>
    );
  }

  // Solo permitir acceso a modelos
  const allowed = Boolean(user && user.role === 'modelo');

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
        <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-600/20 p-8 max-w-md dark:shadow-lg dark:shadow-red-900/15 dark:ring-0.5 dark:ring-red-400/20">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  

  return (
    <>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Volver</span>
            </button>
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-1 whitespace-nowrap truncate">
                Mi Calculadora
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
                Bienvenida, {user?.name || 'Usuario'} · Ingresa tus valores por plataforma
              </p>
            </div>
          </div>
        </div>

        {/* Tasas actualizadas - ESTILO APPLE REFINADO */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-4 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Tasas Actualizadas
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
              <div className="text-xl font-bold text-blue-700 mb-1">
                ${rates?.usd_cop || 3900}
              </div>
              <div className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">USD→COP</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
              <div className="text-xl font-bold text-green-700 mb-1">
                {rates?.eur_usd || 1.01}
              </div>
              <div className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">EUR→USD</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
              <div className="text-xl font-bold text-purple-700 mb-1">
                {rates?.gbp_usd || 1.20}
              </div>
              <div className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">GBP→USD</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center font-medium">
            Configuradas por tu administrador
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 mb-6 dark:shadow-lg dark:shadow-red-900/15 dark:ring-0.5 dark:ring-red-400/20">
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Error al cargar calculadora</h4>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Tu administrador aún no ha configurado las plataformas para tu calculadora.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Contacta a tu administrador para que habilite las plataformas que usarás.
              </p>
            </div>
          </div>
        )}

        {/* Tabla de Calculadora - ESTILO APPLE REFINADO */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Calculadora de Ingresos
          </h2>
          
          {(() => {
            console.log('🔍 [RENDER] platforms.length:', platforms.length);
            console.log('🔍 [RENDER] platforms:', platforms);
            console.log('🔍 [RENDER] enabled platforms:', platforms.filter(p => p.enabled).length);
            return platforms.filter(p => p.enabled).length === 0;
          })() ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay plataformas habilitadas</h4>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Tu administrador aún no ha configurado las plataformas para tu calculadora.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Contacta a tu administrador para que habilite las plataformas que usarás.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200/50 dark:border-gray-600/50 bg-gray-50/50 dark:bg-gray-600/50 backdrop-blur-sm">
                    <th className="text-left py-3 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">PLATAFORMAS</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">VALORES</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">DÓLARES</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">COP MODELO</th>
                  </tr>
                </thead>
                <tbody>
                  {computedRows.map(row => {
                    
                    return (
                      <tr key={row.id} className="border-b border-gray-100 dark:border-gray-600">
                        <td className="py-3 px-3 relative">
                          {/* 🔧 FIX: Nombre clickeable para ingresar P1 - Versión simplificada (igual a view-model) */}
                          <div 
                            className="font-medium text-gray-900 dark:text-gray-100 text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors inline-block mb-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setEditingP1Platform(row.id);
                              setP1InputValue(String(p1Values[row.id] || ''));
                              setP1InputPosition({
                                top: rect.bottom + 5,
                                left: rect.left
                              });
                            }}
                            title="Click para ingresar valor de P1"
                          >
                            {row.name}
                          </div>
                          <div className="flex items-center space-x-3 mb-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Reparto: {row.percentageLabel}
                            </div>
                            {/* 🔧 NUEVO: Checkbox para marcar como mensual */}
                            {(() => {
                              const platform = platforms.find(p => p.id === row.id);
                              return (
                                <label 
                                  htmlFor={`monthly-${row.id}`} 
                                  className="flex items-center space-x-1.5 cursor-pointer group hover:bg-purple-50 dark:hover:bg-purple-900/20 px-2 py-1 rounded-md transition-colors"
                                  title="Marcar como pago mensual (requiere restar P1 en P2)"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    id={`monthly-${row.id}`}
                                    checked={platform?.payment_frequency === 'mensual'}
                                    onChange={async (e) => {
                                      const newFrequency = e.target.checked ? 'mensual' : 'quincenal';
                                      try {
                                        const response = await fetch('/api/calculator/platforms', {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            platformId: row.id,
                                            payment_frequency: newFrequency
                                          })
                                        });
                                        const data = await response.json();
                                        if (data.success) {
                                          // Actualizar estado local
                                          setPlatforms(prev => prev.map(p => 
                                            p.id === row.id 
                                              ? { ...p, payment_frequency: newFrequency }
                                              : p
                                          ));
                                          // Recargar configuración para reflejar el cambio
                                          if (user?.id) {
                                            await loadCalculatorConfig(user.id);
                                          }
                                        } else {
                                          alert('Error al actualizar: ' + (data.error || 'Error desconocido'));
                                        }
                                      } catch (error) {
                                        console.error('Error actualizando payment_frequency:', error);
                                        alert('Error al actualizar la frecuencia de pago');
                                      }
                                    }}
                                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 cursor-pointer"
                                  />
                                  <span className="text-xs font-medium text-purple-700 dark:text-purple-400 group-hover:text-purple-800 dark:group-hover:text-purple-300">
                                    📅 Mensual
                                  </span>
                                </label>
                              );
                            })()}
                          </div>
                          {/* 🔧 NUEVO: Input flotante para P1 */}
                          {editingP1Platform === row.id && p1InputPosition && (
                            <div
                              className="fixed z-50 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-lg shadow-xl p-3 min-w-[200px]"
                              style={{
                                top: `${p1InputPosition.top}px`,
                                left: `${p1InputPosition.left}px`
                              }}
                            >
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Ingresar valor de P1 para {row.name}
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={p1InputValue}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    const unifiedValue = rawValue.replace(',', '.');
                                    setP1InputValue(unifiedValue);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const value = Number.parseFloat(p1InputValue) || 0;
                                      setP1Values(prev => ({ ...prev, [row.id]: value }));
                                      
                                      // Recalcular P2 si hay total mensual
                                      if (monthlyTotals[row.id]) {
                                        const monthlyTotal = Number.parseFloat(monthlyTotals[row.id]) || 0;
                                        const p2Value = monthlyTotal - value;
                                        
                                        setInputValues(prev => ({ ...prev, [row.id]: p2Value > 0 ? String(p2Value) : '' }));
                                        setPlatforms(prev => prev.map(p => p.id === row.id ? { ...p, value: p2Value } : p));
                                      }
                                      
                                      setEditingP1Platform(null);
                                      setP1InputPosition(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingP1Platform(null);
                                      setP1InputPosition(null);
                                    }
                                  }}
                                  autoFocus
                                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="0.00"
                                />
                                <button
                                  onClick={() => handleSaveP1Value(row.id)}
                                  className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingP1Platform(null);
                                    setP1InputPosition(null);
                                  }}
                                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            {(() => {
                              const isFrozen = frozenPlatforms.includes(row.id.toLowerCase());
                              const platform = platforms.find(p => p.id === row.id);
                              const isMonthly = platform?.payment_frequency === 'mensual';
                              const showMonthlyFields = isPeriod2 && isMonthly;
                              
                              // Si es plataforma mensual en P2, mostrar dos campos
                              if (showMonthlyFields) {
                                const p1Value = p1Values[row.id] || 0;
                                const monthlyTotal = Number.parseFloat(monthlyTotals[row.id] || '0') || 0;
                                const p2Value = monthlyTotal - p1Value;
                                
                                return (
                                  <div className="flex flex-col space-y-2">
                                    {/* Campo: Total mensual */}
                                    <div className="flex items-center space-x-1">
                                      <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Total mensual:</label>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={monthlyTotals[row.id] ?? ''}
                                        onChange={(e) => {
                                          if (isFrozen) return;
                                          const rawValue = e.target.value;
                                          const unifiedValue = rawValue.replace(',', '.');
                                          setMonthlyTotals(prev => ({ ...prev, [row.id]: unifiedValue }));
                                          
                                          // Calcular P2 automáticamente
                                          const monthlyTotalNum = Number.parseFloat(unifiedValue) || 0;
                                          const p2Calculated = monthlyTotalNum - p1Value;
                                          
                                          // Actualizar inputValues con P2 (diferencia)
                                          setInputValues(prev => ({ ...prev, [row.id]: p2Calculated > 0 ? String(p2Calculated) : '' }));
                                          setPlatforms(prev => prev.map(p => p.id === row.id ? { ...p, value: p2Calculated } : p));
                                        }}
                                        disabled={isFrozen}
                                        className={`w-20 h-8 px-2 py-1 text-sm border rounded-md transition-all duration-200 ${
                                          isFrozen
                                            ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50'
                                        }`}
                                        placeholder="0.00"
                                        title="Total mensual de la plataforma"
                                      />
                                    </div>
                                    
                                    {/* Campo: P1 (editable) */}
                                    <div className="flex items-center space-x-1">
                                      <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">P1 (editable):</label>
                                      <div 
                                        className="text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setEditingP1Platform(row.id);
                                          setP1InputValue(String(p1Values[row.id] || ''));
                                          setP1InputPosition({
                                            top: rect.bottom + 5,
                                            left: rect.left
                                          });
                                        }}
                                        title="Click para editar P1"
                                      >
                                        {p1Values[row.id]?.toFixed(2) || '0.00'}
                                      </div>
                                    </div>
                                    
                                    {/* Resultado: P2 (calculado) */}
                                    <div className="text-xs text-gray-500 mt-1">
                                      P2 = {monthlyTotal.toFixed(2)} - {p1Value.toFixed(2)} = <strong>{p2Value.toFixed(2)}</strong>
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Renderizado normal para plataformas quincenales o P1
                              return (
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={inputValues[row.id] ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(',', '.');
                                    handleInputChange(row.id, val);
                                  }}
                                  disabled={isFrozen}
                                  className={`w-full px-3 py-2 text-sm border rounded-md transition-all duration-200 ${
                                    isFrozen
                                      ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50'
                                  }`}
                                  placeholder="0.00"
                                  title={isFrozen ? "Plataforma congelada por cierre de periodo" : "Ingresar valor"}
                                />
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                          {(() => {
                            // Mostrar el cálculo de USD bruto para verificar la tasa
                            const usdBase = getUsdBaseFromPlatform(
                              platforms.find(p => p.id === row.id) || { id: row.id, currency: row.currency }, 
                              platforms.find(p => p.id === row.id)?.value || 0, 
                              rates
                            );
                            
                            // Si es una divisa diferente a USD, mostrar el valor convertido
                            if (row.currency && row.currency !== 'USD') {
                              return (
                                <div>
                                  <div>${row.usdModelo.toFixed(2)} USD</div>
                                  <div className="text-xs text-gray-500 font-normal">
                                    (Bruto: ${usdBase.toFixed(2)})
                                  </div>
                                </div>
                              );
                            }
                            return `$${row.usdModelo.toFixed(2)} USD`;
                          })()}
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                          ${Math.round(row.copModelo).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
                    <td className="py-3 px-3 text-gray-900 dark:text-white">TOTALES</td>
                    <td className="py-3 px-3 text-gray-900 dark:text-white">
                      {computedRows.reduce((acc, r) => acc + r.value, 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-blue-600 dark:text-blue-400">
                      ${exactUsdFromTable.toFixed(2)} USD
                    </td>
                    <td className="py-3 px-3 text-green-600 dark:text-green-400">
                      ${Math.round(computedRows.reduce((s, r) => s + r.copModelo, 0)).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* 🔧 SYNC BUTTON DISABLED: Ya no es necesario */}
        {/* 
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => {
              if (platforms.length > 0) {
                console.log('🔄 [MANUAL-SYNC] Sincronizando manualmente...');
                syncPlatformsToInputs(platforms);
              }
            }}
            className="bg-gray-800 text-white p-2 rounded-full shadow-lg opacity-50 hover:opacity-100 transition-opacity"
            title="Sincronizar inputs (Debug)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        */}

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-700 p-4 md:hidden z-40">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 rounded-xl font-medium text-white shadow-lg transform transition-all duration-200 active:scale-95 ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </span>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </div>

        {/* Desktop Save Button */}
        <div className="hidden md:block fixed bottom-8 right-8 z-40">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-8 py-3 rounded-xl font-medium text-white shadow-lg transform transition-all duration-200 hover:-translate-y-1 ${
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/30'
            }`}
          >
            {saving ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Guardando...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <span>Guardar Cambios</span>
              </span>
            )}
          </button>
        </div>
    </>
  );
}