'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import AppleDropdown from '@/components/ui/AppleDropdown';

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
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Estados para filtros
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  
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
        const modelsData = data.models || [];
        setAllModels(modelsData);
        setModels(modelsData);
        
        // Extraer grupos únicos para el filtro
        const groupsSet = new Set<{id: string, name: string}>();
        modelsData.forEach((model: Model) => {
          model.groups.forEach(group => {
            groupsSet.add(group);
          });
        });
        
        // Filtrar grupos según el rol del usuario
        let filteredGroups = Array.from(groupsSet);
        if (user && user.role === 'admin') {
          // Admin solo ve sus grupos asignados
          filteredGroups = filteredGroups.filter(group => 
            user.groups.includes(group.name)
          );
        }
        
        setAvailableGroups(filteredGroups);
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
    setSelectedModelId('');
    setEditValues({});
    setHasChanges(false);
  };

  // Función para filtrar por grupo
  const handleGroupFilter = (groupId: string) => {
    setSelectedGroup(groupId);
    applyFilters(groupId, nameFilter);
  };

  // Función para filtrar por nombre
  const handleNameFilter = (name: string) => {
    setNameFilter(name);
    applyFilters(selectedGroup, name);
  };

  // Aplicar ambos filtros
  const applyFilters = (groupId: string, name: string) => {
    let filteredModels = allModels;

    // Filtrar por grupo
    if (groupId !== 'all') {
      filteredModels = filteredModels.filter(model =>
        model.groups.some(group => group.id === groupId)
      );
    }

    // Filtrar por nombre
    if (name.trim()) {
      const searchTerm = name.toLowerCase().trim();
      filteredModels = filteredModels.filter(model =>
        model.name.toLowerCase().includes(searchTerm) ||
        model.email.toLowerCase().includes(searchTerm)
      );
    }

    setModels(filteredModels);
    
    // Reset selected model if it's not in the filtered results
    if (selectedModelId && !filteredModels.find(m => m.id === selectedModelId)) {
      setSelectedModelId('');
    }
  };

  // Función para seleccionar modelo desde dropdown
  const handleModelDropdownSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    if (modelId) {
      const model = models.find(m => m.id === modelId);
      if (model) {
        handleModelSelect(model);
      }
    }
  };

  const handleValueChange = (platformId: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [platformId]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedModel || !user) return;

    try {
      setSaving(true);
      setError(null);

      // Convertir valores de string a number
      const valuesToSave: Record<string, number> = {};
      Object.entries(editValues).forEach(([platformId, value]) => {
        const numericValue = Number.parseFloat(value) || 0;
        if (numericValue > 0) {
          valuesToSave[platformId] = numericValue;
        }
      });

      console.log('🔍 [ADMIN-EDIT] Saving values:', valuesToSave);

      const response = await fetch('/api/calculator/model-values-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          values: valuesToSave,
          periodDate: selectedModel.calculatorData.periodDate
        }),
      });

      const data = await response.json();
      console.log('🔍 [ADMIN-EDIT] Save result:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar');
      }

      // Recargar datos de la calculadora
      await handleModelSelect(selectedModel);
      
      setEditValues({});
      setHasChanges(false);
      
      // Notificación elegante estilo Apple
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 z-50';
      notification.innerHTML = 'Valores guardados correctamente';
      document.body.appendChild(notification);
      
      // Animar entrada
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      // Remover después de 3 segundos
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);

    } catch (err: any) {
      console.error('❌ [ADMIN-EDIT] Save error:', err);
      setError(err.message || 'Error al guardar valores');
    } finally {
      setSaving(false);
    }
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
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleBackToModels}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Volver a la lista</span>
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                  Calculadora de {selectedModel.name}
                </h1>
                <p className="text-gray-500 text-sm">
                  {selectedModel.email} • {selectedModel.groups.map(g => g.name).join(', ')}
                </p>
              </div>

              {/* Footer actions */}
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                    hasChanges && !saving
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>

          {/* Datos de la calculadora */}
          {selectedModel.calculatorData ? (
            <div className="space-y-4">
              {/* Tasas actualizadas - ESTILO APPLE REFINADO */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 hover:shadow-md transition-all duration-300">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Tasas Actualizadas
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                    <div className="text-xl font-bold text-blue-700 mb-1">
                      ${selectedModel.calculatorData.rates?.usd_cop || 3900}
                    </div>
                    <div className="text-xs font-medium text-blue-600 bg-blue-200 px-2 py-1 rounded-full">USD→COP</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                    <div className="text-xl font-bold text-green-700 mb-1">
                      {selectedModel.calculatorData.rates?.eur_usd || 1.01}
                    </div>
                    <div className="text-xs font-medium text-green-600 bg-green-200 px-2 py-1 rounded-full">EUR→USD</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
                    <div className="text-xl font-bold text-purple-700 mb-1">
                      {selectedModel.calculatorData.rates?.gbp_usd || 1.20}
                    </div>
                    <div className="text-xs font-medium text-purple-600 bg-purple-200 px-2 py-1 rounded-full">GBP→USD</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center font-medium">
                  Configuradas por tu administrador
                </p>
              </div>


              {/* Tabla de Calculadora - ESTILO APPLE REFINADO */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 hover:shadow-md transition-all duration-300">
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Calculadora de Ingresos
                </h2>
                
                {!selectedModel.calculatorData.isConfigured || !selectedModel.calculatorData.platforms || selectedModel.calculatorData.platforms.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"></div>
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
                          // Obtener valor actual de esta plataforma - buscar por platform_id o por platform name
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => 
                            v.platform_id === platform.id || v.platform === platform.name
                          )?.value || 0;
                          console.log('🔍 [ADMIN-VIEW] Platform:', platform.name, 'ID:', platform.id, 'Value:', currentValue);
                          
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
                            <tr key={platform.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 group">
                              <td className="py-3 px-3">
                                <div className="font-medium text-gray-900 text-sm">{platform.name}</div>
                                <div className="text-xs text-gray-500">Reparto: {platform.percentage}%</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="relative group">
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={editValues[platform.id] !== undefined ? editValues[platform.id] : currentValue.toFixed(2)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const cleaned = raw.replace(/[^0-9.,]/g, '');
                                        const normalized = cleaned.replace(',', '.');
                                        const parts = normalized.split('.');
                                        const safeNormalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : normalized;
                                        handleValueChange(platform.id, safeNormalized);
                                      }}
                                      className="w-24 px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 focus:shadow-lg focus:shadow-blue-100"
                                      placeholder="0.00"
                                    />
                                    <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                                      {platform.currency || 'USD'}
                                    </span>
                                  </div>
                                  {/* Indicador de cambio */}
                                  {editValues[platform.id] !== undefined && editValues[platform.id] !== currentValue.toFixed(2) && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                  )}
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
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => 
                            v.platform_id === platform.id || v.platform === platform.name
                          )?.value || 0;
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
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => 
                            v.platform_id === platform.id || v.platform === platform.name
                          )?.value || 0;
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
                          const currentValue = selectedModel.calculatorData.values?.find((v: any) => 
                            v.platform_id === platform.id || v.platform === platform.name
                          )?.value || 0;
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
                <div className="text-gray-400 mb-4"></div>
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

  // Mostrar lista de modelos con panel de filtros
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Ver Calculadora de Modelo</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel izquierdo: Filtros */}
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
            
            {/* Filtro por Nombre */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Buscar por Nombre</h2>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => handleNameFilter(e.target.value)}
                placeholder="Buscar modelo..."
                className="apple-input text-sm"
              />
            </div>

            {/* Selección de Modelo */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Modelo</h2>
              <AppleDropdown
                options={[
                  { value: '', label: 'Selecciona un modelo' },
                  ...models.map(model => ({
                    value: model.id,
                    label: model.name || model.email,
                    badge: model.currentConfig?.active ? 'Configurada' : 'Sin configurar',
                    badgeColor: model.currentConfig?.active ? 'green' as const : 'gray' as const
                  }))
                ]}
                value={selectedModelId}
                onChange={handleModelDropdownSelect}
                placeholder="Selecciona un modelo"
              />

              {/* Información del modelo seleccionado */}
              {selectedModelId && models.find(m => m.id === selectedModelId) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  {(() => {
                    const model = models.find(m => m.id === selectedModelId);
                    return model ? (
                      <>
                        <p className="text-sm font-medium text-gray-900 mb-2">{model.name}</p>
                        <p className="text-xs text-gray-600 mb-2">{model.email}</p>
                        <div className="flex flex-wrap gap-1">
                          {model.groups.map((group) => (
                            <span
                              key={group.id}
                              className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {group.name}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Estado cuando no hay modelos */}
              {models.length === 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                  <div className="text-gray-400 mb-2 text-2xl">👥</div>
                  <p className="text-sm text-gray-600 mb-2">
                    {nameFilter || selectedGroup !== 'all' 
                      ? 'No se encontraron modelos con los filtros aplicados' 
                      : 'No hay modelos disponibles'
                    }
                  </p>
                  {(nameFilter || selectedGroup !== 'all') && (
                    <button
                      onClick={() => {
                        setNameFilter('');
                        setSelectedGroup('all');
                        setSelectedModelId('');
                        setModels(allModels);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Información de resultados */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                Mostrando {models.length} de {allModels.length} modelos
              </p>
              {selectedGroup !== 'all' && (
                <p className="text-xs text-blue-600 mt-1">
                  Filtrado por: {availableGroups.find(g => g.id === selectedGroup)?.name}
                </p>
              )}
              {nameFilter && (
                <p className="text-xs text-green-600 mt-1">
                  Búsqueda: "{nameFilter}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho: Información adicional o vacío */}
        <div className="md:col-span-2">
          <div className="apple-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
            
            {selectedModelId && models.find(m => m.id === selectedModelId) ? (
              <div className="text-center py-8">
                <div className="text-green-500 mb-4 text-4xl">✅</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Modelo seleccionado
                </h3>
                <p className="text-gray-600 mb-4">
                  {models.find(m => m.id === selectedModelId)?.name} está listo para ver su calculadora
                </p>
                <p className="text-sm text-gray-500">
                  La calculadora se abrirá automáticamente
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4 text-4xl">👈</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Selecciona un modelo
                </h3>
                <p className="text-gray-600">
                  Usa los filtros de la izquierda para encontrar y seleccionar un modelo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}