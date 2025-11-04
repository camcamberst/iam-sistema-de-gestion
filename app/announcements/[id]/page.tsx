'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Announcement {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  featured_image_url?: string;
  category: {
    id: string;
    name: string;
    slug: string;
    icon?: string;
    color?: string;
  } | null;
  author: {
    id: string;
    name: string;
    email: string;
  } | null;
  published_at: string;
  created_at: string;
}

export default function AnnouncementPage() {
  const params = useParams();
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncement();
  }, [params.id]);

  const loadAnnouncement = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No hay sesión activa');
        return;
      }

      const response = await fetch(`/api/announcements/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        setError('Error al cargar la publicación');
        return;
      }

      const result = await response.json();
      if (result.success) {
        setAnnouncement(result.data);
      } else {
        setError(result.error || 'Error al cargar la publicación');
      }
    } catch (error) {
      console.error('Error cargando publicación:', error);
      setError('Error al cargar la publicación');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando publicación...</p>
        </div>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Error al cargar la publicación
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {error || 'La publicación no se pudo cargar'}
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                {announcement.category && (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      backgroundColor: `${announcement.category.color}20`,
                      color: announcement.category.color
                    }}
                  >
                    {announcement.category.icon || '📌'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {announcement.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    {announcement.author && (
                      <span>Por: {announcement.author.name}</span>
                    )}
                    <span>
                      {new Date(announcement.published_at || announcement.created_at).toLocaleDateString('es-CO', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                    {announcement.category && (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${announcement.category.color}20`,
                          color: announcement.category.color
                        }}
                      >
                        {announcement.category.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => window.close()}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 ml-4"
                title="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          {announcement.featured_image_url && (
            <img
              src={announcement.featured_image_url}
              alt={announcement.title}
              className="w-full h-96 object-cover rounded-lg mb-6"
            />
          )}
          <div 
            className="prose dark:prose-invert max-w-none announcement-content"
            dangerouslySetInnerHTML={{ __html: announcement.content || announcement.excerpt || '' }}
          />
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

