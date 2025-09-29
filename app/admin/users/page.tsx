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
    <div className="min-h-screen" style={{
      background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
    }}>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Gestión de Usuarios</h1>
            <p className="text-gray-400">Administra usuarios del sistema</p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center space-x-2"
          >
            <span>+</span>
            <span>Nuevo Usuario</span>
          </button>
        </div>

        {/* Error Message */}
        {/* Search and Filters */}
        <div className="mb-6">
          <AppleSearchBar
            onSearch={handleSearch}
            placeholder="Buscar por nombre o email..."
            filters={searchFiltersConfig}
          />
        </div>

        {error && (
          <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-aim-card border border-aim-border rounded-xl shadow-lg backdrop-blur-glass">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
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
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-aim-border">
                    <tr>
                      <th className="px-6 py-4 text-gray-300 font-medium">Usuario</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Email</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Rol</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Grupos</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Estado</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Último Login</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id} className="border-b border-aim-border hover:bg-gray-800/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-white font-medium">{user.name}</div>
                              <div className="text-gray-400 text-sm">ID: {user.id.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-white">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {user.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.groups.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.groups.map((group) => (
                                <span key={group.id} className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">
                                  {group.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Sin grupos</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={getStatusColor(user.is_active)}>
                            {user.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {user.last_login ? 
                            new Date(user.last_login).toLocaleDateString() : 
                            'Nunca'
                          }
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
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
            <select
              value={formData.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="modelo">Modelo</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-3">Grupos</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
              {groups.map((group) => {
                const isChecked = formData.group_ids.includes(group.id);
                const isDisabled = formData.role === 'modelo' && 
                                 formData.group_ids.length > 0 && 
                                 !isChecked;
                
                return (
                  <label 
                    key={group.id} 
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                      isDisabled 
                        ? 'opacity-50 bg-gray-100 cursor-not-allowed' 
                        : 'hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            group_ids: [...formData.group_ids, group.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            group_ids: formData.group_ids.filter(id => id !== group.id)
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className={`text-sm font-medium ${
                      isDisabled 
                        ? 'text-gray-400' 
                        : 'text-gray-700'
                    }`}>
                      {group.name}
                      {isDisabled && (
                        <span className="text-xs text-gray-400 ml-2">(deshabilitado)</span>
                      )}
                    </span>
                  </label>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-aim-card border border-aim-border rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-white mb-4">Editar Usuario</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'super_admin' | 'admin' | 'modelo' })}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="modelo">Modelo</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-white">Usuario Activo</span>
            </label>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-3">Grupos</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50">
              {groups.map((group) => {
                const isChecked = formData.group_ids.includes(group.id);
                const isDisabled = formData.role === 'modelo' && 
                                 formData.group_ids.length > 0 && 
                                 !isChecked;
                
                return (
                  <label 
                    key={group.id} 
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${
                      isDisabled 
                        ? 'opacity-50 bg-gray-100 cursor-not-allowed' 
                        : 'hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            group_ids: [...formData.group_ids, group.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            group_ids: formData.group_ids.filter(id => id !== group.id)
                          });
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className={`text-sm font-medium ${
                      isDisabled 
                        ? 'text-gray-400' 
                        : 'text-gray-700'
                    }`}>
                      {group.name}
                      {isDisabled && (
                        <span className="text-xs text-gray-400 ml-2">(deshabilitado)</span>
                      )}
                    </span>
                  </label>
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
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Actualizar Usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}