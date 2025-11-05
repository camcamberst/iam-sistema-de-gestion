'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import RichTextEditor from './RichTextEditor';

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
  userRole: 'super_admin' | 'admin';
  userGroups: string[];
}

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
    <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Corcho Informativo</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Gestiona publicaciones e información para modelos</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingAnnouncement(null);
            setShowEditor(true);
          }}
          className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Publicación
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('published')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === 'published'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
            }`}
          >
            Publicadas
          </button>
          <button
            onClick={() => setFilter('draft')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === 'draft'
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
            }`}
          >
            Borradores
          </button>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Lista de publicaciones */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No hay publicaciones {filter !== 'all' ? `(${filter === 'published' ? 'publicadas' : 'borradores'})` : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map(announcement => (
            <div
              key={announcement.id}
              className="bg-gray-50/50 dark:bg-gray-600/30 rounded-lg p-4 border border-gray-200/50 dark:border-gray-500/30 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.is_pinned && (
                      <span className="text-xs text-purple-600 dark:text-purple-400">📌</span>
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
                    {!announcement.is_published && (
                      <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                        Borrador
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    {announcement.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                    {announcement.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Por: {announcement.author?.name || 'Desconocido'}</span>
                    <span>•</span>
                    <span>{new Date(announcement.created_at).toLocaleDateString('es-CO')}</span>
                    {announcement.is_published && (
                      <>
                        <span>•</span>
                        <span>{announcement.views_count} vistas</span>
                      </>
                    )}
                    {announcement.is_general ? (
                      <span className="text-purple-600 dark:text-purple-400">General</span>
                    ) : (
                      <span>{announcement.group_targets.length} grupo(s)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingAnnouncement(announcement);
                      setShowEditor(true);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleTogglePublish(announcement)}
                    className={`p-2 rounded-lg transition-colors ${
                      announcement.is_published
                        ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    title={announcement.is_published ? 'Despublicar' : 'Publicar'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {announcement.is_published ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
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
  userRole: 'super_admin' | 'admin';
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
    expires_at: announcement?.expires_at ? announcement.expires_at.split('T')[0] : ''
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
        featured_image_url: formData.featured_image_url || null,
        is_general: formData.is_general,
        group_ids: formData.is_general ? [] : formData.group_ids,
        target_roles: userRole === 'super_admin' ? formData.target_roles : [],
        is_published: formData.is_published,
        is_pinned: formData.is_pinned,
        priority: formData.priority,
        expires_at: formData.expires_at || null
      };

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
      className="fixed inset-0 flex items-center justify-center p-4" 
      style={{ 
        position: 'fixed',
        zIndex: 99999999,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        isolation: 'isolate'
      } as React.CSSProperties}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        style={{ zIndex: 1 } as React.CSSProperties}
      />
      <div 
        className="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto" 
        style={{ 
          zIndex: 2,
          position: 'relative',
          isolation: 'isolate'
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {announcement ? 'Editar Publicación' : 'Nueva Publicación'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              placeholder="Se generará automáticamente si se deja vacío"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoría
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sin categoría</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prioridad
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
              >
                <option value="0">Normal</option>
                <option value="1">Alta</option>
                <option value="2">Urgente</option>
              </select>
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            />
            {uploadingImage && <p className="text-xs text-gray-500 mt-1">Subiendo...</p>}
          </div>

          {/* Distribución */}
          <div>
            <label className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                checked={formData.is_general}
                onChange={(e) => setFormData(prev => ({ ...prev, is_general: e.target.checked, group_ids: e.target.checked ? [] : prev.group_ids }))}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Publicación general (todos los grupos)
              </span>
            </label>
            {(!formData.is_general || userRole === 'super_admin') && (
              <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Grupos objetivo */}
                {!formData.is_general && (
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Grupos objetivo
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                      {groups.map(group => (
                        <label key={group.id} className="flex items-center space-x-2 py-1">
                          <input
                            type="checkbox"
                            checked={formData.group_ids.includes(group.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, group_ids: [...prev.group_ids, group.id] }));
                              } else {
                                setFormData(prev => ({ ...prev, group_ids: prev.group_ids.filter(id => id !== group.id) }));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{group.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selección por rol (solo para super_admin) */}
                {userRole === 'super_admin' && (
                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Roles objetivo (opcional)
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Selecciona roles específicos para dirigir esta publicación a todos los usuarios de ese rol
                    </p>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                      <label className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.target_roles.includes('admin')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, target_roles: [...prev.target_roles, 'admin'] }));
                            } else {
                              setFormData(prev => ({ ...prev, target_roles: prev.target_roles.filter(role => role !== 'admin') }));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Admin</span>
                      </label>
                      <label className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          checked={formData.target_roles.includes('super_admin')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, target_roles: [...prev.target_roles, 'super_admin'] }));
                            } else {
                              setFormData(prev => ({ ...prev, target_roles: prev.target_roles.filter(role => role !== 'super_admin') }));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Super Admin</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Opciones */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.is_pinned}
                onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Fijar en la parte superior</span>
            </label>
          </div>

          {/* Fecha de expiración */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Fecha de expiración (opcional)
            </label>
            <input
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg hover:from-purple-600 hover:to-purple-700 focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
  );

  return createPortal(modalContent, document.body);
}

