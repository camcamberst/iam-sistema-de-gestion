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
  reverted_at?: string;
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
      <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Cargando timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="text-center py-8">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          Timeline de Solicitudes
        </h3>
        <span className="text-sm text-gray-500">
          {requests.length} solicitud{requests.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay solicitudes de plataformas activas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-white/80 backdrop-blur-sm rounded-lg border border-white/30 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getStatusColor(request.status) }}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {getModelDisplayName(request.model_email)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-600">{request.platform_name}</span>
                  <span className="text-sm text-gray-500">•</span>
                  <span className="text-sm text-gray-600">{request.group_name}</span>
                </div>
                
                {canClose(request.status) && (
                  <button
                    onClick={() => handleCloseRequest(request.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Cerrar solicitud"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Timeline visual */}
              <div className="flex items-center space-x-4">
                {/* Solicitada */}
                <div className="flex items-center space-x-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: getStatusColor('solicitada') }}
                  >
                    {getStatusIcon('solicitada')}
                  </div>
                  <span className="text-xs text-gray-600">Solicitada</span>
                </div>

                {/* Flecha */}
                <div className="w-8 h-0.5 bg-gray-300"></div>

                {/* Pendiente */}
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                      ['pendiente', 'entregada', 'inviable'].includes(request.status) 
                        ? '' : 'opacity-50'
                    }`}
                    style={{ 
                      backgroundColor: ['pendiente', 'entregada', 'inviable'].includes(request.status) 
                        ? getStatusColor('pendiente') : '#e2e8f0'
                    }}
                  >
                    {getStatusIcon('pendiente')}
                  </div>
                  <span className="text-xs text-gray-600">Pendiente</span>
                </div>

                {/* Flecha */}
                <div className="w-8 h-0.5 bg-gray-300"></div>

                {/* Estado Final */}
                <div className="flex items-center space-x-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  >
                    {getStatusIcon(request.status)}
                  </div>
                  <span className="text-xs text-gray-600 capitalize">
                    {request.status === 'entregada' ? 'Entregada' : 'Inviable'}
                  </span>
                </div>
              </div>

              {/* Información adicional */}
              <div className="mt-3 pt-3 border-t border-gray-200/50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Solicitada: {new Date(request.requested_at).toLocaleDateString()}</span>
                  {request.notes && (
                    <span className="truncate max-w-xs" title={request.notes}>
                      {request.notes}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
