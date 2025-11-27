'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { getColombiaDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';
import { isClosureDay, isEarlyFreezeRelevantDay } from '@/utils/period-closure-dates';
import { InfoCardGrid } from '@/components/ui/InfoCard';
import ProgressMilestone from '@/components/ui/ProgressMilestone';

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
    const currentPeriodDate = getColombiaPeriodStartDate();
    if (periodDate !== currentPeriodDate) {
      console.log('🔄 [CALCULATOR] Actualizando periodDate:', { anterior: periodDate, nueva: currentPeriodDate });
      setPeriodDate(currentPeriodDate);
    }
    
    // 🔧 NUEVO: Detectar si estamos en P2 (día 16-31)
    const colombiaDate = getColombiaDate();
    const day = parseInt(colombiaDate.split('-')[2]);
    setIsPeriod2(day >= 16 && day <= 31);
  }, []); // Solo al montar
  // Mantener valores escritos como texto para permitir decimales con coma y punto
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [totalUsdModeloState, setTotalUsdModeloState] = useState<number>(0);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [valuesLoaded, setValuesLoaded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [yesterdayValues, setYesterdayValues] = useState<Record<string, number>>({});
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
    // USD
    if (id === 'cmd' || id === 'camlust' || id === 'skypvt') return value * 0.75;
    if (id === 'chaturbate' || id === 'myfreecams' || id === 'stripchat') return value * 0.05;
    if (id === 'dxlive') return value * 0.60;
    if (id === 'secretfriends') return value * 0.5;
    return value;
  };

  const getFinalPercentage = (p: any): number => {
    const parsePct = (val: any) => {
      if (val === null || val === undefined) return NaN;
      if (typeof val === 'number') return val;
      const num = Number(String(val).replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(num) ? num : NaN;
    };
    const candidates = [p.percentage, p.percentage_override, p.group_percentage];
    for (const c of candidates) {
      const n = parsePct(c);
      if (Number.isFinite(n)) return n;
    }
    return 80; // fallback sensato
  };

  const getModeloShare = (p: any, usdBase: number): number => {
    const norm = (s: any) => String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
    const id = norm(p.id);
    const name = norm(p.name);
    const isSuperfoon = (id === 'superfoon') || (name === 'superfoon');
    if (isSuperfoon) return usdBase; // 100% excepción
    const finalPct = getFinalPercentage(p);
    return usdBase * (finalPct / 100);
  };

  // Totalizador único para evitar discrepancias visuales
  const getTotalsModeloUsd = (platformList: Platform[], currentRates: any): number => {
    return platformList
      .filter(p => p.enabled)
      .reduce((sum, p) => {
        const usdBase = getUsdBaseFromPlatform(p, p.value, currentRates);
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

  // 🔧 NUEVO: Recalcular ganancias cuando cambien los inputs del usuario
  useEffect(() => {
    if (platforms.length > 0 && rates) {
      // Pequeño delay para evitar cálculos excesivos durante la escritura
      const timeoutId = setTimeout(async () => {
        console.log('🔍 [CALCULATOR] Recalculating due to input changes...');
        await calculateTodayEarnings(platforms, yesterdayValues, rates);
        // Recalcular total USD Modelo único (tomado de filas computadas)
        const t = exactUsdFromTable;
        setTotalUsdModeloState(t);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [platforms.map(p => p.value).join(','), rates, yesterdayValues, exactUsdFromTable]);

  // Fuente de verdad: total USD Modelo derivado
  useEffect(() => {
    if (!rates) return;
    const t = exactUsdFromTable;
    setTotalUsdModeloState(t);
  }, [platforms, rates, exactUsdFromTable]);

  // 🔍 DEBUG: Verificar configuración
  console.log('🔍 [CALCULATOR] System configuration:', {
    ENABLE_AUTOSAVE,
    SYSTEM_VERSION: 'V2_ONLY'
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        console.log('🔍 [CALCULATOR] useEffect load() ejecutándose...', { periodDate });
        
        // Load current auth user
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          console.log('⚠️ [CALCULATOR] No hay usuario autenticado');
          setUser(null);
          setLoading(false);
          return;
        }
        console.log('✅ [CALCULATOR] Usuario autenticado encontrado:', uid);
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

        // 🔧 NUEVO: Cargar ganancias del día desde la base de datos
        try {
          const todayDate = new Date().toISOString().split('T')[0];
          const earningsResponse = await fetch(`/api/daily-earnings?modelId=${current.id}&date=${todayDate}`);
          const earningsJson = await earningsResponse.json();
          
          if (earningsJson.success && earningsJson.earnings !== undefined) {
            setTodayEarnings(earningsJson.earnings);
            console.log('✅ [CALCULATOR] Daily earnings loaded from database:', earningsJson.earnings);
          } else {
            console.log('🔍 [CALCULATOR] No daily earnings found for today, will calculate from scratch');
          }
        } catch (error) {
          console.error('❌ [CALCULATOR] Error loading daily earnings:', error);
        }

        // 🔧 FIX: Solo cargar configuración del usuario actual (modelo) si no se ha cargado antes
        if (!configLoaded) {
          try {
            await loadCalculatorConfig(current.id);
            setConfigLoaded(true);
          } catch (error) {
            console.error('❌ [CALCULATOR] Error cargando configuración:', error);
          }
        }

        // 🔒 Cargar estado de congelación de plataformas (después de que el usuario esté disponible)
        // FORZAR EJECUCIÓN: Ejecutar siempre, sin condiciones, incluso si falla la configuración
        try {
          console.log('🔍 [CALCULATOR] === INICIANDO carga de frozenPlatforms ===', { 
            modelId: current.id, 
            periodDate,
            timestamp: new Date().toISOString()
          });
          
          const freezeStatusResponse = await fetch(
            `/api/calculator/period-closure/platform-freeze-status?modelId=${current.id}&periodDate=${periodDate}`
          );
          
          if (!freezeStatusResponse.ok) {
            throw new Error(`HTTP ${freezeStatusResponse.status}: ${freezeStatusResponse.statusText}`);
          }
          
          const freezeStatusData = await freezeStatusResponse.json();
          
          console.log('🔍 [CALCULATOR] === Respuesta freeze-status recibida ===', {
            success: freezeStatusData.success,
            hasFrozenPlatforms: !!freezeStatusData.frozen_platforms,
            frozenPlatformsCount: freezeStatusData.frozen_platforms?.length || 0,
            frozenPlatforms: freezeStatusData.frozen_platforms,
            debug: freezeStatusData.debug,
            timestamp: new Date().toISOString()
          });
          
          if (freezeStatusData.success && freezeStatusData.frozen_platforms && freezeStatusData.frozen_platforms.length > 0) {
            const frozenLowercase = freezeStatusData.frozen_platforms.map((p: string) => p.toLowerCase());
            console.log('🔒 [CALCULATOR] === Aplicando frozenPlatforms al estado ===', {
              frozenLowercase,
              count: frozenLowercase.length,
              timestamp: new Date().toISOString()
            });
            setFrozenPlatforms(frozenLowercase);
            console.log('✅ [CALCULATOR] === frozenPlatforms aplicado exitosamente ===');
          } else {
            console.log('⚠️ [CALCULATOR] No hay plataformas congeladas en la respuesta');
            setFrozenPlatforms([]);
          }
        } catch (error) {
          console.error('❌ [CALCULATOR] === ERROR cargando frozenPlatforms ===', error);
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
        const response = await fetch(
          `/api/calculator/period-closure/platform-freeze-status?modelId=${user.id}&periodDate=${periodDate}`
        );
        const data = await response.json();
        
        if (data.success) {
          const newFrozenPlatforms = (data.frozen_platforms || []).map((p: string) => p.toLowerCase());
          
          // Log de depuración
          if (data.debug) {
            console.log('🔍 [CALCULATOR] Debug congelación:', {
              isClosureDay: data.debug.isClosureDay,
              colombiaDate: data.debug.colombiaDate,
              colombiaDay: data.debug.colombiaDay,
              frozenFromDB: data.debug.frozenFromDB,
              frozenAuto: data.debug.frozenAuto,
              frozenPlatforms: newFrozenPlatforms
            });
          }
          
          setFrozenPlatforms(prev => {
            // Solo actualizar si hay cambios para evitar renders innecesarios
            const prevSet = new Set(prev);
            const newSet = new Set(newFrozenPlatforms);
            if (prevSet.size !== newSet.size || 
                !Array.from(prevSet).every(p => newSet.has(p))) {
              console.log('🔒 [CALCULATOR] Estado de congelación actualizado:', {
                antes: Array.from(prevSet),
                ahora: newFrozenPlatforms,
                cambios: newFrozenPlatforms.filter((p: string) => !prevSet.has(p))
              });
              return newFrozenPlatforms;
            }
            return prev;
          });
        } else {
          console.error('❌ [CALCULATOR] Error en respuesta de freeze-status:', data.error);
        }
      } catch (error) {
        console.error('❌ [CALCULATOR] Error actualizando estado de congelación:', error);
      }
    };
    
    // Actualizar inmediatamente
    updateFrozenStatus();
    
    // Actualizar cada 30 segundos durante días de cierre (más frecuente para detectar cambios rápidamente)
    const interval = setInterval(updateFrozenStatus, 30000); // 30 segundos
    
    return () => {
      clearInterval(interval);
      console.log('🔒 [CALCULATOR] Actualización periódica de congelación desactivada');
    };
  }, [user?.id, periodDate, configLoaded]);

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
            payment_frequency: platform.payment_frequency || 'quincenal', // 🔧 NUEVO: Frecuencia de pago
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
      // 🔧 NUEVO ENFOQUE: Cargar plataformas PRIMERO, luego valores guardados
      setPlatforms(enabledPlatforms);
      console.log('🔍 [CALCULATOR] setPlatforms called with:', enabledPlatforms.length, 'platforms');
      
      // Inicializar inputs de texto vacíos
      setInputValues(
        enabledPlatforms.reduce((acc: Record<string, string>, p: Platform) => {
          acc[p.id] = p.value ? String(p.value) : '';
          return acc;
        }, {} as Record<string, string>)
      );

      // 🔧 NUEVO ENFOQUE: Cargar valores guardados DESPUÉS de que platforms esté establecido
      try {
        console.log('🔍 [CALCULATOR] Loading saved values - V2 system only');
        const savedResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${periodDate}`);
        const savedJson = await savedResp.json();
        console.log('🔍 [CALCULATOR] Saved values (v2):', savedJson);
        
        if (savedJson.success && Array.isArray(savedJson.data) && savedJson.data.length > 0) {
          const platformToValue: Record<string, number> = {};
          for (const row of savedJson.data) {
            if (row && row.platform_id) {
              const parsed = Number.parseFloat(String(row.value));
              platformToValue[row.platform_id] = Number.isFinite(parsed) ? parsed : 0;
            }
          }
          
          console.log('🔍 [CALCULATOR] Valores encontrados en API:', platformToValue);
          console.log('🔍 [CALCULATOR] Plataformas habilitadas:', enabledPlatforms.map((p: Platform) => ({ id: p.id, name: p.name })));
          
          // 🔧 NUEVO ENFOQUE: Usar enabledPlatforms directamente (no el estado platforms)
          const updatedPlatforms = enabledPlatforms.map((p: Platform) => ({
            ...p,
            value: platformToValue[p.id] ?? p.value
          }));
          
          console.log('🔍 [CALCULATOR] Plataformas actualizadas:', updatedPlatforms.map((p: Platform) => ({ id: p.id, name: p.name, value: p.value })));
          setPlatforms(updatedPlatforms);

          // 🔧 NUEVO: Cargar valores de ayer para calcular ganancias del día
          // Usamos la fecha REAL de hoy (Colombia) menos un día para obtener "ayer"
          const todayDateVal = getColombiaDate();
          const yesterdayDate = new Date(new Date(todayDateVal).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          console.log('🔍 [CALCULATOR] Loading yesterday values for date:', yesterdayDate);
          
          try {
            const yesterdayResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${yesterdayDate}`);
            const yesterdayJson = await yesterdayResp.json();
            console.log('🔍 [CALCULATOR] Yesterday values response:', yesterdayJson);
            
            if (yesterdayJson.success && Array.isArray(yesterdayJson.data) && yesterdayJson.data.length > 0) {
              const yesterdayPlatformToValue: Record<string, number> = {};
              for (const row of yesterdayJson.data) {
                if (row && row.platform_id) {
                  const parsed = Number.parseFloat(String(row.value));
                  yesterdayPlatformToValue[row.platform_id] = Number.isFinite(parsed) ? parsed : 0;
                }
              }
              setYesterdayValues(yesterdayPlatformToValue);
              console.log('🔍 [CALCULATOR] Yesterday values loaded successfully:', yesterdayPlatformToValue);
              
              // 🔧 CRÍTICO: Calcular ganancias del día DESPUÉS de cargar yesterdayValues
              if (rates) {
                console.log('🔍 [CALCULATOR] Calculating today earnings with loaded yesterday values...');
                calculateTodayEarnings(updatedPlatforms, yesterdayPlatformToValue, rates);
              }
            } else {
              setYesterdayValues({});
              console.log('🔍 [CALCULATOR] No yesterday values found, setting empty object');
            }
          } catch (yesterdayError) {
            console.error('❌ [CALCULATOR] Error loading yesterday values:', yesterdayError);
            setYesterdayValues({});
          }
          
          // Sincronizar manualmente
          syncPlatformsToInputs(updatedPlatforms);
          console.log('🔍 [CALCULATOR] Valores guardados aplicados y sincronizados');
          
          // 🔧 NUEVO: Si estamos en P2, cargar valores de P1 para plataformas mensuales
          if (isPeriod2) {
            const colombiaDate = getColombiaDate();
            const [year, month] = colombiaDate.split('-').map(Number);
            const p1Date = `${year}-${String(month).padStart(2, '0')}-01`; // Fecha de inicio de P1
            
            console.log('🔍 [CALCULATOR] P2 detectado, cargando valores de P1:', p1Date);
            
            try {
              const p1Resp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&periodDate=${p1Date}`);
              const p1Json = await p1Resp.json();
              
              if (p1Json.success && Array.isArray(p1Json.data) && p1Json.data.length > 0) {
                const p1PlatformToValue: Record<string, number> = {};
                for (const row of p1Json.data) {
                  if (row && row.platform_id) {
                    const parsed = Number.parseFloat(String(row.value));
                    p1PlatformToValue[row.platform_id] = Number.isFinite(parsed) ? parsed : 0;
                  }
                }
                setP1Values(p1PlatformToValue);
                console.log('🔍 [CALCULATOR] Valores de P1 cargados:', p1PlatformToValue);
              } else {
                console.log('🔍 [CALCULATOR] No se encontraron valores de P1');
                setP1Values({});
              }
            } catch (p1Error) {
              console.error('❌ [CALCULATOR] Error cargando valores de P1:', p1Error);
              setP1Values({});
            }
          }
          
          // 🔧 NUEVO: Calcular ganancias del día después de cargar yesterdayValues
          // Se calculará en el useEffect cuando yesterdayValues esté listo
        } else {
          console.log('🔍 [CALCULATOR] No se encontraron valores guardados o API falló:', savedJson);
          // 🔧 CRÍTICO: Si no hay valores, resetear explícitamente a cero
          console.log('🔍 [CALCULATOR] Reseteando plataformas a cero porque no hay valores guardados');
          const resetPlatforms = enabledPlatforms.map((p: Platform) => ({
            ...p,
            value: 0
          }));
          setPlatforms(resetPlatforms);
          syncPlatformsToInputs(resetPlatforms);
        }
      } catch (e) {
        console.warn('⚠️ [CALCULATOR] No se pudieron cargar valores guardados:', e);
        // 🔧 CRÍTICO: Si hay error, resetear explícitamente a cero
        console.log('🔍 [CALCULATOR] Reseteando plataformas a cero debido a error al cargar');
        const resetPlatforms = enabledPlatforms.map((p: Platform) => ({
          ...p,
          value: 0
        }));
        setPlatforms(resetPlatforms);
        syncPlatformsToInputs(resetPlatforms);
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

  // 🔧 FUNCIÓN AUXILIAR: Calcular y guardar totales (reutilizable)
  const calculateAndSaveTotals = async (platformsToCalculate: typeof platforms) => {
    if (!user || !rates) return;

    // Calcular totales usando la misma lógica que se muestra en "Totales y Alertas"
    // (incluir plataformas congeladas en cálculo de totales - solo no se pueden editar)
    const totalUsdBruto = platformsToCalculate.reduce((sum, p) => {
      if (!p.enabled) return sum;
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
        } else {
          usdBruto = p.value;
        }
      }
      return sum + usdBruto;
    }, 0);

    // (incluir plataformas congeladas en cálculo de totales - solo no se pueden editar)
    const totalUsdModelo = platformsToCalculate.reduce((sum, p) => {
      if (!p.enabled) return sum;
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
        } else {
          usdModelo = p.value;
        }
      }
      return sum + (usdModelo * p.percentage / 100);
    }, 0);

    const totalCopModelo = totalUsdModelo * (rates?.usd_cop || 3900);

    // Guardar totales consolidados
    try {
      const totalsResponse = await fetch('/api/calculator/totals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: user.id,
          periodDate,
          totalUsdBruto,
          totalUsdModelo,
          totalCopModelo
        }),
      });

      const totalsData = await totalsResponse.json();
      if (!totalsData.success) {
        console.error('❌ [CALCULATOR] Error saving totals:', totalsData.error);
        return false;
      } else {
        console.log('✅ [CALCULATOR] Totals saved successfully');
        return true;
      }
    } catch (error) {
      console.error('❌ [CALCULATOR] Error saving totals:', error);
      return false;
    }
  };

  const saveValues = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // CRÍTICO: Deshabilitar autosave durante guardado manual
      console.log('🔒 [CALCULATOR] Disabling autosave during manual save');

      const values = platforms.reduce((acc, platform) => {
        // 🔒 Excluir plataformas congeladas del guardado
        const isFrozen = frozenPlatforms.includes(platform.id.toLowerCase());
        // 🔧 FIX: Permitir guardar valor 0 - solo excluir si es undefined/null o está congelada
        if (platform.enabled && platform.value !== undefined && platform.value !== null && !isFrozen) {
          // 🔧 NUEVO: Para plataformas mensuales en P2, guardar solo P2 (diferencia)
          // El valor ya está calculado como P2 = Total mensual - P1
          if (isPeriod2 && platform.payment_frequency === 'mensual') {
            // El valor en platform.value ya es P2 (diferencia), guardarlo directamente
            acc[platform.id] = platform.value;
            console.log(`🔍 [SAVE] Plataforma mensual ${platform.id}: guardando P2 (diferencia) = ${platform.value}`);
          } else {
            // Para plataformas quincenales o P1, guardar el valor normalmente
            acc[platform.id] = platform.value;
          }
        }
        return acc;
      }, {} as Record<string, number>);

      console.log('🔍 [CALCULATOR] Saving values:', values);
      console.log('🔍 [CALCULATOR] Using V2 system for saving');
      console.log('🔍 [CALCULATOR] User ID:', user?.id);

      // 1. Guardar valores individuales por plataforma
      const endpoint = '/api/calculator/model-values-v2';
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
              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Error al cargar calculadora</h4>
              <p className="text-gray-500 dark:text-gray-300 mb-4 text-sm">{error}</p>
              <button
                onClick={() => {
                  if (user?.id) {
                    setValuesLoaded(false); // Resetear para permitir recarga
                    setConfigLoaded(false); // Resetear para permitir recarga de config
                    loadCalculatorConfig(user.id);
                  }
                }}
                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
              >
                Reintentar
              </button>
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
                          <div 
                            className="font-medium text-gray-900 dark:text-gray-100 text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors inline-block mb-1"
                            onClick={(e) => {
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
                                  onClick={() => {
                                    const value = Number.parseFloat(p1InputValue) || 0;
                                    setP1Values(prev => ({ ...prev, [row.id]: value }));
                                    setEditingP1Platform(null);
                                    setP1InputPosition(null);
                                  }}
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
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={p1Value > 0 ? String(p1Value) : ''}
                                        onChange={(e) => {
                                          if (isFrozen) return;
                                          const rawValue = e.target.value;
                                          const unifiedValue = rawValue.replace(',', '.');
                                          const p1NewValue = Number.parseFloat(unifiedValue) || 0;
                                          
                                          // Actualizar P1
                                          setP1Values(prev => ({ ...prev, [row.id]: p1NewValue }));
                                          
                                          // Recalcular P2
                                          const monthlyTotalNum = Number.parseFloat(monthlyTotals[row.id] || '0') || 0;
                                          const p2Calculated = monthlyTotalNum - p1NewValue;
                                          
                                          // Actualizar inputValues con P2 (diferencia)
                                          setInputValues(prev => ({ ...prev, [row.id]: p2Calculated > 0 ? String(p2Calculated) : '' }));
                                          setPlatforms(prev => prev.map(p => p.id === row.id ? { ...p, value: p2Calculated } : p));
                                        }}
                                        disabled={isFrozen}
                                        className={`w-20 h-8 px-2 py-1 text-sm border rounded-md transition-all duration-200 ${
                                          isFrozen
                                            ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50'
                                        }`}
                                        placeholder="0.00"
                                        title="Valor de P1 (editable)"
                                      />
                                    </div>
                                    
                                    {/* Mostrar cálculo: P2 = Total - P1 */}
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      P2 = {monthlyTotal.toFixed(2)} - {p1Value.toFixed(2)} = <strong>{p2Value.toFixed(2)}</strong>
                                    </div>
                                    
                                    {isFrozen && (
                                      <span className="text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                                        Cerrado
                                      </span>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Comportamiento normal para plataformas quincenales o P1
                              return (
                                <>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inputValues[row.id] ?? ''}
                                    onChange={(e) => {
                                      // 🔒 Prevenir edición si está congelada
                                      if (isFrozen) return;
                                      
                                      const rawValue = e.target.value;
                                      
                                      // 🔧 UNIFICAR SEPARADORES: Tanto punto como coma se muestran como punto
                                      const unifiedValue = rawValue.replace(',', '.');
                                      
                                      // 🔧 SYNC: Actualizar inputValues con valor unificado
                                      setInputValues(prev => ({ ...prev, [row.id]: unifiedValue }));

                                      // 🔧 SYNC: Convertir a número (ya está normalizado)
                                      const numeric = Number.parseFloat(unifiedValue);
                                      const numericValue = Number.isFinite(numeric) ? numeric : 0;
                                      setPlatforms(prev => prev.map(p => p.id === row.id ? { ...p, value: numericValue } : p));
                                      
                                      console.log('🔍 [SYNC] Usuario escribió:', { 
                                        platform: row.id, 
                                        original: rawValue,
                                        unified: unifiedValue,
                                        numeric: numericValue 
                                      });
                                    }}
                                    disabled={isFrozen}
                                    className={`w-20 h-8 px-2 py-1 text-sm border rounded-md transition-all duration-200 ${
                                      isFrozen
                                        ? 'border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50'
                                    }`}
                                    placeholder="0.00"
                                    title={isFrozen ? "Período cerrado - Esta plataforma no puede ser editada" : "Ingresa valores con decimales (punto o coma se convierten a punto)"}
                                  />
                                  {isFrozen && (
                                    <span className="text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                                      Cerrado
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            <span className="text-gray-600 dark:text-gray-300 text-xs font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                              {(() => {
                                const p = platforms.find(pp => pp.id === row.id);
                                return p?.currency || 'USD';
                              })()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                            ${row.usdModelo.toFixed(2)} USD
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                            ${row.copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
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

        {/* Totales y Alertas - ESTILO APPLE REFINADO */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Totales y Alertas
            </h3>
            <button
              onClick={saveValues}
              disabled={saving || platforms.filter(p => p.enabled).length === 0}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 whitespace-nowrap ${
                !saving && platforms.filter(p => p.enabled).length > 0
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          
          {/* Totales principales - ESTILO UNIFICADO */}
          <InfoCardGrid
            cards={(() => {
              const totalUsdModelo = exactUsdFromTable;
              const totalCopModelo = totalUsdModelo * (rates?.usd_cop || 3900);
              return [
                {
                  value: `$${todayEarnings.toFixed(2)}`,
                  label: 'Ganancias Hoy',
                  color: 'blue'
                },
                {
                  value: `$${totalUsdModelo.toFixed(2)}`,
                  label: 'USD Modelo',
                  color: 'green'
                },
                {
                  value: `$${totalCopModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                  label: 'COP Modelo',
                  color: 'purple'
                }
              ];
            })()}
            columns={3}
            className="mb-4"
          />
          
          {/* 90% de anticipo - estilo sutil */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-600/80 rounded-xl border border-gray-200 dark:border-gray-500/50">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <strong>90% de anticipo disponible:</strong> ${(exactUsdFromTable * (rates?.usd_cop || 3900) * 0.9).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
            </div>
          </div>
          
          {/* Alerta de cuota mínima - barra refinada */}
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
            const rgbToHex = (c: any) => `#${[c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
            const tint = (c: any, t: number) => mix(c, { r: 255, g: 255, b: 255 }, t);
            const shade = (c: any, t: number) => mix(c, { r: 0, g: 0, b: 0 }, t);

            const t = progressPct / 100;
            // 0–60% rojo→púrpura, 60–100% púrpura→esmeralda
            const base = t <= 0.6
              ? mix(RED, PURPLE, t / 0.6)
              : mix(PURPLE, EMERALD, (t - 0.6) / 0.4);

            const progressStart = rgbToHex(shade(base, 0.05));
            const progressEnd = rgbToHex(shade(base, 0.15));
            // Estilos dinámicos para fondo del contenedor e icono
            const cardBgStart = rgbToHex(tint(base, 0.92));
            const cardBgEnd = rgbToHex(tint(base, 0.88));
            const cardBorder = rgbToHex(tint(base, 0.7));
            const iconStart = rgbToHex(shade(base, 0.0));
            const iconEnd = rgbToHex(shade(base, 0.2));
            const headingColor = rgbToHex(shade(base, 0.55));
            const subTextColor = rgbToHex(shade(base, 0.45));
            
            const milestone = progressPct >= 100 ? 100 : progressPct >= 75 ? 75 : progressPct >= 50 ? 50 : progressPct >= 25 ? 25 : 0;
            console.log('[OBJETIVO:TA] render card', { porcentajeAlcanzado: Math.ceil(porcentajeAlcanzado) });
            return (
              <div
                className={`relative overflow-hidden rounded-2xl border transition-all duration-300 in-view`}
                style={{
                  background: `linear-gradient(90deg, ${cardBgStart}, ${cardBgEnd})`,
                  borderColor: cardBorder
                }}
                id="objective-basic-card"
                data-milestone={milestone}
              >
                {/* Efecto de brillo animado */}
                <div
                  className="absolute inset-0 opacity-10 animate-pulse"
                  style={{ background: `linear-gradient(90deg, ${progressStart}, ${progressEnd})` }}
                ></div>

                {/* Animaciones de hito (nuevo set, más contundente) */}
                <div className="milestones-overlay pointer-events-none absolute inset-0 overflow-hidden">
                  {/* 25% */}
                  <div className="arrow-25" />
                  <div className="mini-check-25" />
                  <div className="bonus-count-25" />
                  <div className="streak-25" />
                  <div className="banner-25" />
                  {/* 50% */}
                  <div className="arrows-50" />
                  <div className="underline-50" />
                  <div className="split-50" />
                  {/* 75% */}
                  <div className="aura-75" />
                  <div className="badge-75" />
                  <div className="surge-75" />
                  <div className="toast-75" />
                  {/* 100% */}
                  <div className="crown-100" />
                  <div className="filllock-100" />
                  <div className="confetti-100" />
                  <div className="stamp-100" />
                  <div className="cta-100" />
                </div>
                
                <div className="relative p-4">
                  <div className="flex items-center space-x-3">
                    {/* Icono animado */}
                    <div className={`relative flex-shrink-0 milestone-icon ${estaPorDebajo ? 'animate-bounce' : 'animate-pulse'}`}>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md`}
                        style={{
                          background: `linear-gradient(90deg, ${iconStart}, ${iconEnd})`,
                          boxShadow: `0 4px 10px ${iconStart}33`
                        }}
                      >
                        <span className="text-white text-sm">✓</span>
                      </div>
                    </div>
                    
                    {/* Contenido compacto */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className={`font-bold text-sm milestone-title`} style={{ color: headingColor }}>
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
                            className={`h-full transition-all duration-1000 ease-out progress-inner`}
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
        {/* Estilos de animación para hitos del objetivo */}
        <style jsx>{`
        .milestones-overlay { z-index: 10; pointer-events: none; }
        /* Borde temporal de diagnóstico: comentar cuando confirmemos */
        /* .milestones-overlay { outline: 1px dashed rgba(255,255,255,0.5); } */
        #objective-basic-card.in-view[data-milestone="0"] .milestone-shine { animation: none; }
        #objective-basic-card.in-view[data-milestone="25"] .milestone-shine {
          animation: shine-sweep 1.3s cubic-bezier(0.22, 1, 0.36, 1) 1;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          position: absolute; top: 0; left: -35%; width: 45%; height: 100%;
        }
        #objective-basic-card.in-view[data-milestone="50"] .milestone-wave {
          animation: wave-run 1.6s cubic-bezier(0.22, 1, 0.36, 1) 1;
          position: absolute; inset: 0; opacity: 0.22;
          background: radial-gradient(120% 60% at 0% 50%, rgba(255,255,255,0.75), transparent 60%);
        }
        #objective-basic-card.in-view[data-milestone="100"] .milestone-particles {
          position: absolute; inset: 0; pointer-events: none;
          animation: particles-pop 1s cubic-bezier(0.16, 1, 0.3, 1) 1;
          background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.6) 0 2px, transparent 3px),
                      radial-gradient(circle at 50% 30%, rgba(255,255,255,0.6) 0 2px, transparent 3px),
                      radial-gradient(circle at 70% 60%, rgba(255,255,255,0.6) 0 2px, transparent 3px);
          background-repeat: no-repeat;
        }
          /* 75%: sparkle trail y pulso de barra */
          #objective-basic-card.in-view[data-milestone="75"] .milestone-sparkle {
            position: absolute; inset: 0; pointer-events: none; opacity: 0.25;
            animation: sparkle-run 1.2s ease-out 1;
            background: radial-gradient(circle at 30% 60%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 60% 40%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 80% 55%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px);
            background-repeat: no-repeat;
          }
          /* Ripple en el 50%-100% al pasar umbral 75% */
          #objective-basic-card.in-view[data-milestone="75"] .milestone-ripple {
            position: absolute; inset: 0; pointer-events: none;
            animation: ripple-pop 900ms ease-out 1;
            background: radial-gradient(circle at 15% 50%, rgba(255,255,255,0.35) 0 30px, transparent 31px),
                        radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25) 0 24px, transparent 25px),
                        radial-gradient(circle at 85% 50%, rgba(255,255,255,0.35) 0 30px, transparent 31px);
            background-repeat: no-repeat;
          }
          @keyframes ripple-pop {
            0% { transform: scale(0.9); opacity: 0; }
            50% { opacity: 0.35; }
            100% { transform: scale(1.05); opacity: 0; }
          }

          /* Confetti suave al 100% adicional */
          #objective-basic-card.in-view[data-milestone="100"] .milestone-confetti {
            position: absolute; inset: 0; pointer-events: none;
            animation: confetti-fall 900ms ease-out 1;
            background: radial-gradient(circle at 25% 20%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 65% 10%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px),
                        radial-gradient(circle at 80% 30%, rgba(255,255,255,0.9) 0 1.5px, transparent 2px);
            background-repeat: no-repeat;
          }
          @keyframes confetti-fall {
            0% { transform: translateY(-10px); opacity: 0; }
            60% { opacity: 1; }
            100% { transform: translateY(10px); opacity: 0; }
          }

          /* Pulso de la barra en 75% */
          #objective-basic-card.in-view[data-milestone="75"] .progress-inner { animation: bar-pulse 800ms ease-out 1; }
          @keyframes bar-pulse {
            0% { filter: brightness(1); }
            40% { filter: brightness(1.25); }
            100% { filter: brightness(1); }
          }

        @keyframes shine-sweep {
          0% { transform: translateX(0) skewX(-10deg); }
          100% { transform: translateX(280%) skewX(-10deg); }
        }
        @keyframes wave-run {
          0% { background-position: -220% 0; }
          100% { background-position: 220% 0; }
        }
        @keyframes particles-pop {
          0% { opacity: 0; transform: scale(0.9); filter: blur(1px); }
          25% { opacity: 1; transform: scale(1.06); filter: blur(0); }
          100% { opacity: 0; transform: scale(1); }
        }
          @keyframes sparkle-run {
            0% { transform: translateX(-10%); opacity: 0; }
            40% { opacity: 0.25; }
            100% { transform: translateX(30%); opacity: 0; }
          }

          /* Refuerzo visual en barra al 75% */
          #objective-basic-card.in-view[data-milestone="75"] .milestone-title { animation: title-glow 1000ms ease-out 1; }

          /* Refuerzos por hito */
          #objective-basic-card.in-view[data-milestone="25"] .milestone-icon { animation: icon-tilt 600ms ease-out 1; }
          @keyframes icon-tilt {
            0% { transform: rotate(0deg); }
            40% { transform: rotate(-8deg); }
            100% { transform: rotate(0deg); }
          }
          #objective-basic-card.in-view[data-milestone="50"] .milestone-title { animation: title-glow 900ms ease-out 1; }
          @keyframes title-glow {
            0% { text-shadow: 0 0 0 rgba(255,255,255,0); }
            40% { text-shadow: 0 2px 10px rgba(255,255,255,0.45); }
            100% { text-shadow: 0 0 0 rgba(255,255,255,0); }
          }
          #objective-basic-card.in-view[data-milestone="100"] .milestone-icon { animation: icon-pop 700ms ease-out 1; }
          @keyframes icon-pop {
            0% { transform: scale(1); }
            40% { transform: scale(1.12); }
            100% { transform: scale(1); }
          }

        @media (prefers-reduced-motion: reduce) {
          #objective-basic-card .milestone-shine,
          #objective-basic-card .milestone-wave,
          #objective-basic-card .milestone-particles { animation: none !important; }
        }

        /* ================= EFECTOS VISUALES PROGRESIVOS POR HITO ================ */
        
        /* 0% - Efecto sutil de enfoque */
        #objective-basic-card.in-view[data-milestone="0"] { 
          animation: focus-in 600ms cubic-bezier(0.22,1,0.36,1) 1; 
        }
        @keyframes focus-in { 
          0% { filter: blur(1px); box-shadow: 0 0 0 rgba(0,0,0,0); } 
          100% { filter: blur(0); box-shadow: 0 8px 18px rgba(0,0,0,0.06); 
        } }

        /* 25% - Efecto de sello con brillo suave */
        #objective-basic-card.in-view[data-milestone="25"] .milestone-stamp {
          position: absolute; top: -18%; left: 18%; width: 110px; height: 66px; opacity: 0.9;
          background: radial-gradient(closest-side, rgba(255,255,255,0.85), transparent 70%);
          transform: rotate(-8deg);
          animation: stamp-drop 800ms cubic-bezier(0.22,1,0.36,1) 1;
        }
        @keyframes stamp-drop { 
          0% { transform: translateY(-24px) rotate(-8deg); opacity: 0; } 
          60% { transform: translateY(0) rotate(-8deg); opacity: 0.95; } 
          100% { opacity: 0; } 
        }
        #objective-basic-card.in-view[data-milestone="25"] .milestone-ticks {
          position: absolute; inset: 0; 
          background: repeating-linear-gradient(90deg, rgba(255,255,255,0.9) 0 5px, transparent 5px 12px);
          -webkit-mask-image: linear-gradient(90deg, black 0% 35%, transparent 36%);
          mask-image: linear-gradient(90deg, black 0% 35%, transparent 36%);
          animation: ticks-burst 520ms steps(6) 1;
        }
        @keyframes ticks-burst { 
          0% { opacity: 0; } 
          100% { opacity: 1; } 
        }

        /* 50% - Efecto de rotación 3D y partículas */
        #objective-basic-card.in-view[data-milestone="50"] .milestone-title { 
          animation: title-pivot 700ms cubic-bezier(0.22,1,0.36,1) 1; 
          transform-origin: left center; 
        }
        @keyframes title-pivot { 
          0% { transform: perspective(500px) rotateY(0deg); } 
          50% { transform: perspective(500px) rotateY(8deg); } 
          100% { transform: perspective(500px) rotateY(0deg); } 
        }
        #objective-basic-card.in-view[data-milestone="50"] .milestone-skipper { 
          position: absolute; top: 42%; left: 0; width: 10px; height: 10px; 
          border-radius: 999px; background: rgba(255,255,255,0.95); 
          animation: skipper-run 700ms cubic-bezier(0.22,1,0.36,1) 1; 
        }
        @keyframes skipper-run { 
          0% { transform: translateX(0) translateY(0); filter: blur(0); } 
          50% { transform: translateX(45%) translateY(-4px); filter: blur(1px); } 
          100% { transform: translateX(60%) translateY(0); opacity: 0; } 
        }
        #objective-basic-card.in-view[data-milestone="50"] .milestone-sweep { 
          position: absolute; inset: 0; 
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%); 
          animation: sweep-run 900ms cubic-bezier(0.22,1,0.36,1) 1; 
        }
        @keyframes sweep-run { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }

        /* 75% - Efecto de cometa con elevación y pulso de barra */
        #objective-basic-card.in-view[data-milestone="75"] { 
          animation: elevate-75 600ms cubic-bezier(0.16,1,0.3,1) 1; 
        }
        @keyframes elevate-75 { 
          0% { box-shadow: 0 6px 10px rgba(0,0,0,0.04); } 
          50% { box-shadow: 0 14px 24px rgba(0,0,0,0.08); } 
          100% { box-shadow: 0 10px 16px rgba(0,0,0,0.06); } 
        }
        #objective-basic-card.in-view[data-milestone="75"] .milestone-comet { 
          position: absolute; top: 44%; left: -5%; width: 120px; height: 3px; 
          background: linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.95)); 
          filter: blur(0.6px); 
          animation: comet-run 900ms cubic-bezier(0.16,1,0.3,1) 1; 
        }
        @keyframes comet-run { 
          0% { transform: translateX(0); opacity: 0; } 
          20% { opacity: 1; } 
          100% { transform: translateX(110%); opacity: 0; } 
        }
        #objective-basic-card.in-view[data-milestone="75"] .progress-inner { 
          animation: bar-pulse-strong 820ms ease-out 1; 
        }
        @keyframes bar-pulse-strong { 
          0% { filter: brightness(1); } 
          40% { filter: brightness(1.3); } 
          100% { filter: brightness(1); } 
        }

        /* 100% - Efecto espectacular de celebración */
        #objective-basic-card.in-view[data-milestone="100"] .milestone-ribbon { 
          position: absolute; right: -2%; top: 36%; height: 10px; width: 0; 
          background: rgba(255,255,255,0.95); border-radius: 6px; 
          animation: ribbon-open 1000ms cubic-bezier(0.22,1,0.36,1) 1 forwards; 
        }
        @keyframes ribbon-open { 
          0% { width: 0; } 
          60% { width: 38%; } 
          100% { width: 34%; } 
        }
        #objective-basic-card.in-view[data-milestone="100"] .milestone-icon { 
          animation: trophy-pop 700ms ease-out 1; 
        }
        @keyframes trophy-pop { 
          0% { transform: scale(1) rotate(0); } 
          40% { transform: scale(1.18) rotate(-6deg); } 
          100% { transform: scale(1) rotate(0); } 
        }
        #objective-basic-card.in-view[data-milestone="100"] .milestone-confetti { 
          position: absolute; inset: 0; 
          background: repeating-linear-gradient(180deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 6px); 
          -webkit-mask-image: linear-gradient(180deg, black 0 60%, transparent 60%); 
          mask-image: linear-gradient(180deg, black 0 60%, transparent 60%); 
          animation: confetti-lines 820ms ease-out 1; 
        }
        @keyframes confetti-lines { 
          0% { transform: translateY(-12px); opacity: 0; } 
          40% { opacity: 1; } 
          100% { transform: translateY(8px); opacity: 0; } 
        }
        `}</style>
        </div>
    </>
  );
}
