'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AppleDropdown from '@/components/ui/AppleDropdown';
import { Building2, History, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff';
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

interface GroupOption {
  id: string;
  name: string;
}

interface Model {
  id: string;
  email: string;
  name: string;
  groups: Array<{ id: string; name: string }>;
  hasConfig?: boolean;
  currentConfig?: any;
}

export default function HistorialModeloPage() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI filtros (como en la imagen)
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [nameFilter, setNameFilter] = useState<string>('');

  const [allModels, setAllModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  const router = useRouter();
  const hasNavigatedRef = useRef(false);

  // Inicializar usuario + cargar grupos + cargar modelos
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setError('No hay usuario autenticado');
          return;
        }

        // Cargar usuario (tabla negocio)
        const { data: userRow, error: userError } = await supabase
          .from('users')
          // `users.groups` NO existe en la BD; la relación se modela vía `user_groups`
          .select('id,email,name,role,organization_id,is_active,last_login')
          .eq('id', uid)
          .single();

        if (userError || !userRow) {
          setError(userError?.message || 'Usuario no encontrado');
          return;
        }

        setUser(userRow);

        // Token para /api/groups
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setError('No hay sesión válida');
          return;
        }

        // Grupos (ya aplican filtro de afiliado en el backend)
        const groupsRes = await fetch('/api/groups', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const groupsData = await groupsRes.json();

        if (groupsData?.success && Array.isArray(groupsData.groups)) {
          setAvailableGroups(groupsData.groups.map((g: any) => ({ id: g.id, name: g.name })));
        } else {
          setAvailableGroups([]);
        }

        // Modelos (backend filtra por admin/afiliado con adminId)
        const modelsRes = await fetch(`/api/calculator/models?adminId=${uid}`);
        const modelsData = await modelsRes.json();
        if (modelsData?.success) {
          setAllModels(modelsData.models || []);
        } else {
          setAllModels([]);
        }
      } catch (e: any) {
        setError(e?.message || 'Error inicializando');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Cuando el usuario elige un modelo, navegamos a la pantalla real del historial
  // (sin iframe) para que el scroll sea el del navegador.
  useEffect(() => {
    if (selectedModelId && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      router.push(
        `/admin/model/calculator/historial?modelId=${selectedModelId}&from=historial-modelo`
      );
    }

    // Si el usuario vuelve a seleccionar/vacía, permitimos otra navegación.
    if (!selectedModelId) {
      hasNavigatedRef.current = false;
    }
  }, [selectedModelId, router]);

  const filteredModels = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return (allModels || []).filter((m) => {
      const groupOk =
        selectedGroup === 'all' || (m.groups || []).some((g) => g.id === selectedGroup);
      const nameOk = !q || (m.email || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
      return groupOk && nameOk;
    });
  }, [allModels, nameFilter, selectedGroup]);

  const selectedModel = useMemo(() => {
    return filteredModels.find((m) => m.id === selectedModelId) || null;
  }, [filteredModels, selectedModelId]);

  // Si los filtros cambian y el modelo seleccionado deja de estar en el filtro, limpiar selección.
  useEffect(() => {
    if (!selectedModelId) return;
    const stillVisible = filteredModels.some((m) => m.id === selectedModelId);
    if (!stillVisible) setSelectedModelId('');
  }, [filteredModels, selectedModelId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
          <div className="mb-6 bg-red-50/80 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg shadow-sm">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (selectedModelId) {
    // UI mínima mientras se navega.
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span>Abriendo historial...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl" />
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <History className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Ver Historial Modelo
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      Filtra por grupo y consulta el historial de facturación de una modelo
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel izquierdo: filtros */}
          <div className="lg:col-span-1">
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 space-y-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 z-[99999]">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  Filtrar por Grupo
                </h2>
                <AppleDropdown
                  options={[
                    { value: 'all', label: 'Todos los grupos' },
                    ...availableGroups.map((g) => ({ value: g.id, label: g.name }))
                  ]}
                  value={selectedGroup}
                  onChange={setSelectedGroup}
                  placeholder="Todos los grupos"
                  className="text-sm"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  Buscar por Nombre
                </h2>
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Buscar modelo..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500 focus:shadow-lg focus:shadow-blue-100 pr-10 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-500" />
                  Seleccionar Modelo
                </h2>
                <AppleDropdown
                  options={[
                    { value: '', label: filteredModels.length === 0 ? 'No hay modelos disponibles' : 'Selecciona un modelo' },
                    ...filteredModels.map((m) => ({
                      value: m.id,
                      label: m.email.split('@')[0],
                      badge: m.hasConfig ? 'Configurada' : 'Sin configurar',
                      badgeColor: (m.hasConfig ? 'green' : 'gray') as 'green' | 'gray'
                    }))
                  ]}
                  value={selectedModelId}
                  onChange={setSelectedModelId}
                  placeholder="Selecciona un modelo"
                  className="text-sm"
                  autoOpen={nameFilter.length > 0 && filteredModels.length > 0}
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-600/80 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Mostrando {filteredModels.length} de {allModels.length} modelos
                </p>
                {selectedGroup !== 'all' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Filtrado por: {availableGroups.find((g) => g.id === selectedGroup)?.name}
                  </p>
                )}
                {nameFilter.trim() && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Búsqueda: {`"${nameFilter.trim()}"`}
                  </p>
                )}
                {selectedModel && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {selectedModel.email} (historial)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Panel derecho: historial (se delega a la ruta existente por iframe) */}
          <div className="lg:col-span-2">
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              {!selectedModelId ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4 text-4xl">📄</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Selecciona un modelo
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Usa los filtros de la izquierda para elegir una modelo y ver su historial.
                  </p>
                </div>
              ) : (
                <iframe
                  key={selectedModelId}
                  src={`/admin/model/calculator/historial?modelId=${selectedModelId}`}
                  className="w-full h-[75vh] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

