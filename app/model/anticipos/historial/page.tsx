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
  estado: 'realizado';
  comentarios_admin?: string;
  created_at: string;
  realized_at: string;
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

export default function MiHistorialPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalRealizado, setTotalRealizado] = useState(0);

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
      // Solo cargar anticipos realizados
      const response = await fetch(`/api/anticipos?modelId=${userId}&estado=realizado`);
      const data = await response.json();
      
      if (data.success) {
        const anticiposRealizados = data.data || [];
        setAnticipos(anticiposRealizados);
        
        // Calcular total realizado
        const total = anticiposRealizados.reduce((sum: number, anticipo: Anticipo) => 
          sum + anticipo.monto_solicitado, 0
        );
        setTotalRealizado(total);
      } else {
        setError(data.error || 'Error al cargar historial');
      }
    } catch (error) {
      console.error('Error loading anticipos:', error);
      setError('Error al cargar historial');
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

  const formatPeriod = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })} - Período ${start.getDate() <= 15 ? '1' : '2'}`;
    }
    
    return `${start.toLocaleDateString('es-CO', { month: 'short' })} - ${end.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`;
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header con botón de regreso */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Regresar
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Mi Historial</h1>
          <p className="text-gray-600">Anticipos realizados y pagados</p>
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

        {/* Resumen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                ${totalRealizado.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-gray-600">Total Realizado</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {anticipos.length}
              </div>
              <div className="text-sm text-gray-600">Anticipos Pagados</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {anticipos.length > 0 ? (totalRealizado / anticipos.length).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 0}
              </div>
              <div className="text-sm text-gray-600">Promedio por Anticipo</div>
            </div>
          </div>
        </div>

        {/* Lista de Anticipos Realizados */}
        {anticipos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-8 px-6">
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay anticipos realizados</h3>
            <p className="text-gray-500">Aún no tienes anticipos que hayan sido pagados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {anticipos.map((anticipo) => (
              <div key={anticipo.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                      </h3>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Realizado
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
                        <span className="font-medium">Período:</span> {formatPeriod(anticipo.period.start_date, anticipo.period.end_date)}
                      </div>
                      <div>
                        <span className="font-medium">Solicitado:</span> {formatDate(anticipo.created_at)}
                      </div>
                      <div>
                        <span className="font-medium">Realizado:</span> {formatDate(anticipo.realized_at)}
                      </div>
                    </div>

                    {/* Comentarios del admin */}
                    {anticipo.comentarios_admin && (
                      <div className="mt-3 p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-800">
                          <span className="font-medium">Comentarios del admin:</span> {anticipo.comentarios_admin}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Icono de realizado */}
                  <div className="ml-4 flex items-center">
                    <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botones de navegación */}
        <div className="mt-6 flex justify-center space-x-3">
          <button
            onClick={() => router.push('/model/anticipos/solicitudes')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium"
          >
            Mis Solicitudes
          </button>
          <button
            onClick={() => router.push('/model/anticipos/solicitar')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium"
          >
            Nueva Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
