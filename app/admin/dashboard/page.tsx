"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
  groups: Array<{
    id: string;
    name: string;
    is_manager: boolean;
  }>;
  is_active: boolean;
  last_login?: string;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      
      // Obtener datos del localStorage
      const userData = localStorage.getItem('user');
      if (!userData) {
        router.push('/login');
        return;
      }

      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
    } catch (err) {
      console.error('❌ Error cargando datos del usuario:', err);
      setError('Error cargando datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Limpiar localStorage
      localStorage.removeItem('user');
      
      // Redirigir a login
      router.push('/login');
    } catch (err) {
      console.error('❌ Error en logout:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
      }}>
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
      }}>
        <div className="text-red-400 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
    }}>
      {/* Header */}
      <header className="bg-aim-card border-b border-aim-border p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Administrativo</h1>
            <p className="text-gray-400">Sistema de Gestión AIM</p>
          </div>
          
          {/* User Info */}
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-white font-semibold">{user?.name}</div>
              <div className="text-gray-400 text-sm">{user?.email}</div>
              <div className="text-blue-400 text-sm capitalize">{user?.role}</div>
            </div>
            
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* User Info Card */}
          <div className="bg-aim-card border border-aim-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Información del Usuario</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-400">Nombre:</span>
                <span className="text-white ml-2">{user?.name}</span>
              </div>
              <div>
                <span className="text-gray-400">Email:</span>
                <span className="text-white ml-2">{user?.email}</span>
              </div>
              <div>
                <span className="text-gray-400">Rol:</span>
                <span className="text-blue-400 ml-2 capitalize">{user?.role}</span>
              </div>
              <div>
                <span className="text-gray-400">Estado:</span>
                <span className={`ml-2 ${user?.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  {user?.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {user?.last_login && (
                <div>
                  <span className="text-gray-400">Último login:</span>
                  <span className="text-white ml-2">
                    {new Date(user.last_login).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Groups Card */}
          <div className="bg-aim-card border border-aim-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Grupos Asignados</h2>
            {user?.groups && user.groups.length > 0 ? (
              <div className="space-y-2">
                {user.groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                    <span className="text-white">{group.name}</span>
                    {group.is_manager && (
                      <span className="bg-yellow-600 text-yellow-100 text-xs px-2 py-1 rounded">
                        Manager
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No hay grupos asignados</p>
            )}
          </div>

          {/* Quick Actions Card */}
          <div className="bg-aim-card border border-aim-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Acciones Rápidas</h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/admin/users')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Gestionar Usuarios
              </button>
              <button
                onClick={() => router.push('/admin/groups')}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Gestionar Grupos
              </button>
              <button
                onClick={() => router.push('/admin/reports')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
              >
                Reportes
              </button>
            </div>
          </div>

          {/* System Status Card */}
          <div className="bg-aim-card border border-aim-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Estado del Sistema</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Autenticación:</span>
                <span className="text-green-400">✅ Activa</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Base de Datos:</span>
                <span className="text-green-400">✅ Conectada</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">API:</span>
                <span className="text-green-400">✅ Funcionando</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Seguridad:</span>
                <span className="text-green-400">✅ RLS Activo</span>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-aim-card border border-aim-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Actividad Reciente</h2>
            <div className="space-y-3">
              <div className="text-gray-400 text-sm">
                Sistema modernizado exitosamente
              </div>
              <div className="text-gray-400 text-sm">
                Arquitectura de base de datos actualizada
              </div>
              <div className="text-gray-400 text-sm">
                Autenticación con Supabase implementada
              </div>
              <div className="text-gray-400 text-sm">
                Dashboard administrativo creado
              </div>
            </div>
          </div>

          {/* Statistics Card */}
          <div className="bg-aim-card border border-aim-border rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Estadísticas</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Usuarios Activos:</span>
                <span className="text-white">-</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Grupos:</span>
                <span className="text-white">{user?.groups?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sesión:</span>
                <span className="text-green-400">Activa</span>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}