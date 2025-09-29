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
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const modelsResponse = await fetch('/api/calculator/models?adminId=current-user'); // TODO: Obtener ID real
      const modelsData = await modelsResponse.json();
      
      if (!modelsData.success) {
        throw new Error(modelsData.error || 'Error al cargar modelos');
      }

      setModels(modelsData.data);

      // Cargar plataformas disponibles
      const platformsResponse = await fetch('/api/calculator/platforms');
      const platformsData = await platformsResponse.json();
      
      if (!platformsData.success) {
        throw new Error(platformsData.error || 'Error al cargar plataformas');
      }

      setPlatforms(platformsData.data);

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

      const response = await fetch('/api/calculator/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          adminId: 'current-user', // TODO: Obtener ID real
          groupId: selectedModel.groups[0]?.id,
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
                  <h3 className="text-base font-medium text-gray-900 mb-3">Plataformas Habilitadas</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {platforms.map(platform => (
                      <label key={platform.id} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={enabledPlatforms.includes(platform.id)}
                          onChange={() => handlePlatformToggle(platform.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{platform.name}</span>
                          <p className="text-xs text-gray-500">{platform.description}</p>
                        </div>
                      </label>
                    ))}
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
                        step="0.01"
                        value={groupPercentage}
                        onChange={(e) => setGroupPercentage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="60.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Override por Modelo
                      </label>
                      <input
                        type="number"
                        step="0.01"
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
                        Cuota por Grupo
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={groupMinQuota}
                        onChange={(e) => setGroupMinQuota(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1000.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Override por Modelo
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={minQuotaOverride}
                        onChange={(e) => setMinQuotaOverride(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Dejar vacío para usar grupo"
                      />
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
