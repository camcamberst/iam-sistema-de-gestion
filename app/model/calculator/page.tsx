'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

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
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'modelo',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        setUser(current);
        
        // Cargar configuración de calculadora
        await loadCalculatorConfig(current.id);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadCalculatorConfig = async (userId: string) => {
    try {
      console.log('🔍 [CALCULATOR] Loading config for userId:', userId);

      // Cargar configuración desde API simplificada
      const response = await fetch(`/api/calculator/config-simple?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Error al cargar configuración');
      }

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Config data:', data);

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

      console.log('🔍 [CALCULATOR] Enabled platforms:', enabledPlatforms);
      setPlatforms(enabledPlatforms);

    } catch (err: any) {
      console.error('❌ [CALCULATOR] Error:', err);
      setError(err.message || 'Error al cargar configuración');
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

      const values = platforms.reduce((acc, platform) => {
        if (platform.enabled && platform.value > 0) {
          acc[platform.id] = platform.value;
        }
        return acc;
      }, {} as Record<string, number>);

      console.log('🔍 [CALCULATOR] Saving values:', values);

      const response = await fetch('/api/calculator/model-values', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          values
        }),
      });

      const data = await response.json();
      console.log('🔍 [CALCULATOR] Save result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      alert('Valores guardados correctamente');
    } catch (err: any) {
      console.error('❌ [CALCULATOR] Save error:', err);
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando calculadora...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'modelo') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Mi Calculadora</h1>
          <p className="text-gray-500 text-sm">
            Bienvenida, {user.name} · Ingresa tus valores por plataforma
          </p>
        </div>

        {/* Rates actualizadas */}
        <div className="apple-card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasas Actualizadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">$3,900</div>
              <div className="text-sm text-gray-600">USD → COP</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">1.01</div>
              <div className="text-sm text-gray-600">EUR → USD</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">1.20</div>
              <div className="text-sm text-gray-600">GBP → USD</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Tasas configuradas por tu administrador
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="apple-card mb-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-500 text-2xl">⚠️</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Error al cargar calculadora</h4>
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={() => loadCalculatorConfig(user.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Tabla de Calculadora */}
        <div className="apple-card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Calculadora de Ingresos</h2>
          
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">PLATAFORMAS</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">VALORES</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">DÓLARES</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">COP MODELO</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.filter(p => p.enabled).map(platform => {
                    // Calcular dólares y COP para esta plataforma
                    const usdBruto = platform.value;
                    const usdModelo = (platform.value * platform.percentage) / 100;
                    const copModelo = usdModelo * 3900; // Rate hardcodeado por ahora
                    
                    return (
                      <tr key={platform.id} className="border-b border-gray-100">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{platform.name}</div>
                          <div className="text-xs text-gray-500">Reparto: {platform.percentage}%</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={platform.value}
                              onChange={(e) => handleValueChange(platform.id, parseFloat(e.target.value) || 0)}
                              className="apple-input w-32"
                              placeholder="0.00"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                              <span className="text-gray-500 text-xs">USD</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-gray-600 font-medium">
                            ${usdBruto.toFixed(2)} USD
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-gray-600 font-medium">
                            ${copModelo.toLocaleString()} COP
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

        {/* Botones de Acción */}
        <div className="apple-card mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Cálculo de Totales</h3>
              <p className="text-sm text-gray-500">Calcula tus ingresos totales</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={calculateTotals}
                disabled={calculating || platforms.filter(p => p.enabled).length === 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {calculating ? 'Calculando...' : 'Calcular'}
              </button>
              <button
                onClick={saveValues}
                disabled={saving || platforms.filter(p => p.enabled).length === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>

        {/* Totales y Alertas */}
        <div className="apple-card">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Totales y Alertas</h3>
          
          {/* Totales principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                ${platforms.reduce((sum, p) => sum + p.value, 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">USD Bruto Total</div>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600 mb-2">
                ${platforms.reduce((sum, p) => sum + (p.value * p.percentage / 100), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">USD Modelo Total</div>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                ${(platforms.reduce((sum, p) => sum + (p.value * p.percentage / 100), 0) * 3900).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">COP Modelo Total</div>
            </div>
          </div>
          
          {/* 90% de anticipo */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>90% de anticipo disponible:</strong> ${(platforms.reduce((sum, p) => sum + (p.value * p.percentage / 100), 0) * 3900 * 0.9).toLocaleString()} COP
            </div>
          </div>
          
          {/* Alerta de cuota mínima */}
          {(() => {
            const totalUsdModelo = platforms.reduce((sum, p) => sum + (p.value * p.percentage / 100), 0);
            const cuotaMinima = platforms[0]?.minQuota || 470;
            const porcentajeAlcanzado = (totalUsdModelo / cuotaMinima) * 100;
            const estaPorDebajo = totalUsdModelo < cuotaMinima;
            
            return (
              <div className={`p-4 rounded-lg border ${estaPorDebajo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center">
                  <span className={`text-xl mr-3 ${estaPorDebajo ? 'text-red-500' : 'text-green-500'}`}>
                    {estaPorDebajo ? '⚠️' : '✅'}
                  </span>
                  <div>
                    <div className={`font-medium ${estaPorDebajo ? 'text-red-800' : 'text-green-800'}`}>
                      {estaPorDebajo ? 'Cuota mínima no alcanzada' : 'Cuota mínima alcanzada'}
                    </div>
                    <div className={`text-sm ${estaPorDebajo ? 'text-red-600' : 'text-green-600'}`}>
                      {estaPorDebajo 
                        ? `Te faltan ${(100 - porcentajeAlcanzado).toFixed(1)}% para alcanzar la cuota mínima de $${cuotaMinima} USD`
                        : `Has alcanzado el ${porcentajeAlcanzado.toFixed(1)}% de la cuota mínima de $${cuotaMinima} USD`
                      }
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
