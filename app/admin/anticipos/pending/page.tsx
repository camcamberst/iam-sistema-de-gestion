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

export default function SolicitudesPendientesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const response = await fetch(`/api/anticipos?adminId=${adminId}&estado=pendiente`);
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
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Solicitudes Pendientes</h1>
          <p className="text-gray-600">Gestiona las solicitudes de anticipo de tu grupo</p>
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
          <div className="apple-card text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay solicitudes pendientes</h3>
            <p className="text-gray-500">Todas las solicitudes han sido procesadas</p>
          </div>
        ) : (
          <div className="space-y-6">
            {anticipos.map((anticipo) => {
              const medioPagoInfo = getMedioPagoInfo(anticipo);
              
              return (
                <div key={anticipo.id} className="apple-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header con modelo y monto */}
                      <div className="flex items-center space-x-3 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {anticipo.model.name}
                          </h3>
                          <p className="text-sm text-gray-500">{anticipo.model.email}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">
                            ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                          </div>
                          <div className="text-sm text-gray-500">
                            {anticipo.porcentaje_solicitado.toFixed(1)}% del anticipo disponible
                          </div>
                        </div>
                      </div>

                      {/* Información del anticipo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                        <div>
                          <span className="font-medium">Medio de pago:</span> {medioPagoInfo.tipo}
                        </div>
                        <div>
                          <span className="font-medium">Información:</span> {medioPagoInfo.info}
                        </div>
                        <div>
                          <span className="font-medium">Solicitado:</span> {formatDate(anticipo.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Período:</span> {anticipo.period.name}
                        </div>
                      </div>

                      {/* Datos bancarios detallados */}
                      {anticipo.medio_pago === 'cuenta_bancaria' && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                          <h4 className="font-medium text-gray-900 mb-2">Datos Bancarios</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div><span className="font-medium">Titular:</span> {anticipo.nombre_titular}</div>
                            <div><span className="font-medium">Banco:</span> {anticipo.banco_otro || anticipo.banco}</div>
                            <div><span className="font-medium">Tipo:</span> {anticipo.tipo_cuenta}</div>
                            <div><span className="font-medium">Cuenta:</span> {anticipo.numero_cuenta}</div>
                            <div><span className="font-medium">Documento:</span> {anticipo.documento_titular}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="ml-6 flex flex-col space-y-2">
                      <button
                        onClick={() => {
                          const comentarios = prompt('Comentarios (opcional):');
                          handleAction(anticipo.id, 'aprobado', comentarios || undefined);
                        }}
                        disabled={processing === anticipo.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {processing === anticipo.id ? 'Procesando...' : 'Aprobar'}
                      </button>
                      
                      <button
                        onClick={() => {
                          const comentarios = prompt('Motivo del rechazo:');
                          if (comentarios) {
                            handleAction(anticipo.id, 'rechazado', comentarios);
                          }
                        }}
                        disabled={processing === anticipo.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Botón para historial */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/admin/anticipos/history')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
          >
            Ver Historial
          </button>
        </div>
      </div>
    </div>
  );
}
