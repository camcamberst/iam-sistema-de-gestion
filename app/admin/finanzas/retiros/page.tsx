"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AppleDropdown from '@/components/ui/AppleDropdown';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Withdrawal {
  id: string;
  monto_solicitado: number;
  porcentaje_retiro: number;
  medio_pago: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'realizado' | 'cancelado';
  tiempo_procesamiento?: string;
  fecha_aprobacion_estimada?: string;
  nombre_beneficiario?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  banco?: string;
  banco_otro?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  documento_titular?: string;
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  realized_at?: string;
  model: {
    id: string;
    name: string;
    email: string;
  };
}

export default function GestionRetirosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'realizado' | 'rechazado'>('pendiente');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Withdrawal[]>([]);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadWithdrawals();
    }
  }, [user, estadoFiltro]);

  useEffect(() => {
    if (withdrawals.length > 0 || searchQuery) {
      applyFilters(withdrawals, searchQuery);
    } else {
      setFilteredWithdrawals(withdrawals);
    }
  }, [searchQuery, withdrawals]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        router.push('/login');
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (withdrawalsList: Withdrawal[], query: string) => {
    let filtered = [...withdrawalsList];

    // Filtro por búsqueda de texto (nombre o email de modelo)
    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      filtered = filtered.filter(w => 
        w.model.name.toLowerCase().includes(searchTerm) ||
        w.model.email.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredWithdrawals(filtered);
  };

  const loadWithdrawals = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      // Obtener retiros (filtrado por grupos si es admin)
      const estadoParam = estadoFiltro === 'todos' ? '' : estadoFiltro;
      const response = await fetch(`/api/admin/savings/withdrawals?estado=${estadoParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        setWithdrawals(data.withdrawals || []);
      } else {
        setError(data.error || 'Error al cargar retiros');
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      setError('Error de conexión');
    }
  };

  const handleApprove = async (withdrawal: Withdrawal) => {
    if (!user) return;

    setProcessing(withdrawal.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch(`/api/admin/savings/withdrawals/${withdrawal.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: 'aprobado',
          comentarios_admin: '',
          admin_id: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Retiro aprobado exitosamente');
        await loadWithdrawals();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al aprobar retiro');
      }
    } catch (error: any) {
      console.error('Error approving:', error);
      setError(error.message || 'Error de conexión');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (withdrawal: Withdrawal) => {
    if (!user) return;

    const motivo = prompt('Ingresa el motivo del rechazo:');
    if (!motivo) return;

    setProcessing(withdrawal.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch(`/api/admin/savings/withdrawals/${withdrawal.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: 'rechazado',
          comentarios_rechazo: motivo,
          admin_id: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Retiro rechazado');
        await loadWithdrawals();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al rechazar retiro');
      }
    } catch (error: any) {
      console.error('Error rejecting:', error);
      setError(error.message || 'Error de conexión');
    } finally {
      setProcessing(null);
    }
  };

  const handleMarkAsRealized = async (withdrawal: Withdrawal) => {
    if (!user) return;

    if (!confirm('¿Confirmas que el retiro ha sido procesado y enviado?')) return;

    setProcessing(withdrawal.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch(`/api/admin/savings/withdrawals/${withdrawal.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: 'realizado',
          admin_id: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Retiro marcado como realizado');
        await loadWithdrawals();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al marcar como realizado');
      }
    } catch (error: any) {
      console.error('Error marking as realized:', error);
      setError(error.message || 'Error de conexión');
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
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
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-red-500/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-purple-900/15 dark:ring-0.5 dark:ring-purple-400/20">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Gestión de Retiros
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Revisa y gestiona las solicitudes de retiro de ahorros
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-wrap gap-3">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[200px]"
                  />
                  <AppleDropdown
                    options={[
                      { value: 'pendiente', label: 'Pendientes' },
                      { value: 'aprobado', label: 'Aprobados' },
                      { value: 'realizado', label: 'Realizados' },
                      { value: 'rechazado', label: 'Rechazados' },
                      { value: 'todos', label: 'Todas' }
                    ]}
                    value={estadoFiltro}
                    onChange={(value) => setEstadoFiltro(value as any)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

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

        {/* Lista de retiros */}
        <div className="space-y-4">
          {withdrawals.length === 0 ? (
            <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-12 border border-white/20 dark:border-gray-600/20 shadow-md text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No hay solicitudes de retiro
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {estadoFiltro === 'pendiente' 
                  ? 'No hay retiros pendientes de revisión'
                  : 'No hay retiros con este estado'}
              </p>
            </div>
          ) : (
            filteredWithdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-purple-900/10 dark:ring-0.5 dark:ring-purple-500/15"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        withdrawal.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        withdrawal.estado === 'aprobado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        withdrawal.estado === 'realizado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {withdrawal.estado === 'pendiente' ? 'Pendiente' :
                         withdrawal.estado === 'aprobado' ? 'Aprobado' :
                         withdrawal.estado === 'realizado' ? 'Realizado' :
                         'Rechazado'}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {withdrawal.model.name}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monto</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(withdrawal.monto_solicitado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Porcentaje</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {withdrawal.porcentaje_retiro.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Medio de Pago</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                          {withdrawal.medio_pago === 'nequi' ? 'Nequi' :
                           withdrawal.medio_pago === 'daviplata' ? 'DaviPlata' :
                           'Cuenta Bancaria'}
                        </p>
                      </div>
                      {withdrawal.tiempo_procesamiento && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tiempo Estimado</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {withdrawal.tiempo_procesamiento}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Datos de pago */}
                    <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      {withdrawal.medio_pago === 'nequi' || withdrawal.medio_pago === 'daviplata' ? (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Beneficiario: <span className="font-medium text-gray-900 dark:text-gray-100">{withdrawal.nombre_beneficiario}</span></p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Teléfono: <span className="font-medium text-gray-900 dark:text-gray-100">{withdrawal.numero_telefono}</span></p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Titular: <span className="font-medium text-gray-900 dark:text-gray-100">{withdrawal.nombre_titular}</span></p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Banco: <span className="font-medium text-gray-900 dark:text-gray-100">{withdrawal.banco === 'Otros' ? withdrawal.banco_otro : withdrawal.banco}</span></p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Cuenta: <span className="font-medium text-gray-900 dark:text-gray-100">{withdrawal.numero_cuenta} ({withdrawal.tipo_cuenta})</span></p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Documento: <span className="font-medium text-gray-900 dark:text-gray-100">{withdrawal.documento_titular}</span></p>
                        </div>
                      )}
                    </div>

                    {withdrawal.comentarios_rechazo && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">Motivo del rechazo</p>
                        <p className="text-sm text-red-600 dark:text-red-400">{withdrawal.comentarios_rechazo}</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Solicitud creada: {formatDate(withdrawal.created_at)}
                      {withdrawal.approved_at && ` • Aprobado: ${formatDate(withdrawal.approved_at)}`}
                      {withdrawal.realized_at && ` • Realizado: ${formatDate(withdrawal.realized_at)}`}
                    </p>
                  </div>

                  {withdrawal.estado === 'pendiente' && (
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleApprove(withdrawal)}
                        disabled={processing === withdrawal.id}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing === withdrawal.id ? 'Procesando...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => handleReject(withdrawal)}
                        disabled={processing === withdrawal.id}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}

                  {withdrawal.estado === 'aprobado' && (
                    <div className="ml-4">
                      <button
                        onClick={() => handleMarkAsRealized(withdrawal)}
                        disabled={processing === withdrawal.id}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing === withdrawal.id ? 'Procesando...' : 'Marcar como Realizado'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
