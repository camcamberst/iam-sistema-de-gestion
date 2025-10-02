'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";
import { getCalculatorDate } from '@/utils/calculator-dates';

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
  const [groupsOptions, setGroupsOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  
  // Estados para dropdowns personalizados
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
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
                          // Redirect to dedicated calculator view page
                          router.push(`/admin/calculator/view/${model.id}`);
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

        {/* Instrucciones */}
        <div className="apple-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Ver Calculadora de Modelo
          </h2>
          <p className="text-gray-600 mb-4">
            Selecciona una modelo del dropdown para ver y editar su calculadora.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-blue-900">Nueva implementación</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Ahora la calculadora se abre en una página dedicada sin iframe, 
                  lo que mejora la estabilidad y el rendimiento.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
