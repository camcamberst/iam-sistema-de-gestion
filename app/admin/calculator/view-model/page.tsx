'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from '@/components/ui/PageHeader';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import ProgressMilestone from '@/components/ui/ProgressMilestone';
import DynamicTimeIsland from '@/components/ui/DynamicTimeIsland';
import GlassCard from '@/components/ui/GlassCard';
import ObjectiveBorealCard from '@/components/ui/ObjectiveBorealCard';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff';
  groups: string[];
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

interface Model {
  id: string;
  name: string;
  email: string;
  groups: Array<{
    id: string;
    name: string;
  }>;
  hasConfig?: boolean;
  currentConfig?: {
    id: string;
    active: boolean;
    enabled_platforms: string[];
    percentage_override: number | null;
    min_quota_override: number | null;
    group_percentage: number | null;
    group_min_quota: number | null;
  };
  calculatorData?: any; // Datos de la calculadora cargados desde la API
}

export default function AdminViewModelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingModel, setLoadingModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [syncingTotals, setSyncingTotals] = useState(false);
  const [calculatedTotals, setCalculatedTotals] = useState<any>(null);
  // 🔧 NUEVO: Estado para input flotante de P1
  const [editingP1Platform, setEditingP1Platform] = useState<string | null>(null);
  const [p1InputValue, setP1InputValue] = useState<string>('');
  // const [p1InputPosition, setP1InputPosition] = useState<{ top: number; left: number } | null>(null); // Eliminado
  const [p1Values, setP1Values] = useState<Record<string, number>>({});
  
  // 🔧 PARITY: Estados para control de periodo y congelamiento
  const [isPeriod2, setIsPeriod2] = useState<boolean>(false);
  const [frozenPlatforms, setFrozenPlatforms] = useState<string[]>([]);

  // Estados para filtros
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [mobileCarouselSide, setMobileCarouselSide] = useState<'cop' | 'usd'>('cop');
  
  const router = useRouter();
  
  const supabase = require('@/lib/supabase').supabase;

  // 🔧 NUEVO: Recalcular totales en tiempo real cuando cambian los valores
  useEffect(() => {
    if (!selectedModel || !selectedModel.calculatorData) return;

    const platforms = selectedModel.calculatorData.platforms;
    const rates = selectedModel.calculatorData.rates;
    if (!platforms || !rates) return;

    let totalUsdBruto = 0;
    let totalUsdModelo = 0;

    platforms.forEach((platform: any) => {
      // Obtener valor actual (editado o guardado)
      const editValue = editValues[platform.id];
      const savedValue = selectedModel.calculatorData.values?.find((v: any) => 
        v.platform_id === platform.id || v.platform === platform.name
      )?.value || 0;
      
      const currentValue = editValue !== undefined ? parseFloat(editValue) || 0 : savedValue;

      // Calcular USD bruto con la misma lógica de la tabla
      let usdBruto = 0;
      if (platform.currency === 'EUR') {
        if (platform.id === 'big7') {
          usdBruto = (currentValue * (rates.eur_usd || 1.01)) * 0.84;
        } else if (platform.id === 'mondo') {
          usdBruto = (currentValue * (rates.eur_usd || 1.01)) * 0.78;
        } else if (platform.id === 'superfoon') {
          usdBruto = currentValue * (rates.eur_usd || 1.01);
        } else {
          usdBruto = currentValue * (rates.eur_usd || 1.01);
        }
      } else if (platform.currency === 'GBP') {
        if (platform.id === 'aw') {
          usdBruto = (currentValue * (rates.gbp_usd || 1.20)) * 0.677;
        } else {
          usdBruto = currentValue * (rates.gbp_usd || 1.20);
        }
      } else if (platform.currency === 'USD') {
        if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
          usdBruto = currentValue * 0.75;
        } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
          usdBruto = currentValue * 0.05;
        } else if (platform.id === 'dxlive') {
          usdBruto = currentValue * 0.60;
        } else if (platform.id === 'secretfriends') {
          usdBruto = currentValue * 0.5;
        } else {
          usdBruto = currentValue;
        }
      }

      totalUsdBruto += usdBruto;
      
      // Aplicar porcentaje de reparto
      const usdModeloFinal = (platform.id === 'superfoon') 
        ? usdBruto 
        : (usdBruto * platform.percentage) / 100;
      
      totalUsdModelo += usdModeloFinal;
    });

    const totalCopModelo = totalUsdModelo * (rates.usd_cop || 3900);
    const objetivoBasico = 470; // Hardcoded para paridad
    const porcentajeAlcanzado = (totalUsdModelo / objetivoBasico) * 100;

    // 🔧 NORMALIZACIÓN DE FECHA PARA TOTALES (Día 1 o 16)
    // Replicamos la lógica del backend para asegurar que caiga en el mismo bucket
    const rawPeriodDate = selectedModel.calculatorData.periodDate || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const dateParts = rawPeriodDate.split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]);
    const day = parseInt(dateParts[2]);
    const normalizedDay = day <= 15 ? '01' : '16';
    const normalizedPeriodDate = `${year}-${String(month).padStart(2, '0')}-${normalizedDay}`;

    setCalculatedTotals({
      usdBruto: totalUsdBruto,
      usdModelo: totalUsdModelo,
      copModelo: totalCopModelo,
      objetivoBasico,
      porcentajeAlcanzado,
      normalizedPeriodDate // Guardamos la fecha normalizada para el POST
    });

  }, [editValues, selectedModel]);

  // 🔧 NUEVO: Cerrar input flotante al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingP1Platform) {
        const target = e.target as HTMLElement;
        if (!target.closest('.absolute.z-50')) {
          setEditingP1Platform(null);
        }
      }
    };
    if (editingP1Platform) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [editingP1Platform]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        console.log('🔍 [VIEW-MODEL] Iniciando carga de usuario y modelos...');
        
        // Load current user
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        console.log('🔍 [VIEW-MODEL] Usuario autenticado:', uid);
        
        if (!uid) {
          console.error('❌ [VIEW-MODEL] No hay usuario autenticado');
          setUser(null);
          setLoading(false);
          return;
        }
        
        const { data: userRow, error: userError } = await supabase
          .from('users')
          .select('id,name,email,role')
          .eq('id', uid)
          .single();
        
        console.log('🔍 [VIEW-MODEL] Datos de usuario:', { userRow, userError });
        
        let groups: string[] = [];
        if (userRow && userRow.role !== 'super_admin') {
          const { data: ug } = await supabase
            .from('user_groups')
            .select('groups(name)')
            .eq('user_id', uid);
          groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
          console.log('🔍 [VIEW-MODEL] Grupos del usuario:', groups);
        }
        
        const userData = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'modelo',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString()
        };
        
        console.log('🔍 [VIEW-MODEL] Usuario configurado:', userData);
        setUser(userData);

        // Cargar grupos primero (con filtro de afiliado)
        await loadGroups(userData);
        
        // Load models according to hierarchy
        console.log('🔍 [VIEW-MODEL] Cargando modelos con adminId:', uid);
        await loadModels(uid);
        
      } catch (err: any) {
        console.error('❌ [VIEW-MODEL] Error loading user:', err);
        setError(err.message || 'Error al cargar usuario');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 🔧 UX FIX: Restaurar modelo seleccionada solo si hay modelId en URL (navegación/refresh)
  useEffect(() => {
    if (allModels.length > 0 && !selectedModel && user) {
      const modelIdFromUrl = new URLSearchParams(window.location.search).get('modelId');
      
      // Solo restaurar si hay modelId en la URL (indica navegación o refresh durante gestión)
      if (modelIdFromUrl) {
        console.log('🔍 [UX-FIX] Restaurando modelo desde URL:', modelIdFromUrl);
        const model = allModels.find(m => m.id === modelIdFromUrl);
        if (model) {
          console.log('✅ [UX-FIX] Modelo encontrado, restaurando:', model.name);
          handleModelSelect(model, false); // false = no actualizar URL/storage
        } else {
          console.warn('⚠️ [UX-FIX] Modelo no encontrado, limpiando URL');
          const url = new URL(window.location.href);
          url.searchParams.delete('modelId');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      } else {
        // Si no hay modelId en URL, limpiar localStorage para entrada directa
        console.log('🔍 [UX-FIX] Entrada directa detectada, limpiando localStorage');
        localStorage.removeItem('admin-selected-model-id');
      }
    }
  }, [allModels, selectedModel, user]);

  const loadGroups = async (userData?: User | null) => {
    try {
      console.log('🔍 [LOAD-GROUPS] Cargando grupos desde API...');
      
      // Obtener token de autenticación
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('❌ [LOAD-GROUPS] No hay token de autenticación');
        return;
      }
      
      // Cargar grupos desde /api/groups que ya aplica el filtro de afiliado
      const response = await fetch('/api/groups', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('❌ [LOAD-GROUPS] Error en response:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('🔍 [LOAD-GROUPS] Response data:', data);
      
      if (data.success && data.groups) {
        const filteredGroups = data.groups
          .map((g: any) => ({ id: g.id, name: g.name }));
        
        console.log('✅ [LOAD-GROUPS] Grupos cargados y filtrados:', filteredGroups.length);
        console.log('🔍 [LOAD-GROUPS] Grupos:', filteredGroups.map((g: any) => g.name));
        
        // Usar userData pasado como parámetro o el estado user
        const currentUser = userData || user;
        
        // Si es admin (no super_admin), filtrar por sus grupos asignados
        if (currentUser && currentUser.role === 'admin' && currentUser.groups.length > 0) {
          const adminGroups = filteredGroups.filter((group: any) => 
            currentUser.groups.includes(group.name)
          );
          console.log('🔍 [LOAD-GROUPS] Grupos filtrados para admin:', adminGroups.length);
          setAvailableGroups(adminGroups);
        } else {
          setAvailableGroups(filteredGroups);
        }
      } else {
        console.error('❌ [LOAD-GROUPS] Error en response:', data.error);
      }
    } catch (err: any) {
      console.error('❌ [LOAD-GROUPS] Error en catch:', err);
    }
  };

  const loadModels = async (adminId: string) => {
    try {
      console.log('🔍 [LOAD-MODELS] Iniciando carga con adminId:', adminId);
      const url = `/api/calculator/models?adminId=${adminId}`;
      console.log('🔍 [LOAD-MODELS] URL:', url);
      
      const response = await fetch(url);
      console.log('🔍 [LOAD-MODELS] Response status:', response.status);
      
      const data = await response.json();
      console.log('🔍 [LOAD-MODELS] Response data:', data);
      
      if (data.success) {
        const modelsData = data.models || [];
        console.log('✅ [LOAD-MODELS] Modelos recibidos:', modelsData.length);
        console.log('🔍 [LOAD-MODELS] Primer modelo:', modelsData[0]);
        
        setAllModels(modelsData);
        setModels(modelsData);
        
        // Los grupos ahora se cargan desde /api/groups con filtro de afiliado
        // No extraer grupos de los modelos para evitar mezclar Innova con afiliados
        console.log('✅ [LOAD-MODELS] Modelos cargados. Grupos se cargan por separado desde /api/groups');
      } else {
        console.error('❌ [LOAD-MODELS] Error en response:', data.error);
        setError(data.error || 'Error al cargar modelos');
      }
    } catch (err: any) {
      console.error('❌ [LOAD-MODELS] Error en catch:', err);
      setError(err.message || 'Error al cargar modelos');
    }
  };

  const loadCalculatedTotals = async (modelId: string) => {
    try {
      console.log('🔍 [ADMIN-TOTALS] Loading calculated totals for model:', modelId);
      const response = await fetch(`/api/calculator/admin-totals?modelId=${modelId}&adminId=${user?.id}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ [ADMIN-TOTALS] Totals loaded:', data.totals);
        setCalculatedTotals(data.totals);
      } else {
        console.error('❌ [ADMIN-TOTALS] Error loading totals:', data.error);
        setCalculatedTotals(null);
      }
    } catch (err: any) {
      console.error('❌ [ADMIN-TOTALS] Error loading totals:', err);
      setCalculatedTotals(null);
    }
  };

  const syncTotals = async () => {
    try {
      if (!selectedModel) return;

      setSyncingTotals(true);
      
      // Recargar totales calculados desde el servidor
      await loadCalculatedTotals(selectedModel.id);
      
      console.log('✅ [ADMIN-VIEW] Totales sincronizados desde el servidor');
    } catch (e) {
      console.error('❌ [ADMIN-VIEW] Error en syncTotals:', e);
    } finally {
      setSyncingTotals(false);
    }
  };

  const handleModelSelect = async (model: Model, persistSelection: boolean = true) => {
    try {
      setLoadingModel(true);
      setError(null);
      
      // 🔧 UX FIX: Persistir selección en URL y localStorage
      if (persistSelection) {
        // Actualizar URL sin causar re-render
        const url = new URL(window.location.href);
        url.searchParams.set('modelId', model.id);
        window.history.replaceState({}, '', url.pathname + url.search);
        
        // Guardar en localStorage como respaldo
        localStorage.setItem('admin-selected-model-id', model.id);
        console.log('💾 [UX-FIX] Selección persistida:', model.name);
      }
      
      // Cargar datos de la calculadora del modelo
      const response = await fetch(`/api/calculator/admin-view?modelId=${model.id}&adminId=${user?.id}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('🔍 [ADMIN-VIEW] Calculator data received:', data);
        console.log('🔍 [ADMIN-VIEW] Platforms:', data.platforms);
        console.log('🔍 [ADMIN-VIEW] Values:', data.values);
        console.log('🔍 [ADMIN-VIEW] Values count:', data.values?.length || 0);
        console.log('🔍 [ADMIN-VIEW] Period date:', data.periodDate);
        
        setSelectedModel({
          ...model,
          calculatorData: data
        });

        // 🔧 PARITY: Calcular isPeriod2 de forma segura
        if (data.periodDate) {
          const parts = data.periodDate.split('-');
          const day = parseInt(parts[2], 10);
          setIsPeriod2(day >= 16);
          console.log('🔍 [ADMIN-VIEW] Period check:', { periodDate: data.periodDate, day, isP2: day >= 16 });
        }

        // 🔧 PARITY: Setear frozen platforms
        if (data.frozenPlatforms) {
          setFrozenPlatforms(data.frozenPlatforms);
          console.log('🧊 [ADMIN-VIEW] Frozen platforms:', data.frozenPlatforms);
        } else {
          setFrozenPlatforms([]);
        }

        // Cargar totales calculados desde el servidor
        await loadCalculatedTotals(model.id);
      } else {
        setError(data.error || 'Error al cargar datos de la calculadora');
      }
    } catch (err: any) {
      console.error('Error loading calculator data:', err);
      setError(err.message || 'Error al cargar datos de la calculadora');
    } finally {
      setLoadingModel(false);
    }
  };

  const handleBackToModels = () => {
    setSelectedModel(null);
    setSelectedModelId('');
    setEditValues({});
    setHasChanges(false);
    setIsPeriod2(false); // Reset
    setFrozenPlatforms([]); // Reset
    
    // 🔧 UX FIX: Limpiar URL y localStorage al volver a la lista
    localStorage.removeItem('admin-selected-model-id');
    const url = new URL(window.location.href);
    url.searchParams.delete('modelId');
    window.history.replaceState({}, '', url.pathname + url.search);
    console.log('🧹 [UX-FIX] Selección limpiada');
  };

  // Función para filtrar por grupo
  const handleGroupFilter = (groupId: string) => {
    setSelectedGroup(groupId);
    applyFilters(groupId, nameFilter);
  };

  // Función para filtrar por nombre
  const handleNameFilter = (name: string) => {
    setNameFilter(name);
    applyFilters(selectedGroup, name);
  };

  // Aplicar ambos filtros
  const applyFilters = (groupId: string, name: string) => {
    let filteredModels = allModels;

    // Filtrar por grupo
    if (groupId) {
      filteredModels = filteredModels.filter(model =>
        model.groups.some(group => group.id === groupId)
      );
    }

    // Filtrar por nombre
    if (name.trim()) {
      const searchTerm = name.toLowerCase().trim();
      filteredModels = filteredModels.filter(model =>
        model.name.toLowerCase().includes(searchTerm) ||
        model.email.toLowerCase().includes(searchTerm) ||
        model.email.split('@')[0].toLowerCase().includes(searchTerm)
      );
    }

    setModels(filteredModels);
    
    // Reset selected model if it's not in the filtered results
    if (selectedModelId && !filteredModels.find(m => m.id === selectedModelId)) {
      setSelectedModelId('');
    }
  };

  // Función para seleccionar modelo desde dropdown
  const handleModelDropdownSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    if (modelId) {
      const model = models.find(m => m.id === modelId);
      if (model) {
        handleModelSelect(model);
      }
    }
  };

  const handleValueChange = (platformId: string, value: string) => {
    console.log('🔍 [VALUE-CHANGE] Platform:', platformId, 'Value:', value);
    setEditValues(prev => {
      const newValues = {
      ...prev,
      [platformId]: value
      };
      console.log('🔍 [VALUE-CHANGE] Updated editValues:', newValues);
      return newValues;
    });
    setHasChanges(true);
  };

  // 🔧 AUTOSAVE: Guardar automáticamente después de 40 segundos de inactividad
  useEffect(() => {
    if (!selectedModel || !user || !hasChanges || saving) return;

    console.log('🔄 [ADMIN-AUTOSAVE] Iniciando timer de autosave...');
    
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        console.log('🔄 [ADMIN-AUTOSAVE] Ejecutando autosave después de 40 segundos de inactividad...');
        
        // Convertir valores de string a number
        const valuesToSave: Record<string, number> = {};
        Object.entries(editValues).forEach(([platformId, value]) => {
          const numericValue = Number.parseFloat(value) || 0;
          valuesToSave[platformId] = numericValue;
        });

        const response = await fetch('/api/calculator/model-values-v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modelId: selectedModel.id,
            values: valuesToSave,
            periodDate: selectedModel.calculatorData.periodDate
          }),
          signal: controller.signal
        });

        const data = await response.json();
        
        if (data.success) {
          console.log('✅ [ADMIN-AUTOSAVE] Autosave completado exitosamente');

          // 🔧 NUEVO: También actualizar totales en autosave
          if (calculatedTotals) {
            console.log('🔄 [ADMIN-AUTOSAVE] Actualizando totales también con fecha normalizada:', calculatedTotals.normalizedPeriodDate);
            await fetch('/api/calculator/totals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                modelId: selectedModel.id,
                periodDate: calculatedTotals.normalizedPeriodDate,
                totalUsdBruto: calculatedTotals.usdBruto,
                totalUsdModelo: calculatedTotals.usdModelo,
                totalCopModelo: calculatedTotals.copModelo
              }),
              signal: controller.signal
            });
          }

          setHasChanges(false);
          
          // Notificación elegante
          const notification = document.createElement('div');
          notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 z-50';
          notification.innerHTML = 'Guardado automático completado';
          document.body.appendChild(notification);
          
          setTimeout(() => notification.style.transform = 'translateX(0)', 100);
          setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => document.body.removeChild(notification), 300);
          }, 2000);
        } else {
          console.warn('⚠️ [ADMIN-AUTOSAVE] Error en autosave:', data.error);
        }
      } catch (e) {
        console.warn('⚠️ [ADMIN-AUTOSAVE] Excepción en autosave:', e);
      }
    }, 40000); // 40 segundos = 40,000ms

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [editValues, selectedModel, user, hasChanges, saving]);

  const handleSave = async () => {
    if (!selectedModel || !user) return;

    console.log('🔍 [ADMIN-SAVE] Starting save process');
    console.log('🔍 [ADMIN-SAVE] Current editValues:', editValues);
    console.log('🔍 [ADMIN-SAVE] Has changes:', hasChanges);

    try {
      setSaving(true);
      setError(null);

      // Convertir valores de string a number
      const valuesToSave: Record<string, number> = {};
      Object.entries(editValues).forEach(([platformId, value]) => {
        const numericValue = Number.parseFloat(value) || 0;
        // 🔧 FIX: Guardar todos los valores, incluyendo 0
          valuesToSave[platformId] = numericValue;
      });

      console.log('🔍 [ADMIN-EDIT] Saving values:', valuesToSave);

      const response = await fetch('/api/calculator/model-values-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          values: valuesToSave,
          periodDate: selectedModel.calculatorData.periodDate
        }),
      });

      const data = await response.json();
      console.log('🔍 [ADMIN-EDIT] Save result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      console.log('✅ [ADMIN-EDIT] Values saved successfully');
      
      // 2. Actualizar calculator_totals si hay resultado calculado
      // Esto es crítico para que los dashboards muestren los datos actualizados
      if (calculatedTotals) {
        console.log('💾 [ADMIN-EDIT] Updating calculator_totals with normalized date:', {
          date: calculatedTotals.normalizedPeriodDate,
          totalUsdBruto: calculatedTotals.usdBruto,
          totalUsdModelo: calculatedTotals.usdModelo,
          totalCopModelo: calculatedTotals.copModelo
        });

        await fetch('/api/calculator/totals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedModel.id,
            periodDate: calculatedTotals.normalizedPeriodDate,
            totalUsdBruto: calculatedTotals.usdBruto,
            totalUsdModelo: calculatedTotals.usdModelo,
            totalCopModelo: calculatedTotals.copModelo
          })
        });
        console.log('✅ [ADMIN-EDIT] Totals updated successfully');
      }

      // 🔧 FIX: Limpiar estado de edición ANTES de recargar
      setEditValues({});
      setHasChanges(false);
      
      // Recargar datos de la calculadora
      await handleModelSelect(selectedModel);
      
      // Notificación elegante estilo Apple
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 z-50';
      notification.innerHTML = 'Valores guardados correctamente';
      document.body.appendChild(notification);
      
      // Animar entrada
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      // Remover después de 3 segundos
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);

    } catch (err: any) {
      console.error('❌ [ADMIN-EDIT] Save error:', err);
      setError(err.message || 'Error al guardar valores');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-600/20 p-8 max-w-md dark:shadow-lg dark:shadow-red-900/15 dark:ring-0.5 dark:ring-red-400/20">
        <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4 text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()}
              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
          >
            Reintentar
          </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'superadmin_aff')) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-600/20 p-8 max-w-md dark:shadow-lg dark:shadow-red-900/15 dark:ring-0.5 dark:ring-red-400/20">
        <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4 text-sm">No tienes permisos para acceder a esta función</p>
          <button 
            onClick={() => router.push('/admin/dashboard')}
              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
          >
            Volver al Dashboard
          </button>
          </div>
        </div>
      </div>
    );
  }



  // Mostrar lista de modelos con panel de filtros
  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header estandarizado */}
        <PageHeader 
          title="Consultar Calculadora"
          subtitle="Selecciona un modelo para ver y editar su calculadora"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
          glow="admin"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 px-3 sm:px-0">
          {/* Panel izquierdo: Filtros */}
          <div className="md:col-span-1 relative z-20">
          {/* Título exterior: Por Grupo */}
          {availableGroups.length > 0 && (
            <div className="flex items-center gap-2 px-1 sm:px-2 mb-2 sm:mb-3">
              <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Por Grupo</h2>
            </div>
          )}
          
          <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-3 space-y-4 sm:space-y-6">
            
            {/* Filtro por Grupo */}
            {availableGroups.length > 0 && (
              <div>
                <AppleDropdown
                  options={availableGroups.map(group => ({
                    value: group.id,
                    label: group.name
                  }))}
                  value={selectedGroup}
                  onChange={handleGroupFilter}
                  placeholder="Selecciona"
                  className="text-sm"
                />
              </div>
            )}
            
            {/* Buscador y Selección de Modelo Integrados */}
            <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <svg className="w-[18px] h-[18px] text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.5)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Buscar o Seleccionar</h2>
                </div>
                {nameFilter.trim() !== '' && (
                  <span className="text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {models.length} resultados
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-black/30 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por correo..."
                    value={nameFilter}
                    onChange={(e) => handleNameFilter(e.target.value)}
                    className="apple-input w-full text-sm h-[38px] pl-9 pr-8 rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
                  />
                  {nameFilter && (
                    <button 
                      onClick={() => handleNameFilter('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Dropdown vinculado automáticamente */}
                <AppleDropdown
                  options={models.map(model => ({
                    value: model.id,
                    label: model.email.split('@')[0]
                  }))}
                  value={selectedModelId}
                  onChange={handleModelDropdownSelect}
                  placeholder={models.length > 0 ? "Seleccionar modelo..." : "No hay modelos"}
                  className="text-sm"
                  autoOpen={nameFilter.trim().length > 0}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Panel derecho: Calculadora o Estado Vacío */}
          <div className="md:col-span-2 relative z-10">
            {loadingModel ? (
              /* Skeleton Loading State style matching Apple Style 2 */
              <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-6 sm:p-8 animate-pulse w-full">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 bg-black/10 dark:bg-white/10 rounded-full animate-pulse"></div>
                   <div className="flex-1">
                     <div className="h-6 bg-black/10 dark:bg-white/10 rounded w-1/3 mb-2"></div>
                     <div className="h-4 bg-black/5 dark:bg-white/5 rounded w-1/4"></div>
                   </div>
                </div>
                
                {/* Tasas Skeleton */}
                <div className="h-28 bg-black/5 dark:bg-white/5 rounded-xl w-full mb-6"></div>
                
                {/* Calculator Table Skeleton */}
                <div className="h-64 bg-black/5 dark:bg-white/5 rounded-xl w-full"></div>
              </div>
            ) : selectedModel ? (
            <div className="w-full">
              {/* Header */}
          <div className="mb-4 sm:mb-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                Calculadora de {selectedModel.name.split(' ').slice(0, 2).join(' ')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm truncate">
                {selectedModel.groups.map(g => g.name).join(', ')}
              </p>
            </div>

            {/* Footer actions */}
              <div className="flex justify-end gap-2 flex-shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="btn-apple-primary active:scale-[0.97] touch-manipulation whitespace-nowrap disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>

          {/* Datos de la calculadora */}
          {selectedModel.calculatorData ? (
            <div className="space-y-3 sm:space-y-4">
              {/* Tasas actualizadas - REGLA CARDS AESTHETIC */}
              <div className="flex flex-col gap-1.5 sm:gap-2 mb-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-1 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 translate-y-[1.5px]"></div>
                    Tasas Actualizadas
                  </h3>
                </div>
                <InfoCardGrid
                  compactContainer={true}
                  columns={3}
                  cards={[
                    {
                      value: `${selectedModel.calculatorData.rates?.gbp_usd || 1.20}`,
                      label: "GBP→USD",
                      color: "blue",
                      size: "sm",
                      clickable: false
                    },
                    {
                      value: `${selectedModel.calculatorData.rates?.eur_usd || 1.01}`,
                      label: "EUR→USD",
                      color: "green",
                      size: "sm",
                      clickable: false
                    },
                    {
                      value: `$${selectedModel.calculatorData.rates?.usd_cop || 3900}`,
                      label: "USD→COP",
                      color: "purple",
                      size: "sm",
                      clickable: false
                    }
                  ]}
                />
              </div>




              {/* Tabla de Calculadora - ESTILO APPLE REFINADO */}
              <div className="flex flex-col gap-1.5 sm:gap-2 mb-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-1 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 translate-y-[1.5px]"></div>
                    Calculadora de Ingresos
                  </h2>
                </div>
              <GlassCard padding="none" auroraEffect={false} className="!bg-black/[0.08] dark:!bg-white/[0.06] !backdrop-blur-3xl !border-white/40 dark:!border-white/[0.08] !shadow-sm !shadow-black/5 !rounded-[1.1rem] sm:!rounded-[1.25rem] md:!rounded-[1.25rem] !p-1 sm:!p-1.5 !overflow-hidden">
                
                {!selectedModel.calculatorData.isConfigured || !selectedModel.calculatorData.platforms || selectedModel.calculatorData.platforms.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"></div>
                    <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay plataformas habilitadas</h4>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                      Esta modelo no tiene configuración de calculadora o plataformas habilitadas.
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                      Contacta al administrador para que configure las plataformas.
                    </p>
                  </div>
                ) : (
                  <>
                  {/* Vista de Cards (Desktop & Móvil) */}
                  <div className="w-full flex flex-col gap-1 sm:gap-1.5">
                    {selectedModel.calculatorData.platforms.map((platform: any) => {
                      const currentValue = selectedModel.calculatorData.values?.find((v: any) => 
                        v.platform_id === platform.id || v.platform === platform.name
                      )?.value || 0;
                      const rates = selectedModel.calculatorData.rates;
                      
                      let usdBruto = 0;
                      if (platform.currency === 'EUR') {
                        if (platform.id === 'big7') {
                          usdBruto = (currentValue * (rates?.eur_usd || 1.01)) * 0.84;
                        } else if (platform.id === 'mondo') {
                          usdBruto = (currentValue * (rates?.eur_usd || 1.01)) * 0.78;
                        } else if (platform.id === 'superfoon') {
                          usdBruto = currentValue * (rates?.eur_usd || 1.01);
                        } else {
                          usdBruto = currentValue * (rates?.eur_usd || 1.01);
                        }
                      } else if (platform.currency === 'GBP') {
                        if (platform.id === 'aw') {
                          usdBruto = (currentValue * (rates?.gbp_usd || 1.20)) * 0.677;
                        } else {
                          usdBruto = currentValue * (rates?.gbp_usd || 1.20);
                        }
                      } else if (platform.currency === 'USD') {
                        if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
                          usdBruto = currentValue * 0.75;
                        } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
                          usdBruto = currentValue * 0.05;
                        } else if (platform.id === 'dxlive') {
                          usdBruto = currentValue * 0.60;
                        } else if (platform.id === 'secretfriends') {
                          usdBruto = currentValue * 0.5;
                        } else {
                          usdBruto = currentValue;
                        }
                      }
                      
                      const usdModeloFinal = (platform.id === 'superfoon') 
                        ? usdBruto
                        : (usdBruto * platform.percentage) / 100;
                      const copModelo = usdModeloFinal * (rates?.usd_cop || 3900);
                      const isFrozen = frozenPlatforms.includes(platform.id);
                      const p1Value = p1Values[platform.id] || 0;

                      return (
                      <div key={platform.id} className={`relative z-10 transition-opacity duration-300 opacity-100 border-b border-gray-100 dark:border-white/5 last:border-0 p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] rounded-[0.85rem] ${isFrozen ? 'bg-gray-50/50 dark:bg-black/20' : ''}`}>
                        {/* Layout unificado: ¡Una sola línea para Móvil y Desktop! */}
                        <div className="flex items-end justify-between gap-2 sm:gap-4 w-full">
                          
                          {/* Izquierda: Nombre (Móvil) | Porcentaje, Divisa, Nombre (Desktop) */}
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 pb-[1px]">
                            {/* 1. Porcentaje (SOLO ESCRITORIO) */}
                            <div className="hidden sm:flex w-[32px] text-[8.5px] uppercase font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.02] py-[2px] rounded tracking-wider items-center justify-center shrink-0 whitespace-nowrap">
                              {platform.id === 'superfoon' ? '100%' : `${platform.percentage}%`}
                            </div>
                            
                            {/* 2. Divisa (Unificado para Móvil y Escritorio) */}
                            <span className={`flex text-[8.5px] uppercase font-bold px-1.5 py-[2px] rounded items-center justify-center shrink-0 ${
                              (() => {
                                const curr = ['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase()) ? 'TKN' : (platform.currency || 'USD');
                                if (curr === 'EUR') return 'bg-emerald-100/60 dark:bg-[#2dd4bf]/15 text-emerald-700 dark:text-[#2dd4bf]';
                                if (curr === 'GBP') return 'bg-blue-100/60 dark:bg-[#5caaf5]/15 text-blue-700 dark:text-[#5caaf5]';
                                return 'bg-purple-100/60 dark:bg-[#c488fc]/15 text-purple-700 dark:text-[#c488fc]';
                              })()
                            }`}>
                              {['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase()) 
                                ? 'TKN' 
                                : (platform.currency || 'USD')}
                            </span>

                            {/* 3. Nombre de la Plataforma (Visible en ambos, se trunca en móvil si falta espacio) */}
                            <span className="font-bold text-[13.5px] sm:text-[14px] text-gray-800 dark:text-gray-300 uppercase tracking-wide drop-shadow-none dark:drop-shadow-none truncate">
                              {platform.name}
                            </span>
                            
                            {isFrozen && (
                              <span className="inline-flex items-center px-1 py-[1px] rounded text-[8px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 align-middle shrink-0">
                                🔒
                              </span>
                            )}
                          </div>

                          {/* Derecha: Input y Resultados */}
                          <div className="flex items-end justify-end gap-3 sm:gap-[40px] shrink-0">
                            {/* Input */}
                            <div className="flex items-center pb-[1px] sm:pb-0 sm:translate-y-[2px]">
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={isFrozen}
                                placeholder="0.00"
                                value={editValues[platform.id] !== undefined ? editValues[platform.id] : (currentValue === 0 ? '' : currentValue.toFixed(2))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                    handleSave();
                                  }
                                }}
                                onChange={(e) => {
                                  if (isFrozen) return;
                                  const raw = e.target.value;
                                  const cleaned = raw.replace(/[^0-9.,]/g, '');
                                  const normalized = cleaned.replace(',', '.');
                                  const parts = normalized.split('.');
                                  const safeNormalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
                                  handleValueChange(platform.id, safeNormalized);
                                }}
                                onBlur={(e) => {
                                  let currentValStr = e.target.value;
                                  if (!currentValStr) return;
                                  const currentVal = Number.parseFloat(currentValStr.replace(',', '.')) || 0;
                                  if (currentVal === 0) {
                                    handleValueChange(platform.id, '');
                                  } else {
                                    const isToken = ['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.id.toLowerCase());
                                    const formattedVal = currentVal.toFixed(isToken ? 0 : 2);
                                    handleValueChange(platform.id, formattedVal);
                                  }
                                }}
                                className={`h-[26px] sm:h-[28px] w-[60px] sm:!w-[60px] bg-black/[0.03] hover:bg-black/[0.05] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/10 rounded-md px-1.5 text-[12px] sm:text-[13px] font-bold text-right sm:text-left touch-manipulation focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 focus:outline-none focus:bg-white dark:focus:bg-white/[0.06] focus:border-black/10 dark:focus:border-white/20 text-gray-900 dark:text-gray-300 shadow-inner dark:shadow-none ${isFrozen ? 'cursor-not-allowed text-opacity-50 blur-[0.5px]' : ''}`}
                              />
                            </div>

                            {/* Resultados */}
                            <div 
                              className="flex items-end cursor-pointer sm:cursor-default"
                              onClick={() => {
                                if (window.innerWidth < 640) {
                                  setMobileCarouselSide(prev => prev === 'cop' ? 'usd' : 'cop');
                                }
                              }}
                            >
                              {/* --- VISTA DESKTOP --- */}
                              <div className="hidden sm:flex items-end">
                                {/* USD Mod */}
                                <div className="flex flex-col items-start w-[100px] flex-shrink-0 pr-3 border-r border-gray-200 dark:border-white/10">
                                  <span className="whitespace-nowrap text-[9.5px] uppercase font-bold text-emerald-600 dark:text-[#2dd4bf] opacity-80 tracking-widest mb-[2px]">USD MOD</span>
                                  <div className="flex items-center justify-start gap-[3px] text-[13px] tracking-tight text-emerald-600 dark:text-[#2dd4bf] font-semibold tabular-nums">
                                    <span className="font-normal">$</span>
                                    <span>{usdModeloFinal.toFixed(2)}</span>
                                  </div>
                                </div>
                                {/* COP Mod */}
                                <div className="flex flex-col items-start w-[100px] flex-shrink-0 pl-3">
                                  <span className="block whitespace-nowrap text-[9.5px] uppercase font-bold text-purple-600 dark:text-[#c488fc] opacity-80 tracking-widest mb-[2px]">GANANCIAS</span>
                                  <div className="flex items-center justify-start gap-[3px] text-[13px] tracking-tight text-purple-700 dark:text-[#c488fc] font-semibold tabular-nums">
                                    <span className="font-normal">$</span>
                                    <span>{(copModelo || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                  </div>
                                </div>
                              </div>

                              {/* --- VISTA MÓVIL (CARRUSEL) --- */}
                              <div className="sm:hidden relative overflow-hidden min-w-[74px] w-[74px] h-[34px] flex-shrink-0 translate-y-[2px]">
                                <div className={`absolute top-0 left-0 w-full flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${mobileCarouselSide === 'usd' ? '-translate-y-1/2' : 'translate-y-0'}`}>
                                  {/* Slide 1: COP Mod */}
                                  <div className="h-[34px] flex flex-col items-start justify-end pb-0.5">
                                    <span className="block whitespace-nowrap text-[8px] uppercase font-bold text-purple-600 dark:text-[#c488fc] opacity-80 tracking-widest mb-[1px]">GANANCIAS</span>
                                    <div className="flex items-center justify-start gap-[3px] text-[12.5px] tracking-tight text-purple-700 dark:text-[#c488fc] font-semibold tabular-nums">
                                      <span className="font-normal">$</span>
                                      <span>{(copModelo || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    </div>
                                  </div>
                                  {/* Slide 2: USD Mod */}
                                  <div className="h-[34px] flex flex-col items-start justify-end pb-0.5">
                                    <span className="block whitespace-nowrap text-[8px] uppercase font-bold text-emerald-600 dark:text-[#2dd4bf] opacity-80 tracking-widest mb-[1px]">USD MOD</span>
                                    <div className="flex items-center justify-start gap-[3px] text-[12.5px] tracking-tight text-emerald-600 dark:text-[#2dd4bf] font-semibold tabular-nums">
                                      <span className="font-normal">$</span>
                                      <span>{usdModeloFinal.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  </div>

                  </>
                )}
              </GlassCard>
             </div>

              {/* Totales y Alertas - USANDO TOTALES DEL SERVIDOR */}
              {selectedModel.calculatorData.platforms && selectedModel.calculatorData.platforms.length > 0 && (
                <div className="flex flex-col gap-1.5 sm:gap-2 h-full mb-1 sm:mb-2">
                  <div className="flex items-center justify-start px-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-1 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse translate-y-[1.5px]"></div>
                      Totales y Alertas
                    </h3>
                  </div>
                  
                  {calculatedTotals ? (
                    <>
                      {/* Totales principales unificados en cápsula concéntrica */}
                      <InfoCardGrid
                        compactContainer={true}
                        columns={3}
                        className="mb-1.5 sm:mb-2"
                        cards={[
                          {
                            value: `$${calculatedTotals.usdBruto.toFixed(2)}`,
                            label: "USD Bruto",
                            color: "blue",
                            size: "sm",
                            clickable: false
                          },
                          {
                            value: `$${calculatedTotals.usdModelo.toFixed(2)}`,
                            label: "USD Modelo",
                            color: "green",
                            size: "sm",
                            clickable: false
                          },
                          {
                            value: `$${(calculatedTotals?.copModelo || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                            label: "COP Modelo",
                            color: "purple",
                            size: "sm",
                            clickable: false
                          }
                        ]}
                      />
                      
                      {/* Barra de Objetivo Básico - Estándar del proyecto (idéntica a Mi Historial) */}
                      <div className="mt-1 sm:mt-1.5">
                        <ObjectiveBorealCard 
                          totalUsdBruto={calculatedTotals.usdBruto || 0}
                          cuotaMinima={calculatedTotals.cuotaMinima || 470}
                          periodGoal={null}
                          netoDisponibleCop={calculatedTotals.copModelo || 0}
                          anticipoMaxCop={calculatedTotals.anticipoDisponible || 0}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] rounded-[1.25rem] sm:rounded-2xl p-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Calculando totales...</p>
                    </div>
                  )}
               </div>
              )}
            </div>
          ) : (
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 sm:p-8 animate-pulse w-full">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                 <div className="flex-1">
                   <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
                   <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4"></div>
                 </div>
              </div>
              
              {/* Tasas Skeleton */}
              <div className="h-28 bg-gray-200 dark:bg-gray-600 rounded-xl w-full mb-6"></div>
              
              {/* Calculator Table Skeleton */}
              <div className="h-64 bg-gray-200 dark:bg-gray-600 rounded-xl w-full"></div>
            </div>
          )}
            </div>
          ) : (
            <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-6 md:p-12 flex flex-col items-center justify-center min-h-[400px]">
              <div className="text-gray-400/50 dark:text-gray-500/30 mb-6 text-6xl">✨</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">Selecciona un modelo</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm text-center">Usa los filtros o el buscador en el panel izquierdo para seleccionar un modelo y ver su calculadora en tiempo real.</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
