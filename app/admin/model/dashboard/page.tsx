'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ModelCalculatorNew from '../../../../components/ModelCalculatorNew';
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

export default function ModelDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Mi Dashboard</h1>
        {user && (
          <p className="text-gray-500 mb-6 text-sm">
            Bienvenida, {user.name} · Rol: {String(user.role).replace('_',' ')}
            {user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
          </p>
        )}

        {/* Panel de perfil */}
        <div className="apple-card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Mi perfil</h2>
          <p className="text-sm text-gray-500">Revisa tu información</p>
          <div className="mt-4 text-sm text-gray-700">Email: {user.email}</div>
          <div className="text-sm text-gray-700">Grupo: {user.groups[0] || '—'}</div>
        </div>

        {/* Resumen de productividad y progreso de meta */}
        <div className="apple-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Productividad</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-md bg-blue-50 text-center">
              <div className="text-xs text-gray-600">USD Bruto (hoy)</div>
              <div className="text-2xl font-bold text-blue-600">—</div>
            </div>
            <div className="p-4 rounded-md bg-green-50 text-center">
              <div className="text-xs text-gray-600">USD Modelo (hoy)</div>
              <div className="text-2xl font-bold text-green-600">—</div>
            </div>
            <div className="p-4 rounded-md bg-purple-50 text-center">
              <div className="text-xs text-gray-600">COP Modelo (hoy)</div>
              <div className="text-2xl font-bold text-purple-600">—</div>
            </div>
          </div>

          {/* Barra de alcance de meta (compacta) */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Alcance de meta diaria</span>
              <span className="text-sm text-gray-600">— / — USD</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: '0%' }}></div>
            </div>
            <div className="text-right text-xs text-gray-600 mt-1">0%</div>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            Para actualizar tus valores usa el menú <a href="/model/calculator" className="text-blue-600 hover:text-blue-800 underline">Mi Calculadora</a>.
          </div>
        </div>
      </div>
    </div>
  );
}