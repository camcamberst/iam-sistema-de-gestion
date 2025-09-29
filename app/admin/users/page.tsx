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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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
        
        // Obtener usuario actual para jerarquía
        const currentUserData = usersData.users.find((u: any) => u.id === 'current-user-id'); // TODO: Obtener del contexto de auth
        if (currentUserData) {
          setCurrentUser({
            id: currentUserData.id,
            role: currentUserData.role,
            groups: currentUserData.groups
          });
        }
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
                    {users.map((user, index) => (
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
      <div className="bg-aim-card border border-aim-border rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold text-white mb-4">Crear Nuevo Usuario</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                validation.name.errors.length > 0 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              required
            />
            {validation.name.errors.length > 0 && (
              <div className="mt-1 text-red-400 text-sm">
                {validation.name.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                validation.email.errors.length > 0 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-gray-600 focus:border-blue-500'
              }`}
              required
            />
            {validation.email.errors.length > 0 && (
              <div className="mt-1 text-red-400 text-sm">
                {validation.email.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Contraseña <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              className={`w-full bg-gray-800 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                validation.password.errors.length > 0 
                  ? 'border-red-500 focus:ring-red-500' 
                  : validation.password.warnings && validation.password.warnings.length > 0
                    ? 'border-yellow-500 focus:ring-yellow-500'
                    : 'border-gray-600 focus:border-blue-500'
              }`}
              required
            />
            {validation.password.errors.length > 0 && (
              <div className="mt-1 text-red-400 text-sm">
                {validation.password.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            )}
            {validation.password.warnings && validation.password.warnings.length > 0 && (
              <div className="mt-1 text-yellow-400 text-sm">
                {validation.password.warnings.map((warning, index) => (
                  <div key={index}>{warning}</div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="modelo">Modelo</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Grupos</label>
            <div className="space-y-2">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.group_ids.includes(group.id)}
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
                    className="rounded"
                  />
                  <span className="text-white">{group.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validation.name.isValid || !validation.email.isValid || !validation.password.isValid}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
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
            <label className="block text-gray-300 text-sm font-medium mb-2">Rol</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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
            <label className="block text-gray-300 text-sm font-medium mb-2">Grupos</label>
            <div className="space-y-2">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.group_ids.includes(group.id)}
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
                    className="rounded"
                  />
                  <span className="text-white">{group.name}</span>
                </label>
              ))}
            </div>
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