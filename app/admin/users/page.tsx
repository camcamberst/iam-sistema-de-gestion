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
import PageHeader from "@/components/ui/PageHeader";

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia' | 'superadmin_aff';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  avatar_url?: string;
  photo_url?: string;
  groups: Array<{
    id: string;
    name: string;
  }>;
  affiliate_studio_id?: string | null;
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  // Manejador para cerrar la imagen ampliada con la tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomedImage) {
        setZoomedImage(null);
      }
    };
    
    if (zoomedImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomedImage]);



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
            affiliate_studio_id,
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
          affiliate_studio_id: currentUserData.affiliate_studio_id,
          groups: userGroups
        });
        
        setCurrentUser({
          id: user.id,
          role: currentUserData.role,
          groups: userGroups,
          affiliate_studio_id: currentUserData.affiliate_studio_id || null
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
        
        // Superadmin_aff solo puede filtrar por 'admin' y 'modelo' (roles que puede crear)
        if (currentUser?.role === 'superadmin_aff') {
          return allRoles.filter(role => 
            role.value === 'admin' || role.value === 'modelo'
          );
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
      
      if (currentUser.role === 'superadmin_aff') {
        if (user.role === 'super_admin' || user.role === 'superadmin_aff') {
          errorMessage = 'No puedes editar super administradores u otros superadmin afiliados';
        } else if (user.affiliate_studio_id !== currentUser.affiliate_studio_id) {
          errorMessage = 'Solo puedes editar usuarios de tu estudio afiliado';
        } else {
          errorMessage = 'No tienes permisos para editar este usuario';
        }
      } else if (currentUser.role === 'admin' && user.role !== 'modelo') {
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
      
      if (currentUser.role === 'superadmin_aff') {
        if (userToDelete.role === 'super_admin' || userToDelete.role === 'superadmin_aff') {
          errorMessage = 'No puedes eliminar super administradores u otros superadmin afiliados';
        } else if (userToDelete.affiliate_studio_id !== currentUser.affiliate_studio_id) {
          errorMessage = 'Solo puedes eliminar usuarios de tu estudio afiliado';
        } else {
          errorMessage = 'No tienes permisos para eliminar este usuario';
        }
      } else if (currentUser.role === 'admin' && userToDelete.role !== 'modelo') {
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
      // ✅ Usar función autenticada que incluye el token Bearer
      const result = await deleteUser(userId);
      
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
      <div className="flex min-h-[60vh] items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <PageHeader
          title="Gestión de Usuarios"
          subtitle="Administra usuarios del sistema"
          glow="admin"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          }
          actions={
            <button
              onClick={() => router.push('/admin/users/create')}
              className="w-full sm:w-auto btn-apple-primary flex items-center justify-center h-[34px] px-6 py-0 text-sm"
            >
              <span>Nuevo Usuario</span>
            </button>
          }
        />

        {/* Search and Filters */}
        <div className="mb-2 px-1 sm:px-2 flex items-center gap-2">
          <svg 
            className="w-[18px] h-[18px] text-blue-500 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-wide text-gray-800 dark:text-gray-200">
            Búsqueda y Filtros
          </h2>
        </div>
        
        <div 
          className="mb-8 glass-card p-4 sm:p-6 relative z-[60]"
          aria-hidden={showEditModal}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
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
        <div className="mb-2 px-1 sm:px-2 flex items-center gap-2">
          <svg 
            className="w-[18px] h-[18px] text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
          <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-wide text-gray-800 dark:text-gray-200">
            Usuarios del Sistema ({users.length})
          </h2>
          {filteredUsers.length > 0 && filteredUsers.length !== users.length && (
            <div className="hidden sm:flex items-center space-x-2 text-[13px] ml-auto text-gray-500 dark:text-gray-400 font-medium">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
              <span>{filteredUsers.length} resultado(s) encontrado(s)</span>
            </div>
          )}
        </div>

        <div className="glass-card relative z-[8] pt-4 sm:pt-6 px-3 sm:px-6 pb-0"
             aria-hidden={showEditModal}
        >
            
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
                  className="mt-4 btn-apple-primary"
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
                    <table className="min-w-full text-center text-xs md:table-fixed border-separate border-spacing-0">
                  <thead className="">
                    <tr>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[120px] sm:w-[28%] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center rounded-l-full pl-6">
                        Usuario
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[150px] sm:w-[28%] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Email
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[80px] sm:w-[10%] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Rol
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[100px] sm:w-[20%] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Grupos
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[70px] sm:w-[8%] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Estado
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[100px] sm:w-[6%] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center rounded-r-full pr-6">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all duration-200 h-auto sm:h-14">
                        <td className="px-2 sm:px-4 py-3 pl-6">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-full overflow-hidden bg-black/5 dark:bg-white/5 flex-shrink-0 border border-black/5 dark:border-white/10 cursor-pointer hover:opacity-80 transition-all ring-2 ring-transparent hover:ring-black/10 dark:hover:ring-white/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(user.avatar_url || user.photo_url || '/favicon.png');
                              }}
                            >
                              <img 
                                src={user.avatar_url || user.photo_url || '/favicon.png'} 
                                alt={user.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  // Fallback robusto en caso de que la imagen falle al cargar
                                  (e.target as HTMLImageElement).src = '/favicon.png';
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setVisibleIds(prev => ({...prev, [user.id]: !prev[user.id]})); }}
                                className="text-gray-900 dark:text-gray-100 font-medium text-xs truncate hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer text-left w-full focus:outline-none" 
                              >
                                {user.name}
                              </button>
                              {visibleIds[user.id] && (
                                <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in slide-in-from-top-1">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        await navigator.clipboard.writeText(user.id);
                                        const btn = e.currentTarget;
                                        const originalHTML = btn.innerHTML;
                                        btn.innerHTML = 'Copiado';
                                        btn.classList.add('text-green-600', 'dark:text-green-400');
                                        setTimeout(() => {
                                          btn.innerHTML = originalHTML;
                                          btn.classList.remove('text-green-600', 'dark:text-green-400');
                                        }, 1500);
                                      } catch (err) {
                                        console.error('Error copiando ID:', err);
                                      }
                                    }}
                                    className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 px-3 py-1 rounded-full transition-colors focus:outline-none font-medium"
                                  >
                                    Copiar ID
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-3">
                          {user.email.includes('@') ? (
                            <div className="flex items-center w-full text-gray-600 dark:text-gray-400 text-[11px] sm:text-xs">
                              <span className="flex-1 text-right truncate">{user.email.split('@')[0]}</span>
                              <span className="mx-0.5 opacity-40 font-light">@</span>
                              <span className="flex-1 text-left truncate">{user.email.split('@')[1]}</span>
                            </div>
                          ) : (
                            <div className="text-center text-gray-600 dark:text-gray-400 text-xs">{user.email}</div>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center">
                          <span className={`w-[100px] flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide capitalize border whitespace-nowrap shadow-[0_0_8px_rgba(0,0,0,0.1)] dark:shadow-none mx-auto ${
                            user.role === 'super_admin'
                              ? 'bg-rose-50/50 text-rose-700 border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/50 dark:shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                              : user.role === 'admin'
                                ? 'bg-cyan-50/50 text-cyan-700 border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-400/50 dark:shadow-[0_0_8px_rgba(34,211,238,0.15)]'
                                : user.role === 'modelo'
                                  ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-400/50 dark:shadow-[0_0_8px_rgba(148,163,184,0.2)]'
                                  : 'bg-black/5 text-gray-700 border-black/5 dark:bg-white/5 dark:text-gray-300 dark:border-white/10'
                          }`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-2 text-center">
                          {user.groups.length > 0 ? (
                            <div className="relative inline-flex items-center justify-center">
                              {user.groups.slice(0, 1).map((group) => (
                                <span key={group.id} className="w-[100px] flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border bg-purple-50/50 text-purple-700 border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-400/50 dark:shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                                  {group.name}
                                </span>
                              ))}
                              {user.groups.length > 1 && (
                                <div className="absolute left-full ml-1.5 group/tooltip flex items-center justify-center h-full">
                                  <span
                                    className="text-[11px] font-medium text-gray-400 dark:text-gray-500 cursor-help transition-colors hover:text-gray-600 dark:hover:text-gray-400"
                                  >
                                    +{user.groups.length - 1}
                                  </span>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900/90 dark:bg-gray-100/90 backdrop-blur-md text-white dark:text-gray-900 text-[11px] font-medium rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all whitespace-nowrap z-50 shadow-lg pointer-events-none">
                                    {user.groups.slice(1).map(g => g.name).join(', ')}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Sin grupos</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center">
                          <span className={`w-[80px] flex items-center justify-center mx-auto px-3 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${
                            user.is_active 
                              ? 'bg-emerald-50/50 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/50 dark:shadow-[0_0_8px_rgba(16,185,129,0.15)]' 
                              : 'bg-gray-50/80 text-gray-500 border-gray-200/50 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
                          }`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                         <td className="px-2 sm:px-4 py-2 text-center">
                           <div className="flex justify-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => handleEditUser(user)}
                              disabled={!currentUser || !canEditUser(currentUser, user)}
                              className={`w-[75px] flex items-center justify-center px-3 py-1 text-[11px] font-semibold tracking-wide rounded-full border bg-transparent transition-all duration-300 ${
                                !currentUser || !canEditUser(currentUser, user)
                                  ? 'opacity-50 cursor-not-allowed text-gray-400 border-gray-300 dark:text-gray-600 dark:border-gray-700'
                                  : 'text-cyan-600 border-cyan-500/60 hover:bg-cyan-50/80 hover:border-cyan-500 dark:text-cyan-400 dark:border-cyan-400/50 dark:hover:bg-cyan-500/20 dark:hover:border-cyan-300 dark:hover:shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                              }`}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={!currentUser || !canDeleteUser(currentUser, user)}
                              className={`w-[75px] flex items-center justify-center px-3 py-1 text-[11px] font-semibold tracking-wide rounded-full border bg-transparent transition-all duration-300 ${
                                !currentUser || !canDeleteUser(currentUser, user)
                                  ? 'opacity-50 cursor-not-allowed text-gray-400 border-gray-300 dark:text-gray-600 dark:border-gray-700'
                                  : 'text-rose-600 border-rose-500/60 hover:bg-rose-50/80 hover:border-rose-500 dark:text-rose-400 dark:border-rose-400/50 dark:hover:bg-rose-500/20 dark:hover:border-rose-300 dark:hover:shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                              }`}
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
                const result = await updateUser(userData);
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
        {/* Zoomed Image Modal */}
        {zoomedImage && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 cursor-zoom-out"
            onClick={() => setZoomedImage(null)}
          >
            <img 
              src={zoomedImage} 
              alt="Avatar Ampliado" 
              className="w-full max-w-[360px] h-auto max-h-[360px] rounded-2xl shadow-2xl object-cover border border-white/10 cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors"
              onClick={() => setZoomedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
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
      const result = await updateUser({
        ...formData,
        password: passwordData.newPassword.trim()
      } as any);
      
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: formData.is_active ? '#111827' : '#e5e7eb' }}
                aria-pressed={formData.is_active}
              >
                <span
                  className="absolute top-[3px] rounded-full bg-white dark:bg-gray-200 shadow transition-all"
                  style={{ left: formData.is_active ? 20 : 3, width: 18, height: 18 }}
                />
              </button>
              <span className={`text-xs font-medium ${formData.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {formData.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
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
              className="btn-apple-primary"
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
              className="disabled:opacity-50 disabled:cursor-not-allowed btn-apple-primary"
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
