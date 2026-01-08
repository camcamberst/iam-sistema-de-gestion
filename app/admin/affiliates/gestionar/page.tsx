"use client";

import { useState, useEffect } from 'react';
import StandardModal from '@/components/ui/StandardModal';

export default function GestionarAfiliadosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState<string>('');
  
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

  // Cargar información del usuario
  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userDataStr = localStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        setUserRole(userData.role || '');
      }
    } catch (err) {
      console.error('Error cargando información del usuario:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAffiliateName.trim()) return;

    setCreatingAffiliate(true);
    setError('');
    setSuccess('');
    
    try {
      // Obtener token de autorización
      const token = localStorage.getItem('supabase.auth.token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

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
        // Recargar datos si es necesario
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Gestión de Afiliados
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Administra estudios afiliados y sus configuraciones
              </p>
            </div>
            <button
              onClick={() => setShowCreateAffiliate(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Crear Nuevo Afiliado</span>
            </button>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/20 p-6">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Gestión de Afiliados
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Aquí podrás gestionar todos los estudios afiliados. Las funcionalidades adicionales se irán agregando próximamente.
            </p>
            <button
              onClick={() => setShowCreateAffiliate(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium"
            >
              Crear Nuevo Afiliado
            </button>
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
      </div>
    </div>
  );
}
