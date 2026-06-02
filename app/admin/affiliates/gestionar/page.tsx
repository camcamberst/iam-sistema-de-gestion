"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createPortal } from 'react-dom';
import StandardModal from '@/components/ui/StandardModal';
import PageHeader from '@/components/ui/PageHeader';
import { InfoCardGrid } from '@/components/ui/InfoCard';

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
    avatar_url?: string;
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

  // Estados para editar afiliado
  const [showEditAffiliate, setShowEditAffiliate] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState(false);
  const [editAffiliateName, setEditAffiliateName] = useState('');
  const [editAffiliateDescription, setEditAffiliateDescription] = useState('');
  const [editAffiliateCommission, setEditAffiliateCommission] = useState('');
  const [editAffiliateIsActive, setEditAffiliateIsActive] = useState(true);

  // Estados para imagen ampliada (Zoom Modal)
  const [isMounted, setIsMounted] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Cargar información del usuario y afiliados
  useEffect(() => {
    loadUserInfo();
    setIsMounted(true);
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

  // Editar afiliado
  const handleEditAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAffiliateName.trim()) return;

    setEditingAffiliate(true);
    setError('');
    setSuccess('');

    try {
      const token = await getValidToken();
      if (!token) {
        setError('Error: No se pudo obtener el token de autorización.');
        return;
      }

      const response = await fetch(`/api/admin/affiliates/${selectedAffiliateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editAffiliateName.trim(),
          description: editAffiliateDescription.trim() || null,
          commission_percentage: parseFloat(editAffiliateCommission) || 10.00,
          is_active: editAffiliateIsActive
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message || 'Estudio afiliado actualizado exitosamente');
        setShowEditAffiliate(false);
        setEditAffiliateName('');
        setEditAffiliateDescription('');
        setEditAffiliateCommission('');
        setEditAffiliateIsActive(true);
        await loadAffiliates();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Error: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setEditingAffiliate(false);
    }
  };

  // Eliminar afiliado
  const handleDeleteAffiliate = async (affiliateId: string, affiliateName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el estudio afiliado "${affiliateName}"?\n\nEsta acción ${affiliateName} será desactivado si tiene usuarios asociados, o eliminado completamente si no tiene usuarios.`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const token = await getValidToken();
      if (!token) {
        setError('Error: No se pudo obtener el token de autorización.');
        return;
      }

      const response = await fetch(`/api/admin/affiliates/${affiliateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message || 'Estudio afiliado eliminado exitosamente');
        await loadAffiliates();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError('Error: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
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
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // Solo super_admin puede acceder
  if (userRole !== 'super_admin') {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Solo los super administradores pueden acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <PageHeader 
          title="Gestión de Afiliados"
          subtitle="Administra estudios afiliados, comisiones, asignaciones y audita la facturación y métricas de su burbuja."
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          glow="superadmin"
          actions={
            <button
              onClick={() => setShowCreateAffiliate(true)}
              className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 shadow-md shadow-cyan-500/20 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 active:scale-95 flex items-center justify-center text-xs sm:text-sm font-semibold border-none cursor-pointer"
            >
              <span>Crear Nuevo Afiliado</span>
            </button>
          }
        />

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
        <div className="relative glass-card !rounded-[2rem] p-6 sm:p-8 overflow-hidden mt-6">
          {/* Ambient Boreal Glow Inside Container */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl mix-blend-screen pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                Estudios Afiliados
              </h2>
              {loadingAffiliates && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
            </div>

            {loadingAffiliates ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white rounded-lg hover:from-cyan-500 hover:to-fuchsia-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 shadow-md shadow-cyan-500/20 dark:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm sm:text-base border-none cursor-pointer"
                >
                  Crear Nuevo Afiliado
                </button>
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {affiliates.map((affiliate) => (
                  <div
                    key={affiliate.id}
                    className="flex flex-col gap-1.5 sm:gap-2 h-full"
                  >
                    {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
                        <div className="flex items-center justify-center text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                          <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="relative flex items-center">
                          <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                            {affiliate.name}
                          </h2>
                          {affiliate.description && (
                            <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide hidden sm:block truncate max-w-xs">
                              {affiliate.description}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        {/* Indicador de Estado LED - Solo el punto */}
                        <div className="w-7.5 h-7.5 flex items-center justify-center select-none" title={affiliate.is_active ? 'Activo' : 'Inactivo'}>
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            affiliate.is_active 
                              ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.9)]' 
                              : 'bg-zinc-400 dark:bg-zinc-600 shadow-[0_0_4px_rgba(156,163,175,0.4)]'
                          }`} />
                        </div>
                        {/* Pastilla de Control - Ultra-Apilodorada Rediseñada en Burbujas Compactas */}
                        <div className="flex items-center gap-0.5 p-0.5 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.1] rounded-full backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:scale-[1.03]">
                          <button
                            onClick={() => {
                              setSelectedAffiliateId(affiliate.id);
                              setSelectedAffiliateName(affiliate.name);
                              setEditAffiliateName(affiliate.name);
                              setEditAffiliateDescription(affiliate.description || '');
                              setEditAffiliateCommission(affiliate.commission_percentage.toString());
                              setEditAffiliateIsActive(affiliate.is_active);
                              setShowEditAffiliate(true);
                            }}
                            className="w-7 h-5 flex items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.12] text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 hover:border-emerald-500/30 dark:hover:border-emerald-400/30 hover:drop-shadow-[0_0_6px_rgba(52,211,153,0.4)] shadow-sm transition-all duration-200 active:scale-90 cursor-pointer border-none"
                            title="Editar Estudio"
                          >
                            <svg className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteAffiliate(affiliate.id, affiliate.name)}
                            className="w-7 h-5 flex items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.12] text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:border-red-500/30 dark:hover:border-red-400/30 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.4)] shadow-sm transition-all duration-200 active:scale-90 cursor-pointer border-none"
                            title="Eliminar Estudio"
                          >
                            <svg className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="relative bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl sm:rounded-[1.75rem] p-4 sm:p-5 hover:border-purple-300/50 dark:hover:border-purple-600/50 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all duration-300 hover:shadow-lg flex-1">
                      <div className="flex flex-col gap-3">
                        <InfoCardGrid 
                          compactContainer={true}
                          columns={4}
                          className="mb-4 mt-1"
                          cards={[
                            { value: `${affiliate.commission_percentage}%`, label: 'Comisión', color: 'purple', size: 'sm' },
                            { value: affiliate.stats.users, label: 'Usuarios', color: 'blue', size: 'sm' },
                            { value: affiliate.stats.sedes, label: 'Sedes', color: 'cyan', size: 'sm' },
                            { value: affiliate.stats.models, label: 'Modelos', color: 'green', size: 'sm' }
                          ]}
                        />
                      </div>
                    
                    {/* Información del Superadmin AFF (Ficha macOS User Card) */}
                    <div className="mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.08]">
                      <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 mb-2.5 ml-1">
                        Superadmin AFF Encargado
                      </div>
                      
                      {affiliate.superadmin_aff ? (
                        <div className="relative overflow-hidden bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-3 group transition-all duration-300 hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                          {/* Glow ambiental sutil */}
                          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
                          
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Contenedor de Foto del Superadmin con Click-to-Zoom y estilo estandarizado */}
                            <div 
                              className="w-9 h-9 rounded-full overflow-hidden bg-black/5 dark:bg-white/5 flex-shrink-0 border border-zinc-200/40 dark:border-zinc-800/80 cursor-pointer hover:opacity-90 transition-all ring-2 ring-transparent hover:ring-purple-500/20 dark:hover:ring-purple-500/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (affiliate.superadmin_aff) {
                                  setZoomedImage(affiliate.superadmin_aff.avatar_url || '/favicon.png');
                                }
                              }}
                            >
                              <img 
                                src={affiliate.superadmin_aff.avatar_url || '/favicon.png'} 
                                alt={affiliate.superadmin_aff.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/favicon.png';
                                }}
                              />
                            </div>
                            
                            {/* Datos del Superadmin */}
                            <div className="min-w-0 flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                  {affiliate.superadmin_aff.name}
                                </span>
                                {!affiliate.superadmin_aff.is_active && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    Inactivo
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                {affiliate.superadmin_aff.email}
                              </span>
                            </div>
                          </div>

                          {/* Control Pastilla Zero-Bubble - Ultra-Apilodorada Rediseñada en Burbujas Compactas */}
                          <div className="flex items-center gap-0.5 p-0.5 bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.1] rounded-full backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-300 hover:scale-[1.03]">
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
                              className="w-7 h-5 flex items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.12] text-zinc-500 dark:text-zinc-400 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-500/20 hover:border-purple-500/30 dark:hover:border-purple-400/30 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] shadow-sm transition-all duration-200 active:scale-90 cursor-pointer border-none"
                              title="Editar Superadmin"
                            >
                              <svg className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSuperadminAff(affiliate.id, affiliate.name)}
                              className="w-7 h-5 flex items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.12] text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:border-red-500/30 dark:hover:border-red-400/30 hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.4)] shadow-sm transition-all duration-200 active:scale-90 cursor-pointer border-none"
                              title="Eliminar Superadmin"
                            >
                              <svg className="w-[10px] h-[10px] sm:w-[11px] sm:h-[11px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-black/[0.015] dark:bg-white/[0.015] border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left transition-all duration-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
                            No hay superadmin AFF asignado
                          </p>
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
                            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 shadow-sm shadow-purple-500/10 cursor-pointer border-none"
                          >
                            Asignar Encargado
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {affiliate.created_by_user && (
                      <div className="mt-2.5 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                        <span>
                          Creado por: <span className="font-semibold text-zinc-500 dark:text-zinc-400">{affiliate.created_by_user.name}</span>
                        </span>
                        <span>
                          {new Date(affiliate.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    </div>
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
            title={
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/10 border border-purple-400/20 flex-shrink-0">
                  <svg className="w-4 h-4 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Crear Nuevo Estudio Afiliado</span>
              </div>
            }
            maxWidthClass="max-w-lg"
            paddingClass="p-6 sm:p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
            className="!rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10"
          >
            <form onSubmit={handleCreateAffiliate} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-red-600 dark:text-red-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-300 font-semibold tracking-tight">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-green-600 dark:text-green-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold tracking-tight">{success}</p>
                  </div>
                </div>
              )}
            
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Nombre del Estudio Afiliado *
                </label>
                <input
                  type="text"
                  value={newAffiliateName}
                  onChange={(e) => setNewAffiliateName(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="Ej: Estudio XYZ"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={newAffiliateDescription}
                  onChange={(e) => setNewAffiliateDescription(e.target.value)}
                  className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="Descripción del estudio afiliado..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Porcentaje de Comisión (%) *
                </label>
                <input
                  type="number"
                  value={newAffiliateCommission}
                  onChange={(e) => setNewAffiliateCommission(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="10.00"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 ml-1 font-medium">
                  Porcentaje que recibe Agencia Innova (por defecto: 10%)
                </p>
              </div>

              {/* Separador */}
              <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-4 mt-4">
                <div className="flex items-center space-x-2.5 py-1 ml-1 select-none">
                  <input
                    type="checkbox"
                    id="createSuperadminAff"
                    checked={createSuperadminAff}
                    onChange={(e) => setCreateSuperadminAff(e.target.checked)}
                    className="w-4.5 h-4.5 text-purple-600 border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] rounded focus:ring-purple-500 focus:ring-offset-0 focus:outline-none transition-all duration-200 cursor-pointer"
                  />
                  <label htmlFor="createSuperadminAff" className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Crear Superadmin AFF para este estudio
                  </label>
                </div>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-8 mt-0.5 leading-relaxed">
                  El Superadmin AFF será el administrador principal del estudio afiliado y tendrá acceso completo a su burbuja.
                </p>

                {createSuperadminAff && (
                  <div className="space-y-4 bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-2xl p-4 mt-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                        Email del Superadmin AFF *
                      </label>
                      <input
                        type="email"
                        value={superadminAffEmail}
                        onChange={(e) => setSuperadminAffEmail(e.target.value)}
                        className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                        placeholder="superadmin@estudio.com"
                        required={createSuperadminAff}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                        Nombre del Superadmin AFF *
                      </label>
                      <input
                        type="text"
                        value={superadminAffName}
                        onChange={(e) => setSuperadminAffName(e.target.value)}
                        className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                        placeholder="Nombre completo"
                        required={createSuperadminAff}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                        Contraseña Temporal *
                      </label>
                      <input
                        type="password"
                        value={superadminAffPassword}
                        onChange={(e) => setSuperadminAffPassword(e.target.value)}
                        className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                        required={createSuperadminAff}
                      />
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 ml-1 font-medium">
                        El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-full w-full mt-6 backdrop-blur-md">
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
                  className="flex-1 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 text-xs font-semibold uppercase tracking-wider border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingAffiliate}
                  className="flex-1 h-9 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-200 disabled:opacity-50 text-xs font-bold uppercase tracking-wider shadow-md shadow-purple-500/20 active:scale-95 border-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{creatingAffiliate ? 'Creando...' : 'Crear Afiliado'}</span>
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
            title={
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/10 border border-purple-400/20 flex-shrink-0">
                  <svg className="w-4 h-4 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                  {isEditingSuperadminAff ? 'Editar Superadmin AFF' : 'Crear Superadmin AFF'}
                </span>
              </div>
            }
            maxWidthClass="max-w-lg"
            paddingClass="p-6 sm:p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
            className="!rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10"
          >
            <div className="bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-2 mb-4 select-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Estudio:</span>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{selectedAffiliateName}</span>
            </div>
            
            <form onSubmit={handleManageSuperadminAff} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-red-600 dark:text-red-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-300 font-semibold tracking-tight">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-green-600 dark:text-green-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold tracking-tight">{success}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Email del Superadmin AFF *
                </label>
                <input
                  type="email"
                  value={editSuperadminAffEmail}
                  onChange={(e) => setEditSuperadminAffEmail(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="superadmin@estudio.com"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Nombre del Superadmin AFF *
                </label>
                <input
                  type="text"
                  value={editSuperadminAffName}
                  onChange={(e) => setEditSuperadminAffName(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="Nombre completo"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  {isEditingSuperadminAff ? 'Nueva Contraseña (Opcional)' : 'Contraseña Temporal *'}
                </label>
                <input
                  type="password"
                  value={editSuperadminAffPassword}
                  onChange={(e) => setEditSuperadminAffPassword(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder={isEditingSuperadminAff ? 'Dejar vacío para mantener la actual' : 'Mínimo 6 caracteres'}
                  minLength={isEditingSuperadminAff ? 0 : 6}
                  required={!isEditingSuperadminAff}
                />
                {!isEditingSuperadminAff && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 ml-1 font-medium">
                    El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                  </p>
                )}
                {isEditingSuperadminAff && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 ml-1 font-medium">
                    Dejar vacío para mantener la contraseña actual.
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2.5 py-1 ml-1 select-none">
                <input
                  type="checkbox"
                  id="editSuperadminAffIsActive"
                  checked={editSuperadminAffIsActive}
                  onChange={(e) => setEditSuperadminAffIsActive(e.target.checked)}
                  className="w-4.5 h-4.5 text-purple-600 border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] rounded focus:ring-purple-500 focus:ring-offset-0 focus:outline-none transition-all duration-200 cursor-pointer"
                />
                <label htmlFor="editSuperadminAffIsActive" className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  Usuario activo
                </label>
              </div>

              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-full w-full mt-6 backdrop-blur-md">
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
                  className="flex-1 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 text-xs font-semibold uppercase tracking-wider border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={managingSuperadminAff}
                  className="flex-1 h-9 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-200 disabled:opacity-50 text-xs font-bold uppercase tracking-wider shadow-md shadow-purple-500/20 active:scale-95 border-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>
                    {managingSuperadminAff 
                      ? (isEditingSuperadminAff ? 'Actualizando...' : 'Creando...') 
                      : (isEditingSuperadminAff ? 'Actualizar' : 'Crear')}
                  </span>
                </button>
              </div>
            </form>
          </StandardModal>
        )}

        {/* Modal Editar Afiliado */}
        {showEditAffiliate && (
          <StandardModal
            isOpen={showEditAffiliate}
            onClose={() => {
              setShowEditAffiliate(false);
              setEditAffiliateName('');
              setEditAffiliateDescription('');
              setEditAffiliateCommission('');
              setEditAffiliateIsActive(true);
              setError('');
              setSuccess('');
            }}
            title={
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/10 border border-purple-400/20 flex-shrink-0">
                  <svg className="w-4 h-4 text-white drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <span className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Editar Estudio Afiliado</span>
              </div>
            }
            maxWidthClass="max-w-lg"
            paddingClass="p-6 sm:p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
            className="!rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/50 dark:border-white/10"
          >
            <div className="bg-black/[0.015] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-2 mb-4 select-none">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Estudio:</span>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{selectedAffiliateName}</span>
            </div>
            
            <form onSubmit={handleEditAffiliate} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-red-600 dark:text-red-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-300 font-semibold tracking-tight">{error}</p>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="bg-green-500/10 border border-green-500/20 backdrop-blur-md rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-green-600 dark:text-green-400">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-green-800 dark:text-green-300 font-semibold tracking-tight">{success}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Nombre del Estudio Afiliado *
                </label>
                <input
                  type="text"
                  value={editAffiliateName}
                  onChange={(e) => setEditAffiliateName(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="Ej: Estudio XYZ"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={editAffiliateDescription}
                  onChange={(e) => setEditAffiliateDescription(e.target.value)}
                  className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 py-2.5 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="Descripción del estudio afiliado..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 ml-1">
                  Porcentaje de Comisión (%) *
                </label>
                <input
                  type="number"
                  value={editAffiliateCommission}
                  onChange={(e) => setEditAffiliateCommission(e.target.value)}
                  className="h-10 w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-4 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:focus:ring-purple-400/50 focus:border-transparent transition-all duration-200 backdrop-blur-md shadow-inner"
                  placeholder="10.00"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 ml-1 font-medium">
                  Porcentaje que recibe Agencia Innova
                </p>
              </div>

              <div className="flex items-center space-x-2.5 py-1 ml-1 select-none">
                <input
                  type="checkbox"
                  id="editAffiliateIsActive"
                  checked={editAffiliateIsActive}
                  onChange={(e) => setEditAffiliateIsActive(e.target.checked)}
                  className="w-4.5 h-4.5 text-purple-600 border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] rounded focus:ring-purple-500 focus:ring-offset-0 focus:outline-none transition-all duration-200 cursor-pointer"
                />
                <label htmlFor="editAffiliateIsActive" className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  Estudio activo
                </label>
              </div>

              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-full w-full mt-6 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditAffiliate(false);
                    setEditAffiliateName('');
                    setEditAffiliateDescription('');
                    setEditAffiliateCommission('');
                    setEditAffiliateIsActive(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="flex-1 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 text-xs font-semibold uppercase tracking-wider border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editingAffiliate}
                  className="flex-1 h-9 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full hover:from-purple-500 hover:to-pink-500 transition-all duration-200 disabled:opacity-50 text-xs font-bold uppercase tracking-wider shadow-md shadow-purple-500/20 active:scale-95 border-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{editingAffiliate ? 'Actualizando...' : 'Actualizar'}</span>
                </button>
              </div>
            </form>
          </StandardModal>
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
    </div>
  );
}
