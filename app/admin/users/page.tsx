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
import AppleDropdown from '../../../components/ui/AppleDropdown';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<Record<string, string>>({});
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
        setFilteredUsers(usersData.users);
        
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

  const handleCreateUser = async (userData: any) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();
      
      if (result.success) {
        setShowCreateModal(false);
        loadData(); // Recargar datos
      } else {
        setError('Error creando usuario: ' + result.error);
      }
    } catch (err) {
      console.error('❌ Error creando usuario:', err);
      setError('Error creando usuario');
    }
  };

  const handleEditUser = (user: User) => {
    // Verificar permisos de jerarquía
    if (!currentUser || !canEditUser(currentUser, user)) {
      setError('No tienes permisos para editar este usuario');
      return;
    }
    
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
        loadData(); // Recargar datos
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
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
      }}>
        <div className="text-white text-xl">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-1">Gestión de Usuarios</h1>
            <p className="text-gray-500">Administra usuarios del sistema</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black transition-all duration-200 flex items-center space-x-2"
          >
            <span className="text-sm">+</span>
            <span className="text-sm font-medium">Nuevo Usuario</span>
          </button>
        </div>

        {/* Error Message */}
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="grid grid-cols-1 gap-2 mb-2">
            <span className="text-xs text-gray-500 font-medium">Búsqueda</span>
          </div>
          <AppleSearchBar
            onSearch={handleSearch}
            placeholder="Buscar por nombre o email..."
            filters={searchFiltersConfig}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-200 apple-scroll overflow-x-auto overflow-y-auto max-h-[70vh] p-0">
          <div className="pt-6 px-6 pb-0">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Usuarios del Sistema ({users.length})
            </h2>
            
            {users.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg">No hay usuarios registrados</div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Crear Primer Usuario
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px] table-fixed">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 w-[28%] text-gray-600 font-medium text-xs uppercase tracking-wide">Usuario</th>
                      <th className="px-6 py-3 w-[28%] text-gray-600 font-medium text-xs uppercase tracking-wide">Email</th>
                      <th className="px-6 py-3 w-[10%] text-gray-600 font-medium text-xs uppercase tracking-wide">Rol</th>
                      <th className="px-6 py-3 w-[20%] text-gray-600 font-medium text-xs uppercase tracking-wide">Grupos</th>
                      <th className="px-6 py-3 w-[8%] text-gray-600 font-medium text-xs uppercase tracking-wide">Estado</th>
                      <th className="px-6 py-3 w-[6%] text-gray-600 font-medium text-xs uppercase tracking-wide">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors h-14">
                        <td className="px-6 py-2">
                          <div className="flex items-center space-x-3 overflow-hidden">
                            <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-none">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-gray-900 font-medium truncate" title={user.name}>{user.name}</div>
                              <div className="text-gray-400 text-[11px] truncate" title={`ID: ${user.id}`}>ID: {user.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-2 text-gray-800 truncate max-w-[220px]" title={user.email}>{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-[2px] rounded-full text-[11px] font-medium whitespace-nowrap ${
                            user.role === 'super_admin'
                              ? 'bg-gray-900 text-white'
                              : user.role === 'admin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                          }`}>
                            {user.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.groups.length > 0 ? (
                            <div className="flex items-center gap-1 overflow-hidden">
                              {user.groups.slice(0,2).map((group) => (
                                <span key={group.id} className="bg-gray-100 text-gray-700 px-2 py-[2px] rounded text-[11px] whitespace-nowrap">
                                  {group.name}
                                </span>
                              ))}
                              {user.groups.length > 2 && (
                                <span
                                  className="text-gray-500 text-[11px] whitespace-nowrap cursor-help"
                                  title={user.groups.map(g=>g.name).join(', ')}
                                >
                                  +{user.groups.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[12px]">Sin grupos</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-[2px] rounded-full text-[11px] font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                         <td className="px-6 py-4">
                           <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="px-2.5 py-1 text-[12px] rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="px-2.5 py-1 text-[12px] rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
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

        {/* Create User Modal */}
        {showCreateModal && (
          <CreateUserModal
            groups={groups}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateUser}
            currentUser={currentUser}
          />
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <EditUserModal
            user={selectedUser}
            groups={groups}
            currentUser={currentUser}
            onClose={() => {
              setShowEditModal(false);
              setSelectedUser(null);
            }}
            onSubmit={async (userData) => {
              try {
                const response = await fetch('/api/users', {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(userData),
                });

                const result = await response.json();
                
                if (result.success) {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  loadData();
                } else {
                  setError('Error actualizando usuario: ' + result.error);
                }
              } catch (err) {
                console.error('❌ Error actualizando usuario:', err);
                setError('Error actualizando usuario');
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// Componente para crear usuario
function CreateUserModal({ groups, onClose, onSubmit, currentUser }: {
  groups: Group[];
  onClose: () => void;
  onSubmit: (userData: any) => void;
  currentUser: CurrentUser | null;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'modelo',
    group_ids: getDefaultGroups('modelo', groups)
  });

  const [restrictionMessage, setRestrictionMessage] = useState('');

  const [validation, setValidation] = useState({
    name: { isValid: true, errors: [] as string[] },
    email: { isValid: true, errors: [] as string[] },
    password: { isValid: true, errors: [] as string[], warnings: [] as string[] },
    role: { isValid: true, errors: [] as string[] }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validación en tiempo real
  const validateField = async (field: string, value: string) => {
    const { validateName, validateEmail, validatePassword, validateRole } = await import('../../../lib/validation');
    
    let result;
    switch (field) {
      case 'name':
        result = validateName(value);
        break;
      case 'email':
        result = validateEmail(value);
        break;
      case 'password':
        result = validatePassword(value);
        break;
      case 'role':
        result = validateRole(value);
        break;
      default:
        return;
    }

    setValidation(prev => ({
      ...prev,
      [field]: result
    }));
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (value.trim()) {
      validateField(field, value);
    }
    
    // Mostrar mensajes de restricción según rol
    if (field === 'role') {
      if (value === 'modelo') {
        setRestrictionMessage('💡 Los modelos solo pueden estar en un grupo a la vez');
      } else if (value === 'admin') {
        setRestrictionMessage('💡 Los administradores deben tener al menos un grupo asignado');
      } else if (value === 'super_admin') {
        setRestrictionMessage('💡 Los super administradores tienen acceso a todos los grupos');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validar todos los campos
    const { validateUser } = await import('../../../lib/validation');
    const userValidation = validateUser(formData);

    if (!userValidation.isValid) {
      setValidation(prev => ({
        ...prev,
        name: { isValid: true, errors: [] },
        email: { isValid: true, errors: [] },
        password: { isValid: true, errors: [], warnings: [] },
        role: { isValid: true, errors: [] }
      }));
      setIsSubmitting(false);
      return;
    }

    // Validar jerarquía
    if (!currentUser) {
      setValidation(prev => ({
        ...prev,
        name: { isValid: false, errors: ['Usuario no autenticado'] }
      }));
      setIsSubmitting(false);
      return;
    }
    
    // Verificar si puede asignar el rol
    if (!canAssignRole(currentUser, formData.role)) {
      setValidation(prev => ({
        ...prev,
        name: { isValid: false, errors: ['No tienes permisos para asignar este rol'] }
      }));
      setIsSubmitting(false);
      return;
    }
    
    // Verificar si puede asignar los grupos
    if (!canAssignGroups(currentUser, formData.group_ids)) {
      setValidation(prev => ({
        ...prev,
        name: { isValid: false, errors: ['No tienes permisos para asignar estos grupos'] }
      }));
      setIsSubmitting(false);
      return;
    }
    
    // Validar restricciones de grupos según rol
    const groupValidation = validateGroupRestrictions(formData.role, formData.group_ids);
    if (!groupValidation.valid) {
      setValidation(prev => ({
        ...prev,
        name: { isValid: false, errors: [groupValidation.error || 'Error de validación'] }
      }));
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Crear Nuevo Usuario</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                validation.name.errors.length > 0 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="Ingresa el nombre completo"
              required
            />
            {validation.name.errors.length > 0 && (
              <div className="mt-1 text-red-500 text-sm">
                {validation.name.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                validation.email.errors.length > 0 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="usuario@ejemplo.com"
              required
            />
            {validation.email.errors.length > 0 && (
              <div className="mt-1 text-red-500 text-sm">
                {validation.email.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                validation.password.errors.length > 0 
                  ? 'border-red-500 focus:ring-red-500' 
                  : validation.password.warnings && validation.password.warnings.length > 0
                    ? 'border-amber-500 focus:ring-amber-500'
                    : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="Mínimo 8 caracteres"
              required
            />
            {validation.password.errors.length > 0 && (
              <div className="mt-1 text-red-500 text-sm">
                {validation.password.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
            {validation.password.warnings && validation.password.warnings.length > 0 && (
              <div className="mt-1 text-amber-600 text-sm">
                {validation.password.warnings.map((warning, index) => (
                  <div key={index}>{warning}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Rol</label>
            <AppleDropdown
              options={[
                { value: 'modelo', label: 'Modelo' },
                { value: 'admin', label: 'Admin' },
                { value: 'super_admin', label: 'Super Admin' }
              ]}
              value={formData.role}
              onChange={(value) => handleFieldChange('role', value)}
              placeholder="Selecciona un rol"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-3">Grupos</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {groups.map((group) => {
                const isChecked = formData.group_ids.includes(group.id);
                const isDisabled = formData.role === 'modelo' && 
                                 formData.group_ids.length > 0 && 
                                 !isChecked;
                
                return (
                  <div 
                    key={group.id} 
                    className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${
                      isDisabled 
                        ? 'opacity-50 bg-gray-100 cursor-not-allowed' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-[13px] font-medium ${
                      isDisabled ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {group.name}
                    </span>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isChecked) {
                          setFormData({ ...formData, group_ids: [...formData.group_ids, group.id] });
                        } else {
                          setFormData({ ...formData, group_ids: formData.group_ids.filter(id => id !== group.id) });
                        }
                      }}
                      className="relative w-9 h-5 rounded-full transition-colors duration-200"
                      style={{ background: isChecked ? '#111827' : '#e5e7eb' }}
                    >
                      <span
                        className="absolute top-[2px] rounded-full bg-white shadow"
                        style={{ left: isChecked ? 18 : 2, width: 16, height: 16 }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            {restrictionMessage && (
              <div className="mt-3 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                {restrictionMessage}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 py-3 px-4 rounded-lg transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validation.name.isValid || !validation.email.isValid || !validation.password.isValid}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 font-medium"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creando...</span>
                </>
              ) : (
                <span>Crear Usuario</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Componente para editar usuario
function EditUserModal({ user, groups, onClose, onSubmit, currentUser }: {
  user: User;
  groups: Group[];
  onClose: () => void;
  onSubmit: (userData: any) => void;
  currentUser: CurrentUser | null;
}) {
  const [formData, setFormData] = useState({
    id: user.id, // ✅ AGREGAR ID DEL USUARIO
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    group_ids: user.groups.map(g => g.id)
  });

  const [restrictionMessage, setRestrictionMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5 w-full max-w-md max-h-[60vh] flex flex-col">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Editar Usuario</h2>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-y-auto">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Rol</label>
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
            <label className="block text-gray-700 text-sm font-medium mb-2">Usuario Activo</label>
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
            <label className="block text-gray-700 text-sm font-medium mb-2">Grupos</label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2.5 bg-gray-50">
              {groups.map((group) => {
                const isChecked = formData.group_ids.includes(group.id);
                const isDisabled = formData.role === 'modelo' && 
                                 formData.group_ids.length > 0 && 
                                 !isChecked;

                return (
                  <div 
                    key={group.id} 
                    className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${
                      isDisabled 
                        ? 'opacity-50 bg-gray-100 cursor-not-allowed' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <span className={`text-[13px] font-medium ${
                      isDisabled ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      {group.name}
                    </span>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isChecked) {
                          if (formData.role === 'modelo') {
                            setFormData({ ...formData, group_ids: [group.id] });
                          } else {
                            setFormData({ ...formData, group_ids: [...formData.group_ids, group.id] });
                          }
                        } else {
                          setFormData({ ...formData, group_ids: formData.group_ids.filter(id => id !== group.id) });
                        }
                      }}
                      className="relative w-9 h-5 rounded-full transition-colors duration-200"
                      style={{ background: isChecked ? '#111827' : '#e5e7eb' }}
                    >
                      <span
                        className="absolute top-[2px] rounded-full bg-white shadow"
                        style={{ left: isChecked ? 18 : 2, width: 16, height: 16 }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            {restrictionMessage && (
              <div className="mt-3 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                {restrictionMessage}
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-4">
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