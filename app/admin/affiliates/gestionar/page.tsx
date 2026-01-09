"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StandardModal from '@/components/ui/StandardModal';

interface AffiliateStudio {
  id: string;
  name: string;
  description: string | null;
  commission_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_user?: {
    id: string;
    name: string;
    email: string;
  };
  superadmin_aff?: {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
  } | null;
  stats: {
    users: number;
    sedes: number;
    models: number;
  };
}

export default function GestionarAfiliadosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  const router = useRouter();
  
  // Estados para lista de afiliados
  const [affiliates, setAffiliates] = useState<AffiliateStudio[]>([]);
  const [loadingAffiliates, setLoadingAffiliates] = useState(false);
  
  // Estados para crear afiliado
  const [showCreateAffiliate, setShowCreateAffiliate] = useState(false);
  const [newAffiliateName, setNewAffiliateName] = useState('');
  const [newAffiliateDescription, setNewAffiliateDescription] = useState('');
  const [newAffiliateCommission, setNewAffiliateCommission] = useState('10.00');
  const [creatingAffiliate, setCreatingAffiliate] = useState(false);
  
  // Estados para crear superadmin AFF (opcional)
  const [createSuperadminAff, setCreateSuperadminAff] = useState(true);
  const [superadminAffEmail, setSuperadminAffEmail] = useState('');
  const [superadminAffName, setSuperadminAffName] = useState('');
  const [superadminAffPassword, setSuperadminAffPassword] = useState('');
  
  // Estados para gestionar superadmin AFF desde la card
  const [showManageSuperadminAff, setShowManageSuperadminAff] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>('');
  const [selectedAffiliateName, setSelectedAffiliateName] = useState<string>('');
  const [managingSuperadminAff, setManagingSuperadminAff] = useState(false);
  
  // Estados para crear/editar superadmin AFF
  const [editSuperadminAffEmail, setEditSuperadminAffEmail] = useState('');
  const [editSuperadminAffName, setEditSuperadminAffName] = useState('');
  const [editSuperadminAffPassword, setEditSuperadminAffPassword] = useState('');
  const [editSuperadminAffIsActive, setEditSuperadminAffIsActive] = useState(true);
  const [isEditingSuperadminAff, setIsEditingSuperadminAff] = useState(false);

  // Cargar información del usuario y afiliados
  useEffect(() => {
    loadUserInfo();
  }, []);

  useEffect(() => {
    if (userRole === 'super_admin') {
      loadAffiliates();
    }
  }, [userRole]);

  const loadUserInfo = async () => {
    try {
      setLoading(true);
      
      // Primero intentar obtener desde Supabase
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (userData) {
        setUserRole(userData.role || '');
      } else {
        // Fallback a localStorage si no hay datos en Supabase
        const userDataStr = localStorage.getItem('user');
        if (userDataStr) {
          try {
            const parsed = JSON.parse(userDataStr);
            setUserRole(parsed.role || '');
          } catch (err) {
            console.error('Error parsing user data from localStorage:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error cargando información del usuario:', err);
      // Fallback a localStorage en caso de error
      try {
        const userDataStr = localStorage.getItem('user');
        if (userDataStr) {
          const parsed = JSON.parse(userDataStr);
          setUserRole(parsed.role || '');
        }
      } catch (localErr) {
        console.error('Error parsing user data from localStorage:', localErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper para obtener token válido
  const getValidToken = async (): Promise<string | null> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Error obteniendo sesión:', sessionError);
        return null;
      }

      // Verificar si el token está cerca de expirar (menos de 60 segundos)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = expiresAt - now;
        
        if (expiresIn < 60) {
          // Refrescar el token si está cerca de expirar
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Error refrescando sesión:', refreshError);
            return session.access_token; // Usar el token actual aunque esté cerca de expirar
          }
          
          if (refreshedSession) {
            return refreshedSession.access_token;
          }
        }
      }
      
      return session.access_token;
    } catch (error) {
      console.error('Error obteniendo token:', error);
      return null;
    }
  };

  // Cargar lista de afiliados
  const loadAffiliates = async () => {
    try {
      setLoadingAffiliates(true);
      const token = await getValidToken();
      
      if (!token) {
        setError('Error: No se pudo obtener el token de autorización.');
        return;
      }

      const response = await fetch('/api/admin/affiliates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setAffiliates(result.data || []);
      } else {
        setError('Error cargando afiliados: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error cargando afiliados:', err);
      setError('Error de conexión al cargar afiliados');
    } finally {
      setLoadingAffiliates(false);
    }
  };

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffiliateName.trim()) return;

    setCreatingAffiliate(true);
    setError('');
    setSuccess('');
    
    try {
      // Obtener token de autorización desde Supabase
      const token = await getValidToken();
      
      if (!token) {
        setError('Error: No se pudo obtener el token de autorización. Por favor, inicia sesión nuevamente.');
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const requestBody: any = {
        name: newAffiliateName.trim(),
        description: newAffiliateDescription.trim() || null,
        commission_percentage: parseFloat(newAffiliateCommission) || 10.00
      };

      // Si se marca para crear superadmin AFF, incluir sus datos
      if (createSuperadminAff && superadminAffEmail.trim() && superadminAffName.trim() && superadminAffPassword.trim()) {
        requestBody.superadmin_email = superadminAffEmail.trim();
        requestBody.superadmin_name = superadminAffName.trim();
        requestBody.superadmin_password = superadminAffPassword;
      }

      const response = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess(result.message || 'Estudio afiliado creado exitosamente');
        setNewAffiliateName('');
        setNewAffiliateDescription('');
        setNewAffiliateCommission('10.00');
        setSuperadminAffEmail('');
        setSuperadminAffName('');
        setSuperadminAffPassword('');
        setCreateSuperadminAff(true);
        setShowCreateAffiliate(false);
        // Recargar lista de afiliados
        await loadAffiliates();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error creando afiliado: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setCreatingAffiliate(false);
    }
  };

  // Gestionar superadmin AFF (crear/editar)
  const handleManageSuperadminAff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editSuperadminAffEmail.trim() || !editSuperadminAffName.trim()) {
      setError('Email y nombre son requeridos');
      return;
    }

    if (!isEditingSuperadminAff && !editSuperadminAffPassword.trim()) {
      setError('La contraseña es requerida para crear un nuevo superadmin AFF');
      return;
    }

    setManagingSuperadminAff(true);
    setError('');
    setSuccess('');

    try {
      const token = await getValidToken();
      if (!token) {
        setError('Error: No se pudo obtener el token de autorización.');
        return;
      }

      const url = `/api/admin/affiliates/${selectedAffiliateId}/superadmin`;
      const method = isEditingSuperadminAff ? 'PUT' : 'POST';
      
      const requestBody: any = {
        email: editSuperadminAffEmail.trim(),
        name: editSuperadminAffName.trim(),
        is_active: editSuperadminAffIsActive
      };

      if (editSuperadminAffPassword.trim()) {
        requestBody.password = editSuperadminAffPassword;
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message || (isEditingSuperadminAff ? 'Superadmin AFF actualizado exitosamente' : 'Superadmin AFF creado exitosamente'));
        setShowManageSuperadminAff(false);
        setEditSuperadminAffEmail('');
        setEditSuperadminAffName('');
        setEditSuperadminAffPassword('');
        setEditSuperadminAffIsActive(true);
        setIsEditingSuperadminAff(false);
        await loadAffiliates();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setManagingSuperadminAff(false);
    }
  };

  // Eliminar superadmin AFF
  const handleDeleteSuperadminAff = async (affiliateId: string, affiliateName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el superadmin AFF del estudio "${affiliateName}"?`)) {
      return;
    }

    setManagingSuperadminAff(true);
    setError('');
    setSuccess('');

    try {
      const token = await getValidToken();
      if (!token) {
        setError('Error: No se pudo obtener el token de autorización.');
        return;
      }

      const response = await fetch(`/api/admin/affiliates/${affiliateId}/superadmin`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message || 'Superadmin AFF eliminado exitosamente');
        await loadAffiliates();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setManagingSuperadminAff(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  // Solo super_admin puede acceder
  if (userRole !== 'super_admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/20 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Solo los super administradores pueden acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-purple-900/15 dark:ring-0.5 dark:ring-purple-400/20">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                {/* Título e icono */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Gestión de Afiliados
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      Administra estudios afiliados y sus configuraciones
                    </p>
                  </div>
                </div>

                {/* Botón de acción */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setShowCreateAffiliate(true)}
                    className="w-full md:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium flex items-center justify-center space-x-2 text-sm sm:text-base"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Crear Nuevo Afiliado</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mensajes de error/success */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-700 font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* Lista de Afiliados */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-pink-600/5 rounded-xl blur-xl"></div>
          <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 sm:p-8 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-purple-900/15 dark:ring-0.5 dark:ring-purple-400/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                Estudios Afiliados
              </h2>
              {loadingAffiliates && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              )}
            </div>

            {loadingAffiliates ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Cargando afiliados...</p>
              </div>
            ) : affiliates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  No hay afiliados registrados
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Crea tu primer estudio afiliado para comenzar
                </p>
                <button
                  onClick={() => setShowCreateAffiliate(true)}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm sm:text-base"
                >
                  Crear Nuevo Afiliado
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {affiliates.map((affiliate) => (
                  <div
                    key={affiliate.id}
                    className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-gray-200/50 dark:border-gray-600/50 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {affiliate.name}
                            </h3>
                            {affiliate.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {affiliate.description}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 mt-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Comisión:</span>
                            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                              {affiliate.commission_percentage}%
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Usuarios:</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {affiliate.stats.users}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Sedes:</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {affiliate.stats.sedes}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Modelos:</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {affiliate.stats.models}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          affiliate.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {affiliate.is_active ? 'Activo' : 'Inactivo'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Información del Superadmin AFF */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Superadmin AFF Encargado:</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {affiliate.superadmin_aff ? (
                            <>
                              <button
                                onClick={() => {
                                  if (!affiliate.superadmin_aff) return;
                                  setSelectedAffiliateId(affiliate.id);
                                  setSelectedAffiliateName(affiliate.name);
                                  setEditSuperadminAffEmail(affiliate.superadmin_aff.email);
                                  setEditSuperadminAffName(affiliate.superadmin_aff.name);
                                  setEditSuperadminAffIsActive(affiliate.superadmin_aff.is_active);
                                  setEditSuperadminAffPassword('');
                                  setIsEditingSuperadminAff(true);
                                  setShowManageSuperadminAff(true);
                                }}
                                className="px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeleteSuperadminAff(affiliate.id, affiliate.name)}
                                className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                Eliminar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedAffiliateId(affiliate.id);
                                setSelectedAffiliateName(affiliate.name);
                                setEditSuperadminAffEmail('');
                                setEditSuperadminAffName('');
                                setEditSuperadminAffPassword('');
                                setEditSuperadminAffIsActive(true);
                                setIsEditingSuperadminAff(false);
                                setShowManageSuperadminAff(true);
                              }}
                              className="px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            >
                              Crear
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {affiliate.superadmin_aff ? (
                        <div className="flex items-center space-x-2 ml-8">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {affiliate.superadmin_aff.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({affiliate.superadmin_aff.email})
                          </span>
                          {!affiliate.superadmin_aff.is_active && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Inactivo
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium ml-8">
                          No hay superadmin AFF asignado
                        </p>
                      )}
                    </div>
                    
                    {affiliate.created_by_user && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Creado por: <span className="font-medium">{affiliate.created_by_user.name}</span> • 
                          {' '}{new Date(affiliate.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Crear Afiliado */}
        {showCreateAffiliate && (
          <StandardModal
            isOpen={showCreateAffiliate}
            onClose={() => {
              setShowCreateAffiliate(false);
              setNewAffiliateName('');
              setNewAffiliateDescription('');
              setNewAffiliateCommission('10.00');
              setSuperadminAffEmail('');
              setSuperadminAffName('');
              setSuperadminAffPassword('');
              setCreateSuperadminAff(true);
              setError('');
              setSuccess('');
            }}
            title="Crear Nuevo Estudio Afiliado"
            maxWidthClass="max-w-lg"
            paddingClass="p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
          >
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            
            <form onSubmit={handleCreateAffiliate} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-green-700 font-medium">{success}</p>
                  </div>
                </div>
              )}
            
              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Nombre del Estudio Afiliado *
                </label>
                <input
                  type="text"
                  value={newAffiliateName}
                  onChange={(e) => setNewAffiliateName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="Ej: Estudio XYZ"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={newAffiliateDescription}
                  onChange={(e) => setNewAffiliateDescription(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="Descripción del estudio afiliado..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Porcentaje de Comisión (%) *
                </label>
                <input
                  type="number"
                  value={newAffiliateCommission}
                  onChange={(e) => setNewAffiliateCommission(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="10.00"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Porcentaje que recibe Agencia Innova (por defecto: 10%)
                </p>
              </div>

              {/* Separador */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <input
                    type="checkbox"
                    id="createSuperadminAff"
                    checked={createSuperadminAff}
                    onChange={(e) => setCreateSuperadminAff(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="createSuperadminAff" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Crear Superadmin AFF para este estudio
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  El Superadmin AFF será el administrador principal del estudio afiliado y tendrá acceso completo a su burbuja.
                </p>

                {createSuperadminAff && (
                  <div className="space-y-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                        Email del Superadmin AFF *
                      </label>
                      <input
                        type="email"
                        value={superadminAffEmail}
                        onChange={(e) => setSuperadminAffEmail(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                        placeholder="superadmin@estudio.com"
                        required={createSuperadminAff}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                        Nombre del Superadmin AFF *
                      </label>
                      <input
                        type="text"
                        value={superadminAffName}
                        onChange={(e) => setSuperadminAffName(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                        placeholder="Nombre completo"
                        required={createSuperadminAff}
                      />
                    </div>

                    <div>
                      <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                        Contraseña Temporal *
                      </label>
                      <input
                        type="password"
                        value={superadminAffPassword}
                        onChange={(e) => setSuperadminAffPassword(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        required={createSuperadminAff}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2 flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateAffiliate(false);
                    setNewAffiliateName('');
                    setNewAffiliateDescription('');
                    setNewAffiliateCommission('10.00');
                    setSuperadminAffEmail('');
                    setSuperadminAffName('');
                    setSuperadminAffPassword('');
                    setCreateSuperadminAff(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="flex-1 bg-gray-100/80 dark:bg-gray-600/80 backdrop-blur-sm text-gray-700 dark:text-gray-200 py-2 px-4 rounded-xl hover:bg-gray-200/80 dark:hover:bg-gray-500/80 transition-all duration-200 font-medium border border-gray-200/50 dark:border-gray-500/50 text-sm whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingAffiliate}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm whitespace-nowrap"
                >
                  {creatingAffiliate ? 'Creando...' : 'Crear Afiliado'}
                </button>
              </div>
            </form>
          </StandardModal>
        )}

        {/* Modal Gestionar Superadmin AFF */}
        {showManageSuperadminAff && (
          <StandardModal
            isOpen={showManageSuperadminAff}
            onClose={() => {
              setShowManageSuperadminAff(false);
              setEditSuperadminAffEmail('');
              setEditSuperadminAffName('');
              setEditSuperadminAffPassword('');
              setEditSuperadminAffIsActive(true);
              setIsEditingSuperadminAff(false);
              setError('');
              setSuccess('');
            }}
            title={isEditingSuperadminAff ? 'Editar Superadmin AFF' : 'Crear Superadmin AFF'}
            maxWidthClass="max-w-lg"
            paddingClass="p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
          >
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Estudio: <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedAffiliateName}</span>
                </p>
              </div>
            </div>
            
            <form onSubmit={handleManageSuperadminAff} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-green-700 font-medium">{success}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Email del Superadmin AFF *
                </label>
                <input
                  type="email"
                  value={editSuperadminAffEmail}
                  onChange={(e) => setEditSuperadminAffEmail(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="superadmin@estudio.com"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Nombre del Superadmin AFF *
                </label>
                <input
                  type="text"
                  value={editSuperadminAffName}
                  onChange={(e) => setEditSuperadminAffName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="Nombre completo"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  {isEditingSuperadminAff ? 'Nueva Contraseña (Opcional)' : 'Contraseña Temporal *'}
                </label>
                <input
                  type="password"
                  value={editSuperadminAffPassword}
                  onChange={(e) => setEditSuperadminAffPassword(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder={isEditingSuperadminAff ? 'Dejar vacío para mantener la actual' : 'Mínimo 6 caracteres'}
                  minLength={isEditingSuperadminAff ? 0 : 6}
                  required={!isEditingSuperadminAff}
                />
                {!isEditingSuperadminAff && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                  </p>
                )}
                {isEditingSuperadminAff && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Dejar vacío para mantener la contraseña actual.
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editSuperadminAffIsActive"
                  checked={editSuperadminAffIsActive}
                  onChange={(e) => setEditSuperadminAffIsActive(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label htmlFor="editSuperadminAffIsActive" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Usuario activo
                </label>
              </div>

              <div className="flex space-x-3 pt-2 flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    setShowManageSuperadminAff(false);
                    setEditSuperadminAffEmail('');
                    setEditSuperadminAffName('');
                    setEditSuperadminAffPassword('');
                    setEditSuperadminAffIsActive(true);
                    setIsEditingSuperadminAff(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="flex-1 bg-gray-100/80 dark:bg-gray-600/80 backdrop-blur-sm text-gray-700 dark:text-gray-200 py-2 px-4 rounded-xl hover:bg-gray-200/80 dark:hover:bg-gray-500/80 transition-all duration-200 font-medium border border-gray-200/50 dark:border-gray-500/50 text-sm whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={managingSuperadminAff}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm whitespace-nowrap"
                >
                  {managingSuperadminAff 
                    ? (isEditingSuperadminAff ? 'Actualizando...' : 'Creando...') 
                    : (isEditingSuperadminAff ? 'Actualizar' : 'Crear')}
                </button>
              </div>
            </form>
          </StandardModal>
        )}
      </div>
    </div>
  );
}
