import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface StickerPickerProps {
  onSelectSticker: (stickerUrl: string) => void;
  themeConfig?: any;
}

const BUCKET_NAME = 'chat-stickers';

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelectSticker, themeConfig }) => {
  const [stickers, setStickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStickers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (error) {
        // Si el bucket no existe, es normal al principio, retornamos vacío
        /* log removed */
        setStickers([]);
        return;
      }

      if (data) {
        const urls = data
          .filter(file => file.name !== '.emptyFolderPlaceholder')
          .map(file => {
            const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(file.name);
            return publicUrl;
          });
        setStickers(urls);
      }
    } catch (err) {
      /* log removed */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStickers();
  }, []);

  const handleUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    
    // Validar tipo (imágenes estáticas o webp transparentes recomendadas)
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida (PNG, WEBP).');
      return;
    }
    
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `sticker_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
        
      if (error) {
        throw error;
      }
      
      // Recargar stickers
      fetchStickers();
    } catch (err) {
      /* log removed */
      alert('Error subiendo sticker. Asegúrate de que el bucket "chat-stickers" exista y permita subidas públicas.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col h-[280px]">
      <div className="px-2 pb-2 flex justify-end items-center">
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 text-[11px] font-medium rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          {uploading ? (
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          )}
          Añadir
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/png, image/webp, image/gif"
          onChange={handleUploadSticker}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-[11px] text-gray-500 leading-snug">No hay stickers disponibles.</p>
            <p className="text-[10px] text-gray-400 mt-1">Haz clic en Añadir para crear el banco de stickers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {stickers.map((url, i) => (
              <button
                key={i}
                onClick={() => onSelectSticker(url)}
                className="relative rounded-lg overflow-hidden bg-transparent hover:bg-black/5 dark:hover:bg-white/5 aspect-square p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 group flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  alt={`Sticker ${i}`} 
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-200 drop-shadow-sm"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
