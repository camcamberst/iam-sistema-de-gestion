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
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <button 
              onClick={handleBackToModels}
              className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              ← Volver a la lista de modelos
            </button>
            <h1 className="text-3xl font-semibold text-gray-900">
              Calculadora de {selectedModel.name}
            </h1>
            <p className="text-gray-600 mt-2">
              {selectedModel.email} • {selectedModel.groups.map(g => g.name).join(', ')}
            </p>
          </div>

          {/* Datos de la calculadora */}
          {selectedModel.calculatorData ? (
            <div className="space-y-6">
              {/* Estado de configuración */}
              <div className="apple-card">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Estado de Configuración
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Estado</label>
                    <div className={`mt-1 px-3 py-1 rounded-full text-sm inline-block ${
                      selectedModel.calculatorData.isConfigured 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedModel.calculatorData.isConfigured ? 'Configurada' : 'Sin configurar'}
                    </div>
                  </div>
                  
                  {selectedModel.calculatorData.config && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Porcentaje Override</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedModel.calculatorData.config.percentage_override || 'No definido'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Cuota Mínima Override</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedModel.calculatorData.config.min_quota_override || 'No definido'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Porcentaje del Grupo</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedModel.calculatorData.config.group_percentage || 'No definido'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Cuota Mínima del Grupo</label>
                        <p className="mt-1 text-sm text-gray-900">
                          {selectedModel.calculatorData.config.group_min_quota || 'No definido'}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Plataformas habilitadas */}
              {selectedModel.calculatorData.platforms && selectedModel.calculatorData.platforms.length > 0 && (
                <div className="apple-card">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Plataformas Habilitadas ({selectedModel.calculatorData.platforms.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedModel.calculatorData.platforms.map((platform: any) => (
                      <div key={platform.id} className="border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900">{platform.name}</h4>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <div>Porcentaje: {platform.percentage}%</div>
                          <div>Cuota mínima: ${platform.min_quota}</div>
                          <div>Moneda: {platform.currency || 'USD'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valores actuales */}
              {selectedModel.calculatorData.values && selectedModel.calculatorData.values.length > 0 && (
                <div className="apple-card">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Valores Actuales ({selectedModel.calculatorData.values.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plataforma
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tokens
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            USD
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actualizado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedModel.calculatorData.values.map((value: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {value.platform || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {value.value || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {value.tokens || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${value.value_usd || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(value.updated_at || value.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sin datos */}
              {(!selectedModel.calculatorData.platforms || selectedModel.calculatorData.platforms.length === 0) && 
               (!selectedModel.calculatorData.values || selectedModel.calculatorData.values.length === 0) && (
                <div className="apple-card">
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Sin datos de calculadora
                    </h3>
                    <p className="text-gray-600">
                      Esta modelo no tiene configuración de calculadora o valores registrados
                    </p>
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