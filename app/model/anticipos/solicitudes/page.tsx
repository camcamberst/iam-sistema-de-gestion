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
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  realized_at?: string;
  cancelled_at?: string;
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

export default function MisSolicitudesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const response = await fetch(`/api/anticipos?modelId=${userId}`);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Mis Solicitudes</h1>
          <p className="text-gray-600">Gestiona tus solicitudes de anticipo</p>
        </div>

        {/* Error Message */}
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

        {/* Lista de Solicitudes */}
        {anticipos.length === 0 ? (
          <div className="apple-card text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay solicitudes</h3>
            <p className="text-gray-500 mb-6">Aún no has realizado ninguna solicitud de anticipo</p>
            <button
              onClick={() => router.push('/model/anticipos/solicitar')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Solicitar Anticipo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {anticipos.map((anticipo) => (
              <div key={anticipo.id} className="apple-card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(anticipo.estado)}`}>
                        {getEstadoLabel(anticipo.estado)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Medio de pago:</span> {anticipo.medio_pago.toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">Porcentaje:</span> {anticipo.porcentaje_solicitado.toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium">Solicitado:</span> {formatDate(anticipo.created_at)}
                      </div>
                      {anticipo.approved_at && (
                        <div>
                          <span className="font-medium">Aprobado:</span> {formatDate(anticipo.approved_at)}
                        </div>
                      )}
                      {anticipo.rejected_at && (
                        <div>
                          <span className="font-medium">Rechazado:</span> {formatDate(anticipo.rejected_at)}
                        </div>
                      )}
                      {anticipo.realized_at && (
                        <div>
                          <span className="font-medium">Realizado:</span> {formatDate(anticipo.realized_at)}
                        </div>
                      )}
                      {anticipo.cancelled_at && (
                        <div>
                          <span className="font-medium">Cancelado:</span> {formatDate(anticipo.cancelled_at)}
                        </div>
                      )}
                    </div>

                    {/* Comentarios */}
                    {anticipo.comentarios_admin && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <span className="font-medium">Comentarios del admin:</span> {anticipo.comentarios_admin}
                        </p>
                      </div>
                    )}

                    {anticipo.comentarios_rechazo && (
                      <div className="mt-3 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Motivo del rechazo:</span> {anticipo.comentarios_rechazo}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Botón de cancelar */}
                  {anticipo.estado === 'pendiente' && (
                    <div className="ml-4">
                      <button
                        onClick={() => handleCancel(anticipo.id)}
                        disabled={cancelling === anticipo.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        {cancelling === anticipo.id ? 'Cancelando...' : 'Cancelar'}
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
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/model/anticipos/solicitar')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Nueva Solicitud
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
