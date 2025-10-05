'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
  
  // Estados para dropdowns personalizados
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  
  // Estados de configuración
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const [percentageOverride, setPercentageOverride] = useState<string>('');
  const [minQuotaOverride, setMinQuotaOverride] = useState<string>('');
  const [groupPercentage, setGroupPercentage] = useState<string>('');
  const [groupMinQuota, setGroupMinQuota] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setGroupDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
      
      // Extraer grupos únicos de los modelos
      const groups = new Set<string>();
      const groupsData: Array<{id: string, name: string}> = [];
      
      modelsData.models.forEach((model: Model) => {
        model.groups.forEach(group => {
          if (!groups.has(group.id)) {
            groups.add(group.id);
            groupsData.push({id: group.id, name: group.name});
          }
        });
      });
      
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
      setGroupPercentage(config.group_percentage?.toString() || '');
      setGroupMinQuota(config.group_min_quota?.toString() || '');
    } else {
      // Resetear formulario
      setEnabledPlatforms([]);
      setPercentageOverride('');
      setMinQuotaOverride('');
      setGroupPercentage('');
      setGroupMinQuota('');
    }
  };

  const handlePlatformToggle = (platformId: string) => {
    setEnabledPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
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
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center p-8 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <h2 className="text-xl font-bold mb-4">Error</h2>
          <p>{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Gestión de Calculadora</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel izquierdo: Filtros y Selección de modelo */}
        <div className="md:col-span-1">
          <div className="apple-card space-y-6">
            {/* Filtro por Grupo */}
            {availableGroups.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtrar por Grupo</h2>
                <div className="relative" ref={groupDropdownRef}>
                  <button
                    type="button"
                    className="apple-input text-sm text-left cursor-pointer flex items-center justify-between"
                    onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                  >
                    <span>
                      {selectedGroup === 'all' 
                        ? 'Todos los grupos' 
                        : availableGroups.find(g => g.id === selectedGroup)?.name || 'Todos los grupos'
                      }
                    </span>
                    <svg 
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${groupDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {groupDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                      <div
                        className="px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                        onClick={() => {
                          handleGroupFilter('all');
                          setGroupDropdownOpen(false);
                        }}
                      >
                        Todos los grupos
                      </div>
                      {availableGroups.map((group) => (
                        <div
                          key={group.id}
                          className="px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors duration-150 border-t border-gray-100"
                          onClick={() => {
                            handleGroupFilter(group.id);
                            setGroupDropdownOpen(false);
                          }}
                        >
                          {group.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Selección de Modelo */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Modelo</h2>
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  className="apple-input text-sm text-left cursor-pointer flex items-center justify-between"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                >
                  <span>
                    {selectedModel 
                      ? `${selectedModel.name || selectedModel.email} ${selectedModel.hasConfig ? '(Configurado)' : ''}` 
                      : 'Selecciona un modelo'
                    }
                  </span>
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${modelDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {modelDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    <div
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors duration-150 text-gray-500"
                      onClick={() => {
                        setSelectedModel(null);
                        setModelDropdownOpen(false);
                      }}
                    >
                      Selecciona un modelo
                    </div>
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 transition-colors duration-150 border-t border-gray-100 flex items-center justify-between"
                        onClick={() => {
                          handleModelSelect(model.id);
                          setModelDropdownOpen(false);
                        }}
                      >
                        <span>{model.name || model.email}</span>
                        {model.hasConfig && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Configurado
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Información del grupo del modelo seleccionado */}
              {selectedModel && selectedModel.groups.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Grupos:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedModel.groups.map((group) => (
                      <span 
                        key={group.id}
                        className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
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
          <div className="md:col-span-2 apple-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Configurar: {selectedModel.name || selectedModel.email}
            </h2>

            <div className="space-y-6">
              {/* Plataformas habilitadas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium text-gray-900">Seleccionar Páginas</h3>
                  <span className="text-sm text-gray-500">
                    {platforms.length} plataformas disponibles
                  </span>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
                  <div className="space-y-3">
                    {platforms.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No hay plataformas disponibles</p>
                        <p className="text-sm">Cargando datos...</p>
                      </div>
                    ) : (
                      platforms.map(platform => (
                        <div key={platform.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{platform.name}</span>
                            <p className="text-xs text-gray-500">{platform.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlatformToggle(platform.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              enabledPlatforms.includes(platform.id) ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                          >
                            <span className="sr-only">Enable platform</span>
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                enabledPlatforms.includes(platform.id) ? 'translate-x-6' : 'translate-x-1'
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
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-3">Configuración de Reparto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="percentageOverride" className="block text-sm font-medium text-gray-700">
                      % de Reparto (Override)
                    </label>
                    <input
                      type="number"
                      id="percentageOverride"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={percentageOverride}
                      onChange={(e) => setPercentageOverride(e.target.value)}
                      placeholder="Ej: 70"
                    />
                  </div>
                  <div>
                    <label htmlFor="minQuotaOverride" className="block text-sm font-medium text-gray-700">
                      Cuota Mínima (Override)
                    </label>
                    <input
                      type="number"
                      id="minQuotaOverride"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={minQuotaOverride}
                      onChange={(e) => setMinQuotaOverride(e.target.value)}
                      placeholder="Ej: 1000000"
                    />
                  </div>
                  <div>
                    <label htmlFor="groupPercentage" className="block text-sm font-medium text-gray-700">
                      % de Reparto (Grupo)
                    </label>
                    <input
                      type="number"
                      id="groupPercentage"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={groupPercentage}
                      onChange={(e) => setGroupPercentage(e.target.value)}
                      placeholder="Ej: 60"
                    />
                  </div>
                  <div>
                    <label htmlFor="groupMinQuota" className="block text-sm font-medium text-gray-700">
                      Cuota Mínima (Grupo)
                    </label>
                    <input
                      type="number"
                      id="groupMinQuota"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      value={groupMinQuota}
                      onChange={(e) => setGroupMinQuota(e.target.value)}
                      placeholder="Ej: 500000"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}