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

interface Savings {
  id: string;
  period_date: string;
  period_type: '1-15' | '16-31';
  neto_pagar_base: number;
  monto_ahorrado: number;
  monto_ajustado?: number;
  porcentaje_ahorrado: number;
  tipo_solicitud: 'monto' | 'porcentaje';
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  model: {
    id: string;
    name: string;
    email: string;
  };
}

export default function GestionAhorrosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('pendiente');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [grupos, setGrupos] = useState<Array<{id: string, name: string}>>([]);
  const [filteredSavings, setFilteredSavings] = useState<Savings[]>([]);
  
  // Estados para aprobación/rechazo
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState<Savings | null>(null);
  const [montoAjustado, setMontoAjustado] = useState<string>('');
  const [comentarios, setComentarios] = useState<string>('');

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadSavings();
      loadGroups();
    }
  }, [user, estadoFiltro]);

  useEffect(() => {
    if (savings.length > 0 || searchQuery || grupoFiltro !== 'todos') {
      applyFilters(savings, searchQuery, grupoFiltro);
    } else {
      setFilteredSavings(savings);
    }
  }, [searchQuery, grupoFiltro, savings]);

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

  const loadSavings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const estadoParam = estadoFiltro === 'todos' ? '' : estadoFiltro;
      const response = await fetch(`/api/admin/savings?estado=${estadoParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        const savingsData = data.savings || [];
        setSavings(savingsData);
        applyFilters(savingsData, searchQuery, grupoFiltro);
      } else {
        setError(data.error || 'Error al cargar solicitudes');
      }
    } catch (error) {
      console.error('Error loading savings:', error);
      setError('Error de conexión');
    }
  };

  const loadGroups = async () => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');

      if (!groupsError && groupsData) {
        setGrupos(groupsData);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const applyFilters = (savingsList: Savings[], query: string, grupo: string) => {
    let filtered = [...savingsList];

    // Filtro por búsqueda de texto (nombre o email de modelo)
    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.model.name.toLowerCase().includes(searchTerm) ||
        s.model.email.toLowerCase().includes(searchTerm)
      );
    }

    // Filtro por grupo (se aplicará cuando tengamos la información de grupos de modelos)
    // Por ahora, solo aplicamos el filtro de texto
    setFilteredSavings(filtered);
  };

  const handleApprove = async () => {
    if (!selectedSavings || !user) {
      setError('No hay solicitud seleccionada');
      return;
    }

    setProcessing(selectedSavings.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const montoAjustadoNum = montoAjustado ? parseFloat(montoAjustado.replace(/[^\d]/g, '')) : undefined;

      const response = await fetch(`/api/admin/savings/${selectedSavings.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: 'aprobado',
          comentarios_admin: comentarios,
          monto_ajustado: montoAjustadoNum,
          admin_id: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Solicitud de ahorro aprobada exitosamente');
        setShowApproveModal(false);
        setSelectedSavings(null);
        setMontoAjustado('');
        setComentarios('');
        await loadSavings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al aprobar solicitud');
      }
    } catch (error: any) {
      console.error('Error approving:', error);
      setError(error.message || 'Error de conexión');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (saving: Savings) => {
    if (!user) return;

    const motivo = prompt('Ingresa el motivo del rechazo:');
    if (!motivo) return;

    setProcessing(saving.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch(`/api/admin/savings/${saving.id}/approve`, {
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
        setSuccess('Solicitud de ahorro rechazada');
        await loadSavings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al rechazar solicitud');
      }
    } catch (error: any) {
      console.error('Error rejecting:', error);
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
      day: 'numeric'
    });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Gestión de Ahorros
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Revisa y gestiona las solicitudes de ahorro de las modelos
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-wrap gap-3">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
                  />
                  <AppleDropdown
                    options={[
                      { value: 'pendiente', label: 'Pendientes' },
                      { value: 'aprobado', label: 'Aprobadas' },
                      { value: 'rechazado', label: 'Rechazadas' },
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

        {/* Lista de solicitudes */}
        <div className="space-y-4">
          {savings.length === 0 ? (
            <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-12 border border-white/20 dark:border-gray-600/20 shadow-md text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No hay solicitudes de ahorro
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {estadoFiltro === 'pendiente' 
                  ? 'No hay solicitudes pendientes de revisión'
                  : 'No hay solicitudes con este estado'}
              </p>
            </div>
          ) : (
            filteredSavings.map((saving) => (
              <div
                key={saving.id}
                className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        saving.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        saving.estado === 'aprobado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {saving.estado === 'pendiente' ? 'Pendiente' :
                         saving.estado === 'aprobado' ? 'Aprobado' :
                         'Rechazado'}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {saving.model.name}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Período</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatDate(saving.period_date)} ({saving.period_type === '1-15' ? 'P1' : 'P2'})
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">NETO A PAGAR</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(saving.neto_pagar_base)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monto Solicitado</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(saving.monto_ahorrado)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Porcentaje</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {saving.porcentaje_ahorrado.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {saving.monto_ajustado && saving.monto_ajustado !== saving.monto_ahorrado && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          Monto ajustado por admin: {formatCurrency(saving.monto_ajustado)}
                        </p>
                      </div>
                    )}

                    {saving.comentarios_admin && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Comentarios del Admin</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{saving.comentarios_admin}</p>
                      </div>
                    )}

                    {saving.comentarios_rechazo && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-xs text-red-700 dark:text-red-300 font-medium mb-1">Motivo del rechazo</p>
                        <p className="text-sm text-red-600 dark:text-red-400">{saving.comentarios_rechazo}</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Solicitud creada: {formatDate(saving.created_at)}
                    </p>
                  </div>

                  {saving.estado === 'pendiente' && (
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => {
                          setSelectedSavings(saving);
                          setMontoAjustado('');
                          setComentarios('');
                          setShowApproveModal(true);
                        }}
                        disabled={processing === saving.id}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processing === saving.id ? 'Procesando...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => handleReject(saving)}
                        disabled={processing === saving.id}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg hover:from-red-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal de Aprobación */}
        {showApproveModal && selectedSavings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Aprobar Solicitud de Ahorro
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Modelo: <strong>{selectedSavings.model.name}</strong>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Monto solicitado: <strong>{formatCurrency(selectedSavings.monto_ahorrado)}</strong>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    NETO A PAGAR: <strong>{formatCurrency(selectedSavings.neto_pagar_base)}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Monto Ajustado (Opcional)
                  </label>
                  <input
                    type="text"
                    value={montoAjustado}
                    onChange={(e) => setMontoAjustado(e.target.value)}
                    placeholder={formatCurrency(selectedSavings.monto_ahorrado)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Deja vacío para usar el monto solicitado. Ajusta si es necesario.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Comentarios (Opcional)
                  </label>
                  <textarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="Comentarios adicionales..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleApprove}
                    disabled={processing === selectedSavings.id}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing === selectedSavings.id ? 'Aprobando...' : 'Aprobar Ahorro'}
                  </button>
                  <button
                    onClick={() => {
                      setShowApproveModal(false);
                      setSelectedSavings(null);
                      setMontoAjustado('');
                      setComentarios('');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300 font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
