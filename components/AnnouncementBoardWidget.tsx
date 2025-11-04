'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  content?: string;
  excerpt: string;
  featured_image_url?: string;
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
}

export default function AnnouncementBoardWidget({ userId, userGroups }: AnnouncementBoardWidgetProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, [userId, userGroups]);

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
        `/api/announcements?limit=5&userId=${userId}&userRole=modelo${userGroupsParam ? `&userGroups=${userGroupsParam}` : ''}`,
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
      <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Mostrar siempre el widget, incluso si no hay anuncios (para debug)
  // if (announcements.length === 0) {
  //   return null; // No mostrar si no hay anuncios
  // }

  const displayAnnouncements = showAll ? announcements : announcements.slice(0, 3);

  return (
    <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-600/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Corcho Informativo</h2>
              <p className="text-xs text-gray-600 dark:text-gray-300">Información relevante para ti</p>
            </div>
          </div>
          {announcements.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              {showAll ? 'Ver menos' : `Ver todas (${announcements.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Lista de anuncios o mensaje vacío */}
      {announcements.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No hay publicaciones disponibles en este momento
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Las publicaciones aparecerán aquí cuando los administradores las creen
          </p>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {displayAnnouncements.map((announcement) => (
          <div
            key={announcement.id}
            onClick={() => setSelectedAnnouncement(announcement)}
            className="cursor-pointer group bg-gray-50/50 dark:bg-gray-600/30 rounded-lg p-4 border border-gray-200/50 dark:border-gray-500/30 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-start space-x-3">
              {/* Imagen destacada o icono de categoría */}
              {announcement.featured_image_url ? (
                <img
                  src={announcement.featured_image_url}
                  alt={announcement.title}
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{
                    backgroundColor: announcement.category?.color ? `${announcement.category.color}20` : '#3B82F620',
                    color: announcement.category?.color || '#3B82F6'
                  }}
                >
                  {announcement.category?.icon || '📌'}
                </div>
              )}

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.is_pinned && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">📌</span>
                      )}
                      {announcement.priority > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          announcement.priority === 2 
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        }`}>
                          {announcement.priority === 2 ? 'Urgente' : 'Alta'}
                        </span>
                      )}
                      {announcement.category && (
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: `${announcement.category.color}20`,
                            color: announcement.category.color
                          }}
                        >
                          {announcement.category.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">
                      {announcement.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
                      {announcement.excerpt}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(announcement.published_at || announcement.created_at)}
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                    Leer más →
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Modal de lectura completa */}
      {selectedAnnouncement && (
        <AnnouncementModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}
    </div>
  );
}

// Componente Modal con contenido completo
function AnnouncementModal({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFullContent();
  }, [announcement.id]);

  const loadFullContent = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/announcements/${announcement.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setFullContent(result.data.content);
      }
    } catch (error) {
      console.error('Error cargando contenido completo:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {announcement.category && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{
                  backgroundColor: `${announcement.category.color}20`,
                  color: announcement.category.color
                }}
              >
                {announcement.category.icon || '📌'}
              </div>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {announcement.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {announcement.featured_image_url && (
                <img
                  src={announcement.featured_image_url}
                  alt={announcement.title}
                  className="w-full h-64 object-cover rounded-lg mb-4"
                />
              )}
              <div 
                className="prose dark:prose-invert max-w-none announcement-content"
                dangerouslySetInnerHTML={{ __html: fullContent || announcement.excerpt || '' }}
              />
            </>
          )}
        </div>
      </div>
      <style jsx global>{`
        .announcement-content {
          color: #374151;
        }
        
        .dark .announcement-content {
          color: #f3f4f6;
        }
        
        .announcement-content h1,
        .announcement-content h2,
        .announcement-content h3,
        .announcement-content h4,
        .announcement-content h5,
        .announcement-content h6 {
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          color: #111827;
        }
        
        .dark .announcement-content h1,
        .dark .announcement-content h2,
        .dark .announcement-content h3,
        .dark .announcement-content h4,
        .dark .announcement-content h5,
        .dark .announcement-content h6 {
          color: #f9fafb;
        }
        
        .announcement-content p {
          margin-bottom: 1em;
          line-height: 1.6;
        }
        
        .announcement-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1.5em 0;
        }
        
        .announcement-content ul,
        .announcement-content ol {
          margin: 1em 0;
          padding-left: 2em;
        }
        
        .announcement-content li {
          margin: 0.5em 0;
        }
        
        .announcement-content a {
          color: #3b82f6;
          text-decoration: underline;
        }
        
        .dark .announcement-content a {
          color: #60a5fa;
        }
        
        .announcement-content a:hover {
          color: #2563eb;
        }
        
        .dark .announcement-content a:hover {
          color: #93c5fd;
        }
        
        .announcement-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #6b7280;
        }
        
        .dark .announcement-content blockquote {
          border-left-color: #4b5563;
          color: #9ca3af;
        }
        
        .announcement-content code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.9em;
          color: #dc2626;
        }
        
        .dark .announcement-content code {
          background-color: #374151;
          color: #fca5a5;
        }
        
        .announcement-content pre {
          background-color: #f3f4f6;
          padding: 1em;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1em 0;
        }
        
        .dark .announcement-content pre {
          background-color: #374151;
        }
        
        .announcement-content pre code {
          background-color: transparent;
          padding: 0;
          color: inherit;
        }
      `}</style>
    </div>
  );
}

