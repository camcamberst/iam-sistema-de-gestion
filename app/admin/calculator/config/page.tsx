'use client';

import { useState, useEffect } from 'react';
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
  const [models, setModels] = useState<Model[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformsLoaded, setPlatformsLoaded] = useState(false);
  const [platformsData, setPlatformsData] = useState<Platform[]>([]);
  const [renderPlatforms, setRenderPlatforms] = useState<Platform[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug: Log cuando cambia platforms
  useEffect(() => {
    console.log('🔍 [PLATFORMS-STATE] platforms changed:', platforms);
    console.log('🔍 [PLATFORMS-STATE] platforms type:', typeof platforms);
    console.log('🔍 [PLATFORMS-STATE] platforms is array:', Array.isArray(platforms));
    console.log('🔍 [PLATFORMS-STATE] platforms length:', platforms?.length);
    
    // 🔧 FIX: Si platforms está vacío pero debería tener datos, forzar actualización
    if (platforms.length === 0 && !loading) {
      console.log('🔍 [PLATFORMS-STATE] Platforms is empty but should have data, forcing reload...');
      loadData();
    }
  }, [platforms, loading]);

  // Configuración del formulario
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
      setLoading(true);
      setError(null);

      // Cargar modelos disponibles
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const userId = userData ? JSON.parse(userData).id : 'current-user';
      const modelsResponse = await fetch(`/api/calculator/models?adminId=${userId}`);
      const modelsData = await modelsResponse.json();
      
      if (!modelsData.success) {
        throw new Error(modelsData.error || 'Error al cargar modelos');
      }

      setModels(modelsData.data);

      // Cargar plataformas disponibles
      const platformsResponse = await fetch('/api/calculator/platforms');
      const platformsData = await platformsResponse.json();
      
      console.log('🔍 [DEBUG] Plataformas cargadas:', platformsData);
      
      if (!platformsData.success) {
        throw new Error(platformsData.error || 'Error al cargar plataformas');
      }

      console.log('📊 [DEBUG] Total plataformas:', platformsData.config?.platforms?.length);
      console.log('🔍 [DEBUG] platformsData.config type:', typeof platformsData.config);
      console.log('🔍 [DEBUG] platformsData.config.platforms is array:', Array.isArray(platformsData.config?.platforms));
      console.log('🔍 [DEBUG] platformsData.config.platforms content:', platformsData.config?.platforms);
      
      const platformsArray = platformsData.config?.platforms || [];
      setPlatforms(platformsArray);
      setPlatformsData(platformsArray);
      setRenderPlatforms(platformsArray); // 🔧 FIX: Estado dedicado para render
      setPlatformsLoaded(true);
      console.log('🔍 [DEBUG] setPlatforms called with:', platformsArray);
      console.log('🔍 [DEBUG] setPlatformsData called with:', platformsArray);
      console.log('🔍 [DEBUG] setRenderPlatforms called with:', platformsArray);
      console.log('🔍 [DEBUG] platformsLoaded set to true');

    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configurar Calculadora</h1>
          <p className="text-gray-600 mt-2">Selecciona una modelo y configura sus plataformas y parámetros</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel izquierdo: Selección de modelo */}
          <div className="apple-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Modelo</h2>
            
            <div className="space-y-3">
              {models.map(model => (
                <div
                  key={model.id}
                  onClick={() => handleModelSelect(model.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedModel?.id === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{model.name || model.email}</h3>
                      <p className="text-sm text-gray-500">{model.email}</p>
                      <p className="text-xs text-gray-400">
                        Grupo: {model.groups.map(g => g.name).join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      {model.hasConfig ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Configurada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Sin configurar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel derecho: Configuración */}
          {selectedModel && (
            <div className="apple-card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Configurar: {selectedModel.name || selectedModel.email}
              </h2>

              <div className="space-y-6">
                {/* Plataformas habilitadas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-medium text-gray-900">Seleccionar Páginas</h3>
                    <span className="text-sm text-gray-500">
                      {platforms ? platforms.length : 0} plataformas disponibles
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
                    <div className="space-y-3">
                      {(() => {
                        console.log('🔍 [RENDER] About to map platforms:', platforms);
                        console.log('🔍 [RENDER] platforms type:', typeof platforms);
                        console.log('🔍 [RENDER] platforms is array:', Array.isArray(platforms));
                        console.log('🔍 [RENDER] platforms length:', platforms?.length);
                        
                        // 🔧 FIX: Usar renderPlatforms como fuente de verdad única
                        const platformsToRender = renderPlatforms;
                        
                        if (!platformsLoaded || !platformsToRender || !Array.isArray(platformsToRender) || platformsToRender.length === 0) {
                          console.log('🔍 [RENDER] No platforms to render, showing loading state');
                          console.log('🔍 [RENDER] platformsLoaded:', platformsLoaded);
                          console.log('🔍 [RENDER] platforms:', platforms);
                          console.log('🔍 [RENDER] platformsData:', platformsData);
                          console.log('🔍 [RENDER] renderPlatforms:', renderPlatforms);
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <p>No hay plataformas disponibles</p>
                              <p className="text-sm">Cargando datos...</p>
                            </div>
                          );
                        }
                        
                        return platformsToRender.map(platform => (
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
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                enabledPlatforms.includes(platform.id) ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* Configuración de reparto */}
                <div>
                  <h3 className="text-base font-medium text-gray-900 mb-3">Configuración de Reparto</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Porcentaje por Grupo
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={groupPercentage}
                        onChange={(e) => setGroupPercentage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="60"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Override por Modelo
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={percentageOverride}
                        onChange={(e) => setPercentageOverride(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Dejar vacío para usar grupo"
                      />
                    </div>
                  </div>
                </div>

                {/* Configuración de cuota mínima */}
                <div>
                  <h3 className="text-base font-medium text-gray-900 mb-3">Cuota Mínima</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cuota por Grupo (USD)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={groupMinQuota}
                          onChange={(e) => setGroupMinQuota(e.target.value)}
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="470"
                        />
                        <span className="absolute right-3 top-2 text-sm text-gray-500">USD</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Override por Modelo (USD)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={minQuotaOverride}
                          onChange={(e) => setMinQuotaOverride(e.target.value)}
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Dejar vacío para usar grupo"
                        />
                        <span className="absolute right-3 top-2 text-sm text-gray-500">USD</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={saving || enabledPlatforms.length === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                  <button
                    onClick={() => setSelectedModel(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
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
