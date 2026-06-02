"use client";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
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
        {zoomedImage && isMounted && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 cursor-pointer animate-in fade-in duration-200"
            onClick={() => setZoomedImage(null)}
            style={{ zIndex: 100000 }}
          >
            <img 
              src={zoomedImage} 
              alt="Avatar Ampliado" 
              className="w-full max-w-[360px] h-auto max-h-[360px] rounded-2xl shadow-2xl object-cover border border-white/10 cursor-default animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors cursor-pointer"
              onClick={() => setZoomedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>,
          document.body
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
    group_ids: user?.groups?.map(g => g.id) || [],
    liquidar: false
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
      group_ids: user.groups?.map(g => g.id) || [],
      liquidar: false
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
    <StandardModal 
      isOpen={true} 
      onClose={onClose} 
      showCloseButton={false}
      maxWidthClass="max-w-3xl"
      bgClass="bg-white/90 dark:bg-[#131316]/90 backdrop-blur-3xl"
      borderClass="border border-white/40 dark:border-white/10"
      overflowClass="overflow-hidden"
      className="!rounded-[2.2rem] shadow-[0_25px_60px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] relative"
    >
      {/* Resplandores Ambientales Boreales Aurora */}
      <div className="absolute top-[-100px] right-[-100px] w-80 h-80 rounded-full bg-gradient-to-br from-purple-500/10 to-indigo-500/10 blur-3xl pointer-events-none mix-blend-screen opacity-70 dark:opacity-40" />
      <div className="absolute bottom-[-150px] left-[-150px] w-96 h-96 rounded-full bg-gradient-to-tr from-pink-500/5 to-purple-500/5 blur-3xl pointer-events-none mix-blend-screen opacity-50 dark:opacity-30" />

      {/* Header Premium Aurora */}
      <div className="relative flex items-center justify-between mb-6 pb-2 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/15">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-950 dark:text-white tracking-tight">Editar Usuario</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-all hover:scale-105 active:scale-95 cursor-pointer border border-black/5 dark:border-white/5 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs / Selector de Pestañas estilo Cápsula Aurora */}
      <div className="relative flex p-1 bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 shadow-sm rounded-full mb-6 max-w-xs mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
            activeTab === 'profile'
              ? 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white shadow-md shadow-cyan-500/25 dark:shadow-[0_0_10px_rgba(34,211,238,0.25)] hover:from-cyan-500 hover:to-fuchsia-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Perfil
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
            activeTab === 'password'
              ? 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white shadow-md shadow-cyan-500/25 dark:shadow-[0_0_10px_rgba(34,211,238,0.25)] hover:from-cyan-500 hover:to-fuchsia-500'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          Contraseña
        </button>
      </div>

      {/* Mensajes de Error del Modal */}
      {modalError && (
        <div className="relative mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
          <div className="flex gap-2.5 items-start">
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-800 dark:text-red-300 leading-tight">Error de Operación</p>
              <p className="text-[10.5px] text-red-700/80 dark:text-red-300/80 mt-0.5 leading-normal">{modalError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pestaña Perfil */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSubmit} className="relative space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna Izquierda: Datos del Usuario */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Nombre completo</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: titleCaseWords(e.target.value) })}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-300 shadow-inner"
                    autoComplete="name"
                    autoCapitalize="words"
                    spellCheck={true}
                    required
                  />
                  <div className="absolute right-3.5 top-3 text-gray-300 dark:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Correo electrónico</label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-2.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-300 shadow-inner"
                    autoComplete="email"
                    required
                  />
                  <div className="absolute right-3.5 top-3 text-gray-300 dark:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Roles y Estado */}
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Rol del sistema</label>
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
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Estado de acceso</label>
                <div className="flex flex-col gap-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-2.5 shadow-inner">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const nextActive = !formData.is_active;
                        setFormData({ 
                          ...formData, 
                          is_active: nextActive,
                          liquidar: nextActive ? false : formData.liquidar
                        });
                      }}
                      className={`relative w-11 h-6 rounded-full transition-all duration-300 ease-in-out outline-none shrink-0 cursor-pointer ${
                        formData.is_active 
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_2px_8px_rgba(16,185,129,0.3)]' 
                          : 'bg-black/10 dark:bg-white/10'
                      }`}
                      aria-pressed={formData.is_active}
                    >
                      <span
                        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300 ease-in-out ${
                          formData.is_active ? 'left-[23px] scale-100' : 'left-[3px] scale-95'
                        }`}
                      />
                    </button>
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-bold leading-none ${formData.is_active ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'}`}>
                        {formData.is_active ? 'Usuario Activo' : 'Usuario Inactivo'}
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 leading-none">
                        {formData.is_active ? 'Acceso al sistema permitido' : 'Acceso denegado o suspendido'}
                      </span>
                    </div>
                  </div>

                  {formData.role === 'modelo' && !formData.is_active && (
                    <div className="mt-1 pt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, liquidar: !formData.liquidar })}
                        className={`relative w-11 h-6 rounded-full transition-all duration-300 ease-in-out outline-none shrink-0 cursor-pointer ${
                          formData.liquidar 
                            ? 'bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-[0_2px_8px_rgba(217,70,239,0.3)]' 
                            : 'bg-black/10 dark:bg-white/10'
                        }`}
                        aria-pressed={formData.liquidar}
                      >
                        <span
                          className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-md transition-all duration-300 ease-in-out ${
                            formData.liquidar ? 'left-[23px] scale-100' : 'left-[3px] scale-95'
                          }`}
                        />
                      </button>
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-bold leading-none ${formData.liquidar ? 'text-fuchsia-500' : 'text-gray-400 dark:text-gray-500'}`}>
                          ¿Liquidar Cuentas y Archivar?
                        </span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 leading-none">
                          Genera histórico contable y reembolsa ahorros
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Grupos - Ancho Completo */}
          {formData.role !== 'gestor' && formData.role !== 'fotografia' && (
            <div className="space-y-1.5 animate-in fade-in duration-300">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-1">Grupos asignados</label>
              <AppleDropdown
                options={groups.map(group => ({
                  value: group.id,
                  label: group.name
                }))}
                value={formData.group_ids.length > 0 ? formData.group_ids[0] : ''}
                onChange={handleGroupChange}
                placeholder="Selecciona un grupo asignado"
                className="text-xs"
              />
              {restrictionMessage && (
                <div className="mt-3 text-[10.5px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/20 flex items-start gap-2 shadow-inner">
                  <span className="shrink-0 mt-0.5">ℹ️</span>
                  <span>{restrictionMessage}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Mostrar mensaje de restricción para gestor y fotografia */}
          {(formData.role === 'gestor' || formData.role === 'fotografia') && restrictionMessage && (
            <div className="text-[10.5px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/10 p-3 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/20 flex items-start gap-2 shadow-inner animate-in fade-in duration-300">
              <span className="shrink-0 mt-0.5">ℹ️</span>
              <span>{restrictionMessage}</span>
            </div>
          )}

          {/* Fila de Botones Premium */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-black/[0.04] dark:border-white/[0.04]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 active:scale-95 touch-manipulation cursor-pointer border border-transparent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold rounded-full transition-all duration-300 shadow-md active:scale-95 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white shadow-cyan-500/25 dark:shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:shadow-fuchsia-500/30 active:scale-95 hover:scale-[1.02] transform cursor-pointer flex items-center justify-center"
            >
              Actualizar Usuario
            </button>
          </div>
        </form>
      )}

      {/* Pestaña Contraseña */}
      {activeTab === 'password' && (
        <div className="relative space-y-5 animate-in fade-in duration-300">
          {/* Mensaje de Éxito */}
          {passwordSuccess && (
            <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex gap-2.5 items-center">
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-green-800 dark:text-green-300">¡Contraseña Cambiada!</p>
                  <p className="text-[10px] text-green-700/80 dark:text-green-400/80 mt-0.5">La contraseña se ha actualizado exitosamente en el sistema</p>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje de Error de Contraseña */}
          {passwordError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-800 dark:text-red-300 leading-tight">Error al Cambiar Contraseña</p>
                  <p className="text-[10.5px] text-red-700/80 dark:text-red-300/80 mt-0.5 leading-normal">{passwordError}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Ingresa la nueva contraseña"
                autoComplete="new-password"
                className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-2.5 pr-11 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-300 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title={showPassword ? 'Ocultar Contraseña' : 'Ver Contraseña'}
              >
                {showPassword ? (
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {passwordData.newPassword && passwordData.newPassword.length < 6 && (
              <p className="text-red-500 dark:text-red-400 text-[10px] font-medium mt-1.5 ml-1 flex items-center gap-1">
                <span>⚠️</span> La contraseña debe tener al menos 6 caracteres
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Confirmar nueva contraseña</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirma la nueva contraseña"
                autoComplete="new-password"
                className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-2.5 pr-11 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:focus:ring-purple-400/20 focus:border-purple-500 dark:focus:border-purple-400 transition-all duration-300 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title={showConfirmPassword ? 'Ocultar Contraseña' : 'Ver Contraseña'}
              >
                {showConfirmPassword ? (
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
              <p className="text-red-500 dark:text-red-400 text-[10px] font-medium mt-1.5 ml-1 flex items-center gap-1">
                <span>⚠️</span> Las contraseñas no coinciden
              </p>
            )}
          </div>

          {/* Fila de Botones Premium para Cambiar Contraseña */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-black/[0.04] dark:border-white/[0.04]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 active:scale-95 touch-manipulation cursor-pointer border border-transparent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword || !passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword || passwordData.newPassword.length < 6}
              className="px-6 py-2.5 text-xs font-bold rounded-full transition-all duration-300 shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white shadow-cyan-500/25 dark:shadow-[0_0_12px_rgba(34,211,238,0.3)] hover:shadow-fuchsia-500/30 active:scale-95 hover:scale-[1.02] transform cursor-pointer flex items-center justify-center gap-2"
            >
              {savingPassword ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Cambiando...</span>
                </>
              ) : (
                <span>Cambiar Contraseña</span>
              )}
            </button>
          </div>
        </div>
      )}
    </StandardModal>
  );
}
