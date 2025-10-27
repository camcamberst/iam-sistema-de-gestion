'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

interface UserInfo {
  id: string;
  role: string;
  groups: string[];
  totalUsers: number;
  filteredUsers: number;
}

export default function UsersHierarchyDebugPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const debugUsersHierarchy = async () => {
      try {
        console.log('🔍 [DEBUG-USERS] Iniciando diagnóstico de jerarquía de usuarios...');
        
        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Usuario no autenticado');
          return;
        }

        console.log('🔍 [DEBUG-USERS] Usuario autenticado:', user.id);

        // Obtener datos del usuario actual
        const { data: currentUserData, error: userError } = await supabase
          .from('users')
          .select(`
            role,
            user_groups(
              groups!inner(
                id,
                name
              )
            )
          `)
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('❌ [DEBUG-USERS] Error obteniendo datos del usuario:', userError);
          setError('Error obteniendo datos del usuario: ' + userError.message);
          return;
        }

        if (!currentUserData) {
          setError('Error obteniendo datos del usuario');
          return;
        }

        const userGroups = currentUserData.user_groups?.map((ug: any) => ug.groups.id) || [];
        
        console.log('🔍 [DEBUG-USERS] Datos del usuario actual:', {
          id: user.id,
          role: currentUserData.role,
          groups: userGroups
        });

        // Obtener todos los usuarios
        const { data: allUsers, error: usersError } = await supabase
          .from('users')
          .select(`
            id,
            name,
            email,
            role,
            is_active,
            user_groups(
              groups!inner(
                id,
                name
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (usersError) {
          console.error('❌ [DEBUG-USERS] Error obteniendo usuarios:', usersError);
          setError('Error obteniendo usuarios: ' + usersError.message);
          return;
        }

        console.log('🔍 [DEBUG-USERS] Usuarios obtenidos de Supabase:', allUsers?.length || 0);

        // Aplicar filtros de jerarquía
        let filteredUsers = allUsers || [];
        
        if (currentUserData.role === 'admin') {
          console.log('🔍 [DEBUG-USERS] Aplicando filtro de jerarquía para admin:', {
            userGroupIds: userGroups,
            totalUsers: filteredUsers.length
          });
          
          filteredUsers = (allUsers || []).filter((user: any) => {
            // Super admin no puede ser visto por admin
            if (user.role === 'super_admin') return false;
            
            // Admin puede ver otros admins y modelos
            if (user.role === 'admin' || user.role === 'modelo') {
              // Si el usuario tiene grupos, debe tener al menos uno en común
              if (user.user_groups && user.user_groups.length > 0) {
                const targetUserGroupIds = user.user_groups.map((ug: any) => ug.groups.id);
                const hasCommonGroup = targetUserGroupIds.some((groupId: string) => userGroups.includes(groupId));
                
                console.log('🔍 [DEBUG-USERS] Usuario:', user.name, {
                  role: user.role,
                  targetGroups: targetUserGroupIds,
                  hasCommonGroup,
                  willShow: hasCommonGroup
                });
                
                return hasCommonGroup;
              }
              return false;
            }
            
            return false;
          });
          
          console.log('🔍 [DEBUG-USERS] Usuarios después del filtro:', filteredUsers.length);
        } else if (currentUserData.role === 'super_admin') {
          console.log('🔍 [DEBUG-USERS] Super admin - mostrando todos los usuarios');
        }

        setUserInfo({
          id: user.id,
          role: currentUserData.role,
          groups: userGroups,
          totalUsers: allUsers?.length || 0,
          filteredUsers: filteredUsers.length
        });

      } catch (err) {
        console.error('❌ [DEBUG-USERS] Error general:', err);
        setError('Error general: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    debugUsersHierarchy();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Diagnosticando jerarquía de usuarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            🔍 Diagnóstico de Jerarquía de Usuarios
          </h1>
          
          {userInfo && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  Información del Usuario Actual
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">ID:</p>
                    <p className="font-mono text-sm text-gray-900 dark:text-white">{userInfo.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Rol:</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{userInfo.role}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Grupos Asignados:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {userInfo.groups.length > 0 ? (
                        userInfo.groups.map((groupId, index) => (
                          <span key={index} className="bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                            {groupId}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400 italic">Sin grupos asignados</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
                  Resultados del Filtrado
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total de Usuarios:</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{userInfo.totalUsers}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Usuarios Visibles:</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{userInfo.filteredUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
                  Análisis
                </h2>
                <div className="space-y-2">
                  {userInfo.role === 'admin' && userInfo.groups.length === 0 && (
                    <p className="text-yellow-800 dark:text-yellow-200">
                      ⚠️ <strong>Problema detectado:</strong> El usuario admin no tiene grupos asignados. 
                      Esto causará que vea todos los usuarios sin filtro de jerarquía.
                    </p>
                  )}
                  {userInfo.role === 'admin' && userInfo.groups.length > 0 && userInfo.filteredUsers === userInfo.totalUsers && (
                    <p className="text-yellow-800 dark:text-yellow-200">
                      ⚠️ <strong>Posible problema:</strong> El filtro de jerarquía no está funcionando correctamente. 
                      Se están mostrando todos los usuarios.
                    </p>
                  )}
                  {userInfo.role === 'admin' && userInfo.groups.length > 0 && userInfo.filteredUsers < userInfo.totalUsers && (
                    <p className="text-green-800 dark:text-green-200">
                      ✅ <strong>Funcionando correctamente:</strong> El filtro de jerarquía está aplicándose. 
                      Solo se muestran los usuarios de los grupos asignados.
                    </p>
                  )}
                  {userInfo.role === 'super_admin' && (
                    <p className="text-blue-800 dark:text-blue-200">
                      ℹ️ <strong>Super Admin:</strong> Puede ver todos los usuarios sin restricciones.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Instrucciones
                </h2>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <p>1. Revisa la consola del navegador para ver los logs detallados</p>
                  <p>2. Si hay problemas, verifica que el usuario tenga grupos asignados</p>
                  <p>3. Compara estos resultados con lo que ves en "Consultar Usuarios"</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
