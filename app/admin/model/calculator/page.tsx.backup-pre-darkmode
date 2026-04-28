'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { getColombiaPeriodStartDate, getColombiaDate } from '@/utils/calculator-dates';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import ProgressMilestone from '@/components/ui/ProgressMilestone';
import DynamicTimeIsland from '@/components/ui/DynamicTimeIsland';
import PageHeader from '@/components/ui/PageHeader';
import GlassCard from '@/components/ui/GlassCard';
import ObjectiveBorealCard from '@/components/ui/ObjectiveBorealCard';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';
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
  payment_frequency?: 'quincenal' | 'mensual';
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
  // 🔧 SOLUCIÓN DEFINITIVA: Usar fecha de INICIO DE PERIODO (1 o 16) para sincronizar buckets
  const [periodDate, setPeriodDate] = useState<string>(getColombiaPeriodStartDate());
  // Mantener valores escritos como texto para permitir decimales con coma y punto
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [valuesLoaded, setValuesLoaded] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [yesterdayValues, setYesterdayValues] = useState<Record<string, number>>({});
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [earningsOffset, setEarningsOffset] = useState<number>(0);
  
  // 🔧 EARLY FREEZE: Estado para plataformas congeladas
  const [frozenPlatforms, setFrozenPlatforms] = useState<string[]>([]);
  // Resumen periodo/objetivo para la barra horaria (solo modelo)
  const [periodGoal, setPeriodGoal] = useState<{ goalUsd: number; periodBilledUsd: number; periodBilledUsdModelo: number } | null>(null);
  const [objectiveBarFlip, setObjectiveBarFlip] = useState(0);
  // Neto disponible del período (después de anticipos y compras sexshop) para indicador en calculadora
  const [netoDisponible, setNetoDisponible] = useState<{ neto_disponible: number; facturado: number; anticipos: number; cuotas_pendientes: number; compras_contado?: number; cuotas_primera_aprobacion?: number; descuentos_detalle?: Array<{ concepto: string; monto: number }> } | null>(null);

  // 🌟 ESTADOS DE GAMIFICACIÓN
  interface GamificationEvent {
    platformId: string;
    level: number;
    message: string;
    active: boolean;
    timestamp: number;
  }
  const [objectiveGamiState, setObjectiveGamiState] = useState<{ active: boolean; level: number } | null>(null);
  const [gamiEvent, setGamiEvent] = useState<GamificationEvent | null>(null);
  const [sessionFocusSnapshot, setSessionFocusSnapshot] = useState<Record<string, number>>({});

  // 🌟 HELPER DE GAMIFICACIÓN "MASTER PROMPT"
  const triggerGamification = (platformId: string, currentVal: number) => {
    const oldVal = sessionFocusSnapshot[platformId] || 0;
    const delta = currentVal - oldVal;
    if (delta <= 0) return;

    // Evaluar si impactar la Barra de Objetivo
    const goalUsd = periodGoal ? periodGoal.goalUsd : 0;
    const cuotaMinima = goalUsd > 0 ? goalUsd : 100;
    
    // Función extractora de conversión para Gamificación
    const getUsdFormulaForPlatform = (p: any, val: number) => {
      let usd = 0;
      if (p.currency === 'EUR') {
        if (p.id === 'big7') usd = (val * (rates?.eur_usd || 1.01)) * 0.84;
        else if (p.id === 'mondo') usd = (val * (rates?.eur_usd || 1.01)) * 0.78;
        else usd = val * (rates?.eur_usd || 1.01);
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') usd = (val * (rates?.gbp_usd || 1.20)) * 0.677;
        else usd = val * (rates?.gbp_usd || 1.20);
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') usd = val * 0.75;
        else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') usd = val * 0.05;
        else if (p.id === 'dxlive') usd = val * 0.60;
        else if (p.id === 'secretfriends') usd = val * 0.5;
        else usd = val;
      }
      return usd;
    };

    const currentTotalUsdBruto = platforms.reduce((acc, p) => {
      if (!p.enabled) return acc;
      return acc + getUsdFormulaForPlatform(p, p.id === platformId ? currentVal : p.value);
    }, 0);
    
    const prevTotalUsdBruto = platforms.reduce((acc, p) => {
      if (!p.enabled) return acc;
      return acc + getUsdFormulaForPlatform(p, p.id === platformId ? oldVal : p.value);
    }, 0);

    if (currentTotalUsdBruto >= cuotaMinima) {
      setObjectiveGamiState({ active: true, level: 2 });
      setTimeout(() => setObjectiveGamiState(null), 3500);
    } else if (currentTotalUsdBruto > prevTotalUsdBruto && delta >= 5) {
      setObjectiveGamiState({ active: true, level: 1 });
      setTimeout(() => setObjectiveGamiState(null), 2000);
    }

    let level = 0;
    let message = '';
    
    // Evaluar Delta Inmediato (o Valor Ingresado)
    if (currentVal >= 250) {
      level = 8; // Mítico Solar
      const msgs = ['¡LEYENDA VIVIENTE! 👑', '¡HACIENDO HISTORIA! 📜', '¡FUERA DE ESTA GALAXIA! 🌌'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (currentVal >= 150) {
      level = 7; // Astral Diamante 
      const msgs = ['¡DIOSA DE ORO! 🏆', '¡SUPREMACÍA! ⚡', '¡UN DÍA MÁGICO! ✨'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (currentVal >= 100) {
      level = 6; // Legendario Esmeralda
      const msgs = ['¡REINA INDISCUTIBLE! 👑', '¡ALCANZANDO LA CIMA! 🗻', '¡EL ESTUDIO ES TUYO! 🏢'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (currentVal >= 50) {
      level = 5; // Éxtasis Amatista
      const msgs = ['¡Nivel Diosa!', '¡Modo Élite!', '¡Top de la liga!'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (currentVal >= 20) {
      level = 4; // Éxtasis Base
      const msgs = ['¡ERES IMPARABLE!', '¡Estás on fire!', '¡Magia pura!'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (currentVal >= 10) {
      level = 3; // Euforia
      const msgs = ['¡Subiendo de nivel!', '¡Ritmo perfecto!', '¡No te detengas!'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (currentVal >= 0.05) {
      level = 1; // Semilla
      const msgs = ['¡Buen comienzo!', '¡Sumando victorias!', 'Paso a paso', '¡Ese es el camino!'];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    }

    if (level > 0) {
      const timestamp = Date.now();
      setGamiEvent({ platformId, level, message, active: true, timestamp });
      setTimeout(() => {
        setGamiEvent(prev => prev?.timestamp === timestamp ? null : prev);
      }, 2500); // 2.5 segundos de duración exacta
    }
  };

  // COP Modelo en vivo (misma fórmula que la card morada) para que el neto mostrado coincida con la card cuando no hay descuentos
  const liveCopModelo = useMemo(() => {
    const usdModelo = platforms.reduce((sum, p) => {
      let val = 0;
      if (p.currency === 'EUR') {
        if (p.id === 'big7') val = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
        else if (p.id === 'mondo') val = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
        else if (p.id === 'modelka' || p.id === 'xmodels' || p.id === '777' || p.id === 'vx' || p.id === 'livecreator' || p.id === 'mow') val = p.value * (rates?.eur_usd || 1.01);
        else val = p.value * (rates?.eur_usd || 1.01);
      } else if (p.currency === 'GBP') {
        if (p.id === 'aw') val = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
        else val = p.value * (rates?.gbp_usd || 1.20);
      } else if (p.currency === 'USD') {
        if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') val = p.value * 0.75;
        else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') val = p.value * 0.05;
        else if (p.id === 'dxlive') val = p.value * 0.60;
        else if (p.id === 'secretfriends') val = p.value * 0.5;
        else if (p.id === 'superfoon') val = p.value;
        else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') val = p.value;
        else val = p.value;
      }
      const norm = String(p.id || '').toLowerCase();
      if (norm === 'superfoon') return sum + val;
      return sum + (val * p.percentage / 100);
    }, 0);
    return usdModelo * (rates?.usd_cop || 3900);
  }, [platforms, rates]);

  const router = useRouter();
  // Eliminado: Ya no maneja parámetros de admin
  // Sistema V2 siempre activo (sin flags de entorno)
  // 🔧 FIX: Autosave solo después de 2 minutos de inactividad
  const ENABLE_AUTOSAVE = true; // Habilitado con delay de inactividad
  // Animaciones deshabilitadas: sin lógica extra
  
  // 🔧 CRÍTICO: Asegurar que periodDate se inicialice correctamente al montar
  useEffect(() => {
    const start = getColombiaPeriodStartDate();
    console.log('🔍 [CALCULATOR] Initializing periodDate (Frontend):', start);
    setPeriodDate(start);
  }, []);

  // Neto disponible (anticipos + sexshop): solo para modelo, para indicar que el total COP no es el neto
  useEffect(() => {
    if (!user?.id || user?.role !== 'modelo') {
      setNetoDisponible(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;
        const res = await fetch('/api/shop/neto-disponible', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setNetoDisponible(data);
      } catch {
        if (!cancelled) setNetoDisponible(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  // 🔧 NUEVO: Cargar offset de ganancias hoy desde localStorage
  useEffect(() => {
    if (user?.id) {
      try {
        const dateKey = new Date().toISOString().split('T')[0];
        const key = `earnings_offset_${user.id}_${dateKey}`;
        const savedOffset = localStorage.getItem(key);
        if (savedOffset) {
          const parsed = Number.parseFloat(savedOffset);
          if (Number.isFinite(parsed)) {
            setEarningsOffset(parsed);
            console.log('🔍 [CALCULATOR] Loaded earnings offset:', parsed);
          }
        }
      } catch (e) {
        console.warn('⚠️ [CALCULATOR] Error loading earnings offset:', e);
      }
    }
  }, [user]);

  // 🔧 EARLY FREEZE: Cargar y actualizar estado de congelación periódicamente
  useEffect(() => {
    if (!user?.id) return;

    const loadFreezeStatus = async () => {
      try {
        const currentPeriodDate = periodDate || getColombiaPeriodStartDate();
        const freezeStatusResponse = await fetch(
          `/api/calculator/period-closure/platform-freeze-status?modelId=${user.id}&periodDate=${currentPeriodDate}`
        );
        const freezeStatusData = await freezeStatusResponse.json();
        
        if (freezeStatusData.success && Array.isArray(freezeStatusData.frozen_platforms)) {
          const frozenPlatformsList = freezeStatusData.frozen_platforms.map((p: string) => p.toLowerCase());
          setFrozenPlatforms(frozenPlatformsList);
          console.log('🧊 [CALCULATOR] Estado de congelación actualizado:', frozenPlatformsList);
        } else {
          setFrozenPlatforms([]);
        }
      } catch (freezeError) {
        console.error('❌ [CALCULATOR] Error actualizando estado de congelación:', freezeError);
      }
    };

    // Cargar inmediatamente
    loadFreezeStatus();

    // Actualizar cada 2 minutos para detectar cambios en tiempo real
    const interval = setInterval(loadFreezeStatus, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, periodDate]);

  // Handler para resetear ganancias hoy
  const handleResetTodayEarnings = () => {
    if (confirm('¿Deseas reiniciar el contador de "Ganancias Hoy"?\nEsto pondrá el contador en $0 para tu sesión actual, sin afectar los registros históricos ni los totales acumulados.')) {
      setEarningsOffset(todayEarnings);
      if (user?.id) {
        try {
          const dateKey = new Date().toISOString().split('T')[0];
          const key = `earnings_offset_${user.id}_${dateKey}`;
          localStorage.setItem(key, String(todayEarnings));
          console.log('✅ [CALCULATOR] Earnings offset saved:', todayEarnings);
        } catch (e) {
          console.warn('⚠️ [CALCULATOR] Error saving earnings offset:', e);
        }
      }
    }
  };

  // 🔧 HELPER: Funciones de sincronización bidireccional
  const syncPlatformsToInputs = (platforms: Platform[]) => {
    const newInputValues: Record<string, string> = {};
    platforms.forEach(p => {
      if (p.enabled) {
        // 🔧 FIX: Ocultar el valor 0 de la base de datos tratándolo como vacío para mostrar el placeholder
        newInputValues[p.id] = (p.value !== undefined && p.value !== null && p.value !== 0) ? String(p.value) : '';
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
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [platforms.map(p => p.value).join(','), rates, yesterdayValues]);

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
          await loadCalculatorConfig(current.id);
          setConfigLoaded(true);
        }

        // Resumen periodo/objetivo para la barra horaria
        if (current.role === 'modelo') {
          try {
            const res = await fetch(`/api/calculator/period-goal-summary?modelId=${current.id}`, { cache: 'no-store' });
            const json = await res.json();
            if (json?.success && typeof json.goalUsd === 'number') {
              setPeriodGoal({
                goalUsd: json.goalUsd,
                periodBilledUsd: json.periodBilledUsd ?? 0,
                periodBilledUsdModelo: json.periodBilledUsdModelo ?? json.periodBilledUsd ?? 0
              });
            }
          } catch (_) {}
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Rotar mensaje de la barra "Objetivo Básico" cada 7 s (progreso ↔ promedio diario)
  useEffect(() => {
    const t = setInterval(() => setObjectiveBarFlip((f) => f + 1), 7000);
    return () => clearInterval(t);
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
        console.log('🔍 [CALCULATOR] Loading saved values - V2 system only (Server Date Priority)');
        // 🔧 FIX: NO enviar periodDate desde el cliente para la carga inicial.
        // Dejar que el backend (API) determine la fecha actual de Colombia para evitar desajustes de zona horaria en el navegador del usuario.
        // const periodStart = getColombiaPeriodStartDate(); 
        
        // 🔧 CACHE BUSTING: Añadir timestamp para evitar caché del navegador
        const savedResp = await fetch(`/api/calculator/model-values-v2?modelId=${userId}&t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        const savedJson = await savedResp.json();
        console.log('🔍 [CALCULATOR] Saved values (v2) RAW RESPONSE:', savedJson);
        
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
          // Usar periodDate del estado (ya inicializado)
          const currentPeriodStart = periodDate || getColombiaPeriodStartDate();
          const yesterdayDate = new Date(new Date(currentPeriodStart).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
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
          
          // 🔧 NUEVO: Calcular ganancias del día después de cargar yesterdayValues
          // Se calculará en el useEffect cuando yesterdayValues esté listo
        } else {
          console.log('🔍 [CALCULATOR] No se encontraron valores guardados o API falló:', savedJson);
          // Asegurar que las plataformas se muestren aunque no haya valores guardados
          setPlatforms(enabledPlatforms);
          syncPlatformsToInputs(enabledPlatforms);
        }

        // 🔧 EARLY FREEZE: Cargar lista de plataformas congeladas desde el endpoint
        try {
          const freezeStatusResponse = await fetch(
            `/api/calculator/period-closure/platform-freeze-status?modelId=${userId}&periodDate=${periodDate || getColombiaPeriodStartDate()}`
          );
          const freezeStatusData = await freezeStatusResponse.json();
          
          if (freezeStatusData.success && Array.isArray(freezeStatusData.frozen_platforms)) {
            const frozenPlatformsList = freezeStatusData.frozen_platforms.map((p: string) => p.toLowerCase());
            setFrozenPlatforms(frozenPlatformsList);
            console.log('🧊 [CALCULATOR] Plataformas congeladas cargadas desde endpoint:', frozenPlatformsList);
            console.log('🧊 [CALCULATOR] Debug info:', freezeStatusData.debug);
          } else {
            console.log('🔍 [CALCULATOR] No hay plataformas congeladas o error en endpoint');
            setFrozenPlatforms([]);
          }
        } catch (freezeError) {
          console.error('❌ [CALCULATOR] Error cargando estado de congelación:', freezeError);
          setFrozenPlatforms([]);
        }

      } catch (e) {
        console.warn('⚠️ [CALCULATOR] No se pudieron cargar valores guardados:', e);
        // Asegurar que las plataformas se muestren aunque haya error
        setPlatforms(enabledPlatforms);
        syncPlatformsToInputs(enabledPlatforms);
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

      // 1. Guardar valores individuales por plataforma
      const endpoint = '/api/calculator/model-values-v2';
      // 🔧 FIX: Usar periodDate correcto
      const currentPeriodDate = getColombiaPeriodStartDate();
      const payload = { modelId: user?.id, values, periodDate: currentPeriodDate };
      
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

      // 2. Calcular y guardar totales consolidados
      console.log('🔍 [CALCULATOR] Calculating totals for billing summary...');
      
      // Calcular totales usando la misma lógica que se muestra en "Totales y Alertas"
      const totalUsdBruto = platforms.reduce((sum, p) => {
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

      const totalUsdModelo = platforms.reduce((sum, p) => {
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
        // Superfoon: 100% para el modelo (no aplicar porcentaje)
        const normId = String(p.id || '').toLowerCase();
        if (normId === 'superfoon') {
          return sum + usdModelo;
        }
        return sum + (usdModelo * p.percentage / 100);
      }, 0);

      const totalCopModelo = totalUsdModelo * (rates?.usd_cop || 3900);

      // Guardar totales consolidados
      const totalsResponse = await fetch('/api/calculator/totals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: user?.id,
          periodDate: currentPeriodDate,
          totalUsdBruto,
          totalUsdModelo,
          totalCopModelo
        }),
      });

      const totalsData = await totalsResponse.json();
      if (!totalsData.success) {
        console.error('❌ [CALCULATOR] Error saving totals:', totalsData.error);
        // No fallar la operación principal, solo loggear el error
      } else {
        console.log('✅ [CALCULATOR] Totals saved successfully');
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
    
    // Preparar mapa de valores a guardar
    const enabled = platforms.filter(p => p.enabled && p.value > 0);
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
        const periodStart = getColombiaPeriodStartDate();
        const res = await fetch('/api/calculator/model-values-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: user.id, values, periodDate: periodStart }),
          signal: controller.signal
        });
        const json = await res.json();
        if (!json.success) {
          console.warn('⚠️ [AUTOSAVE] Error guardando automáticamente:', json.error);
        } else {
          console.log('✅ [AUTOSAVE] Valores guardados automáticamente después de inactividad');
        }
      } catch (e) {
        console.warn('⚠️ [AUTOSAVE] Excepción en autosave:', e);
      }
    }, 40000); // 40 segundos = 40,000ms

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [platforms, user, saving, periodDate]); // Incluir platforms para detectar cambios

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
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
      <div className="min-h-screen flex items-center justify-center pt-16">
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
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-screen-2xl mx-auto max-sm:px-0 px-4 sm:px-6 lg:px-20 xl:px-32 py-8 pt-16 relative z-10">
        {/* Header — Migrado a PageHeader */}
        <PageHeader
          title="Mi Calculadora"
          subtitle={`Bienvenida, ${user?.name || 'Usuario'} · Ingresa tus valores por plataforma`}
          glow="model"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
        />

        {/* Barra de Isla Dinámica - Tiempos del Mundo y Cierre */}
        <DynamicTimeIsland
          className="!max-w-none !px-0"
          objetivoUsd={user?.role === 'modelo' ? periodGoal?.goalUsd : undefined}
          facturadoPeriodoUsd={user?.role === 'modelo' ? periodGoal?.periodBilledUsd : undefined}
          facturadoDisplayUsd={user?.role === 'modelo' ? periodGoal?.periodBilledUsdModelo : undefined}
        />

        {/* Tasas actualizadas - REGLA CARDS AESTHETIC */}
        <div className="flex flex-col gap-1.5 sm:gap-2 mb-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-1 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 translate-y-[1.5px]"></div>
              Tasas Actualizadas
            </h3>
          </div>
          <div className="flex-1 relative glass-card bg-white/40 dark:bg-[#0a0a0ade] backdrop-blur-xl border border-white/20 dark:border-white/[0.05] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm dark:shadow-none flex flex-col overflow-hidden">
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[70%] bg-cyan-500/10 blur-[50px] rounded-full mix-blend-screen animate-aurora-1 opacity-70"></div>
              <div className="absolute top-[10%] -right-[15%] w-[60%] h-[70%] bg-fuchsia-500/10 blur-[60px] rounded-full mix-blend-screen animate-aurora-2 opacity-70"></div>
              <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] bg-indigo-500/10 blur-[45px] rounded-full mix-blend-screen animate-aurora-3 opacity-70"></div>
            </div>
            <div className="relative z-10 flex flex-col flex-1">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <InfoCard
                  value={`$${rates?.usd_cop || 3900}`}
                  label="USD→COP"
                  color="blue"
                  size="sm"
                  clickable={false}
                />
                <InfoCard
                  value={`${rates?.eur_usd || 1.01}`}
                  label="EUR→USD"
                  color="green"
                  size="sm"
                  clickable={false}
                />
                <InfoCard
                  value={`${rates?.gbp_usd || 1.20}`}
                  label="GBP→USD"
                  color="purple"
                  size="sm"
                  clickable={false}
                  className=""
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <GlassCard padding="lg" className="mb-6 border-red-200 dark:border-red-900/30">
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
          </GlassCard>
        )}

        {/* Tabla de Calculadora - ESTILO APPLE REFINADO */}
        <div className="flex flex-col gap-1.5 sm:gap-2 mb-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-1 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 translate-y-[1.5px]"></div>
              Calculadora de Ingresos
            </h2>
          </div>
        <GlassCard padding="md" auroraEffect={true} className="!bg-white/40 dark:!bg-[#0a0a0ade] !backdrop-blur-xl border-white/20 dark:!border-white/[0.05]">
          
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
            <>
              {/* Vista de Cards Unificada (Móvil y Escritorio) */}
              <div className="space-y-3">
                {platforms.filter(p => p.enabled).map(platform => {
                  // Calcular dólares y COP para esta plataforma usando fórmulas específicas
                  const usdBruto = platform.value;
                  const isFrozen = frozenPlatforms.includes(platform.id);
                  
                  // Aplicar fórmula específica según la plataforma (mismo código que la tabla)
                  let usdModelo = 0;
                  if (platform.currency === 'EUR') {
                    if (platform.id === 'big7') {
                      usdModelo = (platform.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (platform.id === 'mondo') {
                      usdModelo = (platform.value * (rates?.eur_usd || 1.01)) * 0.78;
                    } else if (platform.id === 'superfoon') {
                      usdModelo = platform.value * (rates?.eur_usd || 1.01);
                    } else if (platform.id === 'modelka' || platform.id === 'xmodels' || platform.id === '777' || platform.id === 'vx' || platform.id === 'livecreator' || platform.id === 'mow') {
                      usdModelo = platform.value * (rates?.eur_usd || 1.01);
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
                    } else if (platform.id === 'mdh' || platform.id === 'livejasmin' || platform.id === 'imlive' || platform.id === 'hegre' || platform.id === 'dirtyfans' || platform.id === 'camcontacts') {
                      usdModelo = platform.value;
                    } else {
                      usdModelo = platform.value;
                    }
                  }
                  
                  let usdModeloFinal;
                  if (platform.id === 'superfoon') {
                    usdModeloFinal = usdModelo;
                  } else {
                    usdModeloFinal = (usdModelo * platform.percentage) / 100;
                  }
                  const copModelo = usdModeloFinal * (rates?.usd_cop || 3900);

                  const gamiLevel = gamiEvent?.platformId === platform.id && gamiEvent.active ? gamiEvent.level : 0;
                  const gamiActive = gamiLevel > 0;
                  
                  let gamiBorderClass = isFrozen ? 'border-red-200 dark:border-red-900/30' : 'border-gray-200 dark:border-white/[0.03]';
                  let gamiDropShadow = 'drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]';
                  let gamiTextShadow = 'none';
                  let gamiScaleClass = '';
                  let gamiAnimationClass = 'animate-[shake-gentle_0.5s_ease-in-out]';
                  let gamiConfettiColor = 'bg-cyan-400';
                  let gamiConfettiColor2 = 'bg-fuchsia-400';

                  if (gamiLevel >= 8) {
                    gamiBorderClass = 'border-yellow-400 shadow-[0_0_80px_rgba(250,204,21,0.8)] z-50';
                    gamiDropShadow = 'drop-shadow-[0_0_30px_rgba(250,204,21,1)]';
                    gamiTextShadow = '0 0 20px #facc15, 0 0 40px #ffffff';
                    gamiScaleClass = 'scale-[1.08]';
                    gamiConfettiColor = 'bg-yellow-400'; gamiConfettiColor2 = 'bg-orange-500';
                  } else if (gamiLevel === 7) {
                    gamiBorderClass = 'border-cyan-300 shadow-[0_0_70px_rgba(103,232,249,0.8)] z-50';
                    gamiDropShadow = 'drop-shadow-[0_0_25px_rgba(103,232,249,1)]';
                    gamiTextShadow = '0 0 15px #67e8f9, 0 0 30px #ffffff';
                    gamiScaleClass = 'scale-[1.07]';
                    gamiConfettiColor = 'bg-white'; gamiConfettiColor2 = 'bg-cyan-300';
                  } else if (gamiLevel === 6) {
                    gamiBorderClass = 'border-emerald-400 shadow-[0_0_60px_rgba(52,211,153,0.8)] z-40';
                    gamiDropShadow = 'drop-shadow-[0_0_25px_rgba(52,211,153,1)]';
                    gamiTextShadow = '0 0 15px #34d399, 0 0 30px #ffffff';
                    gamiScaleClass = 'scale-[1.06]';
                    gamiConfettiColor = 'bg-emerald-400'; gamiConfettiColor2 = 'bg-teal-300';
                  } else if (gamiLevel === 5) {
                    gamiBorderClass = 'border-indigo-400 shadow-[0_0_50px_rgba(129,140,248,0.7)] z-40';
                    gamiDropShadow = 'drop-shadow-[0_0_20px_rgba(129,140,248,1)]';
                    gamiTextShadow = '0 0 15px #818cf8, 0 0 30px #ffffff';
                    gamiScaleClass = 'scale-[1.05]';
                    gamiConfettiColor = 'bg-indigo-400'; gamiConfettiColor2 = 'bg-violet-500';
                  } else if (gamiLevel === 4) {
                    gamiBorderClass = 'border-purple-500 shadow-[0_0_40px_rgba(160,32,240,0.6)] z-40';
                    gamiDropShadow = 'drop-shadow-[0_0_20px_rgba(255,255,255,1)]';
                    gamiTextShadow = '0 0 15px #a020f0, 0 0 30px #ffffff';
                    gamiScaleClass = 'scale-[1.04]';
                  } else if (gamiLevel === 3) {
                    gamiBorderClass = 'border-fuchsia-400 shadow-[0_0_30px_rgba(232,121,249,0.5)] z-30';
                    gamiDropShadow = 'drop-shadow-[0_0_15px_rgba(232,121,249,0.9)]';
                    gamiTextShadow = '0 0 10px #e879f9';
                    gamiScaleClass = 'scale-[1.03]';
                  } else if (gamiLevel === 2) {
                    gamiBorderClass = 'border-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.3)] z-20';
                    gamiDropShadow = 'drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]';
                    gamiScaleClass = 'scale-[1.01]';
                  } else if (gamiLevel === 1) {
                    gamiBorderClass = 'border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10';
                  }

                  // 🔥 OVERRIDE GLOBAL: Si el jugador ha roto el objetivo máximo, todas las cartas vibran
                  let globalSweep = false;
                  if (objectiveGamiState?.level === 2) {
                    gamiBorderClass = 'border-fuchsia-400/80 shadow-[0_0_30px_rgba(232,121,249,0.4)] z-30';
                    gamiScaleClass = 'scale-[1.02]';
                    globalSweep = true;
                  }

                  return (
                    <div key={platform.id} className={`relative bg-gray-50 dark:bg-white/[0.03] max-sm:dark:bg-white/[0.04] backdrop-blur-xl border rounded-[0.85rem] p-2.5 sm:p-3 shadow-sm dark:shadow-none transition-all duration-700 ease-out overflow-hidden ${gamiBorderClass} ${gamiScaleClass} ${gamiLevel >= 3 || globalSweep ? gamiAnimationClass : ''}`}>
                      
                      {/* Aurora Global de Objetivo Logrado */}
                      {globalSweep && (
                        <div className="absolute inset-0 z-0 mix-blend-screen opacity-50 pointer-events-none" style={{
                          background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.6), rgba(232,121,249,0.7), transparent)',
                          backgroundSize: '200% 100%',
                          animation: 'objective-aurora-sweep 2s ease-in-out infinite alternate'
                        }}></div>
                      )}
                      
                      {/* Overlay Gamificación Exacta */}
                      {gamiActive && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                           <style>{`
                             @keyframes shake-gentle { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px) rotate(-1deg); } 75% { transform: translateX(3px) rotate(1deg); } }
                             @keyframes aurora-flow { 0% { background-position: -200% 50%; opacity: 0; } 50% { opacity: 1; } 100% { background-position: 200% 50%; opacity: 0; } }
                             @keyframes confetti-burst { 0% { transform: translateY(10px) scale(0.5); opacity: 0; } 20% { transform: translateY(-20px) scale(1.2); opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(30px) scale(1); opacity: 0; } }
                             @keyframes screen-flash { 0% { background: rgba(255,255,255,0); } 10% { background: rgba(255,255,255,0.3); } 100% { background: rgba(255,255,255,0); } }
                             @keyframes text-emerge { 0% { transform: scale(0.8); opacity: 0; filter: blur(4px); } 30% { transform: scale(1.1); opacity: 1; filter: blur(0); } 100% { transform: scale(1); opacity: 1; } }
                           `}</style>

                           {/* Flash de Pantalla Nivel 4+ */}
                           {gamiLevel >= 4 && (
                             <div className="fixed inset-0 pointer-events-none z-[9999]" style={{ animation: 'screen-flash 1s ease-out forwards' }}></div>
                           )}

                           {/* Particles Confetti (Niveles 3+) */}
                           {gamiLevel >= 3 && (
                             <div className="absolute inset-0 flex items-center justify-center overflow-visible" style={{ animation: 'confetti-burst 2.5s ease-out forwards' }}>
                               <div className="w-full h-full flex items-center justify-around absolute opacity-80">
                                  <div className={`w-2 h-2 rounded-full ${gamiConfettiColor} -translate-y-8 animate-bounce`}></div>
                                  <div className={`w-3 h-3 rotate-45 ${gamiConfettiColor2} translate-y-4 animate-pulse`}></div>
                                  <div className="w-2 h-2 rounded-full bg-white -translate-y-10 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                  <div className={`w-3 h-3 rotate-12 ${gamiConfettiColor2} translate-y-6 animate-pulse`}></div>
                               </div>
                             </div>
                           )}

                           {/* Flujo Aurora (Niveles 2+) */}
                           {gamiLevel >= 2 && (
                             <div className="absolute inset-0 mix-blend-screen opacity-70" 
                                  style={{ 
                                    background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.5), rgba(160,32,240,0.6), transparent)', 
                                    backgroundSize: '200% 100%',
                                    animation: 'aurora-flow 2.5s ease-in-out forwards' 
                                  }}>
                             </div>
                           )}
                           
                           {/* Texto Animado */}
                           <div className={`font-black uppercase tracking-widest text-center leading-none z-50 px-1 text-white ${gamiDropShadow} ${
                             gamiLevel >= 4 ? 'text-lg sm:text-2xl' : 
                             gamiLevel === 3 ? 'text-base sm:text-xl' :
                             gamiLevel === 2 ? 'text-sm sm:text-lg' : 'text-[10px] sm:text-sm'
                           }`} style={{ 
                             animation: 'text-emerge 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                             textShadow: gamiTextShadow 
                           }}>
                             {gamiEvent?.message}
                           </div>
                        </div>
                      )}

                      <div className={`relative z-10 transition-opacity duration-300 ${gamiActive ? 'opacity-0 sm:opacity-40' : 'opacity-100'}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8.5px] uppercase font-bold text-gray-600 dark:text-gray-400 bg-gray-200/60 dark:bg-white/10 px-1.5 py-[2px] rounded">
                              {['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase()) 
                                ? 'TKN' 
                                : (platform.currency || 'USD')}
                            </span>
                            <span className="font-bold text-[13px] sm:text-[14px] text-gray-800 dark:text-gray-300 uppercase tracking-wide drop-shadow-none dark:drop-shadow-none">
                              {platform.name}
                            </span>
                            {isFrozen && (
                              <span className="inline-flex items-center px-1 py-[1px] ml-1 rounded text-[8px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 align-middle">
                                🔒
                              </span>
                            )}
                          </div>
                          <div className="px-1.5 py-[2px] rounded border border-gray-200 dark:border-white/5 bg-gray-100 dark:bg-white/[0.02] text-[9.5px] text-gray-500 dark:text-gray-400 font-bold tracking-wider">
                            {platform.id === 'superfoon' ? '100%' : `${platform.percentage}%`}
                          </div>
                        </div>

                        <div className="flex justify-between items-end mt-2">
                          {/* Area del Input (Valor Principal en Caja) */}
                          <div className="flex items-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={isFrozen}
                              value={inputValues[platform.id] ?? ''}
                              onChange={(e) => {
                                if (isFrozen) return;
                                const rawValue = e.target.value;
                                const unifiedValue = rawValue.replace(',', '.');
                                
                                setInputValues(prev => ({ ...prev, [platform.id]: unifiedValue }));
                                const numeric = Number.parseFloat(unifiedValue);
                                const numericValue = Number.isFinite(numeric) ? numeric : 0;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: numericValue } : p));
                              }}
                              onFocus={() => {
                                setSessionFocusSnapshot(prev => ({ 
                                  ...prev, 
                                  [platform.id]: platforms.find(p => p.id === platform.id)?.value || 0 
                                }));
                              }}
                              onBlur={() => {
                                const currentValStr = inputValues[platform.id];
                                const currentVal = Number.parseFloat(currentValStr && currentValStr.replace(',', '.')) || 0;
                                triggerGamification(platform.id, currentVal);

                                if (currentValStr === '0' || currentValStr === '0.0' || currentValStr === '0.00') {
                                  setInputValues(prev => ({ ...prev, [platform.id]: '' }));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                  saveValues();
                                }
                              }}
                              className={`w-[64px] sm:w-[72px] h-[30px] bg-white dark:bg-white/[0.04] border border-gray-300 dark:border-white/10 rounded-md px-2 text-[14px] sm:text-[15px] font-bold touch-manipulation focus:ring-1 focus:ring-gray-400 dark:focus:ring-white/20 focus:outline-none focus:border-gray-400 dark:focus:border-white/20 text-gray-900 dark:text-gray-300 transition-all shadow-inner dark:shadow-none ${isFrozen ? 'cursor-not-allowed text-opacity-50 blur-[0.5px]' : ''}`}
                              placeholder="0,00"
                            />
                          </div>

                          {/* Bloque de Resultados */}
                          <div className="flex items-center">
                            {/* USD Mod */}
                            <div className="flex flex-col items-end w-[85px] sm:w-[120px] flex-shrink-0 pr-3 border-r border-gray-200 dark:border-white/10">
                              <span className="whitespace-nowrap text-[8px] sm:text-[10px] uppercase font-bold text-teal-600 dark:text-[#2dd4bf] opacity-80 tracking-widest mb-[1px] sm:mb-1 drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]">USD MOD<span className="hidden sm:inline">ELO</span></span>
                              <span className="text-teal-700 dark:text-[#2dd4bf] font-semibold text-[13px] tracking-tight drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]">$ {usdModeloFinal.toFixed(2)}</span>
                            </div>
                            {/* COP Mod */}
                            <div className="flex flex-col items-end w-[85px] sm:w-[120px] flex-shrink-0 pl-3">
                              <span className="whitespace-nowrap text-[8px] sm:text-[10px] uppercase font-bold text-purple-600 dark:text-[#c488fc] opacity-80 tracking-widest mb-[1px] sm:mb-1 drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.8)]"><span className="sm:hidden">GANANCIAS</span><span className="hidden sm:inline">MIS GANANCIAS</span></span>
                              <span className="text-purple-700 dark:text-[#c488fc] font-semibold text-[13px] tracking-tight drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.4)]">$ {copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vista de Tabla para Escritorio (Oculta temporalmente para prueba) */}
              <div className="hidden overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-white/[0.03] shadow-sm backdrop-blur-md">
                    <th className="text-left py-2 px-3 font-semibold text-gray-800 dark:text-gray-300 text-[11px] uppercase tracking-wider rounded-l-full border-y border-l border-gray-200/50 dark:border-white/10">PLATAFORMAS</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-800 dark:text-gray-300 text-[11px] uppercase tracking-wider border-y border-gray-200/50 dark:border-white/10">VALORES</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-800 dark:text-gray-300 text-[11px] uppercase tracking-wider border-y border-gray-200/50 dark:border-white/10">DÓLARES</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-800 dark:text-gray-300 text-[11px] uppercase tracking-wider rounded-r-full border-y border-r border-gray-200/50 dark:border-white/10">MIS GANANCIAS</th>
                  </tr>
                </thead>
                <tbody className="before:content-[''] before:block before:h-2">
                  {platforms.filter(p => p.enabled).map(platform => {
                    // Calcular dólares y COP para esta plataforma usando fórmulas específicas
                    const usdBruto = platform.value;
                    const isFrozen = frozenPlatforms.includes(platform.id); // 🧊 EARLY FREEZE
                    
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
                      } else if (platform.id === 'superfoon') {
                        usdModelo = platform.value * (rates?.eur_usd || 1.01); // EUR a USD directo
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
                      } else if (platform.id === 'mdh' || platform.id === 'livejasmin' || platform.id === 'imlive' || platform.id === 'hegre' || platform.id === 'dirtyfans' || platform.id === 'camcontacts') {
                        usdModelo = platform.value; // USD directo
                      } else {
                        usdModelo = platform.value; // USD directo por defecto
                      }
                    }
                    
                    // SUPERFOON: Aplicar 100% para la modelo (especial)
                    let usdModeloFinal;
                    if (platform.id === 'superfoon') {
                      usdModeloFinal = usdModelo; // 100% directo, sin porcentaje
                    } else {
                      usdModeloFinal = (usdModelo * platform.percentage) / 100;
                    }
                    const copModelo = usdModeloFinal * (rates?.usd_cop || 3900); // Usar tasa real
                    
                    return (
                      <tr key={platform.id} className={`hover:bg-gray-50/10 dark:hover:bg-white/[0.01] transition-colors ${isFrozen ? 'bg-gray-50/50 dark:bg-black/20' : 'bg-transparent'}`}>
                        <td className="py-2 px-3 border-b border-gray-200/20 dark:border-white/[0.04]">
                          <div className="flex items-center gap-1.5 w-full">
                            <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/5 px-1.5 py-[2px] rounded whitespace-nowrap">
                              {platform.id === 'superfoon' ? '100%' : `${platform.percentage}%`}
                            </span>
                            <span className="font-medium text-[13px] tracking-wide uppercase text-gray-900 dark:text-gray-300">
                              {platform.name}
                            </span>
                            {isFrozen && (
                              <span className="inline-flex items-center px-1.5 py-[2px] rounded text-[9px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap ml-1">
                                🔒 Cerrado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-b border-gray-200/20 dark:border-white/[0.04]">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-[2px] min-w-[28px] text-center rounded bg-gray-200/50 dark:bg-white/[0.05] border border-gray-300/50 dark:border-white/5 text-gray-600 dark:text-gray-400 text-[9px] font-semibold tracking-wide uppercase shrink-0">
                              {['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase()) 
                                ? 'TKN' 
                                : (platform.currency || 'USD')}
                            </span>
                            <div className="flex flex-col relative w-20">
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={isFrozen}
                                value={inputValues[platform.id] ?? ''}
                                onChange={(e) => {
                                  if (isFrozen) return;
                                  const rawValue = e.target.value;
                                  const unifiedValue = rawValue.replace(',', '.');
                                  
                                  setInputValues(prev => ({ ...prev, [platform.id]: unifiedValue }));
                                  const numeric = Number.parseFloat(unifiedValue);
                                  const numericValue = Number.isFinite(numeric) ? numeric : 0;
                                  setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: numericValue } : p));
                                }}
                                className={`w-full bg-white/50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/10 rounded px-2 py-0.5 text-[13px] font-medium touch-manipulation focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner ${
                                  isFrozen ? 'cursor-not-allowed text-gray-500' : 'text-gray-900 dark:text-gray-300'
                                }`}
                                placeholder={isFrozen ? "Locked" : "0,00"}
                                title={isFrozen ? "Cerrado por horario europeo" : "Ingresa el valor generado"}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 border-b border-gray-200/20 dark:border-white/[0.04]">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-[2px] rounded flex items-center justify-center bg-transparent border border-gray-300 dark:border-white/10 text-gray-500 dark:text-gray-400 text-[9px] font-semibold tracking-wide uppercase shrink-0">
                              USD
                            </span>
                            <div className="text-gray-700 dark:text-gray-400 font-medium text-[13px]">
                              ${usdModelo.toFixed(2)}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 border-b border-gray-200/20 dark:border-white/[0.04]">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-[2px] rounded flex items-center justify-center bg-transparent border border-gray-300 dark:border-white/10 text-gray-500 dark:text-gray-400 text-[9px] font-semibold tracking-wide uppercase shrink-0">
                              COP
                            </span>
                            <div className="text-gray-700 dark:text-gray-400 font-medium text-[13px]">
                              ${copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </GlassCard>
        </div>

        {/* Zona Táctil de Guardado (Mobile-First Thumb Action) */}
        <div className="w-full sm:w-auto flex justify-center sm:justify-end mb-3 sm:mb-4 mt-2 sm:mt-1 px-1 sm:px-0">
          <button
            onClick={saveValues}
            disabled={saving || platforms.filter(p => p.enabled).length === 0}
            className={`w-full sm:w-auto relative overflow-hidden min-h-[44px] sm:min-h-0 px-6 py-2.5 sm:px-6 sm:py-2 text-[13px] sm:text-[11px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center group ${
              !saving && platforms.filter(p => p.enabled).length > 0
                ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:to-fuchsia-500/30 text-white border border-cyan-400/30 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(232,121,249,0.5)] hover:border-fuchsia-400/50'
                : 'bg-black/20 text-gray-600 cursor-not-allowed border border-white/5'
            }`}
          >
            {!saving && platforms.filter(p => p.enabled).length > 0 && (
              <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                backgroundSize: '200% 100%',
                animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
              }}></div>
            )}
            <span className="relative z-10 flex items-center tracking-widest uppercase">
              {saving ? 'GUARDANDO...' : (
                <>
                  GUARDAR
                </>
              )}
            </span>
          </button>
        </div>

        {/* Totales y Alertas - REGLA CARDS AESTHETIC */}
        <div className="flex flex-col gap-1.5 sm:gap-2 h-full mb-1 sm:mb-2">
          <div className="flex items-center justify-start px-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-1 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse translate-y-[1.5px]"></div>
              Totales y Alertas
            </h3>
          </div>

          <div className="flex-1 relative glass-card bg-white/40 dark:bg-[#0a0a0ade] backdrop-blur-xl border border-white/20 dark:border-white/[0.05] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm dark:shadow-none flex flex-col overflow-hidden">
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[70%] bg-cyan-500/10 blur-[50px] rounded-full mix-blend-screen animate-aurora-1 opacity-70"></div>
              <div className="absolute top-[10%] -right-[15%] w-[60%] h-[70%] bg-fuchsia-500/10 blur-[60px] rounded-full mix-blend-screen animate-aurora-2 opacity-70"></div>
              <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] bg-indigo-500/10 blur-[45px] rounded-full mix-blend-screen animate-aurora-3 opacity-70"></div>
            </div>
            <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3">
            <InfoCard
              value={`$${Math.max(0, todayEarnings - earningsOffset).toFixed(2)}`}
              label="Ganancias Hoy ↺"
              color="blue"
              size="sm"
              onClick={handleResetTodayEarnings}
              clickable={true}
            />
            <InfoCard
              value={`$${platforms.reduce((sum, p) => {
                  // Calcular USD modelo usando fórmulas específicas + porcentaje
                  let usdModelo = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
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
                    } else if (p.id === 'superfoon') {
                      usdModelo = p.value;
                    } else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') {
                      usdModelo = p.value;
                    } else {
                      usdModelo = p.value;
                    }
                  }
                const norm = String(p.id || '').toLowerCase();
                if (norm === 'superfoon') {
                  return sum + usdModelo; // 100% para Superfoon
                }
                  return sum + (usdModelo * p.percentage / 100);
              }, 0).toFixed(2)}`}
              label="USD Modelo"
              color="green"
              size="sm"
            />
            {/* En móvil, la tercera card ocupa 2 columnas para mantener balance */}
            <InfoCard
              value={`$${((platforms.reduce((sum, p) => {
                  // Calcular USD modelo usando fórmulas específicas + porcentaje
                  let usdModelo = 0;
                  if (p.currency === 'EUR') {
                    if (p.id === 'big7') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                    } else if (p.id === 'mondo') {
                      usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
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
                    } else if (p.id === 'superfoon') {
                      usdModelo = p.value;
                    } else if (p.id === 'mdh' || p.id === 'livejasmin' || p.id === 'imlive' || p.id === 'hegre' || p.id === 'dirtyfans' || p.id === 'camcontacts') {
                      usdModelo = p.value;
                    } else {
                      usdModelo = p.value;
                    }
                  }
                const norm = String(p.id || '').toLowerCase();
                if (norm === 'superfoon') {
                  return sum + usdModelo; // 100% para Superfoon
                }
                return sum + (usdModelo * p.percentage / 100);
              }, 0)) * (rates?.usd_cop || 3900)).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              label="COP Modelo"
              color="purple"
              size="sm"
              className=""
            />
          </div>
        </div>
        </div>

          {/* Reactor Boreal (Objetivos y Métricas Dinámicas) */}
          {(() => {
            const totalUsdBruto = platforms.reduce((sum, p) => {
              let usdBruto = 0;
              if (p.currency === 'EUR') {
                if (p.id === 'big7') usdBruto = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                else if (p.id === 'mondo') usdBruto = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                else usdBruto = p.value * (rates?.eur_usd || 1.01);
              } else if (p.currency === 'GBP') {
                if (p.id === 'aw') usdBruto = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                else usdBruto = p.value * (rates?.gbp_usd || 1.20);
              } else if (p.currency === 'USD') {
                if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') usdBruto = p.value * 0.75;
                else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') usdBruto = p.value * 0.05;
                else if (p.id === 'dxlive') usdBruto = p.value * 0.60;
                else if (p.id === 'secretfriends') usdBruto = p.value * 0.5;
                else usdBruto = p.value;
              }
              return sum + usdBruto;
            }, 0);
            
            const cuotaMinima = platforms[0]?.minQuota || 470;
            
            const anticipoMaxCalculado = platforms.reduce((sum, p) => {
              let usdModelo = 0;
              if (p.currency === 'EUR') {
                if (p.id === 'big7') usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.84;
                else if (p.id === 'mondo') usdModelo = (p.value * (rates?.eur_usd || 1.01)) * 0.78;
                else usdModelo = p.value * (rates?.eur_usd || 1.01);
              } else if (p.currency === 'GBP') {
                if (p.id === 'aw') usdModelo = (p.value * (rates?.gbp_usd || 1.20)) * 0.677;
                else usdModelo = p.value * (rates?.gbp_usd || 1.20);
              } else if (p.currency === 'USD') {
                if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') usdModelo = p.value * 0.75;
                else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') usdModelo = p.value * 0.05;
                else if (p.id === 'dxlive') usdModelo = p.value * 0.60;
                else if (p.id === 'secretfriends') usdModelo = p.value * 0.5;
                else usdModelo = p.value;
              }
              if (String(p.id || '').toLowerCase() === 'superfoon') return sum + usdModelo;
              return sum + (usdModelo * p.percentage / 100);
            }, 0) * (rates?.usd_cop || 3900) * 0.9;

            const netoCalculado = Math.max(0, liveCopModelo - ((netoDisponible?.anticipos ?? 0) + (netoDisponible?.cuotas_pendientes ?? 0) + (netoDisponible?.compras_contado ?? 0) + (netoDisponible?.cuotas_primera_aprobacion ?? 0)));

            const colDate = getColombiaDate();
            const [y, m, d] = colDate.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            const nextClosure = d <= 15 ? 15 : lastDay;
            const daysLeft = Math.max(0, nextClosure - d);
            const remaining = periodGoal ? Math.max(0, periodGoal.goalUsd - periodGoal.periodBilledUsd) : 0;
            const dailyAvg = daysLeft > 0 ? remaining / daysLeft : 0;

            return (
              <div className={`mt-1 sm:mt-1.5 mb-8 relative transition-all duration-700 ease-out z-10 ${
                objectiveGamiState?.level === 2 
                  ? 'scale-[1.03] shadow-[0_0_50px_rgba(232,121,249,0.6)] rounded-2xl' 
                  : objectiveGamiState?.level === 1 
                  ? 'scale-[1.01] shadow-[0_0_20px_rgba(34,211,238,0.4)] rounded-2xl' 
                  : ''
              }`}>
                {objectiveGamiState && (
                  <style>{`
                    @keyframes objective-aurora-sweep {
                      0% { background-position: -200% 50%; opacity: 0; }
                      20% { opacity: 1; }
                      80% { opacity: 1; }
                      100% { background-position: 200% 50%; opacity: 0; }
                    }
                    @keyframes screen-flash-obj {
                      0% { background: rgba(255,255,255,0); }
                      10% { background: rgba(255,255,255,0.4); }
                      100% { background: rgba(255,255,255,0); }
                    }
                  `}</style>
                )}
                {/* Impacto Meta Cruzada (Aurora Extrema) */}
                {objectiveGamiState?.level === 2 && (
                  <div className="absolute inset-0 pointer-events-none z-50 rounded-2xl overflow-hidden mix-blend-screen" style={{ animation: 'screen-flash-obj 2s ease-out forwards' }}>
                    <div className="absolute inset-0 w-full h-full opacity-90" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.8), rgba(232,121,249,0.9), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'objective-aurora-sweep 2s ease-in-out forwards'
                    }}></div>
                  </div>
                )}
                {/* Impacto Progreso (Aurora Neón) */}
                {objectiveGamiState?.level === 1 && (
                  <div className="absolute inset-0 pointer-events-none z-50 rounded-2xl overflow-hidden mix-blend-screen opacity-90">
                    <div className="absolute inset-0 w-full h-full" style={{
                      background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.7), rgba(160,32,240,0.7), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'objective-aurora-sweep 1.5s ease-in-out forwards'
                    }}></div>
                  </div>
                )}
                <ObjectiveBorealCard 
                  totalUsdBruto={totalUsdBruto} 
                  cuotaMinima={cuotaMinima}
                  periodGoal={periodGoal || null}
                  netoDisponibleCop={netoCalculado}
                  anticipoMaxCop={anticipoMaxCalculado}
                />
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
            /* ... (resto de estilos igual) */
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
    </div>
  );
}
