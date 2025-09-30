"use client";

import { useEffect, useState } from "react";

interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  value: number;
  percentage: number;
  minQuota: number;
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

export default function ModelCalculator() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Plataformas disponibles (configuradas por admin)
  // Por defecto, ninguna plataforma está habilitada hasta que el admin las configure
  const availablePlatforms = [
    { id: 'chaturbate', name: 'Chaturbate', enabled: false },
    { id: 'myfreecams', name: 'MyFreeCams', enabled: false },
    { id: 'stripchat', name: 'Stripchat', enabled: false },
    { id: 'dxlive', name: 'DX Live', enabled: false },
    { id: 'big7', name: 'BIG7', enabled: false },
    { id: 'aw', name: 'AW', enabled: false },
    { id: 'mondo', name: 'MONDO', enabled: false },
    { id: 'cmd', name: 'CMD', enabled: false },
    { id: 'camlust', name: 'CAMLUST', enabled: false },
    { id: 'skypvt', name: 'SKYPVT', enabled: false },
    { id: 'secretfriends', name: 'SECRETFRIENDS', enabled: false },
    { id: 'superfoon', name: 'SUPERFOON', enabled: false },
  ];

  useEffect(() => {
    loadModelConfig();
  }, []);

  const loadModelConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener configuración de la modelo actual
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const userId = userData ? JSON.parse(userData).id : null;

      if (!userId) {
        setError('Usuario no autenticado');
        return;
      }

      const response = await fetch(`/api/calculator/config?modelId=${userId}`);
      const data = await response.json();

      if (!data.success) {
        // Si no hay configuración, mostrar mensaje
        setPlatforms([]);
        return;
      }

      const config = data.data.config;
      const availablePlatforms = data.data.platforms;

      if (!config || !availablePlatforms) {
        setPlatforms([]);
        return;
      }

      // Crear plataformas basadas en la configuración del admin
      const enabledPlatformIds = config.enabled_platforms || [];
      const configuredPlatforms = availablePlatforms
        .filter((platform: any) => enabledPlatformIds.includes(platform.id))
        .map((platform: any) => ({
          id: platform.id,
          name: platform.name,
          enabled: true,
          value: 0,
          percentage: config.percentage_override || config.group_percentage || 60,
          minQuota: config.min_quota_override || config.group_min_quota || 470
        }));

      setPlatforms(configuredPlatforms);

    } catch (err: any) {
      console.error('Error al cargar configuración:', err);
      setError(err.message || 'Error al cargar configuración');
    } finally {
      setLoading(false);
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

      // Llamar al endpoint de preview
      const response = await fetch('/api/calculator/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
          demo: false // Usar datos reales
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al calcular');
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setCalculating(false);
    }
  };

  const saveValues = async () => {
    try {
      setLoading(true);
      setError(null);

      // Preparar valores para guardar
      const values = platforms.reduce((acc, platform) => {
        if (platform.enabled && platform.value > 0) {
          acc[platform.id] = platform.value;
        }
        return acc;
      }, {} as Record<string, number>);

      // Llamar al endpoint para guardar
      const response = await fetch('/api/calculator/model-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: 'current-user', // TODO: Obtener ID real del usuario
          values
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      // Mostrar mensaje de éxito
      alert('Valores guardados correctamente');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="apple-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Calculadora de Ingresos</h2>
            <p className="text-sm text-gray-500">Ingresa tus valores por plataforma</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={calculateTotals}
              disabled={calculating || platforms.filter(p => p.enabled).length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {calculating ? 'Calculando...' : 'Calcular'}
            </button>
            <button
              onClick={saveValues}
              disabled={loading || platforms.filter(p => p.enabled).length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Plataformas habilitadas */}
      <div className="apple-card">
        <h3 className="text-base font-medium text-gray-900 mb-4">Plataformas Habilitadas</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando configuración...</p>
          </div>
        ) : platforms.filter(p => p.enabled).length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-400 text-2xl">📊</span>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No hay plataformas habilitadas</h4>
            <p className="text-gray-500 mb-4">
              Tu administrador aún no ha configurado las plataformas para tu calculadora.
            </p>
            <p className="text-sm text-gray-400">
              Contacta a tu administrador para que habilite las plataformas que usarás.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platforms.filter(p => p.enabled).map(platform => (
              <div key={platform.id} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {platform.name}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={platform.value}
                  onChange={(e) => handleValueChange(platform.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resultados */}
      {result && (
        <div className="apple-card">
          <h3 className="text-base font-medium text-gray-900 mb-4">Resultados del Cálculo</h3>
          
          {/* Totales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-500">USD Bruto</div>
              <div className="text-2xl font-bold text-blue-900">
                ${result.totalUsdBruto.toFixed(2)}
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-500">USD Modelo</div>
              <div className="text-2xl font-bold text-green-900">
                ${result.totalUsdModelo.toFixed(2)}
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-500">COP Modelo</div>
              <div className="text-2xl font-bold text-purple-900">
                ${result.totalCopModelo.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Alerta de cuota mínima */}
          {result.cuotaMinimaAlert.below && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <div className="flex items-center">
                <span className="text-red-600 text-lg mr-2">⚠️</span>
                <div>
                  <div className="text-red-800 font-medium">Cuota mínima no alcanzada</div>
                  <div className="text-red-600 text-sm">
                    Te faltan {result.cuotaMinimaAlert.percentToReach.toFixed(1)}% para alcanzar tu cuota mínima
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anticipo máximo */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-yellow-600 text-lg mr-2">💰</span>
              <div>
                <div className="text-yellow-800 font-medium">Anticipo máximo disponible</div>
                <div className="text-yellow-600 text-sm">
                  Puedes solicitar hasta ${result.anticipoMaxCop.toLocaleString('es-CO')} COP (90% del total)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="apple-card">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800 font-medium">Error</div>
            <div className="text-red-600 text-sm">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
