'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import AppleDropdown from '@/components/ui/AppleDropdown';
import { InfoCardGrid } from '@/components/ui/InfoCard';

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
  monto_disponible: number;
  medio_pago: string;
  estado: string;
  created_at: string;
  comentarios_admin?: string;
  comentarios_rechazo?: string;
}

export default function MisSolicitudesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
        );
        
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setUser(null);
          setLoading(false);
          return;
        }
        
        const { data: userRow } = await supabase
          .from('users')
          .select('id,name,email,role')
          .eq('id', uid)
          .single();
          
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'modelo',
        };
        setUser(current);

        // Cargar anticipos del usuario
        const { data: anticiposData, error: anticiposError } = await supabase
          .from('anticipos')
          .select('*')
          .eq('model_id', current.id)
          .order('created_at', { ascending: false });

        if (anticiposError) {
          console.error('Error cargando anticipos:', anticiposError);
          setError('Error al cargar las solicitudes');
        } else {
          setAnticipos(anticiposData || []);
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setError('Error al cargar los datos del usuario');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'aprobado': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'rechazado': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'realizado': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'cancelado': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'aprobado': return 'Aprobado';
      case 'rechazado': return 'Rechazado';
      case 'realizado': return 'Realizado';
      case 'cancelado': return 'Cancelado';
      default: return estado;
    }
  };

  const getPaymentMethodText = (medio: string) => {
    switch (medio) {
      case 'nequi': return 'Nequi';
      case 'daviplata': return 'Daviplata';
      case 'cuenta_bancaria': return 'Cuenta Bancaria';
      default: return medio;
    }
  };

  const filteredAnticipos = filterStatus === 'todos' 
    ? anticipos 
    : anticipos.filter(a => a.estado === filterStatus);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando solicitudes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Error</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
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
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              {/* Layout móvil: vertical, escritorio: horizontal */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                {/* Título e icono */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Mis Solicitudes
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      Revisa el estado de tus solicitudes de anticipo
                    </p>
                  </div>
                </div>

                {/* Botón - Ancho completo en móvil, auto en escritorio */}
                <button
                  onClick={() => window.location.href = '/admin/model/anticipos/solicitar'}
                  className="w-full md:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all duration-200 text-sm sm:text-base font-medium shadow-md hover:shadow-lg touch-manipulation"
                >
                  Nueva Solicitud
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 sm:mb-6">
          <div className="bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Filtrar por estado:</span>
              <div className="flex-1 sm:flex-initial">
                <AppleDropdown
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'pendiente', label: 'Pendientes' },
                    { value: 'aprobado', label: 'Aprobados' },
                    { value: 'rechazado', label: 'Rechazados' },
                    { value: 'realizado', label: 'Realizados' },
                    { value: 'cancelado', label: 'Cancelados' }
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="Seleccionar estado"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lista de anticipos */}
        <div className="bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600/20 overflow-hidden">
          {filteredAnticipos.length === 0 ? (
            <div className="p-6 sm:p-8 text-center">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No hay solicitudes
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4">
                {filterStatus === 'todos' 
                  ? 'No tienes solicitudes de anticipo registradas.'
                  : `No tienes solicitudes con estado "${getStatusText(filterStatus)}".`
                }
              </p>
              <button
                onClick={() => window.location.href = '/admin/model/anticipos/solicitar'}
                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all duration-200 text-sm sm:text-base font-medium shadow-md hover:shadow-lg touch-manipulation"
              >
                Crear Primera Solicitud
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-600">
              {filteredAnticipos.map((anticipo) => (
                <div key={anticipo.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-600/20 transition-colors">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    {/* Header de la solicitud */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(anticipo.estado)}`}>
                        {getStatusText(anticipo.estado)}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {new Date(anticipo.created_at).toLocaleDateString('es-CO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    {/* Información de la solicitud - Cards en móvil, Grid en escritorio */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Monto Solicitado</p>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                          ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Porcentaje</p>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {anticipo.porcentaje_solicitado}%
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Medio de Pago</p>
                        <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {getPaymentMethodText(anticipo.medio_pago)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Comentarios */}
                    {(anticipo.comentarios_admin || anticipo.comentarios_rechazo) && (
                      <div className="mt-2 sm:mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          <strong className="font-semibold">Comentarios:</strong> {anticipo.comentarios_admin || anticipo.comentarios_rechazo}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
