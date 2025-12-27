'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  content?: string;
  excerpt: string;
  featured_image_url?: string;
  image_urls?: string[];
  category: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
    color?: string;
  } | null;
  is_pinned: boolean;
  priority: number;
  published_at: string;
  created_at: string;
}

interface AnnouncementBoardWidgetProps {
  userId: string;
  userGroups: string[];
  userRole?: 'modelo' | 'admin' | 'super_admin';
}

export default function AnnouncementBoardWidget({ userId, userGroups, userRole = 'modelo' }: AnnouncementBoardWidgetProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set());
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);

  // Cargar publicaciones leídas desde localStorage
  useEffect(() => {
    const storageKey = `announcements_read_${userId}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const readIds = JSON.parse(stored) as string[];
        setReadAnnouncements(new Set(readIds));
      } catch (e) {
        console.warn('⚠️ [ANNOUNCEMENTS-WIDGET] Error parseando publicaciones leídas:', e);
      }
    }
  }, [userId]);

  useEffect(() => {
    loadAnnouncements();

    // Suscribirse a cambios en tiempo real en la tabla announcements
    const channel = supabase
      .channel(`announcements-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'announcements'
        },
        (payload) => {
          console.log('📢 [ANNOUNCEMENTS-WIDGET] Cambio detectado en tiempo real:', payload);
          
          // Solo recargar si el anuncio está publicado o se acaba de publicar
          const eventType = payload.eventType || (payload as any).event;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const newRecord = payload.new as any;
            if (newRecord && newRecord.is_published === true) {
              // Recargar anuncios cuando hay cambios en publicaciones
              console.log('🔄 [ANNOUNCEMENTS-WIDGET] Recargando anuncios por cambio en tiempo real');
              loadAnnouncements();
            }
          } else if (eventType === 'DELETE') {
            // Si se elimina un anuncio, recargar
            console.log('🔄 [ANNOUNCEMENTS-WIDGET] Recargando anuncios por eliminación');
            loadAnnouncements();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [ANNOUNCEMENTS-WIDGET] Estado de suscripción:', status);
      });

    return () => {
      console.log('🧹 [ANNOUNCEMENTS-WIDGET] Limpiando suscripción');
      supabase.removeChannel(channel);
    };
  }, [userId, userGroups]);

  // Verificar si hay publicaciones nuevas
  useEffect(() => {
    if (announcements.length === 0) {
      setHasNewAnnouncements(false);
      return;
    }

    // Verificar si hay alguna publicación no leída
    const hasNew = announcements.some(ann => !readAnnouncements.has(ann.id));
    setHasNewAnnouncements(hasNew);

    // Si es la primera vez que se cargan anuncios y no hay nada en localStorage,
    // marcar todas como "nuevas" inicialmente
    const storageKey = `announcements_read_${userId}`;
    const stored = localStorage.getItem(storageKey);
    if (!stored && announcements.length > 0) {
      // Primera vez: no marcar ninguna como leída, todas son nuevas
      console.log('🆕 [ANNOUNCEMENTS-WIDGET] Primera carga: todas las publicaciones son nuevas');
    }
  }, [announcements, readAnnouncements, userId]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('⚠️ [ANNOUNCEMENTS-WIDGET] No hay sesión activa');
        return;
      }

      // Obtener IDs de grupos del usuario desde la base de datos
      const { data: userGroupsData, error: groupsError } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', userId);

      if (groupsError) {
        console.error('❌ [ANNOUNCEMENTS-WIDGET] Error obteniendo grupos:', groupsError);
      }

      const userGroupIds = userGroupsData?.map(ug => ug.group_id) || [];
      const userGroupsParam = userGroupIds.length > 0 ? userGroupIds.join(',') : '';
      
      console.log('🔍 [ANNOUNCEMENTS-WIDGET] Cargando anuncios para:', {
        userId,
        userGroupIds,
        userGroupsParam
      });
      
      const response = await fetch(
        `/api/announcements?limit=5&userId=${userId}&userRole=${userRole}${userGroupsParam ? `&userGroups=${userGroupsParam}` : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        console.error('❌ [ANNOUNCEMENTS-WIDGET] Error en respuesta:', response.status, response.statusText);
        return;
      }

      const result = await response.json();
      
      console.log('📊 [ANNOUNCEMENTS-WIDGET] Resultado:', {
        success: result.success,
        count: result.data?.length || 0,
        data: result.data
      });
      
      if (result.success) {
        setAnnouncements(result.data || []);
      } else {
        console.error('❌ [ANNOUNCEMENTS-WIDGET] Error en respuesta:', result.error);
      }
    } catch (error) {
      console.error('❌ [ANNOUNCEMENTS-WIDGET] Error cargando anuncios:', error);
    } finally {
      setLoading(false);
    }
  };

  // Marcar publicación como leída
  const markAsRead = (announcementId: string) => {
    const storageKey = `announcements_read_${userId}`;
    const newReadSet = new Set(readAnnouncements);
    newReadSet.add(announcementId);
    setReadAnnouncements(newReadSet);
    
    // Guardar en localStorage
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newReadSet)));
    
    // Verificar si aún hay publicaciones nuevas
    const stillHasNew = announcements.some(ann => !newReadSet.has(ann.id));
    setHasNewAnnouncements(stillHasNew);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} h`;
    if (diffDays < 7) return `hace ${diffDays} d`;
    
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 sm:p-6">
        <div className="flex items-center justify-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const displayAnnouncements = showAll ? announcements : announcements.slice(0, 3);
  const newCount = announcements.filter(ann => !readAnnouncements.has(ann.id)).length;

  return (
    <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200/50 dark:border-gray-600/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            {/* 🔧 INDICADOR BALANCEADO - PUBLICACIONES NUEVAS */}
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              {/* Badge sutil - Punto rojo pequeño con animación suave */}
              {hasNewAnnouncements && (
                <div className="absolute -top-0.5 -right-0.5">
                  <div className="relative w-3 h-3 sm:w-3.5 sm:h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-700 shadow-sm">
                    {newCount > 1 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[7px] sm:text-[8px] font-semibold text-white leading-none">
                        {newCount > 9 ? '9+' : newCount}
                      </span>
                    )}
                    <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-40"></span>
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                Corcho Informativo
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 hidden sm:block">Información relevante para ti</p>
            </div>
          </div>
          {announcements.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex-shrink-0 whitespace-nowrap"
            >
              {showAll ? 'Ver menos' : `Ver todas (${announcements.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Lista de anuncios o mensaje vacío */}
      {announcements.length === 0 ? (
        <div className="p-4 sm:p-6 text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            No hay publicaciones disponibles en este momento
          </p>
          <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1">
            Las publicaciones aparecerán aquí cuando los administradores las creen
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          {displayAnnouncements.map((announcement) => {
            const isNew = !readAnnouncements.has(announcement.id);
            return (
            <div
              key={announcement.id}
              onClick={() => {
                // Marcar como leída antes de abrir
                markAsRead(announcement.id);
                // Abrir en nueva pestaña/ventana
                const url = `/announcements/${announcement.id}`;
                window.open(url, '_blank', 'width=800,height=900,scrollbars=yes,resizable=yes');
              }}
              className={`relative cursor-pointer group rounded-lg p-3 sm:p-4 border transition-all duration-200 hover:shadow-md ${
                isNew 
                  ? 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-200/60 dark:border-blue-500/30' 
                  : 'bg-gray-50/50 dark:bg-gray-600/30 border-gray-200/50 dark:border-gray-500/30 hover:border-blue-300 dark:hover:border-blue-500/50'
              }`}
            >
              {/* Badge "Nuevo" en esquina superior derecha - alineado con otras etiquetas */}
              {isNew && (
                <>
                  <style>{`
                    @keyframes badgeBlink {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.5; }
                    }
                    .badge-nuevo-blink {
                      animation: badgeBlink 1.5s ease-in-out infinite;
                    }
                  `}</style>
                  <span 
                    className="badge-nuevo-blink absolute top-2 right-2 sm:top-4 sm:right-4 inline-flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs font-medium text-white bg-gradient-to-r from-red-500 via-pink-500 to-red-500 rounded-full shadow-sm shadow-red-500/30 hover:shadow-md hover:shadow-red-500/50 transition-all duration-200 z-10"
                  >
                    {/* Punto parpadeante dinámico - más pequeño */}
                    <span className="relative flex h-0.5 w-0.5 sm:h-1 sm:w-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-70"></span>
                      <span className="relative inline-flex rounded-full h-0.5 w-0.5 sm:h-1 sm:w-1 bg-white"></span>
                    </span>
                    {/* Texto */}
                    <span className="relative">Nuevo</span>
                    {/* Efecto de brillo sutil animado */}
                    <span className="absolute inset-0 bg-gradient-to-r from-red-400 via-pink-400 to-red-400 rounded-full opacity-40 blur-sm -z-10 animate-pulse"></span>
                  </span>
                </>
              )}
              
              <div className="flex items-start space-x-2 sm:space-x-3">
                {/* Avatar: Imagen destacada, primera imagen de image_urls, o icono de categoría */}
                {(() => {
                  // Obtener la imagen a usar: featured_image_url tiene prioridad, luego primera de image_urls
                  const imageUrl = announcement.featured_image_url || 
                    (announcement.image_urls && announcement.image_urls.length > 0 
                      ? announcement.image_urls[0] 
                      : null);
                  
                  if (imageUrl) {
                    return (
                      <img
                        src={imageUrl}
                        alt={announcement.title}
                        className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    );
                  }
                  
                  // Si no hay imagen, mostrar ícono de categoría
                  return (
                    <div
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-lg sm:text-2xl"
                      style={{
                        backgroundColor: announcement.category?.color ? `${announcement.category.color}20` : '#3B82F620',
                        color: announcement.category?.color || '#3B82F6'
                      }}
                    >
                      {announcement.category?.icon || '📌'}
                    </div>
                  );
                })()}

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  {/* Badges y etiquetas - con mejor espaciado */}
                  <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    {announcement.is_pinned && (
                      <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400">📌</span>
                    )}
                    {announcement.priority > 0 && (
                      <span className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded ${
                        announcement.priority === 2 
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                      }`}>
                        {announcement.priority === 2 ? 'Urgente' : 'Alta'}
                      </span>
                    )}
                    {announcement.category && (
                      <span
                        className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${announcement.category.color}20`,
                          color: announcement.category.color
                        }}
                      >
                        {announcement.category.name}
                      </span>
                    )}
                  </div>
                  
                  {/* Título - con mejor separación */}
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1.5 sm:mb-2.5 leading-snug">
                    {announcement.title}
                  </h3>
                  
                  {/* Excerpt - con mejor separación */}
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-2 sm:mb-3 leading-relaxed">
                    {announcement.excerpt}
                  </p>
                  
                  {/* Footer con fecha y acción - mejor separado */}
                  <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-gray-200/30 dark:border-gray-600/30">
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(announcement.published_at || announcement.created_at)}
                    </span>
                    <span className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                      Leer más →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}

    </div>
  );
}
