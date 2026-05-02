import React, { useState, useEffect, useCallback } from 'react';

const GIPHY_API_KEY = 'y2rcnfY5mgEbECaxOL2knnDCPpmZf2lQ';

interface GifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  themeConfig?: any;
}

export const GifPicker: React.FC<GifPickerProps> = ({ onSelectGif, themeConfig }) => {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGifs = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = searchQuery.trim() 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.meta && data.meta.status === 200) {
        setGifs(data.data);
      } else {
        throw new Error(data.meta?.msg || 'Error fetch GIFs');
      }
    } catch (err) {
      /* log removed */
      setError('No se pudieron cargar los GIFs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch trending on mount
  useEffect(() => {
    fetchGifs('');
  }, [fetchGifs]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() !== '') {
        fetchGifs(query);
      } else if (query === '') {
        fetchGifs('');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, fetchGifs]);

  return (
    <div className="flex flex-col h-[280px]">
      <div className="px-2 pb-2">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar GIFs en Giphy..."
          className={`w-full px-3 py-1.5 text-[13px] rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors ${themeConfig?.textColor || 'text-gray-800 dark:text-gray-200'} placeholder-gray-500`}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2">
        {loading && gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-xs text-red-500">
            {error}
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            No se encontraron GIFs
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelectGif(gif.images.fixed_height.url)}
                className="relative rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 aspect-video hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={gif.images.fixed_height_small.url} 
                  alt={gif.title} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Branding required by Giphy */}
      <div className="flex justify-end pr-2 opacity-50 pointer-events-none scale-75 origin-right mt-1">
        <span className="text-[10px] font-bold tracking-widest text-gray-500 mr-1">POWERED BY</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71 20" className="h-3 w-auto fill-current text-gray-500"><path d="M66.4 12v5h-4v-5h4zm-5-3.3h9V12h-9V8.7zM66.4 3v5h-4V3h4zm-5-3.3h9V3h-9V-.3zM49 12v5h-4v-5h4zm-5-3.3h9V12h-9V8.7zM49 3v5h-4V3h4zm-5-3.3h9V3h-9V-.3zM32 12v5h-4v-5h4zm-5-3.3h9V12h-9V8.7zM32 3v5h-4V3h4zm-5-3.3h9V3h-9V-.3zM15 12v5h-4v-5h4zm-5-3.3h9V12h-9V8.7zM15 3v5h-4V3h4zm-5-3.3h9V3h-9V-.3z" /></svg>
      </div>
    </div>
  );
};
