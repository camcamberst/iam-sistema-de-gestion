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
  // Campos de asignación (opcionales)
  jornada?: string;
  room_id?: string;
  room_name?: string;
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
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);



  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar usuarios y grupos con cliente autenticado
      const [usersData, groupsData] = await Promise.all([
        getUsers(),
        getGroups()
      ]);

      if (usersData.success) {
        setUsers(usersData.users);
        setFilteredUsers([]); // Inicialmente vacío, solo mostrar con filtros
        
        // Obtener usuario actual para jerarquía (simular super_admin por ahora)
        setCurrentUser({
          id: 'temp-super-admin',
          role: 'super_admin',
          groups: groupsData.success ? groupsData.groups.map((g: any) => ({ id: g.id, name: g.name })) : []
        });
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

  // Search filters configuration
  const searchFiltersConfig = [
    {
      id: 'role',
      label: 'Rol',
      value: searchFilters.role || '',
      options: [
        { label: 'Super Admin', value: 'super_admin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Modelo', value: 'modelo' }
      ]
    },
    {
      id: 'group',
      label: 'Grupo',
      value: searchFilters.group || '',
      options: groups.map(group => ({
        label: group.name,
        value: group.id
      }))
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
    
    // Cargar asignaciones si es un modelo ANTES de abrir el modal
    if (user.role === 'modelo') {
      try {
        const response = await fetch(`/api/assignments/${user.id}`);
        const result = await response.json();
        
        if (result.success && result.assignments.length > 0) {
          const assignment = result.assignments[0]; // Tomar la primera asignación activa
          console.log('🔍 [FRONTEND] Asignación cargada:', assignment);
          
          // Actualizar el usuario con los datos de asignación ANTES de abrir el modal
          const userWithAssignment = {
            ...user,
            jornada: assignment.jornada,
            room_id: assignment.room_id,
            room_name: assignment.room_name
          };
          
          setSelectedUser(userWithAssignment);
          setShowEditModal(true);
        } else {
          // No hay asignaciones, abrir modal con usuario normal
          setSelectedUser(user);
          setShowEditModal(true);
        }
      } catch (error) {
        console.error('❌ [FRONTEND] Error cargando asignaciones:', error);
        // En caso de error, abrir modal con usuario normal
        setSelectedUser(user);
        setShowEditModal(true);
      }
    } else {
      // No es modelo, abrir modal directamente
      setSelectedUser(user);
      setShowEditModal(true);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Gestión de Usuarios
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">Administra usuarios del sistema</p>
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
        <div className="mb-10 relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-gray-900">Búsqueda</span>
          </div>
          <AppleSearchBar
            onSearch={handleSearch}
            placeholder="Buscar por nombre o email..."
            filters={searchFiltersConfig}
          />
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
        <div className="relative bg-white/70 backdrop-blur-sm border border-white/20 rounded-xl shadow-md transition-all duration-200 apple-scroll overflow-x-auto overflow-y-auto max-h-[70vh] p-0">
          <div className="pt-6 px-6 pb-0">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">
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
                <div className="text-gray-400 text-base font-medium">No hay resultados</div>
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
                  <thead className="border-b border-gray-200/50 bg-gray-50/50 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 w-[28%] text-gray-600 font-medium text-xs uppercase tracking-wide">Usuario</th>
                      <th className="px-4 py-3 w-[28%] text-gray-600 font-medium text-xs uppercase tracking-wide">Email</th>
                      <th className="px-4 py-3 w-[10%] text-gray-600 font-medium text-xs uppercase tracking-wide">Rol</th>
                      <th className="px-4 py-3 w-[20%] text-gray-600 font-medium text-xs uppercase tracking-wide">Grupos</th>
                      <th className="px-4 py-3 w-[8%] text-gray-600 font-medium text-xs uppercase tracking-wide">Estado</th>
                      <th className="px-4 py-3 w-[6%] text-gray-600 font-medium text-xs uppercase tracking-wide">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50 divide-y divide-gray-200/50">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100/50 hover:bg-white/80 transition-colors h-12">
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <div className="w-6 h-6 bg-gradient-to-br from-gray-600 to-slate-700 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-none">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-gray-900 font-medium truncate text-xs" title={user.name}>{user.name}</div>
                              <div className="text-gray-400 text-xs truncate" title={`ID: ${user.id}`}>ID: {user.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-800 truncate max-w-[220px] text-xs" title={user.email}>{user.email}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                            user.role === 'super_admin'
                              ? 'bg-gray-900/80 text-white border-gray-700/50'
                              : user.role === 'admin'
                                ? 'bg-blue-100/80 text-blue-800 border-blue-200/50'
                                : 'bg-green-100/80 text-green-800 border-green-200/50'
                          }`}>
                            {user.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {user.groups.length > 0 ? (
                            <div className="flex items-center gap-1 overflow-hidden">
                              {user.groups.slice(0,2).map((group) => (
                                <span key={group.id} className="bg-gray-100/80 text-gray-700 px-2 py-1 rounded text-xs whitespace-nowrap border border-gray-200/50">
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
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${user.is_active ? 'bg-green-100/80 text-green-800 border-green-200/50' : 'bg-gray-100/80 text-gray-700 border-gray-200/50'}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                         <td className="px-4 py-2">
                           <div className="flex space-x-1">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="px-2 py-1 text-xs rounded-md bg-blue-50/80 border border-blue-200/50 text-blue-700 hover:bg-blue-100/80 transition-all duration-300"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="px-2 py-1 text-xs rounded-md bg-red-50/80 border border-red-200/50 text-red-600 hover:bg-red-100/80 transition-all duration-300"
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
    group_ids: user?.groups?.map(g => g.id) || [],
    jornada: user?.jornada || '', // 🆕 Campo para jornada (usar datos del usuario)
    room_id: user?.room_id || ''  // 🆕 Campo para room (usar datos del usuario)
  });

  const [showPassword, setShowPassword] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState('');
  const [availableRooms, setAvailableRooms] = useState<Array<{id: string, room_name: string}>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Función para determinar si un grupo requiere rooms obligatorios
  const groupRequiresRooms = (groupName: string): boolean => {
    // Solo "Sede MP" requiere rooms obligatorios
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Función para determinar si un grupo requiere jornada obligatoria
  const groupRequiresJornada = (groupName: string): boolean => {
    // Solo "Sede MP" requiere jornada obligatoria
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Obtener el nombre del grupo seleccionado
  const selectedGroupName = groups.find(g => g.id === formData.group_ids[0])?.name || '';

  // 🔧 ACTUALIZAR FORMULARIO CUANDO CAMBIE EL USUARIO (con asignaciones)
  useEffect(() => {
    if (!user) return; // Validar que user existe
    
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
      group_ids: user.groups?.map(g => g.id) || [],
      jornada: user.jornada || '',
      room_id: user.room_id || ''
    });
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Función para cargar rooms por grupo
  const loadRoomsForGroup = async (groupId: string) => {
    if (!groupId) {
      setAvailableRooms([]);
      return;
    }

    setLoadingRooms(true);
    try {
      const response = await fetch(`/api/groups/rooms?groupId=${groupId}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableRooms(data.rooms);
      } else {
        console.error('Error loading rooms:', data.error);
        setAvailableRooms([]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Cargar rooms iniciales si el usuario ya tiene un grupo
  useEffect(() => {
    if (formData.group_ids.length > 0) {
      loadRoomsForGroup(formData.group_ids[0]);
    }
  }, []);

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
      group_ids: value ? [value] : [],
      room_id: '' // Reset room when group changes
    }));
    
    // Cargar rooms para el grupo seleccionado
    if (value) {
      loadRoomsForGroup(value);
    } else {
      setAvailableRooms([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-full max-w-md max-h-[95vh] flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Editar Usuario</h2>

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
            <label className="block text-gray-700 text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              Nueva Contraseña 
              <span className="text-gray-500 text-xs ml-1">(opcional - dejar vacío para mantener actual)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Ingresa nueva contraseña"
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
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Rol</label>
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
            <label className="block text-gray-700 text-sm font-medium mb-1">Usuario Activo</label>
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
            <label className="block text-gray-700 text-sm font-medium mb-1">Grupos</label>
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

          {/* Campos específicos para modelos */}
          {formData.role === 'modelo' && (
            <>
              {/* Campo Room - solo obligatorio para Sede MP */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Room {groupRequiresRooms(selectedGroupName) && <span className="text-red-500">*</span>}
                </label>
                <AppleDropdown
                  options={availableRooms.map(room => ({
                    value: room.id,
                    label: room.room_name
                  }))}
                  value={formData.room_id}
                  onChange={(value) => setFormData({ ...formData, room_id: value })}
                  placeholder={loadingRooms ? "Cargando rooms..." : "Selecciona un room"}
                  disabled={loadingRooms || availableRooms.length === 0}
                  maxHeight="max-h-40"
                />
                {formData.group_ids.length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">Primero selecciona un grupo</p>
                )}
                {!groupRequiresRooms(selectedGroupName) && selectedGroupName && (
                  <p className="mt-1 text-sm text-gray-500">Opcional para {selectedGroupName}</p>
                )}
              </div>

              {/* Campo Jornada - solo obligatorio para Sede MP */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Jornada {groupRequiresJornada(selectedGroupName) && <span className="text-red-500">*</span>}
                </label>
                <AppleDropdown
                  options={[
                    { value: 'MAÑANA', label: 'Mañana' },
                    { value: 'TARDE', label: 'Tarde' },
                    { value: 'NOCHE', label: 'Noche' }
                  ]}
                  value={formData.jornada}
                  onChange={(value) => setFormData({ ...formData, jornada: value })}
                  placeholder="Selecciona una jornada"
                />
                {!groupRequiresJornada(selectedGroupName) && selectedGroupName && (
                  <p className="mt-1 text-sm text-gray-500">Opcional para {selectedGroupName}</p>
                )}
              </div>
            </>
          )}

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
