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
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const loadModels = async (adminId: string) => {
    try {
      const response = await fetch(`/api/calculator/models?adminId=${adminId}`);
      const data = await response.json();
      
      if (data.success) {
        setModels(data.models || []);
      } else {
        setError(data.error || 'Error al cargar modelos');
      }
    } catch (err: any) {
      console.error('Error loading models:', err);
      setError(err.message || 'Error al cargar modelos');
    }
  };

  const handleModelSelect = async (model: Model) => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar datos de la calculadora del modelo
      const response = await fetch(`/api/calculator/admin-view?modelId=${model.id}&adminId=${user?.id}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('🔍 [ADMIN-VIEW] Calculator data received:', data);
        console.log('🔍 [ADMIN-VIEW] Platforms:', data.platforms);
        console.log('🔍 [ADMIN-VIEW] Values:', data.values);
        setSelectedModel({
          ...model,
          calculatorData: data
        });
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">🚫</div>
          <p className="text-red-600 mb-4">No tienes permisos para acceder a esta función</p>
          <button 
            onClick={() => router.push('/admin/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Si hay un modelo seleccionado, mostrar su calculadora
  if (selectedModel) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                Calculadora de {selectedModel.name}
              </h1>
              <p className="text-gray-500 text-sm">
                {selectedModel.email} • {selectedModel.groups.map(g => g.name).join(', ')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToModels}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
              >
                ← Volver
              </button>
            </div>
          </div>

          {/* Datos de la calculadora */}
          {selectedModel.calculatorData ? (
            <div className="space-y-4">
              {/* Estado de configuración - COMPACTO */}
              <div className="apple-card mb-3">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Estado de Configuración</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-blue-50 rounded-md">
                    <div className={`text-lg font-bold ${
                      selectedModel.calculatorData.isConfigured ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {selectedModel.calculatorData.isConfigured ? '✓' : '○'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {selectedModel.calculatorData.isConfigured ? 'Configurada' : 'Sin configurar'}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded-md">
                    <div className="text-lg font-bold text-purple-600">
                      {selectedModel.calculatorData.platforms?.length || 0}
                    </div>
                    <div className="text-xs text-gray-600">Plataformas</div>
                  </div>
                </div>
              </div>

              {/* Tabla de Calculadora - REPLICANDO DISEÑO DE MI CALCULADORA */}
              <div className="apple-card mb-4">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Calculadora de Ingresos</h2>
                
                {!selectedModel.calculatorData.isConfigured || !selectedModel.calculatorData.platforms || selectedModel.calculatorData.platforms.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-gray-400 text-2xl">📊</span>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No hay plataformas habilitadas</h4>
                    <p className="text-gray-500 mb-4">
                      Esta modelo no tiene configuración de calculadora o plataformas habilitadas.
                    </p>
                    <p className="text-sm text-gray-400">
                      Contacta al administrador para que configure las plataformas.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">PLATAFORMAS</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">VALORES</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">DÓLARES</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">COP MODELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedModel.calculatorData.platforms.map((platform: any) => {
                          // Obtener valor actual de esta plataforma
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => v.platform_id === platform.id)?.value || 0;
                          console.log('🔍 [ADMIN-VIEW] Platform:', platform.name, 'Value:', currentValue, 'Values array:', selectedModel.calculatorData.values);
                          
                          // Calcular dólares y COP para esta plataforma usando las mismas fórmulas
                          let usdBruto = currentValue;
                          
                          // Aplicar fórmula específica según la plataforma
                          let usdModelo = 0;
                          if (platform.currency === 'EUR') {
                            if (platform.id === 'big7') {
                              usdModelo = (currentValue * 1.01) * 0.84; // 16% impuesto
                            } else if (platform.id === 'mondo') {
                              usdModelo = (currentValue * 1.01) * 0.78; // 22% descuento
                            } else {
                              usdModelo = currentValue * 1.01; // EUR directo
                            }
                          } else if (platform.currency === 'GBP') {
                            if (platform.id === 'aw') {
                              usdModelo = (currentValue * 1.20) * 0.677; // 32.3% descuento
                            } else {
                              usdModelo = currentValue * 1.20; // GBP directo
                            }
                          } else if (platform.currency === 'USD') {
                            if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
                              usdModelo = currentValue * 0.75; // 25% descuento
                            } else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
                              usdModelo = currentValue * 0.05; // 100 tokens = 5 USD
                            } else if (platform.id === 'dxlive') {
                              usdModelo = currentValue * 0.60; // 100 pts = 60 USD
                            } else if (platform.id === 'secretfriends') {
                              usdModelo = currentValue * 0.5; // 50% descuento
                            } else if (platform.id === 'superfoon') {
                              usdModelo = currentValue; // 100% directo
                            } else {
                              usdModelo = currentValue; // USD directo por defecto
                            }
                          }
                          
                          // Aplicar porcentaje de reparto del modelo
                          const usdModeloFinal = (usdModelo * platform.percentage) / 100;
                          const copModelo = usdModeloFinal * 3900; // Tasa fija por ahora
                          
                          return (
                            <tr key={platform.id} className="border-b border-gray-100">
                              <td className="py-3 px-3">
                                <div className="font-medium text-gray-900 text-sm">{platform.name}</div>
                                <div className="text-xs text-gray-500">Reparto: {platform.percentage}%</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="relative">
                                  <div className="text-gray-600 font-medium text-sm">
                                    {currentValue.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {platform.currency || 'USD'}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-gray-600 font-medium text-sm">
                                  ${usdModelo.toFixed(2)} USD
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="text-gray-600 font-medium text-sm">
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

              {/* Totales y Alertas - COMPACTO */}
              {selectedModel.calculatorData.platforms && selectedModel.calculatorData.platforms.length > 0 && (
                <div className="apple-card">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Totales y Alertas</h3>
                  
                  {/* Totales principales - COMPACTO */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-md">
                      <div className="text-xl font-bold text-blue-600 mb-1">
                        ${selectedModel.calculatorData.platforms.reduce((sum: number, platform: any) => {
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => v.platform_id === platform.id)?.value || 0;
                          let usdBruto = 0;
                          if (platform.currency === 'EUR') {
                            usdBruto = currentValue * 1.01;
                          } else if (platform.currency === 'GBP') {
                            usdBruto = currentValue * 1.20;
                          } else {
                            usdBruto = currentValue;
                          }
                          return sum + usdBruto;
                        }, 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">USD Bruto</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-md">
                      <div className="text-xl font-bold text-green-600 mb-1">
                        ${selectedModel.calculatorData.platforms.reduce((sum: number, platform: any) => {
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => v.platform_id === platform.id)?.value || 0;
                          let usdModelo = 0;
                          if (platform.currency === 'EUR') {
                            usdModelo = currentValue * 1.01;
                          } else if (platform.currency === 'GBP') {
                            usdModelo = currentValue * 1.20;
                          } else {
                            usdModelo = currentValue;
                          }
                          return sum + (usdModelo * platform.percentage / 100);
                        }, 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600">USD Modelo</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-md">
                      <div className="text-xl font-bold text-purple-600 mb-1">
                        ${(selectedModel.calculatorData.platforms.reduce((sum: number, platform: any) => {
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => v.platform_id === platform.id)?.value || 0;
                          let usdModelo = 0;
                          if (platform.currency === 'EUR') {
                            usdModelo = currentValue * 1.01;
                          } else if (platform.currency === 'GBP') {
                            usdModelo = currentValue * 1.20;
                          } else {
                            usdModelo = currentValue;
                          }
                          return sum + (usdModelo * platform.percentage / 100);
                        }, 0) * 3900).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-gray-600">COP Modelo</div>
                    </div>
                  </div>
                  
                  {/* 90% de anticipo */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                      <strong>90% de anticipo disponible:</strong> ${(selectedModel.calculatorData.platforms.reduce((sum: number, platform: any) => {
                        const currentValue = selectedModel.calculatorData.values?.find((v: any) => v.platform_id === platform.id)?.value || 0;
                        let usdModelo = 0;
                        if (platform.currency === 'EUR') {
                          usdModelo = currentValue * 1.01;
                        } else if (platform.currency === 'GBP') {
                          usdModelo = currentValue * 1.20;
                        } else {
                          usdModelo = currentValue;
                        }
                        return sum + (usdModelo * platform.percentage / 100);
                      }, 0) * 3900 * 0.9).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="apple-card">
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">🧮</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Calculadora de {selectedModel.name}
                </h3>
                <p className="text-gray-600 mb-4">
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

  // Mostrar lista de modelos
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">
            Ver Calculadora de Modelo
          </h1>
          <p className="text-gray-600 mt-2">
            Selecciona una modelo para ver su calculadora
          </p>
        </div>

        {/* Lista de modelos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => (
            <div 
              key={model.id}
              onClick={() => handleModelSelect(model)}
              className="apple-card cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {model.name}
                </h3>
                <div className={`px-2 py-1 rounded-full text-xs ${
                  model.currentConfig?.active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {model.currentConfig?.active ? 'Configurada' : 'Sin configurar'}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">
                {model.email}
              </p>
              
              <div className="text-sm text-gray-500">
                Grupos: {model.groups.map(g => g.name).join(', ')}
              </div>
              
              <div className="mt-3 text-sm text-blue-600">
                Ver calculadora →
              </div>
            </div>
          ))}
        </div>

        {models.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay modelos disponibles
            </h3>
            <p className="text-gray-600">
              No se encontraron modelos asignados a tus grupos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}