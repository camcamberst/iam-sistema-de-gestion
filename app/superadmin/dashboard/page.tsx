'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ActiveRatesPanel from '../../../../components/ActiveRatesPanel';

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

interface Stats {
  total: number;
  super_admin: number;
  admin: number;
  modelo: number;
}

export default function SuperAdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, super_admin: 0, admin: 0, modelo: 0 });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (!userData) {
          router.push('/login');
          return;
        }

        const parsedUser = JSON.parse(userData);
        
        // Verificar que sea super_admin
        if (parsedUser.role !== 'super_admin') {
          router.push('/login');
          return;
        }

        setUser(parsedUser);
        await loadStats();
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        const users = data.data;
        const stats = {
          total: users.length,
          super_admin: users.filter((u: any) => u.role === 'super_admin').length,
          admin: users.filter((u: any) => u.role === 'admin').length,
          modelo: users.filter((u: any) => u.role === 'modelo').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

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
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Super Admin Dashboard</h1>
        {user && (
          <p className="text-gray-500 mb-6 text-sm">
            Bienvenido, {user.name} · Rol: {String(user.role).replace('_',' ')}
            {user.groups.length > 0 && ` · Grupos: ${user.groups.join(', ')}`}
          </p>
        )}

        {/* Cards por rol */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="apple-card">
            <div className="text-sm text-gray-500">Usuarios</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{stats.total}</div>
          </div>
          <div className="apple-card">
            <div className="text-sm text-gray-500">Super Admin</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{stats.super_admin}</div>
          </div>
          <div className="apple-card">
            <div className="text-sm text-gray-500">Admin</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{stats.admin}</div>
          </div>
          <div className="apple-card">
            <div className="text-sm text-gray-500">Modelos</div>
            <div className="text-2xl font-semibold text-gray-900 mt-2">{stats.modelo}</div>
          </div>
        </div>

        {/* Panel de Tasas Activas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

        {/* Accesos rápidos */}
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
      </div>
    </div>
  );
}
