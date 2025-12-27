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
import StandardModal from '@/components/ui/StandardModal';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia';
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

        const userGroups = currentUserData.user_groups?.map((ug: any) => ug.groups) || [];
        console.log('🔍 [USUARIOS] Datos del usuario actual:', {
          id: user.id,
          role: currentUserData.role,
          groups: userGroups
        });
        
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
        
        console.log('🔍 [USUARIOS] Usuarios obtenidos de API:', usersData.users.length);
        console.log('🔍 [USUARIOS] Usuario actual para filtrado:', currentUser);
        
        if (currentUser?.role === 'admin') {
          // Admin solo puede ver usuarios de sus grupos
          const userGroups = currentUser.groups || [];
          // Normalizar userGroups a array de strings (IDs)
          const userGroupIds = Array.isArray(userGroups) 
            ? userGroups.map((g: any) => typeof g === 'string' ? g : g.id)
            : [];
          
          console.log('🔍 [USUARIOS] Aplicando filtro de jerarquía para admin:', {
            userGroupIds,
            totalUsers: usersData.users.length
          });
          
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
          
          console.log('🔍 [USUARIOS] Usuarios después del filtro:', filteredUsers.length);
        } else if (currentUser?.role === 'gestor' || currentUser?.role === 'fotografia') {
          // Gestor y Fotografía solo pueden ver admins (NO modelos)
          console.log('🔍 [USUARIOS] Aplicando filtro de jerarquía para gestor/fotografia:', {
            totalUsers: usersData.users.length
          });
          
          filteredUsers = usersData.users.filter((user: any) => {
            // Solo pueden ver admins y super admins (NO modelos)
            return user.role === 'admin' || user.role === 'super_admin';
          });
          
          console.log('🔍 [USUARIOS] Usuarios después del filtro (solo admins):', filteredUsers.length);
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
          { label: 'Gestor', value: 'gestor' },
          { label: 'Fotografía', value: 'fotografia' },
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
    if (!currentUser) {
      setError('Debes estar autenticado para editar usuarios');
      return;
    }
    
    if (!canEditUser(currentUser, user)) {
      let errorMessage = 'No tienes permisos para editar este usuario';
      
      if (currentUser.role === 'admin' && user.role !== 'modelo') {
        errorMessage = 'Los administradores solo pueden editar modelos';
      } else if (currentUser.role === 'admin' && user.role === 'modelo') {
        const userGroupIds = currentUser.groups.map(g => g.id);
        const targetUserGroupIds = user.groups.map(g => g.id);
        const hasSharedGroup = targetUserGroupIds.some(groupId => userGroupIds.includes(groupId));
        
        if (!hasSharedGroup) {
          errorMessage = 'Solo puedes editar modelos de tus grupos asignados';
        }
      } else if (currentUser.role === 'modelo') {
        errorMessage = 'Los modelos no pueden editar otros usuarios';
      }
      
      setError(errorMessage);
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
    if (!currentUser) {
      setError('Debes estar autenticado para eliminar usuarios');
      return;
    }
    
    if (!canDeleteUser(currentUser, userToDelete)) {
      let errorMessage = 'No tienes permisos para eliminar este usuario';
      
      if (currentUser.role === 'admin' && userToDelete.role !== 'modelo') {
        errorMessage = 'Los administradores solo pueden eliminar modelos';
      } else if (currentUser.role === 'admin' && userToDelete.role === 'modelo') {
        const userGroupIds = currentUser.groups.map(g => g.id);
        const targetUserGroupIds = userToDelete.groups.map(g => g.id);
        const hasSharedGroup = targetUserGroupIds.some(groupId => userGroupIds.includes(groupId));
        
        if (!hasSharedGroup) {
          errorMessage = 'Solo puedes eliminar modelos de tus grupos asignados';
        }
      } else if (currentUser.role === 'modelo') {
        errorMessage = 'Los modelos no pueden eliminar otros usuarios';
      }
      
      setError(errorMessage);
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
      case 'gestor':
        return 'bg-orange-600 text-orange-100';
      case 'fotografia':
        return 'bg-purple-600 text-purple-100';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-3 sm:p-4 md:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex justify-between items-center gap-2 sm:gap-3">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 sm:h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight">
                      Gestión de Usuarios
                    </h1>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">Administra usuarios del sistema</p>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/admin/users/create')}
                  className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-1 sm:space-x-2 shadow-md hover:shadow-lg transform hover:scale-105 flex-shrink-0"
                >
                  <span className="text-base sm:text-sm font-semibold">+</span>
                  <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Nuevo Usuario</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className={`mb-16 relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 z-10 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 ${showEditModal ? 'opacity-30 blur-sm pointer-events-none' : ''}`}
             aria-hidden={showEditModal}
        >
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
            showResultsInfo={true}
            totalUsers={users.length}
            filteredUsers={filteredUsers.length}
            onClearSearch={() => {
                    setSearchQuery('');
                    setSearchFilters({});
                    setFilteredUsers([]);
                  }}
          />
        </div>

        {error && (
          <div className="mb-6 relative bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl shadow-md">
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
        <div className={`relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm border border-white/20 dark:border-gray-600/20 rounded-xl shadow-md transition-all duration-300 apple-scroll overflow-y-auto max-h-[70vh] p-0 z-10 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 ${(isDropdownOpen || showEditModal) ? 'opacity-30 blur-sm pointer-events-none' : 'opacity-100 blur-none pointer-events-auto'}`}
             aria-hidden={showEditModal}
        >
          <div className="pt-4 sm:pt-6 px-3 sm:px-6 pb-0">
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
                <div className="text-gray-400 dark:text-gray-500 text-base font-medium">No hay usuarios registrados</div>
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
                <div className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                  {searchQuery.trim() || Object.values(searchFilters).some(f => f) 
                    ? 'Intenta ajustar los filtros de búsqueda' 
                    : 'Usa los filtros de búsqueda para encontrar usuarios'
                  }
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full text-left text-xs md:table-fixed">
                  <thead className="border-b border-white/20 dark:border-gray-600/20 bg-gradient-to-r from-gray-50/80 to-blue-50/60 dark:from-gray-700/80 dark:to-gray-600/60 backdrop-blur-sm">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[120px] sm:w-[28%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                        Usuario
                      </th>
                      <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[150px] sm:w-[28%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                        Email
                      </th>
                      <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[80px] sm:w-[10%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                        Rol
                      </th>
                      <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[100px] sm:w-[20%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                        Grupos
                      </th>
                      <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[70px] sm:w-[8%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                        Estado
                      </th>
                      <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[100px] sm:w-[6%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/30 backdrop-blur-sm divide-y divide-white/20">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-white/10 hover:bg-white/60 hover:shadow-sm transition-all duration-200 h-auto sm:h-12 group">
                        <td className="px-2 sm:px-4 py-2">
                          <div className="flex items-center space-x-2">
                            {(() => {
                              // Avatar simbólico homogéneo por rol
                              const role = user.role || 'modelo';
                              
                              let gradient = 'bg-gradient-to-br from-pink-500 via-rose-500 to-purple-500';
                              let symbol: React.ReactElement;
                              
                              if (role === 'super_admin') {
                                gradient = 'bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600';
                                symbol = (
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M5 16L3 10l5.5-2L12 10l3.5-2L21 10l-2 6H5zm14.5-7.5L18.5 8l-3.5 1.5L12 8l-2.5 1.5L6 8l-1 0.5L5 11l14 0.5z"/>
                                    <circle cx="8" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
                                    <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
                                    <circle cx="12" cy="14" r="1.5" fill="currentColor" opacity="0.9"/>
                                  </svg>
                                );
                              } else if (role === 'admin') {
                                gradient = 'bg-gradient-to-br from-blue-500 to-indigo-600';
                                symbol = (
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
                                  </svg>
                                );
                              } else if (role === 'gestor') {
                                gradient = 'bg-gradient-to-br from-orange-500 to-amber-600';
                                symbol = (
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                  </svg>
                                );
                              } else if (role === 'fotografia') {
                                gradient = 'bg-gradient-to-br from-purple-500 to-pink-600';
                                symbol = (
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                  </svg>
                                );
                              } else {
                                symbol = (
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <circle cx="12" cy="12" r="2" fill="currentColor"/>
                                    <circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.8"/>
                                    <circle cx="12" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
                                    <circle cx="8" cy="12" r="1.5" fill="currentColor" opacity="0.8"/>
                                    <circle cx="16" cy="12" r="1.5" fill="currentColor" opacity="0.8"/>
                                    <circle cx="10" cy="10" r="1.2" fill="currentColor" opacity="0.7"/>
                                    <circle cx="14" cy="10" r="1.2" fill="currentColor" opacity="0.7"/>
                                    <circle cx="10" cy="14" r="1.2" fill="currentColor" opacity="0.7"/>
                                    <circle cx="14" cy="14" r="1.2" fill="currentColor" opacity="0.7"/>
                                  </svg>
                                );
                              }
                              
                              return (
                                <div 
                                  className={`w-6 h-6 ${gradient} rounded-full flex items-center justify-center text-xs shadow-sm border border-white/20 flex-shrink-0 relative overflow-hidden`}
                                >
                                  <div className="text-white flex items-center justify-center">
                                    {symbol}
                            </div>
                                </div>
                              );
                            })()}
                            <div className="min-w-0 flex-1">
                              <div className="text-gray-900 dark:text-gray-100 font-medium text-xs truncate" title={user.name}>{user.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 group/id">
                                <span 
                                  className="text-gray-400 dark:text-gray-500 text-xs font-mono select-all cursor-text hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                  title={`ID: ${user.id} (click para seleccionar, botón para copiar)`}
                                >
                                  {user.id}
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(user.id);
                                      // Feedback visual temporal
                                      const btn = e.currentTarget;
                                      const originalHTML = btn.innerHTML;
                                      btn.innerHTML = '<svg class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>';
                                      setTimeout(() => {
                                        btn.innerHTML = originalHTML;
                                      }, 1500);
                                    } catch (err) {
                                      console.error('Error copiando ID:', err);
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 group-hover/id:opacity-100 transition-opacity p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0"
                                  title="Copiar ID al portapapeles"
                                >
                                  <svg className="w-3 h-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-2 text-gray-800 truncate max-w-[220px] text-xs text-center" title={user.email}>{user.email}</td>
                        <td className="px-2 sm:px-4 py-2 text-center">
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
                        <td className="px-2 sm:px-4 py-2 text-center">
                          {user.groups.length > 0 ? (
                            <div className="flex items-center justify-center gap-1 overflow-hidden">
                              {user.groups.slice(0,2).map((group) => (
                                <span key={group.id} className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-md text-xs whitespace-nowrap border border-gray-200/30 dark:border-gray-600/30 shadow-sm backdrop-blur-sm">
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
                        <td className="px-2 sm:px-4 py-2 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-sm backdrop-blur-sm ${user.is_active ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-300 border-green-200/50 dark:border-green-700/50' : 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-gray-600 text-gray-600 dark:text-gray-300 border-gray-200/50 dark:border-gray-600/50'}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                         <td className="px-2 sm:px-4 py-2 text-center">
                           <div className="flex justify-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => handleEditUser(user)}
                              disabled={!currentUser || !canEditUser(currentUser, user)}
                              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-all duration-200 backdrop-blur-sm ${
                                !currentUser || !canEditUser(currentUser, user)
                                  ? 'bg-gray-100 dark:bg-gray-700 border-gray-200/30 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200/30 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:shadow-sm'
                              }`}
                              title={!currentUser || !canEditUser(currentUser, user) ? 'Solo puedes editar modelos de tus grupos' : 'Editar usuario'}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={!currentUser || !canDeleteUser(currentUser, user)}
                              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-all duration-200 backdrop-blur-sm ${
                                !currentUser || !canDeleteUser(currentUser, user)
                                  ? 'bg-gray-100 dark:bg-gray-700 border-gray-200/30 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200/30 text-red-700 hover:from-red-100 hover:to-rose-100 hover:shadow-sm'
                              }`}
                              title={!currentUser || !canDeleteUser(currentUser, user) ? 'Solo puedes eliminar modelos de tus grupos' : 'Eliminar usuario'}
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
                </div>
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

// Componente para editar usuario con pestañas
function EditUserModal({ user, groups, onClose, onSubmit, currentUser, modalError, setModalError }: {
  user: User;
  groups: Group[];
  onClose: () => void;
  onSubmit: (userData: any) => void;
  currentUser: CurrentUser | null;
  modalError: string | null;
  setModalError: (error: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [formData, setFormData] = useState({
    id: user?.id || '',
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'modelo',
    is_active: user?.is_active ?? true,
    group_ids: user?.groups?.map(g => g.id) || []
  });

  // Estados para la pestaña de contraseña
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Estados para el formulario principal
  const [restrictionMessage, setRestrictionMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  // Obtener el nombre del grupo seleccionado
  const selectedGroupName = groups.find(g => g.id === formData.group_ids[0])?.name || '';

  // 🔧 ACTUALIZAR FORMULARIO CUANDO CAMBIE EL USUARIO
  useEffect(() => {
    if (!user) return;
    
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      group_ids: user.groups?.map(g => g.id) || []
    });
  }, [user]);

  // Formatear el nombre con mayúscula inicial en cada palabra
  const titleCaseWords = (input: string) => {
    return input
      .trimStart()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
      .join(' ');
  };

  // Sanear espacios y puntuación para nombres
  const sanitizeBasic = (input: string) => {
    return input
      .trim() // quitar espacios al inicio/fin
      .replace(/\s{2,}/g, ' ') // colapsar múltiples espacios
      .replace(/\s+([,.;:])/g, '$1'); // quitar espacio antes de puntuación común
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedName = titleCaseWords(sanitizeBasic(formData.name || ''));
    onSubmit({ ...formData, name: sanitizedName });
  };

  // Función para cambiar contraseña (independiente)
  const handleChangePassword = async () => {
    if (!passwordData.newPassword.trim()) {
      setPasswordError('La contraseña no puede estar vacía');
      return;
    }

    if (passwordData.newPassword.trim().length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: formData.id,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          is_active: formData.is_active,
          group_ids: formData.group_ids,
          password: passwordData.newPassword.trim()
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setPasswordError(null);
        setPasswordSuccess(true);
        setPasswordData({ newPassword: '', confirmPassword: '' });
        
        // Resetear mensaje de éxito después de 3 segundos
        setTimeout(() => {
          setPasswordSuccess(false);
        }, 3000);
      } else {
        setPasswordError(result.error || 'Error actualizando contraseña');
      }
    } catch (error) {
      console.error('Error actualizando contraseña:', error);
      setPasswordError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Mostrar mensajes de restricción según rol
  const handleRoleChange = (role: string) => {
    // Limpiar grupos si se selecciona gestor o fotografia
    if (role === 'gestor' || role === 'fotografia') {
      setFormData(prev => ({ 
        ...prev, 
        role: role as 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia',
        group_ids: []
      }));
    } else {
      setFormData(prev => ({ ...prev, role: role as 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia' }));
    }
    
    if (role === 'modelo') {
      setRestrictionMessage('💡 Los modelos solo pueden estar en un grupo a la vez');
    } else if (role === 'admin') {
      setRestrictionMessage('💡 Los administradores deben tener al menos un grupo asignado');
    } else if (role === 'gestor') {
      setRestrictionMessage('💡 Los gestores interactúan con todos los admins (no requieren grupos)');
    } else if (role === 'fotografia') {
      setRestrictionMessage('💡 Los usuarios de fotografía interactúan con todos los admins (no requieren grupos)');
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

  // Cerrar con ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Animación de entrada
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <StandardModal isOpen={true} onClose={onClose} title="Editar Usuario" maxWidthClass="max-w-4xl">
      {/* Pestañas */}
      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'password'
              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          Contraseña
        </button>
      </div>

        {/* Mensaje de error del modal */}
        {modalError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-300">{modalError}</p>
              </div>
            </div>
          </div>
        )}

      {/* Contenido de pestañas */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Diseño horizontal con dos columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna izquierda */}
            <div className="space-y-4">
          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: titleCaseWords(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
              autoComplete="name"
                  autoCapitalize="words"
                  spellCheck={true}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
              autoComplete="email"
              required
            />
          </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-4">
          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Rol</label>
            <AppleDropdown
              options={[
                { value: 'modelo', label: 'Modelo' },
                { value: 'fotografia', label: 'Fotografía' },
                { value: 'gestor', label: 'Gestor' },
                { value: 'admin', label: 'Admin' },
                { value: 'super_admin', label: 'Super Admin' }
              ]}
              value={formData.role}
                  onChange={(value) => handleRoleChange(value)}
              placeholder="Selecciona un rol"
              className="text-sm"
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
                className="absolute top-[3px] rounded-full bg-white dark:bg-gray-200 shadow"
                style={{ left: formData.is_active ? 20 : 3, width: 18, height: 18 }}
              />
            </button>
              </div>
            </div>
          </div>

          {/* Grupos - ancho completo (oculto para gestor y fotografia) */}
          {formData.role !== 'gestor' && formData.role !== 'fotografia' && (
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
              className="text-sm"
            />
            {restrictionMessage && (
              <div className="mt-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700/50">
                {restrictionMessage}
              </div>
            )}
          </div>
          )}
          
          {/* Mostrar mensaje de restricción para gestor y fotografia */}
          {(formData.role === 'gestor' || formData.role === 'fotografia') && restrictionMessage && (
            <div className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700/50">
              {restrictionMessage}
            </div>
          )}

          {/* Botones - centrados */}
          <div className="flex justify-center space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-md"
            >
              Actualizar Usuario
            </button>
          </div>
        </form>
      )}

      {activeTab === 'password' && (
        <div className="space-y-4">
          {/* Mensaje de éxito */}
          {passwordSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
      </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800 dark:text-green-300">Contraseña actualizada exitosamente</p>
    </div>
              </div>
            </div>
          )}

          {/* Mensaje de error de contraseña */}
          {passwordError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800 dark:text-red-300">{passwordError}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Nueva Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Ingresa nueva contraseña"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 px-2 py-1 rounded-md text-xs text-white bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600"
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {passwordData.newPassword && passwordData.newPassword.length < 6 && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">La contraseña debe tener al menos 6 caracteres</p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-1">Confirmar Contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirma la nueva contraseña"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-12 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 backdrop-blur-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-2 px-2 py-1 rounded-md text-xs text-white bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 dark:hover:bg-gray-600"
              >
                {showConfirmPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">Las contraseñas no coinciden</p>
            )}
          </div>

          <div className="flex justify-center space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword || !passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword || passwordData.newPassword.length < 6}
              className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cambiando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Cambiar Contraseña
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </StandardModal>
  );
}
