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
  role: string;
  groups: string[];
}

export default function ViewModelCalculator() {
  const [user, setUser] = useState<User | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [groupsOptions, setGroupsOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  
  // Estados para dropdowns personalizados
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  
  // Estados para optimización de carga
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [preloadData, setPreloadData] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setIsGroupDropdownOpen(false);
        setIsModelDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Precargar datos de la calculadora cuando se selecciona un modelo
  const preloadCalculatorData = async (modelId: string) => {
    try {
      setIframeLoading(true);
      setIframeError(false);
      
      // Precargar configuración de la calculadora
      const configResponse = await fetch(`/api/calculator/config-v2?modelId=${modelId}`);
      const configData = await configResponse.json();
      
      // Precargar valores guardados
      const valuesResponse = await fetch(`/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${new Date().toISOString().split('T')[0]}`);
      const valuesData = await valuesResponse.json();
      
      // Precargar tasas activas
      const ratesResponse = await fetch('/api/rates-v2');
      const ratesData = await ratesResponse.json();
      
      setPreloadData({
        config: configData,
        values: valuesData,
        rates: ratesData
      });
      
      console.log('✅ [PRELOAD] Datos precargados para modelo:', modelId);
    } catch (error) {
      console.error('❌ [PRELOAD] Error precargando datos:', error);
      setIframeError(true);
    } finally {
      setIframeLoading(false);
    }
  };

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
          role: (userRow?.role as any) || 'admin',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        setUser(current);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      if (!user) return;
      const response = await fetch(`/api/calculator/models?adminId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const list: Model[] = (data.data || []).map((m: any) => ({
          id: m.id,
          email: m.email,
          name: m.name,
          role: m.role,
          groups: (m.groups || []).map((g: any) => g?.name || g).filter(Boolean)
        }));
        // Filtrado por grupos para admin (solo ve sus grupos)
        const visibleForRole = (user.role === 'admin')
          ? list.filter((m: Model) => m.groups.some(g => user.groups.includes(g)))
          : list;
        setModels(visibleForRole);
        setFilteredModels(visibleForRole);
        // Opciones de grupos para super admin
        if (user.role === 'super_admin') {
          const unique = new Map<string, { id: string; name: string }>();
          for (const m of list) {
            for (const g of m.groups) {
              const key = String(g);
              if (!unique.has(key)) unique.set(key, { id: key, name: key });
            }
          }
          setGroupsOptions(Array.from(unique.values()));
        }
      }
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      loadModels();
    }
  }, [user]);

  // Aplicar filtro por grupo (solo super admin)
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'super_admin') {
      setFilteredModels(models);
      return;
    }
    if (!selectedGroup) {
      setFilteredModels(models);
      return;
    }
    setFilteredModels(models.filter(m => m.groups.includes(selectedGroup)));
  }, [user, models, selectedGroup]);

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

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
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
    <>
      <style jsx>{`
        .dropdown-container .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        .dropdown-container .overflow-y-auto::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .dropdown-container .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .dropdown-container .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Ver Calculadora de Modelo</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Selecciona una modelo para ver su calculadora
        </p>

        {/* Filtros y selector de modelo */}
        <div className="apple-card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Modelo</h2>
          <div className="space-y-4">
            {user.role === 'super_admin' && (
              <div className="dropdown-container relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por grupo
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                    disabled={modelsLoading}
                    className="w-full px-4 py-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-gray-700">
                      {selectedGroup || 'Todos los grupos'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isGroupDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isGroupDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-32 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGroup('');
                          setIsGroupDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors duration-150"
                      >
                        Todos los grupos
                      </button>
                      {groupsOptions.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setSelectedGroup(g.name);
                            setIsGroupDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors duration-150"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="dropdown-container relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  disabled={modelsLoading}
                  className="w-full px-4 py-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-gray-700">
                    {selectedModel ? `${selectedModel.name} (${selectedModel.email})` : 'Selecciona una modelo...'}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-32 overflow-y-auto">
                    {filteredModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model);
                          setIsModelDropdownOpen(false);
                          // Precargar datos de la calculadora
                          preloadCalculatorData(model.id);
                        }}
                        className="w-full px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors duration-150"
                      >
                        {model.name} ({model.email})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vista de calculadora de modelo */}
        {selectedModel && (
          <div className="apple-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Calculadora de {selectedModel.name}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Vista de administrador - Puedes editar los valores ingresados por la modelo
            </p>
            
            {/* Loading State */}
            {iframeLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando calculadora...</p>
                  <p className="text-sm text-gray-500 mt-2">Precargando datos para una experiencia más fluida</p>
                </div>
              </div>
            )}
            
            {/* Error State */}
            {iframeError && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-red-600 font-medium">Error al cargar la calculadora</p>
                  <p className="text-sm text-gray-500 mt-2">Intenta seleccionar la modelo nuevamente</p>
                  <button
                    onClick={() => preloadCalculatorData(selectedModel.id)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            )}
            
            {/* Iframe optimizado */}
            {!iframeLoading && !iframeError && (
              <iframe
                src={`/model/calculator?modelId=${selectedModel.id}&asAdmin=1&preload=${preloadData ? 'true' : 'false'}`}
                className="w-full rounded-lg border border-gray-200"
                style={{ minHeight: '900px' }}
                loading="eager"
                sandbox="allow-scripts allow-same-origin allow-forms"
                onLoad={() => {
                  console.log('✅ [IFRAME] Calculadora cargada exitosamente');
                  setIframeLoading(false);
                }}
                onError={() => {
                  console.error('❌ [IFRAME] Error cargando calculadora');
                  setIframeError(true);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
