'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import AppleDropdown from '@/components/ui/AppleDropdown';

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [syncingTotals, setSyncingTotals] = useState(false);
  const [calculatedTotals, setCalculatedTotals] = useState<any>(null);
  
  // Estados para filtros
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  
  const router = useRouter();
  
  const supabase = require('@/lib/supabase').supabase;

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
        
        setUser({
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'modelo',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString()
        });

        // Load models according to hierarchy
        await loadModels(uid);
        
      } catch (err: any) {
        console.error('Error loading user:', err);
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

  const loadModels = async (adminId: string) => {
    try {
      const response = await fetch(`/api/calculator/models?adminId=${adminId}`);
      const data = await response.json();
      
      if (data.success) {
        const modelsData = data.models || [];
        setAllModels(modelsData);
        setModels(modelsData);
        
        // Extraer grupos únicos para el filtro (usando Map para evitar duplicados por ID)
        const groupsMap = new Map<string, {id: string, name: string}>();
        modelsData.forEach((model: Model) => {
          model.groups.forEach(group => {
            if (group && group.id && group.name) {
              groupsMap.set(group.id, group);
            }
          });
        });
        
        // Filtrar grupos según el rol del usuario
        let filteredGroups = Array.from(groupsMap.values());
        if (user && user.role === 'admin') {
          // Admin solo ve sus grupos asignados
          filteredGroups = filteredGroups.filter(group => 
            user.groups.includes(group.name)
          );
        }
        
        setAvailableGroups(filteredGroups);
      } else {
        setError(data.error || 'Error al cargar modelos');
      }
    } catch (err: any) {
      console.error('Error loading models:', err);
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
      setLoading(true);
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

        // Cargar totales calculados desde el servidor
        await loadCalculatedTotals(model.id);
      } else {
        setError(data.error || 'Error al cargar datos de la calculadora');
      }
    } catch (err: any) {
      console.error('Error loading calculator data:', err);
      setError(err.message || 'Error al cargar datos de la calculadora');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToModels = () => {
    setSelectedModel(null);
    setSelectedModelId('');
    setEditValues({});
    setHasChanges(false);
    
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
    if (groupId !== 'all') {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
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

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
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

  // Si hay un modelo seleccionado, mostrar su calculadora
  if (selectedModel) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-16">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleBackToModels}
                className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver a la lista</span>
              </button>
            </div>
            
            <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-1 whitespace-nowrap truncate">
                Calculadora de {selectedModel.name}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
                {selectedModel.email} • {selectedModel.groups.map(g => g.name).join(', ')}
              </p>
            </div>

            {/* Footer actions */}
              <div className="flex justify-end gap-2 flex-shrink-0">
                <button
                  onClick={syncTotals}
                  disabled={syncingTotals || !selectedModel?.calculatorData}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 whitespace-nowrap ${
                    !syncingTotals
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {syncingTotals ? 'Sincronizando...' : 'Sincronizar Totales'}
                </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 whitespace-nowrap ${
                  hasChanges && !saving
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            </div>
          </div>

          {/* Datos de la calculadora */}
          {selectedModel.calculatorData ? (
            <div className="space-y-4">
              {/* Tasas actualizadas - ESTILO APPLE REFINADO */}
              <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-4 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Tasas Actualizadas
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                    <div className="text-xl font-bold text-blue-700 mb-1">
                      ${selectedModel.calculatorData.rates?.usd_cop || 3900}
                    </div>
                    <div className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">USD→COP</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                    <div className="text-xl font-bold text-green-700 mb-1">
                      {selectedModel.calculatorData.rates?.eur_usd || 1.01}
                    </div>
                    <div className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">EUR→USD</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                    <div className="text-xl font-bold text-purple-700 mb-1">
                      {selectedModel.calculatorData.rates?.gbp_usd || 1.20}
                    </div>
                    <div className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">GBP→USD</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center font-medium">
                  Configuradas por tu administrador
                </p>
              </div>


              {/* Tabla de Calculadora - ESTILO APPLE REFINADO */}
              <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Calculadora de Ingresos
                </h2>
                
                {!selectedModel.calculatorData.isConfigured || !selectedModel.calculatorData.platforms || selectedModel.calculatorData.platforms.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"></div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay plataformas habilitadas</h4>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Esta modelo no tiene configuración de calculadora o plataformas habilitadas.
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Contacta al administrador para que configure las plataformas.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-600">
                          <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-sm">PLATAFORMAS</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-sm">VALORES</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-sm">USD BRUTO</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-sm">USD MODELO</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-sm">COP MODELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedModel.calculatorData.platforms.map((platform: any) => {
                          // Obtener valor actual de esta plataforma - buscar por platform_id o por platform name
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => 
                            v.platform_id === platform.id || v.platform === platform.name
                          )?.value || 0;
                          console.log('🔍 [ADMIN-VIEW] Platform:', platform.name, 'ID:', platform.id, 'Value:', currentValue);
                          
                          // Obtener tasas para los cálculos
                          const rates = selectedModel.calculatorData.rates;
                          
                          // Calcular USD bruto con fórmulas específicas por plataforma
                          let usdBruto = 0;
                          if (platform.currency === 'EUR') {
                            if (platform.id === 'big7') {
                              usdBruto = (currentValue * (rates?.eur_usd || 1.01)) * 0.84;
                            } else if (platform.id === 'mondo') {
                              usdBruto = (currentValue * (rates?.eur_usd || 1.01)) * 0.78;
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
                            } else if (platform.id === 'superfoon') {
                              usdBruto = currentValue;
                            } else {
                              usdBruto = currentValue;
                            }
                          }
                          
                          // Aplicar porcentaje de reparto del modelo al USD bruto
                          const usdModeloFinal = (usdBruto * platform.percentage) / 100;
                          const copModelo = usdModeloFinal * (rates?.usd_cop || 3900);
                          
                          return (
                            <tr key={platform.id} className="border-b border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600/50 transition-colors duration-200 group">
                              <td className="py-3 px-3">
                                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{platform.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Reparto: {platform.percentage}%</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="relative group">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={editValues[platform.id] !== undefined ? editValues[platform.id] : currentValue.toFixed(2)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const cleaned = raw.replace(/[^0-9.,]/g, '');
                                        const normalized = cleaned.replace(',', '.');
                                        const parts = normalized.split('.');
                                        const safeNormalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
                                        handleValueChange(platform.id, safeNormalized);
                                      }}
                                      className="w-24 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 focus:shadow-lg focus:shadow-blue-100"
                                      placeholder="0.00"
                                    />
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-600 px-2 py-1 rounded-md">
                                      {platform.currency || 'USD'}
                                    </span>
                                  </div>
                                  {/* Indicador de cambio */}
                                  {editValues[platform.id] !== undefined && editValues[platform.id] !== currentValue.toFixed(2) && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                                  ${usdBruto.toFixed(2)} USD
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                                  ${usdModeloFinal.toFixed(2)} USD
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
                )}
              </div>

              {/* Totales y Alertas - USANDO TOTALES DEL SERVIDOR */}
              {selectedModel.calculatorData.platforms && selectedModel.calculatorData.platforms.length > 0 && (
                <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-4 mb-4 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Totales y Alertas
                  </h3>
                  
                  {calculatedTotals ? (
                    <>
                      {/* Totales principales - DESDE SERVIDOR */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                          <div className="text-xl font-bold text-blue-700 mb-1">
                            ${calculatedTotals.usdBruto.toFixed(2)}
                          </div>
                          <div className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">USD Bruto</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                          <div className="text-xl font-bold text-green-700 mb-1">
                            ${calculatedTotals.usdModelo.toFixed(2)}
                          </div>
                          <div className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">USD Modelo</div>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                          <div className="text-xl font-bold text-purple-700 mb-1">
                            ${calculatedTotals.copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">COP Modelo</div>
                        </div>
                      </div>
                      
                      {/* 90% de anticipo - DESDE SERVIDOR */}
                      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-600/80 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <strong>90% de anticipo disponible:</strong> ${calculatedTotals.anticipoDisponible.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Calculando totales...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                  <div className="text-center py-12">
                <div className="text-gray-400 mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Calculadora de {selectedModel.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Cargando datos de la calculadora...
                </p>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mostrar lista de modelos con panel de filtros
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Ver Calculadora de Modelo</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Selecciona un modelo para ver y editar su calculadora</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo: Filtros */}
          <div className="lg:col-span-1">
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 space-y-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            {/* Filtro por Grupo */}
            {availableGroups.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Filtrar por Grupo</h2>
                <AppleDropdown
                  options={[
                    { value: 'all', label: 'Todos los grupos' },
                    ...availableGroups.map(group => ({
                      value: group.id,
                      label: group.name
                    }))
                  ]}
                  value={selectedGroup}
                  onChange={handleGroupFilter}
                  placeholder="Selecciona un grupo"
                  className="text-sm"
                />
              </div>
            )}
            
            {/* Filtro por Nombre */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Buscar por Nombre</h2>
              <div className="relative">
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => handleNameFilter(e.target.value)}
                  placeholder="Buscar modelo..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 focus:shadow-lg focus:shadow-blue-100 pr-10 text-gray-900 dark:text-gray-100"
                />
                {nameFilter && (
                  <button
                    onClick={() => handleNameFilter('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                </div>
              {nameFilter && (
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  🔍 Filtrando por: "{nameFilter}" - {models.length} resultado{models.length !== 1 ? 's' : ''}
                </div>
              )}
              </div>
              
            {/* Selección de Modelo */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Seleccionar Modelo</h2>
              <AppleDropdown
                options={[
                  { value: '', label: models.length === 0 ? 'No hay modelos disponibles' : 'Selecciona un modelo' },
                  ...models.map(model => ({
                    value: model.id,
                    label: model.email.split('@')[0],
                    badge: model.currentConfig?.active ? 'Configurada' : 'Sin configurar',
                    badgeColor: model.currentConfig?.active ? 'green' as const : 'gray' as const
                  }))
                ]}
                value={selectedModelId}
                onChange={handleModelDropdownSelect}
                placeholder={
                  models.length === 0 
                    ? (nameFilter ? `No hay modelos que contengan "${nameFilter}"` : 'No hay modelos disponibles')
                    : `${models.length} modelo${models.length !== 1 ? 's' : ''} disponible${models.length !== 1 ? 's' : ''}`
                }
                autoOpen={nameFilter.length > 0 && models.length > 0}
                className="text-sm"
              />

              {/* Información del modelo seleccionado */}
              {selectedModelId && models.find(m => m.id === selectedModelId) && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-600/80 rounded-lg">
                  {(() => {
                    const model = models.find(m => m.id === selectedModelId);
                    return model ? (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{model.email.split('@')[0]}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{model.email}</p>
                        <div className="flex flex-wrap gap-1">
                          {model.groups.map((group) => (
                            <span
                              key={group.id}
                              className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                            >
                              {group.name}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Estado cuando no hay modelos */}
              {models.length === 0 && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-600/80 rounded-lg text-center">
                  <div className="text-gray-400 mb-2 text-2xl">👥</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {nameFilter || selectedGroup !== 'all' 
                      ? 'No se encontraron modelos con los filtros aplicados' 
                      : 'No hay modelos disponibles'
                    }
                  </p>
                  {(nameFilter || selectedGroup !== 'all') && (
                    <button
                      onClick={() => {
                        setNameFilter('');
                        setSelectedGroup('all');
                        setSelectedModelId('');
                        setModels(allModels);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
              </div>
              
            {/* Información de resultados */}
            <div className="p-3 bg-gray-50 dark:bg-gray-600/80 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Mostrando {models.length} de {allModels.length} modelos
              </p>
              {selectedGroup !== 'all' && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Filtrado por: {availableGroups.find(g => g.id === selectedGroup)?.name}
                </p>
              )}
              {nameFilter && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Búsqueda: "{nameFilter}"
                </p>
              )}
              </div>
            </div>
        </div>

        {/* Panel derecho: Información adicional o vacío */}
        <div className="lg:col-span-2">
          <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Información</h2>
            
            {selectedModelId && models.find(m => m.id === selectedModelId) ? (
              <div className="text-center py-8">
                <div className="text-green-500 mb-4 text-4xl">✅</div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Modelo seleccionado
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {models.find(m => m.id === selectedModelId)?.email.split('@')[0]} está listo para ver su calculadora
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  La calculadora se abrirá automáticamente
                </p>
              </div>
            ) : (
          <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-4xl">👈</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Selecciona un modelo
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
                  Usa los filtros de la izquierda para encontrar y seleccionar un modelo
            </p>
          </div>
        )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}