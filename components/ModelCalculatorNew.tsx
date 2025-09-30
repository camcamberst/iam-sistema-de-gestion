"use client";

import { useState, useEffect } from "react";

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

export default function ModelCalculatorNew() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  console.log('🔍 [ModelCalculatorNew] Component mounted');
  console.log('🔍 [ModelCalculatorNew] Loading:', loading);
  console.log('🔍 [ModelCalculatorNew] Platforms:', platforms);

  // Cargar configuración de la modelo
  useEffect(() => {
    loadModelConfiguration();
  }, []);

  const loadModelConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener ID del usuario desde localStorage
      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('Usuario no autenticado');
      }

      const user = JSON.parse(userData);
      console.log('🔍 [ModelCalculatorNew] User:', user);

      // Cargar configuración desde API
      const response = await fetch(`/api/calculator/config?userId=${user.id}`);
      if (!response.ok) {
        throw new Error('Error al cargar configuración');
      }

      const data = await response.json();
      console.log('🔍 [ModelCalculatorNew] Config data:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar configuración');
      }

      // Procesar plataformas habilitadas
      const enabledPlatforms = data.config.platforms
        .filter((p: any) => p.enabled)
        .map((platform: any) => ({
          id: platform.platform_id,
          name: platform.platform_name,
          enabled: true,
          value: 0,
          percentage: platform.percentage_override || platform.group_percentage || 80,
          minQuota: platform.min_quota_override || platform.group_min_quota || 470
        }));

      console.log('🔍 [ModelCalculatorNew] Enabled platforms:', enabledPlatforms);
      setPlatforms(enabledPlatforms);

    } catch (err: any) {
      console.error('❌ [ModelCalculatorNew] Error:', err);
      setError(err.message || 'Error al cargar configuración');
      
      // Fallback: mostrar plataformas de ejemplo para testing
      const fallbackPlatforms = [
        { id: 'chaturbate', name: 'Chaturbate', enabled: true, value: 0, percentage: 80, minQuota: 470 },
        { id: 'myfreecams', name: 'MyFreeCams', enabled: true, value: 0, percentage: 80, minQuota: 470 },
        { id: 'stripchat', name: 'Stripchat', enabled: true, value: 0, percentage: 80, minQuota: 470 }
      ];
      setPlatforms(fallbackPlatforms);
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

      console.log('🔍 [ModelCalculatorNew] Calculating with values:', values);

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
      console.log('🔍 [ModelCalculatorNew] Calculation result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al calcular');
      }

      setResult(data.data);
    } catch (err: any) {
      console.error('❌ [ModelCalculatorNew] Calculation error:', err);
      setError(err.message || 'Error al calcular');
    } finally {
      setCalculating(false);
    }
  };

  const saveValues = async () => {
    try {
      setSaving(true);
      setError(null);

      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('Usuario no autenticado');
      }

      const user = JSON.parse(userData);
      const values = platforms.reduce((acc, platform) => {
        if (platform.enabled && platform.value > 0) {
          acc[platform.id] = platform.value;
        }
        return acc;
      }, {} as Record<string, number>);

      console.log('🔍 [ModelCalculatorNew] Saving values:', values);

      const response = await fetch('/api/calculator/model-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          values
        }),
      });

      const data = await response.json();
      console.log('🔍 [ModelCalculatorNew] Save result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      alert('Valores guardados correctamente');
    } catch (err: any) {
      console.error('❌ [ModelCalculatorNew] Save error:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="apple-card">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando calculadora...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="apple-card">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">⚠️</span>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">Error al cargar calculadora</h4>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadModelConfiguration}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header de la calculadora */}
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
              disabled={saving || platforms.filter(p => p.enabled).length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Plataformas habilitadas */}
      <div className="apple-card">
        <h3 className="text-base font-medium text-gray-900 mb-4">Plataformas Habilitadas</h3>
        
        {platforms.filter(p => p.enabled).length === 0 ? (
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
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={platform.value}
                    onChange={(e) => handleValueChange(platform.id, parseFloat(e.target.value) || 0)}
                    className="apple-input w-full"
                    placeholder="Ingresa valor"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-500 text-sm">USD</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Reparto: {platform.percentage}% | Cuota mín: ${platform.minQuota} USD
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resultados */}
      {result && (
        <div className="apple-card">
          <h3 className="text-base font-medium text-gray-900 mb-4">Resultados del Cálculo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                ${result.totalUsdBruto.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">USD Bruto</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ${result.totalUsdModelo.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">USD Modelo</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                ${result.totalCopModelo.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">COP Modelo</div>
            </div>
          </div>
          
          {result.cuotaMinimaAlert.below && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-red-500 text-xl mr-2">⚠️</span>
                <div>
                  <div className="text-red-800 font-medium">Cuota mínima no alcanzada</div>
                  <div className="text-red-600 text-sm">
                    Te faltan {result.cuotaMinimaAlert.percentToReach.toFixed(1)}% para alcanzar la cuota mínima
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>Anticipo máximo:</strong> ${result.anticipoMaxCop.toLocaleString()} COP
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
