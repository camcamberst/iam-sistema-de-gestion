'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';

// Importar Quill dinámicamente para evitar problemas de SSR
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escribe el contenido aquí...',
  className = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstanceRef = useRef<any>(null);
  const [uploading, setUploading] = useState(false);

  // Función para subir imagen
  const uploadImage = async (file: File) => {
    // Validar tamaño (4MB máximo para evitar problemas con límites de Vercel)
    const maxSize = 4 * 1024 * 1024; // 4MB
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. El límite máximo es 4MB. Por favor, comprime la imagen o usa una imagen más pequeña.');
      return null;
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de archivo no permitido. Use JPEG, PNG, GIF o WebP');
      return null;
    }

    try {
      setUploading(true);
      
      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('No hay sesión activa');
        return null;
      }

      // Preparar FormData
      const formData = new FormData();
      formData.append('file', file);

      // Subir imagen
      const response = await fetch('/api/announcements/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      // Verificar si la respuesta es exitosa
      if (!response.ok) {
        // Si es error 413, mostrar mensaje específico
        if (response.status === 413) {
          alert('El archivo es demasiado grande. El límite máximo es 4MB. Por favor, comprime la imagen o usa una imagen más pequeña.');
          return null;
        }
        
        // Intentar parsear como JSON, si falla, mostrar mensaje genérico
        let errorMessage = 'Error al subir la imagen';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          // Si no es JSON, usar el status text
          errorMessage = `Error ${response.status}: ${response.statusText || 'Error desconocido'}`;
        }
        
        alert(errorMessage);
        return null;
      }

      // Intentar parsear la respuesta como JSON
      let result;
      try {
        result = await response.json();
      } catch (error) {
        console.error('Error parseando respuesta JSON:', error);
        alert('Error al procesar la respuesta del servidor');
        return null;
      }

      if (result.success && result.url) {
        return result.url;
      } else {
        alert('Error subiendo imagen: ' + (result.error || 'Error desconocido'));
        return null;
      }
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      alert('Error al subir la imagen. Por favor, verifica tu conexión e intenta de nuevo.');
      return null;
    } finally {
      document.body.style.overflow = '';
      setUploading(false);
    }
  };

  // Configurar el handler de imágenes después de que el editor esté montado
  useEffect(() => {
    if (!editorRef.current) return;

    // Función para encontrar el editor de Quill
    const findQuillEditor = () => {
      const quillElement = editorRef.current?.querySelector('.ql-editor');
      if (quillElement && (quillElement as any).__quill) {
        return (quillElement as any).__quill;
      }
      return null;
    };

    // Intentar encontrar el editor después de un breve delay
    const timer = setTimeout(() => {
      const quill = findQuillEditor();
      if (quill && !quillInstanceRef.current) {
        quillInstanceRef.current = quill;
        
        const toolbar = quill.getModule('toolbar');
        
        // Reemplazar el handler de imagen por defecto
        toolbar.addHandler('image', async () => {
          const input = document.createElement('input');
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.click();

          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            const imageUrl = await uploadImage(file);
            if (imageUrl && quillInstanceRef.current) {
              // Obtener la posición del cursor
              const range = quillInstanceRef.current.getSelection(true);
              
              // Insertar la imagen en el editor
              quillInstanceRef.current.insertEmbed(range.index, 'image', imageUrl);
              
              // Mover el cursor después de la imagen
              quillInstanceRef.current.setSelection(range.index + 1);
            }
          };
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [value]); // Re-ejecutar cuando el valor cambie (editor se monta)

  // Configuración del toolbar de Quill
  const modules = {
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': [] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
      ]
    },
    clipboard: {
      matchVisual: false,
    }
  };

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'color', 'background',
    'align',
    'link', 'image', 'video'
  ];

  return (
    <div className={`rich-text-editor relative border border-black/[0.08] dark:border-white/[0.08] rounded-2xl overflow-hidden bg-white dark:bg-[#141416] shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 dark:focus-within:ring-emerald-400/20 focus-within:border-emerald-500/40 dark:focus-within:border-emerald-400/40 transition-all duration-300 ${className}`} ref={editorRef}>
      {uploading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl" style={{ zIndex: 9999 }}>
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-black/5 dark:border-white/10 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-scale-up">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent"></div>
            <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Subiendo imagen...</span>
          </div>
        </div>
      )}
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        className="bg-transparent"
        style={{
          height: '400px',
        }}
      />
    </div>
  );
}
