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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por grupo
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="apple-input w-full"
                  disabled={modelsLoading}
                >
                  <option value="">Todos los grupos</option>
                  {groupsOptions.map((g) => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo
              </label>
              <select
                value={selectedModel?.id || ''}
                onChange={(e) => {
                  const model = filteredModels.find(m => m.id === e.target.value);
                  setSelectedModel(model || null);
                }}
                className="apple-input w-full"
                disabled={modelsLoading}
              >
                <option value="">Selecciona una modelo...</option>
                {filteredModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.email})
                  </option>
                ))}
              </select>
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
            <iframe
              src={`/model/calculator?modelId=${selectedModel.id}&asAdmin=1`}
              className="w-full rounded-lg border border-gray-200"
              style={{ minHeight: '900px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
