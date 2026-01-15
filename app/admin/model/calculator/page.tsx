'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { getColombiaPeriodStartDate } from '@/utils/calculator-dates';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import ProgressMilestone from '@/components/ui/ProgressMilestone';
import DynamicTimeIsland from '@/components/ui/DynamicTimeIsland';

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
  // 🔧 NUEVO: Estados para plataformas mensuales en P2
  const [p1Values, setP1Values] = useState<Record<string, number>>({}); // Valores de P1 para plataformas mensuales
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, string>>({}); // Total mensual ingresado
  const [isPeriod2, setIsPeriod2] = useState<boolean>(false); // Si estamos en P2
  // 🔧 NUEVO: Estado para input flotante de P1
  const [editingP1Platform, setEditingP1Platform] = useState<string | null>(null); // ID de plataforma siendo editada
  const [p1InputValue, setP1InputValue] = useState<string>('');
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

  // 🔧 NUEVO: Cargar valores de P1 si estamos en P2
  useEffect(() => {
    const loadP1Values = async () => {
      if (!user) return;
      
      // Determinar si estamos en P2 (16-fin de mes) usando parseo seguro de strings
      // new Date('YYYY-MM-DD') usa UTC y puede devolver el día anterior en zonas horarias occidentales
      const parts = periodDate.split('-');
      const day = parseInt(parts[2], 10);
      const isP2 = day >= 16;
      console.log('🔍 [CALCULATOR] Period check:', { periodDate, day, isP2 });
      setIsPeriod2(isP2);
      
      if (isP2) {
        const p1Date = new Date(periodDate);
        p1Date.setDate(1); // Primer día del mes
        const p1DateStr = p1Date.toISOString().split('T')[0];
        
        console.log('🔍 [CALCULATOR] Fetching P1 values for monthly logic:', p1DateStr);
        const p1Res = await fetch(`/api/calculator/model-values-v2?modelId=${user.id}&periodDate=${p1DateStr}`);
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
    };
    
    if (user && periodDate) {
      loadP1Values();
    }
  }, [user, periodDate]);

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

  // 🔧 NUEVO: Cerrar input flotante al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingP1Platform) {
        const target = e.target as HTMLElement;
        if (!target.closest('.absolute.z-[100]') && !target.closest('.group')) {
          setEditingP1Platform(null);
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingP1Platform(null);
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
  }, [editingP1Platform]);

  // Handler para guardar P1
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
  };
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
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              {/* Layout móvil: vertical, escritorio: horizontal */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                {/* Título e icono */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
          </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                Mi Calculadora
              </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                Bienvenida, {user?.name || 'Usuario'} · Ingresa tus valores por plataforma
              </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Isla Dinámica - Tiempos del Mundo y Cierre */}
        <DynamicTimeIsland className="!max-w-none !px-0" />

        {/* Tasas actualizadas - ESTILO APPLE REFINADO */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-3 sm:p-4 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <h2 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3 flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Tasas Actualizadas
          </h2>
          {/* Móvil: 2 columnas, Escritorio: 3 columnas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
              <div className="text-lg sm:text-xl font-bold text-blue-700 mb-1">
                ${rates?.usd_cop || 3900}
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">USD→COP</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
              <div className="text-lg sm:text-xl font-bold text-green-700 mb-1">
                {rates?.eur_usd || 1.01}
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">EUR→USD</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105 col-span-2 sm:col-span-1">
              <div className="text-lg sm:text-xl font-bold text-purple-700 mb-1">
                {rates?.gbp_usd || 1.20}
              </div>
              <div className="text-[10px] sm:text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">GBP→USD</div>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-2 sm:mt-3 text-center font-medium">
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
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-4 sm:p-6 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
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
            <>
              {/* Vista de Cards para Móvil */}
              <div className="md:hidden space-y-3">
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
                  
                  const p1Value = p1Values[platform.id] || 0;
                  const showMonthlyFields = isPeriod2 && p1Value > 0;

                  return (
                    <div key={platform.id} className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border ${isFrozen ? 'border-red-200 dark:border-red-900/30' : 'border-gray-200 dark:border-gray-600/50'}`}>
                      {/* Header de la card */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button 
                              type="button"
                              disabled={isFrozen || !isPeriod2}
                              className={`font-semibold text-sm text-left transition-colors flex items-center gap-2 ${
                                isFrozen 
                                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                  : !isPeriod2
                                    ? 'text-gray-900 dark:text-gray-100 cursor-default'
                                    : 'text-gray-900 dark:text-gray-100 active:text-blue-600 dark:active:text-blue-400'
                              }`}
                              onClick={(e) => {
                                if (isFrozen || !isPeriod2) return;
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingP1Platform(platform.id);
                                setP1InputValue(String(p1Values[platform.id] || ''));
                              }}
                            >
                              <span>{platform.name}</span>
                              {!isFrozen && isPeriod2 && (
                                <span className="text-blue-500 text-xs">✎</span>
                              )}
                            </button>
                            {isFrozen && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                🔒 Cerrado
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Reparto: {platform.id === 'superfoon' ? '100%' : `${platform.percentage}%`}
                          </div>
                          {p1Value > 0 && (
                            <div className="mt-1 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-800/30 w-fit">
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">P1:</span>
                              <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300">{p1Value.toLocaleString('es-CO')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Input flotante de P1 para móvil */}
                      {editingP1Platform === platform.id && !isFrozen && isPeriod2 && (
                        <div className="mb-3 bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-500 rounded-lg shadow-xl p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">P1:</span>
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
                                  setP1Values(prev => ({ ...prev, [platform.id]: value }));
                                  if (monthlyTotals[platform.id]) {
                                    const monthlyTotal = Number.parseFloat(monthlyTotals[platform.id]) || 0;
                                    const p2Value = monthlyTotal - value;
                                    setInputValues(prev => ({ ...prev, [platform.id]: p2Value > 0 ? String(p2Value) : '' }));
                                    setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: p2Value } : p));
                                  }
                                  setEditingP1Platform(null);
                                } else if (e.key === 'Escape') {
                                  setEditingP1Platform(null);
                                }
                              }}
                              autoFocus
                              className="flex-1 h-11 px-3 text-base border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder="0.00"
                            />
                            <button
                              onClick={() => handleSaveP1Value(platform.id)}
                              className="h-11 px-4 bg-blue-500 text-white rounded-lg text-sm font-medium active:bg-blue-600 transition-colors touch-manipulation"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingP1Platform(null)}
                              className="h-11 px-4 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium active:bg-gray-300 dark:active:bg-gray-500 transition-colors touch-manipulation"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Input de valor principal */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Valor {showMonthlyFields ? '(Total Mensual)' : '(P2)'}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            disabled={isFrozen}
                            value={showMonthlyFields ? (monthlyTotals[platform.id] ?? '') : (inputValues[platform.id] ?? '')}
                            onChange={(e) => {
                              if (isFrozen) return;
                              const rawValue = e.target.value;
                              const unifiedValue = rawValue.replace(',', '.');
                              
                              if (showMonthlyFields) {
                                setMonthlyTotals(prev => ({ ...prev, [platform.id]: unifiedValue }));
                                const p1Value = p1Values[platform.id] || 0;
                                const monthlyTotalNum = Number.parseFloat(unifiedValue) || 0;
                                const p2Calculated = monthlyTotalNum - p1Value;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: p2Calculated } : p));
                              } else {
                                setInputValues(prev => ({ ...prev, [platform.id]: unifiedValue }));
                                const numeric = Number.parseFloat(unifiedValue);
                                const numericValue = Number.isFinite(numeric) ? numeric : 0;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: numericValue } : p));
                              }
                            }}
                            className={`flex-1 h-12 px-3 text-base border-2 rounded-lg transition-all duration-200 touch-manipulation ${
                              isFrozen
                                ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed border-gray-200 dark:border-gray-600 text-gray-500'
                                : showMonthlyFields 
                                  ? 'bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500' 
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            placeholder={isFrozen ? "Locked" : "0.00"}
                          />
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 whitespace-nowrap">
                            {['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase()) 
                              ? 'TKN' 
                              : (platform.currency || 'USD')}
                          </span>
                        </div>
                        {showMonthlyFields && (
                          <div className="text-xs text-blue-500/80 dark:text-blue-400/80 mt-1 font-medium">
                            - P1 ({(p1Values[platform.id] || 0).toFixed(0)})
                          </div>
                        )}
                      </div>

                      {/* Resultados */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">USD Modelo</div>
                          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            ${usdModeloFinal.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">COP Modelo</div>
                          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            ${copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vista de Tabla para Escritorio */}
              <div className="hidden md:block overflow-x-auto">
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
                    
                    // 🔧 FIX: Activar modo mensual automáticamente si hay un valor de P1 > 0
                    const p1Value = p1Values[platform.id] || 0;
                    const showMonthlyFields = isPeriod2 && p1Value > 0;
                    
                    return (
                      <tr key={platform.id} className={`border-b border-gray-100 dark:border-gray-600 ${isFrozen ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                        <td className="py-3 px-3">
                          <div className="relative flex flex-col items-start gap-1">
                            {/* 🔧 FIX: Contenedor flex para alinear nombre y etiqueta Cerrado */}
                            <div className="flex items-center gap-2 w-full">
                              <button 
                                type="button"
                                disabled={isFrozen || !isPeriod2} // 🧊 BLOQUEAR SI ESTÁ CONGELADO O NO ES P2
                                className={`font-medium text-sm text-left transition-colors flex items-center gap-2 group min-w-[100px] ${
                                  isFrozen 
                                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                                    : !isPeriod2
                                      ? 'text-gray-900 dark:text-gray-100 cursor-default' // No clickable pero visible
                                      : 'text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400'
                                }`}
                                onClick={(e) => {
                                  if (isFrozen || !isPeriod2) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log('👆 [CALCULATOR] Click en plataforma:', platform.id);
                                  setEditingP1Platform(platform.id);
                                  setP1InputValue(String(p1Values[platform.id] || ''));
                                }}
                                title={
                                  isFrozen 
                                    ? "Plataforma cerrada por horario europeo" 
                                    : !isPeriod2 
                                      ? "Solo disponible en el segundo periodo (16-Fin de mes)" 
                                      : "Click para ingresar valor de P1"
                                }
                              >
                                <span className={`${!isFrozen && isPeriod2 && 'underline decoration-dotted decoration-gray-400 underline-offset-2 hover:decoration-blue-500'}`}>
                                  {platform.name}
                                </span>
                                {!isFrozen && isPeriod2 && (
                                  <span className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 transition-all duration-200 transform translate-x-[-4px] group-hover:translate-x-0">
                                    ✎
                                  </span>
                                )}
                              </button>
                              {/* 🔒 Etiqueta Cerrado alineada a la derecha */}
                              {isFrozen && (
                                <span 
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap"
                                >
                                  🔒 Cerrado
                                </span>
                              )}
                            </div>
                            
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Reparto: {platform.id === 'superfoon' ? '100%' : `${platform.percentage}%`}
                            </div>
                            
                            {/* 🔧 REFERENCIA PERMANENTE DE P1 */}
                            {/* Se muestra SIEMPRE que haya un valor de P1 > 0, independiente de si se está editando o no */}
                            {p1Value > 0 && (
                               <div className="mt-1 flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/30 w-fit">
                                 <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">P1:</span>
                                 <span className="text-[10px] font-mono text-blue-700 dark:text-blue-300">{p1Value.toLocaleString('es-CO')}</span>
                               </div>
                            )}

                            {/* 🔧 NUEVO: Input flotante para P1 - Posición absoluta con z-index alto */}
                            {editingP1Platform === platform.id && !isFrozen && isPeriod2 && (
                              <div
                                className="absolute z-[100] bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-500 rounded-lg shadow-xl p-2 sm:p-3 min-w-[160px] sm:min-w-[180px]"
                                style={{
                                  top: '100%', 
                                  left: '0',
                                  marginTop: '4px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">P1:</span>
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
                                        setP1Values(prev => ({ ...prev, [platform.id]: value }));
                                        
                                        // Recalcular P2 si hay total mensual
                                        if (monthlyTotals[platform.id]) {
                                          const monthlyTotal = Number.parseFloat(monthlyTotals[platform.id]) || 0;
                                          const p2Value = monthlyTotal - value;
                                          
                                          setInputValues(prev => ({ ...prev, [platform.id]: p2Value > 0 ? String(p2Value) : '' }));
                                          setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: p2Value } : p));
                                        }
                                        
                                        setEditingP1Platform(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingP1Platform(null);
                                      }
                                    }}
                                    autoFocus
                                    className="flex-1 h-9 sm:h-10 px-2 sm:px-3 text-sm sm:text-base border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 touch-manipulation"
                                    placeholder="0.00"
                                  />
                                  <button
                                    onClick={() => handleSaveP1Value(platform.id)}
                                    className="h-9 sm:h-10 px-3 sm:px-4 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-medium active:bg-blue-600 transition-colors touch-manipulation"
                                    title="Guardar"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingP1Platform(null);
                                    }}
                                    className="h-9 sm:h-10 px-3 sm:px-4 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs sm:text-sm font-medium active:bg-gray-300 dark:active:bg-gray-500 transition-colors touch-manipulation"
                                    title="Cancelar"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2 relative">
                            <input
                              type="text"
                              inputMode="decimal"
                                disabled={isFrozen} // 🧊 BLOQUEAR SI ESTÁ CONGELADO
                                // Si es mensual (P1>0), mostrar Total Mensual. Si no, mostrar Input Normal (P2)
                                value={showMonthlyFields ? (monthlyTotals[platform.id] ?? '') : (inputValues[platform.id] ?? '')}
                              onChange={(e) => {
                                  if (isFrozen) return; // Doble check
                                const rawValue = e.target.value;
                                const unifiedValue = rawValue.replace(',', '.');
                                
                                  if (showMonthlyFields) {
                                    // LÓGICA MENSUAL: Input es Total Mensual
                                    setMonthlyTotals(prev => ({ ...prev, [platform.id]: unifiedValue }));
                                    
                                    const p1Value = p1Values[platform.id] || 0;
                                    const monthlyTotalNum = Number.parseFloat(unifiedValue) || 0;
                                    const p2Calculated = monthlyTotalNum - p1Value;
                                    
                                    // Guardar P2 calculado en platform.value (esto actualiza las columnas de resultados)
                                    setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: p2Calculated } : p));
                                  } else {
                                    // LÓGICA NORMAL: Input es P2
                                setInputValues(prev => ({ ...prev, [platform.id]: unifiedValue }));

                                const numeric = Number.parseFloat(unifiedValue);
                                const numericValue = Number.isFinite(numeric) ? numeric : 0;
                                setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, value: numericValue } : p));
                                  }
                                }}
                                className={`w-20 sm:w-24 h-9 sm:h-10 px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-base border-2 rounded-lg transition-all duration-200 touch-manipulation ${
                                  isFrozen
                                    ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed border-gray-200 dark:border-gray-600 text-gray-500'
                                    : showMonthlyFields 
                                      ? 'bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900/30 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50' 
                                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50'
                                }`}
                                placeholder={isFrozen ? "Locked" : "0.00"}
                                title={isFrozen ? "Cerrado por horario europeo" : (showMonthlyFields ? "Ingresa el TOTAL MENSUAL del mes (el sistema restará automáticamente lo reportado en P1)" : "Ingresa el valor generado en este periodo")}
                              />
                              <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm font-medium bg-gray-100 dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                {/* Mostrar TKN para plataformas que usan tokens, no la moneda */}
                                {['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase()) 
                                  ? 'TKN' 
                                  : (platform.currency || 'USD')}
                            </span>
                            </div>
                            {/* Indicador discreto de resta P1 */}
                            {showMonthlyFields && (
                               <div className="text-[10px] text-blue-500/80 dark:text-blue-400/80 mt-0.5 font-medium ml-1">
                                 - P1 ({(p1Values[platform.id] || 0).toFixed(0)})
                               </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                            ${usdModelo.toFixed(2)} USD
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                            ${copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
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
        </div>

        {/* Totales y Alertas - ESTILO APPLE REFINADO */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-3 sm:p-6 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <div className="flex items-center justify-between mb-2.5 sm:mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Totales y Alertas
            </h3>
            <button
              onClick={saveValues}
              disabled={saving || platforms.filter(p => p.enabled).length === 0}
              className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-base font-medium rounded-lg transition-all duration-200 transform active:scale-95 whitespace-nowrap touch-manipulation ${
                !saving && platforms.filter(p => p.enabled).length > 0
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg active:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          
          {/* Totales principales - Móvil: 2 columnas, Escritorio: 3 columnas */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-2.5 sm:mb-4">
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
              className="col-span-2 md:col-span-1"
            />
          </div>
          
          {/* 90% de anticipo - estilo sutil */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-600/80 rounded-xl border border-gray-200 dark:border-gray-500/50">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
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
                
                <div className="relative p-2.5 sm:p-4">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Icono animado */}
                    <div className={`relative flex-shrink-0 milestone-icon ${estaPorDebajo ? 'animate-bounce' : 'animate-pulse'}`}>
                      <div
                        className={`w-5 h-5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-md`}
                        style={{
                          background: `linear-gradient(90deg, ${iconStart}, ${iconEnd})`,
                          boxShadow: `0 4px 10px ${iconStart}33`
                        }}
                      >
                        <span className="text-white text-[10px] sm:text-sm">✓</span>
                      </div>
                    </div>
                    
                    {/* Contenido compacto */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-0">
                        <div className={`font-bold text-[11px] sm:text-sm milestone-title`} style={{ color: headingColor }}>
                          {estaPorDebajo ? 'Objetivo Básico en Progreso' : 'Objetivo Básico Alcanzado'}
                        </div>
                        {(() => {
                          const roundedProgress = Math.max(0, Math.min(100, Math.round(porcentajeAlcanzado)));
                          const remainingPct = Math.max(0, 100 - roundedProgress);
                          return (
                            <div className={`text-[9px] sm:text-xs font-medium`} style={{ color: subTextColor }}>
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
                      <div className="mt-1.5 sm:mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
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
    </>
  );
}
