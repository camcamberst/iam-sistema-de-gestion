'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppleDropdown from '@/components/ui/AppleDropdown';

interface Model {
  id: string;
  email: string;
  name: string;
  groups: Array<{ id: string; name: string }>;
  hasConfig: boolean;
  currentConfig: any;
}

interface Platform {
  id: string;
  name: string;
  description: string;
  currency: string;
  token_rate: number | null;
  discount_factor: number | null;
  tax_rate: number | null;
  direct_payout: boolean;
}

// Porcentajes estandarizados por grupos
const getStandardPercentageByGroup = (groupName: string): number => {
  const standardPercentages: Record<string, number> = {
    'Cabecera': 60,
    'Diamante': 60,
    'Sede MP': 60,
    'Terrazas': 60,
    'Victoria': 60,
    'Satélites': 80,
    'Otros': 70
  };
  
  const result = standardPercentages[groupName] || 80;
  console.log(`🔍 [STANDARD PERCENTAGE] Grupo: "${groupName}" -> ${result}%`);
  return result;
};

// Función para obtener el color del estado del Portafolio
const getPortfolioStatusColor = (status: string): string => {
  switch (status) {
    case 'entregada': return 'bg-green-100 text-green-800 border-green-200';
    case 'pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'solicitada': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'inviable': return 'bg-red-100 text-red-800 border-red-200';
    case 'desactivada': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function ConfigCalculatorPage() {
  const router = useRouter();
  
  // Estados principales
  const [models, setModels] = useState<Model[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtro por grupo
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  
  // Estados de configuración
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const [percentageOverride, setPercentageOverride] = useState<string>('');
  const [minQuotaOverride, setMinQuotaOverride] = useState<string>('');
  const [groupPercentage, setGroupPercentage] = useState<string>('');
  const [groupMinQuota, setGroupMinQuota] = useState<string>('');
  const [portfolioData, setPortfolioData] = useState<Record<string, any>>({});

  useEffect(() => {
    loadData();
  }, []);


  const loadData = async () => {
    try {
      console.log('🔍 [LOAD] Iniciando loadData...');
      setLoading(true);
      setError(null);

      // Cargar datos del usuario actual
      console.log('🔍 [LOAD] Cargando datos del usuario...');
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || 'current-user';
      console.log('🔍 [LOAD] User data:', user);
      setCurrentUser(user);
      
      // Cargar modelos disponibles
      console.log('🔍 [LOAD] Cargando modelos...');
      const modelsResponse = await fetch(`/api/calculator/models?adminId=${userId}`);
      console.log('🔍 [LOAD] Models response status:', modelsResponse.status);
      const modelsData = await modelsResponse.json();
      console.log('🔍 [LOAD] Models data:', modelsData);

      if (!modelsData.success) {
        throw new Error(modelsData.error || 'Error al cargar modelos');
      }

      setAllModels(modelsData.models);
      setModels(modelsData.models);
      
      // Extraer grupos únicos de los modelos (usando Map para evitar duplicados por ID)
      const groupsMap = new Map<string, {id: string, name: string}>();
      
      modelsData.models.forEach((model: Model) => {
        model.groups.forEach(group => {
          if (group && group.id && group.name) {
            groupsMap.set(group.id, group);
          }
        });
      });
      
      const groupsData = Array.from(groupsMap.values());
      
      // Filtrar grupos según permisos del usuario
      let filteredGroups = groupsData;
      if (user?.role === 'admin') {
        // Admin solo ve sus grupos asignados
        const userGroupIds = user.groups?.map((g: any) => g.id) || [];
        filteredGroups = groupsData.filter(group => userGroupIds.includes(group.id));
      }
      
      setAvailableGroups(filteredGroups);
      console.log('🔍 [LOAD] Available groups:', filteredGroups);
      console.log('🔍 [LOAD] Models set successfully');

      // Cargar plataformas disponibles
      console.log('🔍 [LOAD] Cargando plataformas...');
      const platformsResponse = await fetch('/api/calculator/platforms');
      console.log('🔍 [LOAD] Platforms response status:', platformsResponse.status);
      const platformsData = await platformsResponse.json();
      console.log('🔍 [LOAD] Platforms data:', platformsData);

      if (!platformsData.success) {
        throw new Error(platformsData.error || 'Error al cargar plataformas');
      }

      // 🔧 FIX: Usar estado normal de React
      const platformsArray = platformsData.config?.platforms || [];
      setPlatforms(platformsArray);
      console.log('🔍 [LOAD] platforms set with:', platformsArray.length, 'plataformas');
      console.log('🔍 [LOAD] loadData completado exitosamente');

    } catch (err: any) {
      console.error('❌ [LOAD] Error en loadData:', err);
      setError(err.message || 'Error al cargar datos');
    } finally {
      console.log('🔍 [LOAD] Setting loading to false');
      setLoading(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    setSelectedModel(model);

    // Cargar configuración existente si la hay
    if (model.hasConfig && model.currentConfig) {
      const config = model.currentConfig;
      setEnabledPlatforms(config.enabled_platforms || []);
      setPercentageOverride(config.percentage_override?.toString() || '');
      setMinQuotaOverride(config.min_quota_override?.toString() || '');
      
      // Si no hay group_percentage o es 0, usar el estándar del grupo
      const groupName = model.groups[0]?.name;
      if (config.group_percentage && config.group_percentage > 0) {
        setGroupPercentage(config.group_percentage.toString());
      } else if (groupName) {
        const standardPercentage = getStandardPercentageByGroup(groupName);
        setGroupPercentage(standardPercentage.toString());
        console.log(`🔍 [EXISTING CONFIG] Usando porcentaje estándar para ${groupName}: ${standardPercentage}%`);
      } else {
        setGroupPercentage('');
      }
      
      setGroupMinQuota(config.group_min_quota?.toString() || '');
    } else {
      // Resetear formulario y cargar porcentaje estándar del grupo
      setEnabledPlatforms([]);
      setPercentageOverride('');
      setMinQuotaOverride('');
      
      // Cargar porcentaje estándar del grupo como valor por defecto
      const groupName = model.groups[0]?.name;
      if (groupName) {
        const standardPercentage = getStandardPercentageByGroup(groupName);
        setGroupPercentage(standardPercentage.toString());
        console.log(`🔍 [DEFAULT PERCENTAGE] Cargando porcentaje estándar para ${groupName}: ${standardPercentage}%`);
      } else {
        setGroupPercentage('');
      }
      setGroupMinQuota('');
    }
    
    // Cargar datos del Portafolio para este modelo
    try {
      const response = await fetch(`/api/modelo-plataformas?model_id=${model.id}`);
      const portfolioData = await response.json();
      
      // Crear un mapa de platform_id -> datos del portafolio
      const portfolioMap: Record<string, any> = {};
      portfolioData.forEach((item: any) => {
        portfolioMap[item.platform_id] = item;
      });
      
      setPortfolioData(portfolioMap);
    } catch (error) {
      console.error('Error cargando datos del Portafolio:', error);
      setPortfolioData({});
    }
  };

  const handlePlatformToggle = async (platformId: string) => {
    // Si se está desactivando, permitir siempre
    if (enabledPlatforms.includes(platformId)) {
      setEnabledPlatforms(prev => prev.filter(id => id !== platformId));
      return;
    }

    // Si se está activando, validar estado del Portafolio
    if (!selectedModel) {
      console.error('No hay modelo seleccionado');
      return;
    }

    // Verificar si es configuración inicial (modelo sin configuración previa)
    const isInitialConfig = !selectedModel.hasConfig;
    
    if (isInitialConfig) {
      // Para configuración inicial, permitir cualquier plataforma
      console.log('🔍 [INITIAL CONFIG] Permitir plataforma para configuración inicial:', platformId);
      setEnabledPlatforms(prev => [...prev, platformId]);
      return;
    }

    // Para configuraciones posteriores, validar estado del Portafolio
    try {
      // Consultar el estado de la plataforma en el Portafolio
      const response = await fetch(`/api/modelo-plataformas?model_id=${selectedModel.id}&platform_id=${platformId}`);
      const portfolioData = await response.json();
      
      if (portfolioData && portfolioData.length > 0) {
        const platformStatus = portfolioData[0].status;

        // Permitir activar si está en estado 'entregada' o 'confirmada', o es configuración inicial
        if (platformStatus === 'entregada' || platformStatus === 'confirmada' || portfolioData[0].is_initial_config) {
          setEnabledPlatforms(prev => [...prev, platformId]);
        } else {
          // Mostrar mensaje de error
          alert(`No se puede activar esta plataforma. Estado actual en Portafolio: ${platformStatus}. Debe estar en estado "Entregada" o "Confirmada" para poder activarla.`);
        }
      } else {
        // Si no existe en el Portafolio, es una plataforma nueva que no se puede activar
        alert('Esta plataforma no está disponible. Debe ser solicitada a través del Portafolio Modelos primero.');
      }
    } catch (error) {
      console.error('Error validando estado del Portafolio:', error);
      alert('Error al validar el estado de la plataforma. Intenta nuevamente.');
    }
  };

  const handleGroupFilter = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedModel(null); // Reset selected model when changing group
    
    if (groupId === 'all') {
      setModels(allModels);
    } else {
      const filteredModels = allModels.filter(model => 
        model.groups.some(group => group.id === groupId)
      );
      setModels(filteredModels);
    }
  };

  const handleSave = async () => {
    if (!selectedModel) return;

    try {
      setSaving(true);
      setError(null);

      // Obtener ID del usuario actual
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const userId = userData ? JSON.parse(userData).id : 'current-user';

      const response = await fetch('/api/calculator/config-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          adminId: userId,
          groupId: selectedModel.groups[0]?.id || 'default-group',
          enabledPlatforms,
          percentageOverride: percentageOverride ? parseFloat(percentageOverride) : null,
          minQuotaOverride: minQuotaOverride ? parseFloat(minQuotaOverride) : null,
          groupPercentage: groupPercentage ? parseFloat(groupPercentage) : null,
          groupMinQuota: groupMinQuota ? parseFloat(groupMinQuota) : null,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al guardar configuración');
      }

      alert('Configuración guardada correctamente');

      // Recargar datos
      await loadData();
      setSelectedModel(null);

    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando configuración...</p>
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
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Error</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">Gestión de Calculadora</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Configura las tasas y parámetros de cálculo para cada modelo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel izquierdo: Filtros y Selección de modelo */}
        <div className="md:col-span-1">
          <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 space-y-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 z-[99999]">
            {/* Filtro por Grupo */}
            {availableGroups.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filtrar por Grupo</h2>
                </div>
                <AppleDropdown
                  options={availableGroups.map(group => ({
                    value: group.id,
                    label: group.name
                  }))}
                  value={selectedGroup}
                  onChange={handleGroupFilter}
                  placeholder="Selecciona un grupo"
                  className="text-sm"
                />
              </div>
            )}
            
            {/* Selección de Modelo */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Seleccionar Modelo</h2>
              </div>
              <AppleDropdown
                options={[
                  { value: '', label: 'Seleccionar modelo' },
                  ...models.map(model => ({
                    value: model.id,
                    label: model.email ? model.email.split('@')[0] : model.name,
                    badge: model.hasConfig ? 'Configurado' : undefined,
                    badgeColor: model.hasConfig ? 'green' as const : undefined
                  }))
                ]}
                value={selectedModel?.id || ''}
                onChange={(value) => value ? handleModelSelect(value) : setSelectedModel(null)}
                placeholder="Seleccionar modelo"
                className="text-sm"
              />
              
              {/* Información del grupo del modelo seleccionado */}
              {selectedModel && selectedModel.groups.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50/80 dark:bg-gray-600/80 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-500/50">
                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 font-medium">Grupos:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedModel.groups.map((group) => (
                      <span 
                        key={group.id}
                        className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full border border-blue-200/50 dark:border-blue-700/50"
                      >
                        {group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho: Configuración */}
        {selectedModel && (
          <div className="md:col-span-2 relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Configurar: {selectedModel.name || selectedModel.email}
              </h2>
            </div>

            <div className="space-y-6">
              {/* Plataformas habilitadas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-sm flex items-center justify-center">
                      <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Seleccionar Páginas</h3>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-gray-600/80 px-2 py-1 rounded-full border border-gray-200/50 dark:border-gray-500/50">
                    {platforms.length} plataformas disponibles
                  </span>
                </div>
                <div className="border border-gray-200/50 dark:border-gray-500/50 rounded-lg p-4 max-h-80 overflow-y-auto bg-gray-50/30 dark:bg-gray-600/30 backdrop-blur-sm">
                  <div className="space-y-3">
                    {platforms.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">No hay plataformas disponibles</p>
                        <p className="text-xs">Cargando datos...</p>
                      </div>
                    ) : (
                      platforms.map(platform => (
                        <div key={platform.id} className="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-600/80 backdrop-blur-sm rounded-lg border border-gray-200/50 dark:border-gray-500/50">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{platform.name}</span>
                              {portfolioData[platform.id] && selectedModel?.hasConfig && (
                                <span className={`text-xs px-2 py-1 rounded-full border ${getPortfolioStatusColor(portfolioData[platform.id].status)}`}>
                                  {portfolioData[platform.id].status}
                                </span>
                              )}
                              {!selectedModel?.hasConfig && (
                                <span className="text-xs px-2 py-1 rounded-full border bg-green-100 text-green-800 border-green-200">
                                  Disponible
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{platform.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlatformToggle(platform.id)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              enabledPlatforms.includes(platform.id) ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-200'
                            }`}
                          >
                            <span className="sr-only">Enable platform</span>
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                                enabledPlatforms.includes(platform.id) ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Configuración de reparto */}
              <div className="relative bg-white/50 dark:bg-gray-600/50 backdrop-blur-sm rounded-xl shadow-sm border border-white/30 dark:border-gray-500/30 p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <div className="w-5 h-5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-md flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Configuración de Reparto</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Columna Grupo */}
                  <div className="bg-white/80 dark:bg-gray-600/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-500/50 p-6 h-full">
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-sm flex items-center justify-center">
                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configuración Grupo</h4>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="groupPercentage" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Porcentaje Grupo
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            id="groupPercentage"
                            className="apple-input flex-1"
                            value={groupPercentage}
                            onChange={(e) => setGroupPercentage(e.target.value)}
                            placeholder="60"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">%</span>
                        </div>
                        {selectedModel?.groups?.[0] && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Valor por defecto: {getStandardPercentageByGroup(selectedModel.groups[0].name)}%
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <label htmlFor="groupMinQuota" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Objetivo Grupo
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            id="groupMinQuota"
                            className="apple-input flex-1"
                            value={groupMinQuota}
                            onChange={(e) => setGroupMinQuota(e.target.value)}
                            placeholder="500000"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">USD</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          &nbsp;
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Columna Modelo */}
                  <div className="bg-white dark:bg-gray-600 rounded-xl shadow-sm border border-gray-200 dark:border-gray-500 p-6 h-full">
                    <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-6">Configuración Modelo</h4>
                    
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="percentageOverride" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Porcentaje Modelo
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            id="percentageOverride"
                            className="apple-input flex-1"
                            value={percentageOverride}
                            onChange={(e) => setPercentageOverride(e.target.value)}
                            placeholder="70"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">%</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Dejar vacío para usar el porcentaje del grupo
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="minQuotaOverride" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Objetivo Modelo
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            id="minQuotaOverride"
                            className="apple-input flex-1"
                            value={minQuotaOverride}
                            onChange={(e) => setMinQuotaOverride(e.target.value)}
                            placeholder="300000"
                          />
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">USD</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Dejar vacío para usar el objetivo del grupo
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-md"
                >
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}