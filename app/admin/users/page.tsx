"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUsers, getGroups, createUser, updateUser, deleteUser } from '../../../lib/api-client';
import { 
  canAssignRole, 
  canAssignGroups, 
  validateGroupRestrictions, 
  canEditUser, 
  canDeleteUser,
  getAvailableGroups,
  getDefaultGroups,
  type CurrentUser 
} from '../../../lib/hierarchy';
import { supabase } from '../../../lib/supabase';
import AppleSearchBar from '../../../components/AppleSearchBar';
import AppleDropdown from '@/components/ui/AppleDropdown';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'modelo';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  groups: Array<{
    id: string;
    name: string;
  }>;
}

interface Group {
  id: string;
  name: string;
  description: string;
}

export default function UsersListPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);



  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar usuario actual primero
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuario no autenticado');
        return;
      }

      // Obtener datos del usuario actual
      try {
        const { data: currentUserData, error } = await supabase
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

        if (error) {
          console.error('Error obteniendo datos del usuario:', error);
          setError('Error obteniendo datos del usuario: ' + error.message);
          return;
        }

        if (!currentUserData) {
          setError('Error obteniendo datos del usuario');
          return;
        }

        const userGroups = currentUserData.user_groups?.map((ug: any) => ug.groups.id) || [];
        setCurrentUser({
          id: user.id,
          role: currentUserData.role,
          groups: userGroups
        });
      } catch (err) {
        console.error('Error en consulta de usuario:', err);
        setError('Error obteniendo datos del usuario');
        return;
      }
      
      // Cargar usuarios y grupos
      const [usersData, groupsData] = await Promise.all([
        getUsers(),
        getGroups()
      ]);

      if (usersData.success) {
        // Aplicar filtros de jerarquía
        let filteredUsers = usersData.users;
        
        if (currentUser?.role === 'admin') {
          // Admin solo puede ver usuarios de sus grupos
          const userGroups = currentUser.groups || [];
          // Normalizar userGroups a array de strings (IDs)
          const userGroupIds = Array.isArray(userGroups) 
            ? userGroups.map((g: any) => typeof g === 'string' ? g : g.id)
            : [];
          
          filteredUsers = usersData.users.filter((user: any) => {
            // Super admin puede ver todos
            if (user.role === 'super_admin') return false;
            
            // Admin puede ver otros admins y modelos
            if (user.role === 'admin' || user.role === 'modelo') {
              // Si el usuario tiene grupos, debe tener al menos uno en común
              if (user.groups && user.groups.length > 0) {
                // user.groups puede ser array de strings (IDs) o array de objetos
                const targetUserGroupIds = Array.isArray(user.groups) 
                  ? user.groups.map((g: any) => typeof g === 'string' ? g : g.id)
                  : [];
                return targetUserGroupIds.some((groupId: string) => userGroupIds.includes(groupId));
              }
              return false;
            }
            
            return false;
          });
        }
        
        setUsers(filteredUsers);
        setFilteredUsers([]); // Inicialmente vacío, solo mostrar con filtros
      } else {
        setError('Error cargando usuarios: ' + usersData.error);
      }

      if (groupsData.success) {
        setGroups(groupsData.groups);
      }

    } catch (err) {
      console.error('❌ Error cargando datos:', err);
      setError('Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // 🔍 SEARCH AND FILTER FUNCTIONS
  // ===========================================
  const handleSearch = (query: string, filters: Record<string, string>) => {
    setSearchQuery(query);
    setSearchFilters(filters);
    
    // Solo mostrar resultados si hay al menos un filtro activo
    const hasActiveFilters = query.trim() || filters.role || filters.group || filters.status;
    
    if (!hasActiveFilters) {
      setFilteredUsers([]);
      return;
    }
    
    let filtered = users;

    // Aplicar filtros de jerarquía primero (si es admin)
    if (currentUser?.role === 'admin') {
      const userGroupIds = Array.isArray(currentUser.groups) 
        ? currentUser.groups.map((g: any) => typeof g === 'string' ? g : g.id)
        : [];
      
      filtered = filtered.filter((user: any) => {
        // Super admin no puede ser visto por admin
        if (user.role === 'super_admin') return false;
        
        // Admin puede ver otros admins y modelos
        if (user.role === 'admin' || user.role === 'modelo') {
          // Si el usuario tiene grupos, debe tener al menos uno en común
          if (user.groups && user.groups.length > 0) {
            const targetUserGroupIds = Array.isArray(user.groups) 
              ? user.groups.map((g: any) => typeof g === 'string' ? g : g.id)
              : [];
            return targetUserGroupIds.some((groupId: string) => userGroupIds.includes(groupId));
          }
          return false;
        }
        
        return false;
      });
    }

    // Text search
    if (query.trim()) {
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(query.toLowerCase()) ||
        user.email.toLowerCase().includes(query.toLowerCase())
      );
    }

    // Role filter
    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    // Group filter
    if (filters.group) {
      filtered = filtered.filter(user => 
        user.groups.some(group => group.id === filters.group)
      );
    }

    // Status filter
    if (filters.status) {
      const isActive = filters.status === 'active';
      filtered = filtered.filter(user => user.is_active === isActive);
    }

    setFilteredUsers(filtered);
  };

  // Manejar cambios en el estado de dropdowns
  const handleDropdownStateChange = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen);
  };

  // Search filters configuration
  const searchFiltersConfig = [
    {
      id: 'role',
      label: 'Rol',
      value: searchFilters.role || '',
      options: (() => {
        const allRoles = [
          { label: 'Super Admin', value: 'super_admin' },
          { label: 'Admin', value: 'admin' },
          { label: 'Modelo', value: 'modelo' }
        ];
        
        // Aplicar límites de jerarquía
        if (currentUser?.role === 'admin') {
          // Admin solo puede filtrar por 'admin' y 'modelo'
          return allRoles.filter(role => role.value !== 'super_admin');
        }
        
        // Super admin puede filtrar por todos los roles
        return allRoles;
      })()
    },
    {
      id: 'group',
      label: 'Grupo',
      value: searchFilters.group || '',
      options: (() => {
        // Aplicar límites de jerarquía para grupos
        if (currentUser?.role === 'admin') {
          const userGroupIds = Array.isArray(currentUser.groups) 
            ? currentUser.groups.map((g: any) => typeof g === 'string' ? g : g.id)
            : [];
          
          return groups
            .filter(group => userGroupIds.includes(group.id))
            .map(group => ({
              label: group.name,
              value: group.id
            }));
        }
        
        // Super admin puede filtrar por todos los grupos
        return groups.map(group => ({
          label: group.name,
          value: group.id
        }));
      })()
    },
    {
      id: 'status',
      label: 'Estado',
      value: searchFilters.status || '',
      options: [
        { label: 'Activo', value: 'active' },
        { label: 'Inactivo', value: 'inactive' }
      ]
    }
  ];


  const handleEditUser = async (user: User) => {
    // Validar que el usuario existe
    if (!user || !user.id) {
      console.error('❌ [FRONTEND] Usuario inválido:', user);
      setError('Usuario inválido');
      return;
    }
    
    // Verificar permisos de jerarquía
    if (!currentUser || !canEditUser(currentUser, user)) {
      setError('No tienes permisos para editar este usuario');
      return;
    }
    
    console.log('🔍 [FRONTEND] Abriendo modal para usuario:', user);
    
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    // Encontrar el usuario a eliminar
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) {
      setError('Usuario no encontrado');
      return;
    }

    // Verificar permisos de jerarquía
    if (!currentUser || !canDeleteUser(currentUser, userToDelete)) {
      setError('No tienes permisos para eliminar este usuario');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    try {
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        // Actualizar solo la lista local sin perder filtros
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
        setFilteredUsers(prevFiltered => prevFiltered.filter(u => u.id !== userId));
        console.log('✅ [FRONTEND] Usuario eliminado de la lista local');
      } else {
        setError('Error eliminando usuario: ' + result.error);
      }
    } catch (err) {
      console.error('❌ Error eliminando usuario:', err);
      setError('Error eliminando usuario');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-600 text-red-100';
      case 'admin':
        return 'bg-blue-600 text-blue-100';
      case 'modelo':
        return 'bg-green-600 text-green-100';
      case 'chatter':
        return 'bg-purple-600 text-purple-100';
      default:
        return 'bg-gray-600 text-gray-100';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'text-green-400' : 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-700/20 shadow-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Gestión de Usuarios
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Administra usuarios del sistema</p>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/admin/users/create')}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  <span className="text-sm">+</span>
                  <span className="text-xs font-medium">Nuevo Usuario</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-16 relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 z-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Búsqueda y Filtros</span>
            </div>
            {filteredUsers.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>{filteredUsers.length} resultado(s) encontrado(s)</span>
              </div>
            )}
          </div>
          <AppleSearchBar
            onSearch={handleSearch}
            placeholder="Buscar por nombre, email o ID de usuario..."
            filters={searchFiltersConfig}
            onDropdownStateChange={handleDropdownStateChange}
          />
          {(searchQuery || Object.values(searchFilters).some(v => v)) && (
            <div className="mt-4 p-3 bg-blue-50/80 backdrop-blur-sm rounded-lg border border-blue-200/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-700">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {filteredUsers.length === 0 
                      ? 'No se encontraron usuarios con los criterios especificados'
                      : `Mostrando ${filteredUsers.length} de ${users.length} usuarios`
                    }
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchFilters({});
                    setFilteredUsers([]);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors duration-150"
                >
                  Limpiar búsqueda
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 relative bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 px-4 py-3 rounded-xl shadow-md">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded-sm flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className={`relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl shadow-md transition-all duration-300 apple-scroll overflow-x-auto overflow-y-auto max-h-[70vh] p-0 z-10 ${isDropdownOpen ? 'opacity-30 blur-sm pointer-events-none' : 'opacity-100 blur-none pointer-events-auto'}`}>
          <div className="pt-6 px-6 pb-0">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Usuarios del Sistema ({users.length})
              </h2>
            </div>
            
            {users.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="text-gray-400 text-base font-medium">No hay usuarios registrados</div>
                <button
                  onClick={() => router.push('/admin/users/create')}
                  className="mt-4 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
                >
                  Crear Primer Usuario
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-base font-medium">No hay resultados</div>
                <div className="text-gray-500 text-xs mt-2">
                  {searchQuery.trim() || Object.values(searchFilters).some(f => f) 
                    ? 'Intenta ajustar los filtros de búsqueda' 
                    : 'Usa los filtros de búsqueda para encontrar usuarios'
                  }
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs table-fixed">
                  <thead className="border-b border-white/20 bg-gradient-to-r from-gray-50/80 to-blue-50/60 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-4 w-[28%] text-gray-700 dark:text-gray-200 font-medium text-sm uppercase tracking-wide text-center">
                        Usuario
                      </th>
                      <th className="px-4 py-4 w-[28%] text-gray-700 dark:text-gray-200 font-medium text-sm uppercase tracking-wide text-center">
                        Email
                      </th>
                      <th className="px-4 py-4 w-[10%] text-gray-700 font-medium text-sm uppercase tracking-wide text-center">
                        Rol
                      </th>
                      <th className="px-4 py-4 w-[20%] text-gray-700 font-medium text-sm uppercase tracking-wide text-center">
                        Grupos
                      </th>
                      <th className="px-4 py-4 w-[8%] text-gray-700 font-medium text-sm uppercase tracking-wide text-center">
                        Estado
                      </th>
                      <th className="px-4 py-4 w-[6%] text-gray-700 font-medium text-sm uppercase tracking-wide text-center">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-white/20">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-white/10 hover:bg-white/60 hover:shadow-sm transition-all duration-200 h-12 group">
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm border border-white/20">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-gray-900 dark:text-gray-100 font-medium text-xs truncate" title={user.name}>{user.name}</div>
                              <div className="text-gray-400 dark:text-gray-500 text-xs truncate" title={`ID: ${user.id}`}>ID: {user.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-800 truncate max-w-[220px] text-xs text-center" title={user.email}>{user.email}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border shadow-sm backdrop-blur-sm ${
                            user.role === 'super_admin'
                              ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white border-gray-600/30'
                              : user.role === 'admin'
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200/50'
                                : 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200/50'
                          }`}>
                            {user.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {user.groups.length > 0 ? (
                            <div className="flex items-center justify-center gap-1 overflow-hidden">
                              {user.groups.slice(0,2).map((group) => (
                                <span key={group.id} className="bg-gradient-to-r from-gray-50 to-slate-50 text-gray-700 px-2 py-1 rounded-md text-xs whitespace-nowrap border border-gray-200/30 shadow-sm backdrop-blur-sm">
                                  {group.name}
                                </span>
                              ))}
                              {user.groups.length > 2 && (
                                <span
                                  className="text-gray-500 text-xs whitespace-nowrap cursor-help"
                                  title={user.groups.map(g=>g.name).join(', ')}
                                >
                                  +{user.groups.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Sin grupos</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-sm backdrop-blur-sm ${user.is_active ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200/50' : 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-600 border-gray-200/50'}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                         <td className="px-4 py-2 text-center">
                           <div className="flex justify-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="px-2.5 py-1.5 text-xs rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/30 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="px-2.5 py-1.5 text-xs rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/30 text-red-700 hover:from-red-100 hover:to-rose-100 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>


        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <EditUserModal
            user={selectedUser}
            groups={groups}
            currentUser={currentUser}
            modalError={modalError}
            setModalError={setModalError}
            onClose={() => {
              setShowEditModal(false);
              setSelectedUser(null);
              setModalError(null); // Limpiar error del modal al cerrar
            }}
            onSubmit={async (userData) => {
              try {
                console.log('🔍 [PARENT] Recibiendo datos del formulario:', userData);
                const response = await fetch('/api/users', {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(userData),
                });

                const result = await response.json();
                console.log('🔍 [PARENT] Respuesta de la API:', result);
                
                if (result.success) {
                  console.log('✅ [PARENT] Usuario actualizado exitosamente');
                  setShowEditModal(false);
                  setSelectedUser(null);
                  setModalError(null); // Limpiar error del modal al actualizar exitosamente
                  
                  // Actualizar solo el usuario específico en la lista local sin perder filtros
                  setUsers(prevUsers => 
                    prevUsers.map(u => u.id === userData.id ? { ...u, ...result.user } : u)
                  );
                  setFilteredUsers(prevFiltered => 
                    prevFiltered.map(u => u.id === userData.id ? { ...u, ...result.user } : u)
                  );
                  console.log('✅ [FRONTEND] Usuario actualizado en la lista local');
                } else {
                  console.error('❌ [PARENT] Error de la API:', result.error);
                  // Usar el estado de error del modal en lugar del estado de la página principal
                  setModalError('Error actualizando usuario: ' + result.error);
                }
              } catch (err) {
                console.error('❌ [PARENT] Error en la petición:', err);
                setModalError('Error actualizando usuario');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// Componente para crear usuario
function EditUserModal({ user, groups, onClose, onSubmit, currentUser, modalError, setModalError }: {
  user: User;
  groups: Group[];
  onClose: () => void;
  onSubmit: (userData: any) => void;
  currentUser: CurrentUser | null;
  modalError: string | null;
  setModalError: (error: string | null) => void;
}) {
  const [formData, setFormData] = useState({
    id: user?.id || '', // ✅ AGREGAR ID DEL USUARIO con validación
    name: user?.name || '',
    email: user?.email || '',
    password: '', // Nueva contraseña (opcional)
    role: user?.role || 'modelo',
    is_active: user?.is_active ?? true,
    group_ids: user?.groups?.map(g => g.id) || []
  });

  const [showPassword, setShowPassword] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState('');
  const [isPasswordChanged, setIsPasswordChanged] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Obtener el nombre del grupo seleccionado
  const selectedGroupName = groups.find(g => g.id === formData.group_ids[0])?.name || '';

  // 🔧 ACTUALIZAR FORMULARIO CUANDO CAMBIE EL USUARIO
  useEffect(() => {
    if (!user) return; // Validar que user existe
    
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
      group_ids: user.groups?.map(g => g.id) || []
    });
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Excluir la contraseña del formulario principal para evitar conflictos
    const { password, ...formDataWithoutPassword } = formData;
    onSubmit(formDataWithoutPassword);
  };

  // Función para manejar cambio de contraseña
  const handlePasswordChange = (value: string) => {
    setFormData(prev => ({ ...prev, password: value }));
    setIsPasswordChanged(value.trim().length > 0);
  };

  // Función para guardar solo la contraseña
  const handleSavePassword = async () => {
    if (!formData.password.trim()) {
      setModalError('La contraseña no puede estar vacía');
      return;
    }

    if (formData.password.trim().length < 6) {
      setModalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setSavingPassword(true);
    setModalError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: formData.id,
          password: formData.password.trim()
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setModalError(null);
        setIsPasswordChanged(false);
        setFormData(prev => ({ ...prev, password: '' }));
        // Mostrar mensaje de éxito temporal
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Contraseña actualizada exitosamente';
        successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
        document.body.appendChild(successMsg);
        setTimeout(() => {
          document.body.removeChild(successMsg);
        }, 3000);
      } else {
        setModalError(result.error || 'Error actualizando contraseña');
      }
    } catch (error) {
      console.error('Error actualizando contraseña:', error);
      setModalError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setSavingPassword(false);
    }
  };


  // Mostrar mensajes de restricción según rol
  const handleRoleChange = (role: string) => {
    setFormData(prev => ({ ...prev, role: role as 'super_admin' | 'admin' | 'modelo' }));
    
    if (role === 'modelo') {
      setRestrictionMessage('💡 Los modelos solo pueden estar en un grupo a la vez');
    } else if (role === 'admin') {
      setRestrictionMessage('💡 Los administradores deben tener al menos un grupo asignado');
    } else if (role === 'super_admin') {
      setRestrictionMessage('💡 Los super administradores tienen acceso a todos los grupos');
    }
  };

  // Manejar cambio de grupo
  const handleGroupChange = (value: string) => {
    setFormData(prev => ({ 
      ...prev, 
      group_ids: value ? [value] : []
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-full max-w-md max-h-[95vh] flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Editar Usuario</h2>

        {/* Mensaje de error del modal */}
        {modalError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{modalError}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2">
          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">
              Nueva Contraseña 
              <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">(opcional - dejar vacío para mantener actual)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Ingresa nueva contraseña"
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-12 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {formData.password && formData.password.length < 6 && (
              <p className="text-red-500 text-xs mt-1">La contraseña debe tener al menos 6 caracteres</p>
            )}
            
            {/* Botón para guardar solo la contraseña */}
            {isPasswordChanged && formData.password.trim().length >= 6 && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                >
                  {savingPassword ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Contraseña
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Rol</label>
            <AppleDropdown
              options={[
                { value: 'modelo', label: 'Modelo' },
                { value: 'admin', label: 'Admin' },
                { value: 'super_admin', label: 'Super Admin' }
              ]}
              value={formData.role}
              onChange={(value) => setFormData({ ...formData, role: value as 'super_admin' | 'admin' | 'modelo' })}
              placeholder="Selecciona un rol"
            />
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Usuario Activo</label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className="relative w-10 h-6 rounded-full transition-colors"
              style={{ background: formData.is_active ? '#111827' : '#e5e7eb' }}
              aria-pressed={formData.is_active}
            >
              <span
                className="absolute top-[3px] rounded-full bg-white shadow"
                style={{ left: formData.is_active ? 20 : 3, width: 18, height: 18 }}
              />
            </button>
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Grupos</label>
            <AppleDropdown
              options={groups.map(group => ({
                value: group.id,
                label: group.name
              }))}
              value={formData.group_ids.length > 0 ? formData.group_ids[0] : ''}
              onChange={handleGroupChange}
              placeholder={formData.role === 'modelo' ? 'Selecciona un grupo' : 'Selecciona un grupo'}
            />
            {restrictionMessage && (
              <div className="mt-3 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                {restrictionMessage}
              </div>
            )}
          </div>


          <div className="flex space-x-3 pt-10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-md text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md text-sm font-medium transition-colors"
            >
              Actualizar Usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
