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
      setGroupPercentage(config.group_percentage?.toString() || '');
      setGroupMinQuota(config.group_min_quota?.toString() || '');
    } else {
      // Resetear formulario y cargar porcentaje estándar del grupo
      setEnabledPlatforms([]);
      setPercentageOverride('');
      setMinQuotaOverride('');
      
      // Cargar porcentaje estándar del grupo
      const groupName = model.groups[0]?.name;
      if (groupName) {
        const standardPercentage = getStandardPercentageByGroup(groupName);
        setGroupPercentage(standardPercentage.toString());
      } else {
        setGroupPercentage('');
      }
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
                />
              </div>
            )}
            
            {/* Selección de Modelo */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Modelo</h2>
              <AppleDropdown
                options={[
                  { value: '', label: 'Selecciona un modelo' },
                  ...models.map(model => ({
                    value: model.id,
                    label: model.name || model.email,
                    badge: model.hasConfig ? 'Configurado' : undefined,
                    badgeColor: model.hasConfig ? 'green' as const : undefined
                  }))
                ]}
                value={selectedModel?.id || ''}
                onChange={(value) => value ? handleModelSelect(value) : setSelectedModel(null)}
                placeholder="Selecciona un modelo"
              />
              
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
              <div className="apple-card">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Configuración de Reparto</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Columna Grupo */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h4 className="text-base font-medium text-gray-900 mb-4">Configuración del Grupo</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="groupPercentage" className="block text-sm font-medium text-gray-700 mb-2">
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
                            <span className="text-sm text-gray-500 font-medium">%</span>
                          </div>
                          {selectedModel?.groups?.[0] && (
                            <p className="text-xs text-gray-500 mt-2">
                              Estándar: {getStandardPercentageByGroup(selectedModel.groups[0].name)}%
                            </p>
                          )}
                        </div>
                        
                        <div>
                          <label htmlFor="groupMinQuota" className="block text-sm font-medium text-gray-700 mb-2">
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
                            <span className="text-sm text-gray-500 font-medium">USD</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Columna Modelo */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <h4 className="text-base font-medium text-gray-900 mb-4">Configuración del Modelo</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="percentageOverride" className="block text-sm font-medium text-gray-700 mb-2">
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
                            <span className="text-sm text-gray-500 font-medium">%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Dejar vacío para usar el porcentaje del grupo
                          </p>
                        </div>
                        
                        <div>
                          <label htmlFor="minQuotaOverride" className="block text-sm font-medium text-gray-700 mb-2">
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
                            <span className="text-sm text-gray-500 font-medium">USD</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Dejar vacío para usar el objetivo del grupo
                          </p>
                        </div>
                      </div>
                    </div>
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