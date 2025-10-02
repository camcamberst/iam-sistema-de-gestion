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
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'realizado' | 'cancelado';
  nombre_beneficiario?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  banco?: string;
  banco_otro?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  documento_titular?: string;
  cedula_titular?: string;
  created_at: string;
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
    <div className="flex flex-wrap gap-x-3 text-xs text-gray-700 mt-1">
      {details.map((detail, i) => (
        <span key={i}>{detail}</span>
      ))}
    </div>
  );
};

export default function SolicitudesPendientesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'realizado' | 'confirmado'>('todos');

  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

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

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
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

  const loadAnticipos = async (adminId: string) => {
    try {
      // Cargar tanto pendientes como aprobadas
      const response = await fetch(`/api/anticipos?adminId=${adminId}&estado=pendiente,aprobado`);
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

  // Filtrar anticipos por estado
  const getAnticiposFiltrados = () => {
    if (estadoFiltro === 'todos') {
      return anticipos;
    }
    return anticipos.filter(anticipo => anticipo.estado === estadoFiltro);
  };

  const handleAction = async (anticipoId: string, action: 'aprobado' | 'rechazado' | 'realizado', comentarios?: string) => {
    try {
      setProcessing(anticipoId);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/anticipos/${anticipoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: action,
          comentarios_admin: action === 'aprobado' ? comentarios : undefined,
          comentarios_rechazo: action === 'rechazado' ? comentarios : undefined,
          admin_id: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Solicitud ${action} correctamente`);
        // Recargar la lista
        await loadAnticipos(user?.id || '');
      } else {
        setError(data.error || `Error al ${action} solicitud`);
      }
    } catch (error) {
      console.error(`Error ${action} anticipo:`, error);
      setError(`Error al ${action} solicitud`);
    } finally {
      setProcessing(null);
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

  const getMedioPagoInfo = (anticipo: Anticipo) => {
    if (anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata') {
      return {
        tipo: anticipo.medio_pago.toUpperCase(),
        info: `${anticipo.nombre_beneficiario} - ${anticipo.numero_telefono}`
      };
    } else {
      return {
        tipo: 'Cuenta Bancaria',
        info: `${anticipo.banco} - ${anticipo.tipo_cuenta} - ${anticipo.numero_cuenta}`
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Gestión de Solicitudes</h1>
          <p className="text-gray-600">Gestiona las solicitudes de anticipo de tu grupo</p>
          
          {/* Filtro de Estado */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por estado:</label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as 'todos' | 'pendiente' | 'aprobado' | 'realizado' | 'confirmado')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobadas</option>
              <option value="realizado">Realizadas</option>
              <option value="confirmado">Confirmadas</option>
            </select>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-medium">Éxito</span>
            </div>
            <p className="text-green-700 text-sm mt-1">{success}</p>
          </div>
        )}

        {/* Lista de Solicitudes */}
        {anticipos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-8 px-6">
            <svg className="w-8 h-8 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay solicitudes pendientes</h3>
            <p className="text-gray-500">Todas las solicitudes han sido procesadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {getAnticiposFiltrados().map((anticipo) => {
              const medioPagoInfo = getMedioPagoInfo(anticipo);
              
              return (
                <div key={anticipo.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {/* Primera línea: Modelo y monto */}
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {anticipo.model.name}
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-gray-900">
                            ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                          </div>
                        </div>
                      </div>

                      {/* Segunda línea: Información compacta */}
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center space-x-3">
                          <span><span className="font-medium">Medio:</span> {medioPagoInfo.tipo}</span>
                          <span><span className="font-medium">%:</span> {anticipo.porcentaje_solicitado.toFixed(1)}%</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(anticipo.created_at).toLocaleDateString('es-CO')}
                        </div>
                      </div>
                    </div>

                    {/* Datos de transferencia */}
                    {renderTransferDetails(anticipo)}

                    {/* Botones de acción compactos */}
                    <div className="ml-2 flex space-x-1">
                      {anticipo.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={() => {
                              const comentarios = prompt('Comentarios (opcional):');
                              handleAction(anticipo.id, 'aprobado', comentarios || undefined);
                            }}
                            disabled={processing === anticipo.id}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            {processing === anticipo.id ? '...' : 'Aprobar'}
                          </button>
                          
                          <button
                            onClick={() => {
                              const comentarios = prompt('Motivo del rechazo:');
                              if (comentarios) {
                                handleAction(anticipo.id, 'rechazado', comentarios);
                              }
                            }}
                            disabled={processing === anticipo.id}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      
                      {anticipo.estado === 'aprobado' && (
                        <button
                          onClick={() => {
                            const confirmar = confirm('¿Confirmas que el anticipo ha sido realizado/pagado?');
                            if (confirmar) {
                              handleAction(anticipo.id, 'realizado');
                            }
                          }}
                          disabled={processing === anticipo.id}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {processing === anticipo.id ? '...' : 'Realizado'}
                        </button>
                      )}

                      {anticipo.estado === 'realizado' && (
                        <div className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">
                          Esperando confirmación de la modelo
                        </div>
                      )}

                      {anticipo.estado === 'confirmado' && (
                        <div className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">
                          Confirmado por la modelo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botón para historial */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/admin/anticipos/history')}
            className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all duration-200 font-medium shadow-sm"
          >
            Ver Historial
          </button>
        </div>
      </div>
    </div>
  );
}
