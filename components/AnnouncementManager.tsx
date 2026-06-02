'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import RichTextEditor from './RichTextEditor';
import AppleDropdown from '@/components/ui/AppleDropdown';
import AppleDatePicker from '@/components/ui/AppleDatePicker';

interface Announcement {
  id: string;
  title: string;
  content: string;
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
  author: {
    id: string;
    name: string;
    email: string;
  } | null;
  is_general: boolean;
  is_published: boolean;
  is_pinned: boolean;
  priority: number;
  views_count: number;
  published_at?: string;
  expires_at?: string;
  created_at: string;
  group_targets: Array<{ id: string; name: string }>;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

interface Group {
  id: string;
  name: string;
}

interface AnnouncementManagerProps {
  userId: string;
  userRole: 'super_admin' | 'admin' | 'superadmin_aff';
  userGroups: string[];
}

const getCategoryStyle = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('noticia')) {
    return {
      bg: 'bg-teal-500/10 dark:bg-teal-500/15',
      border: 'border-teal-500/20 dark:border-teal-500/25',
      text: 'text-teal-600 dark:text-teal-300'
    };
  }
  if (lower.includes('recorda') || lower.includes('alert')) {
    return {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      border: 'border-emerald-500/20 dark:border-emerald-500/25',
      text: 'text-emerald-600 dark:text-emerald-300'
    };
  }
  return {
    bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    border: 'border-emerald-500/15 dark:border-emerald-500/20',
    text: 'text-emerald-600/90 dark:text-emerald-400/95'
  };
};

export default function AnnouncementManager({ userId, userRole, userGroups }: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadData();

    // Auto-open editor if hash is #new-announcement
    if (typeof window !== 'undefined' && window.location.hash === '#new-announcement') {
      setShowEditor(true);
      // Remove the hash cleanly without triggering scroll jumps
      const scrollV = document.body.scrollTop;
      const scrollH = document.body.scrollLeft;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      document.body.scrollTop = scrollV;
      document.body.scrollLeft = scrollH;
    }
  }, [userId, userRole, userGroups]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;

      // Cargar publicaciones (todas, incluyendo borradores)
      // Super admin verá todas, admin solo las suyas
      const announcementsResponse = await fetch(`/api/announcements?limit=100&userRole=${userRole}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const announcementsData = await announcementsResponse.json();
      if (announcementsData.success) {
        setAnnouncements(announcementsData.data || []);
      }

      // Cargar categorías
      const categoriesResponse = await fetch('/api/announcements/categories');
      const categoriesData = await categoriesResponse.json();
      if (categoriesData.success) {
        setCategories(categoriesData.data || []);
      }

      // Cargar grupos
      const groupsResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRole, userGroups })
      });
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setGroups(groupsData.groups || []);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta publicación?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error eliminando:', error);
      alert('Error al eliminar la publicación');
    }
  };

  const handleTogglePublish = async (announcement: Announcement) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          is_published: !announcement.is_published
        })
      });

      const result = await response.json();
      if (result.success) {
        await loadData();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error actualizando:', error);
      alert('Error al actualizar la publicación');
    }
  };

  const filteredAnnouncements = announcements.filter(ann => {
    if (filter === 'published' && !ann.is_published) return false;
    if (filter === 'draft' && ann.is_published) return false;
    if (selectedCategory !== 'all' && ann.category?.id !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="relative w-full text-gray-900 dark:text-zinc-100 flex flex-col gap-1.5 sm:gap-2">
      {/* Header */}
      <div className="flex items-start justify-between px-1 mb-3 sm:mb-4">
        <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
          <div className="flex items-center justify-center text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.95)] mt-0.5">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div className="flex items-baseline min-w-0">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              What&apos;s News?
            </h2>
            <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-zinc-400 font-medium tracking-wide hidden sm:inline">
              Gestiona publicaciones e información para modelos
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingAnnouncement(null);
              setShowEditor(true);
            }}
            className="btn-apple-primary w-full sm:w-auto flex items-center justify-center touch-manipulation"
          >
            <span className="hidden sm:inline">Nueva Publicación</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-2.5 sm:gap-3.5 mb-4 sm:mb-6 items-center">
        <div className="flex p-0.5 bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md rounded-full border border-black/[0.05] dark:border-white/[0.06] gap-0.5 shadow-sm">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded-full transition-all duration-300 active:scale-95 touch-manipulation border ${
              filter === 'all'
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 shadow-sm shadow-emerald-500/5'
                : 'bg-transparent text-gray-500 dark:text-zinc-400 border-transparent hover:text-gray-800 dark:hover:text-zinc-200'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('published')}
            className={`px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded-full transition-all duration-300 active:scale-95 touch-manipulation border ${
              filter === 'published'
                ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/25 shadow-sm shadow-teal-500/5'
                : 'bg-transparent text-gray-500 dark:text-zinc-400 border-transparent hover:text-gray-800 dark:hover:text-zinc-200'
            }`}
          >
            Publicadas
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded-full transition-all duration-300 active:scale-95 touch-manipulation border ${
              filter === 'draft'
                ? 'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/25 shadow-sm shadow-yellow-500/5'
                : 'bg-transparent text-gray-500 dark:text-zinc-400 border-transparent hover:text-gray-800 dark:hover:text-zinc-200'
            }`}
          >
            Borradores
          </button>
        </div>
        <AppleDropdown
          options={[
            { value: 'all', label: 'Todas las categorías' },
            ...categories.map(cat => ({
              value: cat.id,
              label: cat.name
            }))
          ]}
          value={selectedCategory}
          onChange={(value) => setSelectedCategory(value)}
          placeholder="Todas las categorías"
          className="text-xs"
          theme="emerald"
          pill={true}
        />
      </div>

      {/* Lista de publicaciones */}
      {loading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">
          <p className="text-xs sm:text-sm">No hay publicaciones {filter !== 'all' ? `(${filter === 'published' ? 'publicadas' : 'borradores'})` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredAnnouncements.map(announcement => {
            const isExcerptRedundant = !announcement.excerpt || announcement.excerpt.trim() === announcement.title.trim();
            const catStyle = announcement.category ? getCategoryStyle(announcement.category.name) : null;
            return (
              <div
                key={announcement.id}
                className="bg-white/45 dark:bg-[#1a1a1c]/45 backdrop-blur-md rounded-[1.75rem] sm:rounded-[2rem] p-4 sm:p-5.5 border border-black/[0.04] dark:border-white/[0.06] shadow-sm hover:shadow-md hover:border-emerald-400/30 dark:hover:border-emerald-500/40 hover:bg-white/55 dark:hover:bg-[#1c1c1e]/55 transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3.5 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] sm:text-[17px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm mb-2 leading-snug flex items-start gap-1.5">
                      {announcement.is_pinned && (
                        <span className="inline-flex items-center justify-center text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)] transform -rotate-[15deg] mt-[3px] sm:mt-[4px] flex-shrink-0" title="Fijado">
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                        </span>
                      )}
                      <span>{announcement.title}</span>
                    </h3>
                    <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-2.5">
                      {announcement.priority > 0 && (
                        <span className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          announcement.priority === 2
                            ? 'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                            : 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/20 dark:border-teal-500/25'
                        }`}>
                          {announcement.priority === 2 ? 'Urgente' : 'Alta'}
                        </span>
                      )}
                      {announcement.category && catStyle && (
                        <span className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-semibold border ${catStyle.bg} ${catStyle.border} ${catStyle.text}`}>
                          {announcement.category.name}
                        </span>
                      )}
                      {!announcement.is_published && (
                        <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20 dark:border-zinc-500/25 font-semibold">
                          Borrador
                        </span>
                      )}
                    </div>
                    {!isExcerptRedundant && (
                      <p className="text-xs sm:text-[13.5px] text-gray-600 dark:text-zinc-400 line-clamp-2 mt-1 mb-2.5 leading-relaxed font-medium">
                        {announcement.excerpt}
                      </p>
                    )}
                    <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-400 dark:text-zinc-500 font-medium tracking-wide">
                      <span>Por: {announcement.author?.name || 'Desconocido'}</span>
                      <span className="text-gray-300 dark:text-zinc-700 select-none">•</span>
                      <span>{new Date(announcement.created_at).toLocaleDateString('es-CO')}</span>
                      {announcement.is_published && (
                        <>
                          <span className="text-gray-300 dark:text-zinc-700 select-none">•</span>
                          <span>{announcement.views_count} vistas</span>
                        </>
                      )}
                      <span className="text-gray-300 dark:text-zinc-700 select-none">•</span>
                      {announcement.is_general ? (
                        <span className="text-emerald-500/90 dark:text-emerald-400/95 font-semibold">General</span>
                      ) : (
                        <span>{announcement.group_targets.length} grupo(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end sm:justify-start flex-shrink-0 self-center sm:self-start mt-1 sm:mt-0">
                    <div className="bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-md rounded-full border border-black/[0.05] dark:border-white/[0.06] p-0.5 sm:p-1 flex items-center gap-0.5 sm:gap-1 shadow-sm">
                      <button
                        onClick={() => {
                          setEditingAnnouncement(announcement);
                          setShowEditor(true);
                        }}
                        className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all duration-200 hover:scale-115 active:scale-90 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                        title="Editar"
                      >
                        <svg className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleTogglePublish(announcement)}
                        className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 flex items-center justify-center transition-all duration-200 hover:scale-115 active:scale-90 ${
                          announcement.is_published
                            ? 'text-emerald-500 dark:text-emerald-400 hover:text-amber-500 dark:hover:text-amber-400 hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                            : 'text-gray-400 dark:text-zinc-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                        }`}
                        title={announcement.is_published ? 'Despublicar (Mover a Borradores)' : 'Publicar'}
                      >
                        <svg className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          {announcement.is_published ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v12m0 0l-3-3m3 3l3-3m2-9a7 7 0 11-14 0 7 7 0 0114 0z" />
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 hover:scale-115 active:scale-90 hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                        title="Eliminar"
                      >
                        <svg className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Editor */}
      {showEditor && (
        <AnnouncementEditor
          announcement={editingAnnouncement}
          categories={categories}
          groups={userRole === 'super_admin' ? groups : groups.filter(g => userGroups.includes(g.id))}
          userId={userId}
          userRole={userRole}
          onClose={() => {
            setShowEditor(false);
            setEditingAnnouncement(null);
          }}
          onSave={() => {
            setShowEditor(false);
            setEditingAnnouncement(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Componente Editor (simplificado por ahora, se puede expandir)
function AnnouncementEditor({
  announcement,
  categories,
  groups,
  userId,
  userRole,
  onClose,
  onSave
}: {
  announcement: Announcement | null;
  categories: Category[];
  groups: Group[];
  userId: string;
  userRole: 'super_admin' | 'admin' | 'superadmin_aff';
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<{
    title: string;
    content: string;
    excerpt: string;
    category_id: string;
    featured_image_url: string;
    is_general: boolean;
    group_ids: string[];
    target_roles: string[];
    is_published: boolean;
    is_pinned: boolean;
    priority: number;
    expires_at: string;
    share_with_affiliates: boolean;
  }>({
    title: announcement?.title || '',
    content: announcement?.content || '',
    excerpt: announcement?.excerpt || '',
    category_id: announcement?.category?.id || '',
    featured_image_url: announcement?.featured_image_url || '',
    is_general: announcement?.is_general || false,
    group_ids: announcement?.group_targets.map(gt => gt.id) || [],
    target_roles: (announcement as any)?.target_roles || [],
    is_published: announcement?.is_published !== undefined ? announcement.is_published : true,
    is_pinned: announcement?.is_pinned || false,
    priority: announcement?.priority || 0,
    expires_at: announcement?.expires_at ? announcement.expires_at.split('T')[0] : '',
    share_with_affiliates: (announcement as any)?.share_with_affiliates || false
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño antes de enviar (4MB máximo)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. El límite máximo es 4MB. Por favor, comprime la imagen o usa una imagen más pequeña.');
      return;
    }

    try {
      setUploadingImage(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/announcements/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        // Si es error 413, mostrar mensaje específico
        if (response.status === 413) {
          alert('El archivo es demasiado grande. El límite máximo es 4MB. Por favor, comprime la imagen o usa una imagen más pequeña.');
          return;
        }
        
        // Intentar parsear como JSON, si falla, mostrar mensaje genérico
        let errorMessage = 'Error al subir la imagen';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no es JSON, usar el status text
          errorMessage = `Error ${response.status}: ${response.statusText || 'Error desconocido'}`;
        }
        
        alert(errorMessage);
        return;
      }

      // Intentar parsear la respuesta como JSON
      let result;
      try {
        result = await response.json();
      } catch (error) {
        console.error('Error parseando respuesta JSON:', error);
        alert('Error al procesar la respuesta del servidor');
        return;
      }

      if (result.success) {
        setFormData(prev => ({ ...prev, featured_image_url: result.url }));
      } else {
        alert('Error subiendo imagen: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      alert('Error al subir la imagen. Por favor, verifica tu conexión e intenta de nuevo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      alert('Título y contenido son requeridos');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payload: any = {
        title: formData.title,
        content: formData.content,
        excerpt: formData.excerpt || formData.title.substring(0, 150),
        category_id: formData.category_id || null,
        featured_image_url: formData.featured_image_url || '/images/os-aim-logo.png',
        is_general: formData.is_general,
        group_ids: formData.is_general ? [] : formData.group_ids,
        target_roles: userRole === 'super_admin' ? formData.target_roles : [],
        is_published: formData.is_published,
        is_pinned: formData.is_pinned,
        priority: formData.priority,
        expires_at: formData.expires_at || null
      };
      
      // Agregar share_with_affiliates solo si es super_admin
      if (userRole === 'super_admin') {
        payload.share_with_affiliates = formData.share_with_affiliates;
      }

      const url = announcement
        ? `/api/announcements/${announcement.id}`
        : '/api/announcements';
      const method = announcement ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        onSave();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar la publicación');
    } finally {
      setSaving(false);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevenir scroll del body cuando el modal está abierto
    document.body.style.overflow = 'hidden';
    return () => {
      setMounted(false);
      document.body.style.overflow = '';
    };
  }, []);

  if (!mounted) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 transition-opacity duration-300 p-4" 
      onClick={onClose}
      style={{ 
        position: 'fixed',
        zIndex: 99999999,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      } as React.CSSProperties}
    >
      <div 
        className="bg-white/85 dark:bg-[#1a1a1c]/85 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] w-full max-w-3xl max-h-[calc(100vh-2.5rem)] flex flex-col transform transition-all duration-300 ease-out animate-scale-up" 
        style={{ 
          zIndex: 2,
          position: 'relative',
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="sticky top-0 bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md px-7 py-5 flex items-center justify-between z-10 rounded-t-[2rem]"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            {announcement ? 'Editar Publicación' : 'Nueva Publicación'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-white transition-all active:scale-90"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Glowing Neon Line Separator (Delineado del Header Boreal) */}
        <div className="h-[1.5px] w-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.75),0_0_3px_rgba(16,185,129,0.85)] pointer-events-none opacity-80 relative z-20" />

        <div className="overflow-y-auto flex-1">
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="apple-input rounded-full px-5 py-2.5"
              required
            />
          </div>

          {/* Contenido */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contenido *
            </label>
            <RichTextEditor
              value={formData.content}
              onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
              placeholder="Escribe el contenido de la publicación aquí. Puedes usar las herramientas de formato, insertar imágenes, enlaces, etc."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 Puedes insertar imágenes directamente desde el editor usando el botón de imagen
            </p>
          </div>

          {/* Resumen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Resumen (opcional)
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              rows={2}
              className="apple-input rounded-[1.5rem] px-5 py-3"
              placeholder="Se generará automáticamente si se deja vacío"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoría
              </label>
              <AppleDropdown
                options={[
                  { value: '', label: 'Sin categoría' },
                  ...categories.map(cat => ({
                    value: cat.id,
                    label: cat.name
                  }))
                ]}
                value={formData.category_id || ''}
                onChange={(value) => setFormData(prev => ({ ...prev, category_id: value || '' }))}
                placeholder="Sin categoría"
                theme="emerald"
                pill={true}
              />
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prioridad
              </label>
              <AppleDropdown
                options={[
                  { value: '0', label: 'Normal' },
                  { value: '1', label: 'Alta' },
                  { value: '2', label: 'Urgente' }
                ]}
                value={formData.priority.toString()}
                onChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) }))}
                placeholder="Normal"
                theme="emerald"
                pill={true}
              />
            </div>
          </div>

          {/* Imagen destacada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Imagen destacada
            </label>
            {formData.featured_image_url && (
              <img
                src={formData.featured_image_url}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg mb-2"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              className="apple-input rounded-full px-5 py-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-500/20 cursor-pointer transition-all duration-200"
            />
            {uploadingImage && <p className="text-xs text-emerald-500 mt-1 animate-pulse">Subiendo...</p>}
          </div>

          {/* Centro de Control Boreal (Ajustes de Publicación) */}
          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] rounded-[2rem] p-4 sm:p-5 space-y-4">
            <h4 className="text-[13px] font-bold text-gray-600 dark:text-zinc-400 mb-1.5 select-none">
              Ajustes de distribución y visibilidad
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Publicación general */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all cursor-pointer group">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Publicación General</span>
                  <span className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">A todos los grupos</span>
                </div>
                <div className="relative flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_general}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_general: e.target.checked, group_ids: e.target.checked ? [] : prev.group_ids }))}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-all duration-200 ease-in-out ${
                    formData.is_general 
                      ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]' 
                      : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}>
                    <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                      formData.is_general ? 'translate-x-4' : 'translate-x-0'
                    }`}></div>
                  </div>
                </div>
              </label>

              {/* Fijar en la parte superior */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all cursor-pointer group">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Fijar al Inicio</span>
                  <span className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">Fijar en cabecera</span>
                </div>
                <div className="relative flex-shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_pinned}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-all duration-200 ease-in-out ${
                    formData.is_pinned 
                      ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]' 
                      : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}>
                    <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                      formData.is_pinned ? 'translate-x-4' : 'translate-x-0'
                    }`}></div>
                  </div>
                </div>
              </label>

              {/* Compartir con afiliados (super_admin) */}
              {userRole === 'super_admin' ? (
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all cursor-pointer group">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Compartir Afiliados</span>
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">Estudios externos</span>
                  </div>
                  <div className="relative flex-shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.share_with_affiliates}
                      onChange={(e) => setFormData(prev => ({ ...prev, share_with_affiliates: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-9 h-5 rounded-full transition-all duration-200 ease-in-out ${
                      formData.share_with_affiliates 
                        ? 'bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]' 
                        : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}>
                      <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
                        formData.share_with_affiliates ? 'translate-x-4' : 'translate-x-0'
                      }`}></div>
                    </div>
                  </div>
                </label>
              ) : (
                /* Espacio reservado para balancear el grid si no es super_admin */
                <div className="hidden sm:block" />
              )}
            </div>
          </div>

          {/* Segmentación por Grupo y Rol con Revelación Dinámica (Opción 1: Chips interactivos en píldoras) */}
          {(!formData.is_general || userRole === 'super_admin') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Grupos objetivo */}
              {!formData.is_general && (
                <div className="flex flex-col">
                  <label className="block text-[13px] font-bold text-gray-600 dark:text-zinc-400 mb-2 select-none">
                    Grupos objetivo
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {groups.map(group => {
                      const isChecked = formData.group_ids.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setFormData(prev => ({ ...prev, group_ids: prev.group_ids.filter(id => id !== group.id) }));
                            } else {
                              setFormData(prev => ({ ...prev, group_ids: [...prev.group_ids, group.id] }));
                            }
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30 font-bold shadow-[0_2px_8px_rgba(16,185,129,0.1)]'
                              : 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] border-black/[0.06] dark:border-emerald-500/[0.1] text-gray-500 dark:text-emerald-400/70 hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.1] hover:text-emerald-600 dark:hover:text-emerald-300'
                          }`}
                        >
                          {isChecked && (
                            <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-extrabold animate-scale-up">✓</span>
                          )}
                          {group.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selección por rol (solo para super_admin) */}
              {userRole === 'super_admin' && (
                <div className="flex flex-col">
                  <label className="block text-[13px] font-bold text-gray-600 dark:text-zinc-400 mb-2 select-none">
                    Roles objetivo (opcional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* Admin Chip */}
                    {(() => {
                      const isChecked = formData.target_roles.includes('admin');
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setFormData(prev => ({ ...prev, target_roles: prev.target_roles.filter(role => role !== 'admin') }));
                            } else {
                              setFormData(prev => ({ ...prev, target_roles: [...prev.target_roles, 'admin'] }));
                            }
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30 font-bold shadow-[0_2px_8px_rgba(16,185,129,0.1)]'
                              : 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] border-black/[0.06] dark:border-emerald-500/[0.1] text-gray-500 dark:text-emerald-400/70 hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.1] hover:text-emerald-600 dark:hover:text-emerald-300'
                          }`}
                        >
                          {isChecked && (
                            <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-extrabold animate-scale-up">✓</span>
                          )}
                          Admin
                        </button>
                      );
                    })()}

                    {/* Super Admin Chip */}
                    {(() => {
                      const isChecked = formData.target_roles.includes('super_admin');
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setFormData(prev => ({ ...prev, target_roles: prev.target_roles.filter(role => role !== 'super_admin') }));
                            } else {
                              setFormData(prev => ({ ...prev, target_roles: [...prev.target_roles, 'super_admin'] }));
                            }
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                            isChecked
                              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 dark:border-emerald-500/30 font-bold shadow-[0_2px_8px_rgba(16,185,129,0.1)]'
                              : 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] border-black/[0.06] dark:border-emerald-500/[0.1] text-gray-500 dark:text-emerald-400/70 hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.1] hover:text-emerald-600 dark:hover:text-emerald-300'
                          }`}
                        >
                          {isChecked && (
                            <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-extrabold animate-scale-up">✓</span>
                          )}
                          Super Admin
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fecha de expiración */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha de expiración (opcional)
            </label>
            <AppleDatePicker
              value={formData.expires_at}
              onChange={(date) => setFormData(prev => ({ ...prev, expires_at: date }))}
              placeholder="dd/mm/aaaa"
              theme="emerald"
              pill={true}
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 border border-transparent rounded-full transition-all duration-200 active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-apple-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar</span>
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

