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

        {/* Calculadora para modelos */}
        <ModelCalculatorNew />
      </div>
    </div>
  );
}