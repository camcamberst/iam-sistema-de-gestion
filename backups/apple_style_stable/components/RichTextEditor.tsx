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
        } catch {
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
    <div className={`rich-text-editor relative ${className}`} ref={editorRef}>
      {uploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-lg" style={{ zIndex: 9999 }}>
          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Subiendo imagen...</span>
            </div>
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
        className="bg-white dark:bg-gray-800"
        style={{
          height: '400px',
        }}
      />
      <style jsx global>{`
        .rich-text-editor .ql-container {
          min-height: 300px;
          font-size: 14px;
          color: #1f2937;
        }
        
        .dark .rich-text-editor .ql-container {
          color: #f3f4f6;
        }
        
        .rich-text-editor .ql-editor {
          min-height: 300px;
        }
        
        .rich-text-editor .ql-stroke {
          stroke: #6b7280;
        }
        
        .dark .rich-text-editor .ql-stroke {
          stroke: #9ca3af;
        }
        
        .rich-text-editor .ql-fill {
          fill: #6b7280;
        }
        
        .dark .rich-text-editor .ql-fill {
          fill: #9ca3af;
        }
        
        .rich-text-editor .ql-picker-label {
          color: #6b7280;
        }
        
        .dark .rich-text-editor .ql-picker-label {
          color: #9ca3af;
        }
        
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          background-color: #f9fafb;
        }
        
        .dark .rich-text-editor .ql-toolbar {
          border-bottom-color: #4b5563;
          background-color: #374151;
        }
        
        .rich-text-editor .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          background-color: #ffffff;
        }
        
        .dark .rich-text-editor .ql-container {
          border-color: #4b5563;
          background-color: #1f2937;
        }
        
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
        
        .dark .rich-text-editor .ql-editor.ql-blank::before {
          color: #6b7280;
        }
        
        .rich-text-editor .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
