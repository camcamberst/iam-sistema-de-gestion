"use client";

import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getModelDisplayName } from '@/utils/model-display';

interface PlatformRequest {
  id: string;
  model_id: string;
  model_email: string;
  platform_name: string;
  status: 'solicitada' | 'pendiente' | 'entregada' | 'inviable';
  requested_at: string;
  delivered_at?: string;
  confirmed_at?: string;
  deactivated_at?: string;
  reverted_at?: string;
  updated_at: string;
  notes?: string;
  group_name: string;
}

interface PlatformTimelineProps {
  userRole: 'admin' | 'super_admin';
  userGroups?: string[];
}

export default function PlatformTimeline({ userRole, userGroups }: PlatformTimelineProps) {
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTimelineData();
  }, [userRole, userGroups]);

  // Debug temporal: verificar fechas
  useEffect(() => {
    if (requests.length > 0) {
      console.log('🔍 Timeline requests con fechas:', requests.map(req => ({
        id: req.id,
        status: req.status,
        requested_at: req.requested_at,
        delivered_at: req.delivered_at,
        confirmed_at: req.confirmed_at,
        deactivated_at: req.deactivated_at,
        reverted_at: req.reverted_at,
        updated_at: req.updated_at
      })));
    }
  }, [requests]);


  const loadTimelineData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/modelo-plataformas/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRole,
          userGroups: userGroups || []
        })
      });

      if (!response.ok) {
        throw new Error('Error al cargar timeline');
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/modelo-plataformas/timeline/${requestId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Error al cerrar solicitud');
      }

      // Recargar datos
      await loadTimelineData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar solicitud');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'solicitada': return '#93c5fd'; // blue-300
      case 'pendiente': return '#fde047'; // yellow-300
      case 'entregada': return '#86efac'; // green-300
      case 'inviable': return '#fca5a5'; // red-300
      default: return '#e2e8f0'; // slate-200
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'solicitada': return <Clock className="w-4 h-4" />;
      case 'pendiente': return <Clock className="w-4 h-4" />;
      case 'entregada': return <CheckCircle className="w-4 h-4" />;
      case 'inviable': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const canClose = (status: string) => {
    return status === 'entregada' || status === 'inviable';
  };

  if (loading) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300 text-sm">Cargando timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-4">
        <div className="text-center py-4">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-700/20 p-4" style={{ overflow: 'visible' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
          <Clock className="w-4 h-4 mr-2" />
          Timeline Portafolio Modelos
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-300">
          {requests.length} solicitud{requests.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-4">
          <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-300 text-sm">No hay solicitudes de plataformas activas</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto space-y-3 relative" style={{ overflowX: 'visible' }}>
          {requests.slice(0, 5).map((request) => (
            <div
              key={request.id}
              className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-lg border border-white/30 dark:border-gray-600/30 p-3"
            >
              {/* Línea 1: Información del modelo y plataforma */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {getModelDisplayName(request.model_email)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">•</span>
                  <span 
                    className="text-xs font-medium px-2 py-1 rounded-full text-white"
                    style={{ 
                      backgroundColor: getStatusColor(request.status),
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      display: 'inline-block'
                    }}
                  >
                    {request.platform_name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-300">•</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">{request.group_name}</span>
                </div>
                
                {canClose(request.status) && (
                  <button
                    onClick={() => handleCloseRequest(request.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Cerrar solicitud"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Línea 2: Timeline visual compacto - un espacio adelante de la 'P' de 'Sede MP' */}
              <div className="flex items-center space-x-3" style={{ marginLeft: 'calc(2rem + 1.5rem + 0.5rem + 1.5rem + 0.5rem + 3.5rem)' }}>
                {/* Solicitada - siempre visible */}
                <div className="flex items-center space-x-1">
                  <div className="relative group">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs cursor-help"
                      style={{ backgroundColor: getStatusColor('solicitada') }}
                    >
                      {getStatusIcon('solicitada')}
                    </div>
                        {/* Tooltip personalizado */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[99999]">
                          {new Date(request.requested_at).toLocaleDateString()} {new Date(request.requested_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-gray-900"></div>
                        </div>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300">Solicitada</span>
                </div>

                {/* Mostrar Pendiente solo si el estado es pendiente, entregada o inviable */}
                {['pendiente', 'entregada', 'inviable'].includes(request.status) && (
                  <>
                    <div className="w-6 h-0.5 bg-gray-300"></div>
                    <div className="flex items-center space-x-1">
                      <div className="relative group">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs cursor-help"
                          style={{ backgroundColor: getStatusColor('pendiente') }}
                        >
                          {getStatusIcon('pendiente')}
                        </div>
                        {/* Tooltip personalizado */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[99999]">
                          {request.updated_at ? `${new Date(request.updated_at).toLocaleDateString()} ${new Date(request.updated_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Sin fecha'}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300">Pendiente</span>
                    </div>
                  </>
                )}

                {/* Mostrar estado final solo si es entregada o inviable */}
                {['entregada', 'inviable'].includes(request.status) && (
                  <>
                    <div className="w-6 h-0.5 bg-gray-300"></div>
                    <div className="flex items-center space-x-1">
                      <div className="relative group">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs cursor-help"
                          style={{ backgroundColor: getStatusColor(request.status) }}
                        >
                          {getStatusIcon(request.status)}
                        </div>
                        {/* Tooltip personalizado */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[99999]">
                          {request.status === 'entregada' && request.delivered_at 
                            ? `${new Date(request.delivered_at).toLocaleDateString()} ${new Date(request.delivered_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                            : request.status === 'inviable' && request.reverted_at
                            ? `${new Date(request.reverted_at).toLocaleDateString()} ${new Date(request.reverted_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Finalizado'
                          }
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">
                        {request.status === 'entregada' ? 'Entregada' : 'Inviable'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          
          {/* Indicador si hay más de 5 registros */}
          {requests.length > 5 && (
            <div className="text-center py-2">
              <span className="text-xs text-gray-500 dark:text-gray-300">
                Y {requests.length - 5} solicitud{requests.length - 5 !== 1 ? 'es' : ''} más...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
