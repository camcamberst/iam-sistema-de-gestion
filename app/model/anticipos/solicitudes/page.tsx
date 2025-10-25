"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Anticipo {
  id: string;
  monto_solicitado: number;
  porcentaje_solicitado: number;
  medio_pago: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'realizado' | 'confirmado' | 'cancelado';
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  realized_at?: string;
  cancelled_at?: string;
  // Datos de transferencia
  nombre_beneficiario?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  cedula_titular?: string;
  model: {
    id: string;
    name: string;
    email: string;
  };
  period: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

const renderTransferDetails = (anticipo: Anticipo) => {
  let details: string[] = [];

  // Siempre mostrar el beneficiario si está disponible
  if (anticipo.nombre_beneficiario) {
    details.push(`Beneficiario: ${anticipo.nombre_beneficiario}`);
  }

  if (anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata') {
    if (anticipo.numero_telefono) details.push(`Tel: ${anticipo.numero_telefono}`);
  } else if (anticipo.banco && anticipo.numero_cuenta) {
    details.push(`Banco: ${anticipo.banco}`);
    details.push(`Cuenta: ${anticipo.numero_cuenta}`);
    if (anticipo.tipo_cuenta) details.push(`Tipo: ${anticipo.tipo_cuenta}`);
    if (anticipo.nombre_titular) details.push(`Titular de la cuenta: ${anticipo.nombre_titular}`);
    if (anticipo.cedula_titular) details.push(`Cédula: ${anticipo.cedula_titular}`);
  }

  if (details.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 text-xs text-gray-700 dark:text-gray-300 mt-1">
      {details.map((detail, i) => (
        <span key={i}>{detail}</span>
      ))}
    </div>
  );
};

export default function MisSolicitudesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

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

      if (!userData || userData.role !== 'modelo') {
        router.push('/login');
        return;
      }

      setUser(userData);
      await loadAnticipos(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadAnticipos = async (userId: string) => {
    try {
      // Mostrar solo solicitudes activas en proceso: pendiente, aprobado, realizado
      const response = await fetch(`/api/anticipos?modelId=${userId}&estado=pendiente,aprobado,realizado`);
      const data = await response.json();
      
      if (data.success) {
        setAnticipos(data.data || []);
      } else {
        setError(data.error || 'Error al cargar solicitudes');
      }
    } catch (error) {
      console.error('Error loading anticipos:', error);
      setError('Error al cargar solicitudes');
    }
  };

  const handleCancel = async (anticipoId: string) => {
    if (!confirm('¿Estás seguro de que quieres cancelar esta solicitud?')) {
      return;
    }

    try {
      setCancelling(anticipoId);
      setError(null);

      const response = await fetch(`/api/anticipos/${anticipoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'cancelado',
          admin_id: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Recargar la lista
        await loadAnticipos(user?.id || '');
      } else {
        setError(data.error || 'Error al cancelar solicitud');
      }
    } catch (error) {
      console.error('Error cancelling anticipo:', error);
      setError('Error al cancelar solicitud');
    } finally {
      setCancelling(null);
    }
  };

  const handleConfirm = async (anticipoId: string) => {
    if (!confirm('¿Confirmas que recibiste el anticipo?')) {
      return;
    }

    try {
      setCancelling(anticipoId);
      setError(null);

      const response = await fetch(`/api/anticipos/${anticipoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'confirmado',
          model_id: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Recargar la lista
        await loadAnticipos(user?.id || '');
      } else {
        setError(data.error || 'Error al confirmar anticipo');
      }
    } catch (error) {
      console.error('Error confirming anticipo:', error);
      setError('Error al confirmar anticipo');
    } finally {
      setCancelling(null);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'aprobado':
        return 'bg-blue-100 text-blue-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      case 'realizado':
        return 'bg-green-100 text-green-800';
      case 'confirmado':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelado':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'aprobado':
        return 'Aprobado';
      case 'rechazado':
        return 'Rechazado';
      case 'realizado':
        return 'Realizado';
      case 'confirmado':
        return 'Confirmado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return estado;
    }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-300 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Mis Solicitudes
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Gestiona tus solicitudes de anticipo
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Acceso: <span className="font-medium text-blue-600 dark:text-blue-400">Modelo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 dark:text-red-400 font-medium">Error</span>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Lista de Solicitudes */}
        {anticipos.length === 0 ? (
          <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-600/20 text-center py-8 px-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay solicitudes</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Aún no has realizado ninguna solicitud de anticipo</p>
            <button
              onClick={() => router.push('/model/anticipos/solicitar')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md"
            >
              Solicitar Anticipo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {anticipos.map((anticipo) => (
              <div key={anticipo.id} className="bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600/20 p-3 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/* Primera línea: Monto y Estado */}
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(anticipo.estado)}`}>
                        {getEstadoLabel(anticipo.estado)}
                      </span>
                    </div>
                    
                    {/* Segunda línea: Información compacta */}
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span><span className="font-medium">Medio:</span> {anticipo.medio_pago.toUpperCase()}</span>
                      <span className="text-gray-500 dark:text-gray-400">{new Date(anticipo.created_at).toLocaleDateString('es-CO')}</span>
                    </div>

                    {/* Datos de transferencia */}
                    {renderTransferDetails(anticipo)}

                    {/* Comentarios compactos - solo si existen */}
                    {anticipo.comentarios_admin && (
                      <div className="mt-1 p-1 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-800 dark:text-blue-300">
                        <span className="font-medium">Admin:</span> {anticipo.comentarios_admin}
                      </div>
                    )}

                    {anticipo.comentarios_rechazo && (
                      <div className="mt-1 p-1 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-300">
                        <span className="font-medium">Rechazo:</span> {anticipo.comentarios_rechazo}
                      </div>
                    )}
                  </div>

                  {/* Botones de acción compactos */}
                  {anticipo.estado === 'pendiente' && (
                    <div className="ml-2">
                      <button
                        onClick={() => handleCancel(anticipo.id)}
                        disabled={cancelling === anticipo.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-red-500 to-red-600 rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                      >
                        {cancelling === anticipo.id ? '...' : 'Cancelar'}
                      </button>
                    </div>
                  )}

                  {anticipo.estado === 'realizado' && (
                    <div className="ml-2">
                      <button
                        onClick={() => handleConfirm(anticipo.id)}
                        disabled={cancelling === anticipo.id}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-green-500 to-green-600 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                      >
                        {cancelling === anticipo.id ? '...' : 'Confirmar'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botón para nueva solicitud */}
        {anticipos.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/model/anticipos/solicitar')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md"
            >
              Nueva Solicitud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
