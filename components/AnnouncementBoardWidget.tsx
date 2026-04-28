'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  author?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

interface AnnouncementBoardWidgetProps {
  userId: string;
  userGroups: string[];
  userRole?: 'modelo' | 'admin' | 'super_admin' | 'superadmin_aff';
}

export default function AnnouncementBoardWidget({ userId, userGroups, userRole = 'modelo' }: AnnouncementBoardWidgetProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [readAnnouncements, setReadAnnouncements] = useState<Set<string>>(new Set());
  const [hasNewAnnouncements, setHasNewAnnouncements] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Estados para swipe táctil
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Estados para swipe táctil especifico del Modal
  const [modalTouchStartX, setModalTouchStartX] = useState<number | null>(null);
  const [modalTouchStartY, setModalTouchStartY] = useState<number | null>(null);
  const [modalTouchEndX, setModalTouchEndX] = useState<number | null>(null);
  const [modalTouchEndY, setModalTouchEndY] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Rotación Automática del Carrusel
  useEffect(() => {
    if (announcements.length <= 1 || isPaused) return;

    const displayAnnouncements = showAll ? announcements : announcements.slice(0, 5);
    if (currentIndex >= displayAnnouncements.length) {
      setCurrentIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayAnnouncements.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [announcements, isPaused, currentIndex, showAll]);

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
      <div className="relative bg-white/80 dark:bg-white/[0.08] backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-white/[0.10] p-4 sm:p-6">
        <div className="flex items-center justify-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const displayAnnouncements = showAll ? announcements : announcements.slice(0, 5);
  const newCount = announcements.filter(ann => !readAnnouncements.has(ann.id)).length;

  // Manejadores de Swipe Táctil
  const minSwipeDistance = 50;
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    setIsPaused(true);
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (displayAnnouncements.length <= 1) return;

    if (isLeftSwipe) {
      // Siguiente
      setCurrentIndex(prev => (prev + 1) % displayAnnouncements.length);
    } else if (isRightSwipe) {
      // Anterior
      setCurrentIndex(prev => (prev - 1 + displayAnnouncements.length) % displayAnnouncements.length);
    }
    
    // Reactivar auto-rotate después de iterar manualmente
    setTimeout(() => setIsPaused(false), 5000);
  };

  const handleModalTouchStart = (e: React.TouchEvent) => {
    setModalTouchEndX(null);
    setModalTouchEndY(null);
    setModalTouchStartX(e.targetTouches[0].clientX);
    setModalTouchStartY(e.targetTouches[0].clientY);
  };

  const handleModalTouchMove = (e: React.TouchEvent) => {
    if (!modalTouchStartX || !modalTouchStartY || !selectedAnnouncement) return;

    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    
    setModalTouchEndX(currentX);
    setModalTouchEndY(currentY);

    const distanceX = modalTouchStartX - currentX;
    const distanceY = modalTouchStartY - currentY;

    // Disparador hiper-sensible que se adelanta a la cancelación del scroll del navegador
    // Umbral bajado a 30px. Permite gestos totalmente diagonales al no bloquear el eje Y.
    if (Math.abs(distanceX) > 30) {
      // Solo ignorar si es un scroll vertical *puro* y recto (Y es 3 veces mayor que X)
      if (Math.abs(distanceY) > Math.abs(distanceX) * 3) return;

      const isLeftSwipe = distanceX > 30;
      const isRightSwipe = distanceX < -30;
      
      if (displayAnnouncements.length <= 1) return;

      const currentIdx = displayAnnouncements.findIndex(a => a.id === selectedAnnouncement.id);
      if (currentIdx === -1) return;

      if (isLeftSwipe) {
        const nextIdx = (currentIdx + 1) % displayAnnouncements.length;
        setSelectedAnnouncement(displayAnnouncements[nextIdx]);
        setCurrentIndex(nextIdx);
        markAsRead(displayAnnouncements[nextIdx].id);
      } else if (isRightSwipe) {
        const prevIdx = (currentIdx - 1 + displayAnnouncements.length) % displayAnnouncements.length;
        setSelectedAnnouncement(displayAnnouncements[prevIdx]);
        setCurrentIndex(prevIdx);
        markAsRead(displayAnnouncements[prevIdx].id);
      }

      // Reiniciar coordenadas tras la ejecución
      setModalTouchStartX(null);
      setModalTouchEndX(null);
      setModalTouchStartY(null);
      setModalTouchEndY(null);
    }
  };

  const handleModalTouchEnd = () => {
    // Ya no dependemos de este evento porque Safari corta los toques si detecta scroll
    setModalTouchStartX(null);
    setModalTouchEndX(null);
    setModalTouchStartY(null);
    setModalTouchEndY(null);
  };

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-sky-500 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div className="relative flex items-center">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              What's News?
            </h2>
            {/* Badge sutil - Punto rojo pequeño con animación suave */}
            {hasNewAnnouncements && (
              <div className="ml-1.5 relative w-2 h-2 bg-red-500 rounded-full shadow-sm">
                <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-40"></span>
              </div>
            )}
          </div>
        </div>
        {announcements.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] sm:text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex-shrink-0 whitespace-nowrap"
          >
            {showAll ? 'Ver menos' : `Todas (${announcements.length})`}
          </button>
        )}
      </div>

      <div className="flex-1 glass-card bg-black/[0.08] dark:bg-white/[0.08] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">

      {/* Lista de anuncios o mensaje vacío */}
      {announcements.length === 0 ? (
        <div className="py-6 text-center text-gray-400 dark:text-gray-500">
          <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="text-sm">No hay publicaciones disponibles en este momento</p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden flex flex-col pt-1" 
             onMouseEnter={() => setIsPaused(true)}
             onMouseLeave={() => setIsPaused(false)}
             onTouchStart={handleTouchStart}
             onTouchMove={handleTouchMove}
             onTouchEnd={handleTouchEnd}
        >
          {(() => {
            const displayAnnouncements = showAll ? announcements : announcements.slice(0, 5);
            const currentItem = displayAnnouncements[currentIndex];
            if (!currentItem) return null;

            const isNew = !readAnnouncements.has(currentItem.id);
            const heroImageUrl = currentItem.featured_image_url || 
              (currentItem.image_urls && currentItem.image_urls.length > 0 ? currentItem.image_urls[0] : null);

            return (
              <div key={currentIndex} className="flex flex-col w-full h-full relative animate-in fade-in zoom-in-95 duration-500 ease-out">
                {/* 🌟 THE CAROUSEL ARTICLE */}
                <div
                  onClick={() => {
                    markAsRead(currentItem.id);
                    setSelectedAnnouncement(currentItem);
                  }}
                  className="flex-1 relative group rounded-xl sm:rounded-xl md:rounded-2xl overflow-hidden cursor-pointer shadow-xl bg-white/90 dark:bg-[#0f111a] backdrop-blur-3xl border border-white/60 dark:border-white/10 flex flex-col transition-all duration-500 hover:shadow-2xl hover:border-white/80 dark:hover:border-white/20 dark:hover:bg-[#161925] hover:-translate-y-1"
                >
                  {/* Top: Image Container (Fixed Height reduced for mobile) */}
                  <div className="relative w-full h-[70px] sm:h-28 lg:h-auto lg:flex-1 lg:min-h-[70px] bg-gray-100 dark:bg-black/40 overflow-hidden flex-shrink-0">
                    {heroImageUrl ? (
                      <div className="absolute inset-0 w-full h-full">
                        <img
                          src={heroImageUrl}
                          alt={currentItem.title}
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center transition-transform duration-1000 group-hover:scale-105"
                        style={{
                          backgroundColor: currentItem.category?.color ? `${currentItem.category.color}20` : '#3B82F620',
                          color: currentItem.category?.color || '#3B82F6'
                        }}
                      >
                        <div className="text-6xl opacity-50">{currentItem.category?.icon || '📌'}</div>
                      </div>
                    )}


                  </div>

                  {/* Bottom: Content Container (Fills remaining space) */}
                  <div className="relative z-10 px-3 py-2 sm:p-4 flex flex-col justify-between flex-1 min-h-0">


                    <div className="flex-1 flex flex-col justify-start mt-0">
                      {/* Headline (Typographic Upgrade - Gradient active hover) */}
                      <h3 className="h-[44px] sm:h-[42px] text-[15px] sm:text-[16px] font-semibold text-gray-900 dark:text-gray-100 leading-tight sm:leading-tight line-clamp-2 transition-all duration-300 shrink-0 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-500 dark:group-hover:from-blue-400 dark:group-hover:to-indigo-300 group-hover:bg-clip-text group-hover:text-transparent">
                        {currentItem.title}
                      </h3>
                      

                    </div>

                    {/* Author Meta (Móvil: Oculto para ahorrar espacio, Escritorio: Visible) */}
                    <div className="hidden sm:flex overflow-hidden mb-1.5 sm:mb-2 items-center gap-2">
                      {currentItem.author?.avatar_url ? (
                        <img 
                          src={currentItem.author.avatar_url} 
                          alt={currentItem.author.name}
                          className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-gray-300 dark:border-gray-700 shadow-sm"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white/50 dark:bg-black/40 backdrop-blur-md flex items-center justify-center text-[10px] text-blue-600 dark:text-blue-400 flex-shrink-0 border border-blue-200/50 dark:border-blue-500/30 shadow-inner">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                      )}
                      <span className="hidden sm:block text-[11.5px] text-gray-500 dark:text-gray-400 font-medium leading-none truncate">
                        Publicado por <span className="font-bold text-gray-800 dark:text-gray-100 tracking-tight drop-shadow-sm">{currentItem.author?.name || 'Administración'}</span>
                      </span>
                    </div>

                    {/* Meta Bottom: Date & All Pills */}
                    <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 mt-auto shrink-0 pt-3 pb-0.5 mt-2 border-t border-gray-100 dark:border-white/5">
                      <span className="text-[12px] sm:text-[13px] font-bold text-slate-600 dark:text-slate-300 tracking-tight drop-shadow-sm flex-shrink-0">
                        {formatDate(currentItem.published_at || currentItem.created_at)}
                      </span>
                      
                      <div className="flex flex-wrap items-center justify-end gap-1.5 flex-1">
                        {/* Nuevo */}
                        {isNew && (
                          <span className="inline-flex items-center justify-center px-2 h-[20px] text-[9px] font-extrabold uppercase tracking-widest text-white leading-none bg-gradient-to-r from-fuchsia-600 via-cyan-500 to-emerald-500 rounded-full shadow-sm drop-shadow-md">
                            <span className="mt-[1px]">NUEVO</span>
                          </span>
                        )}
                        
                        {/* Categoría */}
                        {currentItem.category && (
                          <span className={`inline-flex items-center justify-center px-2 h-[20px] rounded-full text-[9px] font-extrabold uppercase tracking-widest w-max backdrop-blur-md border shadow-sm transition-all leading-none ${
                            (() => {
                              const n = currentItem.category.name.toLowerCase();
                              if (n.includes('recordatorio')) return 'bg-violet-500/10 border-violet-500/20 text-violet-500 dark:text-violet-400';
                              if (n.includes('noticia')) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400';
                              if (n.includes('evento')) return 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400';
                              if (n.includes('actualiza')) return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400';
                              return 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'; // Default fallback
                            })()
                          }`}>
                            <span className="mt-[1px]">{currentItem.category.name}</span>
                          </span>
                        )}

                        {/* Priority */}
                        {currentItem.priority > 0 && (
                          <span className={`inline-flex items-center justify-center px-2 h-[20px] leading-none rounded-full text-[9px] font-extrabold uppercase tracking-widest backdrop-blur-md border shadow-sm ${
                            currentItem.priority === 2 
                              ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400' 
                              : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-700 dark:text-cyan-400'
                          }`}>
                            <span className="mt-[1px]">{currentItem.priority === 2 ? 'URGENTE' : 'ALTA'}</span>
                          </span>
                        )}

                        {/* Pin */}
                        {currentItem.is_pinned && (
                          <span className="flex items-center justify-center text-rose-500 dark:text-rose-400 drop-shadow-[0_0_3px_rgba(244,63,94,0.5)] bg-rose-500/10 p-0.5 px-1.5 h-[20px] rounded-full border border-rose-500/20">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 17v5" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dots Indicator */}
                {displayAnnouncements.length > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-3 sm:mt-5 pb-1 sm:pb-2">
                    {displayAnnouncements.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentIndex(idx);
                        }}
                        className={`transition-all duration-500 rounded-full ${
                          currentIndex === idx 
                            ? 'w-6 h-1.5 bg-blue-500' 
                            : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                        }`}
                        aria-label={`Ir a la noticia ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
      </div> {/* <-- CIERRE DE LA NUEVA CAJA MINIMALISTA */}

      {/* Modal de Anuncio (Side-by-Side Style) */}
      {/* Modal de Anuncio (Concepto "Store Product") */}
      {mounted && selectedAnnouncement && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pt-20 sm:p-8 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          
          {(() => {
            // Extraer imagen principal del contenido HTML
            let contentImageUrl = null;
            let restHtml = selectedAnnouncement.content || selectedAnnouncement.excerpt || '';
            const imgMatch = restHtml.match(/<img[^>]+src="([^">]+)"[^>]*>/);
            
            if (imgMatch) {
              contentImageUrl = imgMatch[1];
              // Eliminar la imagen (y posibles etiquetas figure/p que la envuelvan) del HTML
              restHtml = restHtml.replace(/<p[^>]*>\s*<img[^>]+src="[^">]+"[^>]*>\s*<\/p>|<figure[^>]*>.*?<img[^>]+src="[^">]+"[^>]*>.*?<\/figure>|<img[^>]+src="[^">]+"[^>]*>/, '').trim();
            } else if (selectedAnnouncement.image_urls && selectedAnnouncement.image_urls.length > 0) {
              contentImageUrl = selectedAnnouncement.image_urls[0];
            }

            return (
              <div 
                className="w-full max-w-7xl max-h-[90vh] flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-[0_20px_70px_-15px_rgba(0,0,0,0.7)] border border-white/10 transition-all animate-in zoom-in-95 relative touch-pan-y"
                onTouchStart={handleModalTouchStart}
                onTouchMove={handleModalTouchMove}
                onTouchEnd={handleModalTouchEnd}
              >
                
                {/* Botón Cerrar Global */}
                <button
                  onClick={() => setSelectedAnnouncement(null)}
                  className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 sm:w-10 sm:h-10 bg-black/20 hover:bg-black/40 text-white/70 hover:text-white rounded-full flex items-center justify-center transition-all z-50 backdrop-blur-md shadow-sm"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Panel Izquierdo (Antes Derecho): Información y Detalles */}
                <div className="w-full md:w-[40%] bg-[#242938] dark:bg-[#1a1d27] flex flex-col flex-1 md:flex-none z-10 min-h-0">
                  
                  {/* Cabecera Fija del Panel (No Sigue el Scroll) */}
                  <div className="p-8 md:p-12 pb-6 shrink-0 z-20">
                    {/* Categoría / Etiquetas */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      {selectedAnnouncement.category && (
                        <span className="text-base font-bold tracking-wide" style={{ color: selectedAnnouncement.category.color || '#F472B6' }}>
                          {selectedAnnouncement.category.name}
                        </span>
                      )}
                      {selectedAnnouncement.priority > 0 && (
                        <span className={`text-xs px-3.5 py-1.5 rounded-full inline-flex items-center justify-center font-extrabold uppercase tracking-wider ${
                          selectedAnnouncement.priority === 2 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {selectedAnnouncement.priority === 2 ? 'URGENTE' : 'IMPORTANTE'}
                        </span>
                      )}
                    </div>

                    {/* Título Principal */}
                    <h2 className="text-3xl md:text-4xl font-bold text-white leading-[1.15] mb-6">
                      {selectedAnnouncement.title}
                    </h2>

                    {/* Fila de Autor y Fecha */}
                    <div className="flex items-center gap-4">
                      {selectedAnnouncement.featured_image_url ? (
                        <img src={selectedAnnouncement.featured_image_url} className="w-12 h-12 rounded-xl object-contain bg-black/20" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#374151] flex items-center justify-center text-xl text-white">👤</div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-base text-gray-200 font-semibold">Por: {selectedAnnouncement.author?.name || 'Administración'}</span>
                        <span className="text-sm text-gray-500 pr-2">{formatDate(selectedAnnouncement.published_at || selectedAnnouncement.created_at)}</span>
                      </div>
                    </div>
                    
                    {/* Separador inferior a la cabecera */}
                    <div className="w-full h-px bg-white/10 mt-8"></div>
                  </div>

                  {/* Contenido HTML Restante (Área con Scroll Activo) */}
                  <div className="flex-1 overflow-y-auto px-8 md:px-12 pb-8 md:pb-12 right-panel-scroll min-h-0 relative">
                    <style dangerouslySetInnerHTML={{__html: `
                      .right-panel-scroll::-webkit-scrollbar { width: 6px; }
                      .right-panel-scroll::-webkit-scrollbar-track { background: transparent; }
                      .right-panel-scroll::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 10px; }
                      .right-panel-scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.3); }
                    `}} />
                    
                    {restHtml ? (
                      <div 
                        className="prose prose-base md:prose-lg prose-invert max-w-none
                                   prose-headings:text-white prose-a:text-pink-400
                                   prose-p:text-gray-300 prose-p:leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: restHtml }}
                      />
                    ) : null}
                  </div>

                </div>

                {/* Panel Derecho (Antes Izquierdo): Imagen Dominante */}
                <div className="w-full md:w-[60%] bg-[#4d5363] dark:bg-[#2b3040] flex items-center justify-center relative shrink-0 min-h-[25vh] md:min-h-0 border-l border-white/5 overflow-hidden">
                  {contentImageUrl ? (
                    <img 
                      src={contentImageUrl} 
                      alt="Contenido"
                      className="w-[90%] h-[90%] object-contain drop-shadow-2xl z-10"
                    />
                  ) : (
                    <div className="w-[90%] h-[90%] flex items-center justify-center relative">
                      {/* Efectos de luz de fondo para el Logo */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-10 w-48 h-48 bg-purple-500/20 blur-3xl rounded-full pointer-events-none"></div>

                      {/* Logo Tipográfico "IN" Premium / Logo OS-AIM Oficial */}
                      <img 
                        src="/images/os-aim-logo.png" 
                        alt="AIM Logo" 
                        className="w-48 h-48 md:w-80 md:h-80 object-contain select-none z-10 mix-blend-screen brightness-125 contrast-125"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>,
        document.body
      )}

    </div>
  );
}
