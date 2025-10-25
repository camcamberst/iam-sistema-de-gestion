'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function UserRoleDebugPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        setLoading(true);
        
        // Obtener usuario autenticado
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        
        if (!uid) {
          setError('Usuario no autenticado');
          setLoading(false);
          return;
        }

        // Obtener perfil del usuario
        const { data: userRow, error: userError } = await supabase
          .from('users')
          .select('id, name, email, role, is_active')
          .eq('id', uid)
          .single();

        if (userError) {
          setError(`Error obteniendo perfil: ${userError.message}`);
          setLoading(false);
          return;
        }

        if (!userRow) {
          setError('Perfil de usuario no encontrado');
          setLoading(false);
          return;
        }

        setUserInfo({
          auth: {
            id: auth.user.id,
            email: auth.user.email,
            created_at: auth.user.created_at
          },
          profile: userRow,
          expectedRedirect: userRow.role === 'modelo' ? '/admin/model/dashboard' : '/admin/dashboard'
        });

      } catch (err) {
        setError(`Error general: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Verificando información del usuario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌ Error</div>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
          <button 
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Ir al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          🔍 Diagnóstico de Usuario
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Información de Autenticación
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ID de Usuario</label>
              <p className="text-gray-900 dark:text-white font-mono text-sm">{userInfo.auth.id}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p className="text-gray-900 dark:text-white">{userInfo.auth.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha de Creación</label>
              <p className="text-gray-900 dark:text-white text-sm">{new Date(userInfo.auth.created_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Perfil de Usuario
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
              <p className="text-gray-900 dark:text-white">{userInfo.profile.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email del Perfil</label>
              <p className="text-gray-900 dark:text-white">{userInfo.profile.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rol</label>
              <p className={`px-3 py-1 rounded-full text-sm font-medium ${
                userInfo.profile.role === 'modelo' 
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : userInfo.profile.role === 'admin'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              }`}>
                {userInfo.profile.role}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
              <p className={`px-3 py-1 rounded-full text-sm font-medium ${
                userInfo.profile.is_active 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {userInfo.profile.is_active ? 'Activo' : 'Inactivo'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Redirección Esperada
          </h2>
          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
            <p className="text-blue-900 dark:text-blue-100">
              <strong>URL de Redirección:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{userInfo.expectedRedirect}</code>
            </p>
            <p className="text-blue-700 dark:text-blue-300 mt-2">
              Basado en el rol <strong>{userInfo.profile.role}</strong>, el usuario debería ser redirigido a esta URL después del login.
            </p>
          </div>
        </div>

        <div className="flex space-x-4">
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Probar Login Nuevamente
          </button>
          <button 
            onClick={() => router.push(userInfo.expectedRedirect)}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            🎯 Ir a Dashboard Correcto
          </button>
        </div>
      </div>
    </div>
  );
}
