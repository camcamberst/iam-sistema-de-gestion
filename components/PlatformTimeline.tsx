"use client";

import { useState, useEffect, useRef } from 'react';
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
  userRole: 'admin' | 'super_admin' | 'superadmin_aff';
  userGroups?: string[];
  userId?: string;
}

export default function PlatformTimeline({ userRole, userGroups, userId }: PlatformTimelineProps) {
  const [requests, setRequests] = useState<PlatformRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para el carrusel horizontal infinito
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cuando el contenedor y los requests estén listos, lo scrolleamos silenciosamente
    // a una posición muy alta (clon n.º 20) para dar la ilusión de scroll infinito.
    if (requests.length > 0) {
      // Usamos setTimeout para asegurar que el DOM ya se pintó y scrollRef.current existe
      setTimeout(() => {
        if (scrollRef.current) {
          const pagesCount = Math.ceil(requests.length / 3);
          if (pagesCount > 1) {
            const startIdx = pagesCount * 20; // Exactamente el comienzo de un bloque
            scrollRef.current.scrollLeft = startIdx * scrollRef.current.clientWidth;
            setCarouselIndex(startIdx);
          } else {
            setCarouselIndex(0);
          }
        }
      }, 50);
    }
  }, [requests]);

  useEffect(() => {
    loadTimelineData();
  }, [userRole, userGroups, userId]);

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
          userGroups: userGroups || [],
          userId: userId || ''
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

  const getStatusDotClasses = (status: string) => {
    switch (status) {
      case 'solicitada': return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
      case 'pendiente': return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
      case 'entregada': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
      case 'inviable': return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
      default: return 'bg-slate-500 shadow-none';
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'solicitada': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'pendiente': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      case 'entregada': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'inviable': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getStatusIconClasses = (status: string) => {
    switch (status) {
      case 'solicitada': return 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]';
      case 'pendiente': return 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]';
      case 'entregada': return 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]';
      case 'inviable': return 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]';
      default: return 'text-slate-500 drop-shadow-none';
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
      <div className="glass-card p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300 text-sm">Cargando timeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-4">
        <div className="text-center py-4">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
            <Clock className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" />
          </div>
          <div className="relative flex items-center">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              Timeline Portafolio Modelos
            </h2>
          </div>
        </div>
      </div>

      <div className="glass-card p-3 sm:p-4 flex-1" style={{ overflow: 'visible' }}>

      {requests.length === 0 ? (
        <div className="text-center py-4 sm:py-4">
          <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-300 text-xs sm:text-sm">No hay solicitudes de plataformas activas</p>
        </div>
      ) : (
        (() => {
          // Agrupar en páginas base de 3
          const rawPages = [];
          for (let i = 0; i < requests.length; i += 3) {
            rawPages.push(requests.slice(i, i + 3));
          }

          const isInfinite = rawPages.length > 1;
          // Clonar múltiples veces para simular el infinito visual
          const displayPages = isInfinite ? Array(40).fill(rawPages).flat() : rawPages;

          const handleScroll = () => {
            if (!scrollRef.current) return;
            const scrollLeft = scrollRef.current.scrollLeft;
            const clientWidth = scrollRef.current.clientWidth;
            if (clientWidth === 0) return;
            const newIndex = Math.round(scrollLeft / clientWidth);
            if (newIndex !== carouselIndex) {
              setCarouselIndex(newIndex);
            }
          };

          const handleDotClick = (dotIdx: number) => {
            if (!scrollRef.current || carouselIndex === null) return;
            const currentMod = carouselIndex % rawPages.length;
            const diff = dotIdx - currentMod;
            const newIndex = carouselIndex + diff;
            
            scrollRef.current.scrollTo({
              left: newIndex * scrollRef.current.clientWidth,
              behavior: 'smooth'
            });
          };

          return (
            <div className={`relative w-full pb-8 transition-opacity duration-300 ${carouselIndex === null ? 'opacity-0' : 'opacity-100'}`}>
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide touch-pan-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Ocultar scrollbar en firefox/IE
              >
                {/* CSS para ocultar scrollbar en webkit */}
                <style dangerouslySetInnerHTML={{__html: `
                  .scrollbar-hide::-webkit-scrollbar {
                      display: none;
                  }
                `}} />
                
                {displayPages.map((page, pIdx) => (
                  <div key={pIdx} className="w-full flex-shrink-0 snap-center snap-always flex flex-col space-y-2.5 sm:space-y-3 px-0.5" style={{ overflowX: 'visible' }}>
                    {page.map((request: PlatformRequest) => (
                      <div
                        key={request.id}
              className="p-3 sm:p-4 bg-gray-50/80 dark:bg-white/[0.03] rounded-xl sm:rounded-2xl border border-transparent dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-300 group/timelinecard"
            >
              {/* Línea 1: Información del modelo y plataforma */}
              <div className="flex flex-row items-center justify-between gap-2 mb-2">
                <div className="flex flex-row items-center gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5 min-w-0 flex-shrink">
                    <div
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${getStatusDotClasses(request.status)}`}
                    />
                    <span className="text-[13px] sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {getModelDisplayName(request.model_email)}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">•</span>
                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate flex-shrink">
                    {request.group_name}
                  </span>
                </div>
                
                {canClose(request.status) && (
                  <button
                    onClick={() => handleCloseRequest(request.id)}
                    className="p-1.5 sm:p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors active:scale-95 touch-manipulation flex-shrink-0"
                    title="Cerrar solicitud"
                  >
                    <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  </button>
                )}
              </div>

              {/* Línea 2: Timeline visual compacto */}
              <div className="flex flex-wrap items-center gap-y-1.5 gap-x-1 sm:gap-x-2 pb-0.5 mt-0">
                {/* Píldora de plataforma sin ancho fijo para que se ajuste al texto en móvil */}
                <span 
                  className={`text-[9px] sm:text-[10.5px] font-bold py-0.5 px-2 rounded-full border tracking-wide uppercase flex-shrink-0 inline-flex items-center justify-center ${getStatusBadgeClasses(request.status)}`}
                >
                  <span className="truncate">{request.platform_name}</span>
                </span>

                <div className="hidden sm:block w-4 sm:w-6 h-[2px] bg-gray-200 dark:bg-white/10 flex-shrink-0 rounded-full"></div>

                {/* Solicitada - siempre visible */}
                <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                  <button type="button" className="relative group focus:outline-none">
                    <div
                      className={`flex items-center justify-center cursor-help active:scale-95 touch-manipulation transition-transform duration-300 hover:scale-110 ${getStatusIconClasses('solicitada')}`}
                    >
                      <Clock className="w-3.5 h-3.5 sm:w-[16px] sm:h-[16px]" />
                    </div>
                        {/* Tooltip personalizado */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-[10px] sm:text-xs rounded shadow-2xl opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[99999]">
                          {new Date(request.requested_at).toLocaleDateString()} {new Date(request.requested_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-transparent border-b-gray-900"></div>
                        </div>
                  </button>
                  <span className="text-[9.5px] sm:text-[10.5px] font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap capitalize tracking-wide">Solicitada</span>
                </div>

                {/* Mostrar Pendiente solo si el estado es pendiente, entregada o inviable */}
                {['pendiente', 'entregada', 'inviable'].includes(request.status) && (
                  <>
                    <div className="hidden sm:block w-3 sm:w-5 h-[2px] bg-gray-200 dark:bg-white/10 flex-shrink-0 rounded-full"></div>
                    <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                      <button type="button" className="relative group focus:outline-none">
                        <div
                          className={`flex items-center justify-center cursor-help active:scale-95 touch-manipulation transition-transform duration-300 hover:scale-110 ${getStatusIconClasses('pendiente')}`}
                        >
                          <Clock className="w-3.5 h-3.5 sm:w-[16px] sm:h-[16px]" />
                        </div>
                        {/* Tooltip personalizado */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-[10px] sm:text-xs rounded shadow-2xl opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[99999]">
                          {request.updated_at ? `${new Date(request.updated_at).toLocaleDateString()} ${new Date(request.updated_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Sin fecha'}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-transparent border-b-gray-900"></div>
                        </div>
                      </button>
                      <span className="text-[9.5px] sm:text-[10.5px] font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap capitalize tracking-wide">Pendiente</span>
                    </div>
                  </>
                )}

                {/* Mostrar estado final solo si es entregada o inviable */}
                {['entregada', 'inviable'].includes(request.status) && (
                  <>
                    <div className="hidden sm:block w-3 sm:w-5 h-[2px] bg-gray-200 dark:bg-white/10 flex-shrink-0 rounded-full"></div>
                    <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                      <button type="button" className="relative group focus:outline-none">
                        <div
                          className={`flex items-center justify-center cursor-help active:scale-95 touch-manipulation transition-transform duration-300 hover:scale-110 ${getStatusIconClasses(request.status)}`}
                        >
                          {request.status === 'entregada' ? <CheckCircle className="w-3.5 h-3.5 sm:w-[16px] sm:h-[16px]" /> : <XCircle className="w-3.5 h-3.5 sm:w-[16px] sm:h-[16px]" />}
                        </div>
                        {/* Tooltip personalizado */}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-[10px] sm:text-xs rounded shadow-2xl opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[99999]">
                          {request.status === 'entregada' && request.delivered_at 
                            ? `${new Date(request.delivered_at).toLocaleDateString()} ${new Date(request.delivered_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                            : request.status === 'inviable' && request.reverted_at
                            ? `${new Date(request.reverted_at).toLocaleDateString()} ${new Date(request.reverted_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Finalizado'
                          }
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-transparent border-b-gray-900"></div>
                        </div>
                      </button>
                      <span className="text-[9.5px] sm:text-[10.5px] font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap capitalize tracking-wide">
                        {request.status === 'entregada' ? 'Entregada' : 'Inviable'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Indicadores Dots del Carrusel */}
              {isInfinite && carouselIndex !== null && (
                <div className="absolute bottom-1 left-0 w-full flex justify-center items-center gap-1.5">
                  {rawPages.map((_, dotIdx) => {
                    const isActive = (carouselIndex % rawPages.length) === dotIdx;
                    return (
                      <button
                        key={dotIdx}
                        onClick={() => handleDotClick(dotIdx)}
                        className={`transition-all duration-300 rounded-full ${
                          isActive
                            ? 'w-5 h-1.5 bg-purple-500' 
                            : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                        }`}
                        aria-label={`Ir a página ${dotIdx + 1}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()
      )}
      </div>
    </div>
  );
}
