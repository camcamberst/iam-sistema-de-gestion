"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ActiveRatesPanel from "../../../components/ActiveRatesPanel";
import ModelCalculator from "../../../components/ModelCalculator";

type Role = 'super_admin' | 'admin' | 'modelo' | string;

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: Role; groups: string[] } | null>(null);
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
          role: (userRow?.role as Role) || 'modelo',
          groups,
        };
        setUser(current);

        // Load global stats (super admin) or filtered stats (admin)
        const { data: all } = await supabase.from('users').select('id,role');
        if (all) {
          let filtered = all;
          if (current.role === 'admin' && current.groups.length) {
            // restrict to users within admin groups
            const { data: usersInMyGroups } = await supabase
              .from('user_groups')
              .select('user_id, groups(name)')
              .in('groups.name', current.groups);
            const allowedIds = new Set((usersInMyGroups || []).map((r: any) => r.user_id));
            filtered = all.filter((u: any) => allowedIds.has(u.id));
          }
          const total = filtered.length;
          const super_admin = filtered.filter((u: any) => u.role === 'super_admin').length;
          const admin = filtered.filter((u: any) => u.role === 'admin').length;
          const modelo = filtered.filter((u: any) => u.role === 'modelo').length;
          setStats({ total, super_admin, admin, modelo });
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Dashboard</h1>
        {user && (
          <p className="text-gray-500 mb-6 text-sm">
            Bienvenido, {user.name} · Rol: {String(user.role).replace('_',' ')}
            {user.role !== 'super_admin' && user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
          </p>
        )}

        {/* Tarjetas de conteo eliminadas por irrelevantes en el dashboard */}

        {/* Panel de Tasas Activas para Super Admin y Admin */}
        {(user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActiveRatesPanel compact={true} />
            <div className="apple-card">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Calculadora</h3>
              <p className="text-xs text-gray-500 mb-3">Gestiona las tasas de cambio para la calculadora</p>
              <Link 
                href="/admin/rates" 
                className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
              >
                Ver todas las tasas →
              </Link>
            </div>
          </div>
        )}

        {/* Quick actions según rol */}
        {user?.role === 'super_admin' && (
          <div className="apple-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Accesos rápidos</h2>
                <p className="text-sm text-gray-500">Tareas frecuentes del sistema</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/admin/users" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">Usuarios</Link>
                <Link href="/admin/groups" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">Grupos</Link>
                <Link href="/admin/users/create" className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">+ Nuevo Usuario</Link>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="apple-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Accesos rápidos</h2>
                <p className="text-sm text-gray-500">Gestión acotada a tus grupos</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/admin/users" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">Usuarios de mis grupos</Link>
                <Link href="/admin/users/create" className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">+ Crear usuario</Link>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'modelo' && (
          <div className="space-y-6">
            {/* Panel de perfil */}
            <div className="apple-card">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Mi perfil</h2>
              <p className="text-sm text-gray-500">Revisa tu información</p>
              <div className="mt-4 text-sm text-gray-700">Email: {user.email}</div>
              <div className="text-sm text-gray-700">Grupo: {user.groups[0] || '—'}</div>
            </div>

            {/* Calculadora para modelos */}
            <ModelCalculator />
          </div>
        )}
      </div>
    </div>
  );
}