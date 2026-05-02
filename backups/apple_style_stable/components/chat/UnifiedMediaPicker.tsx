import React, { useState, useRef, useEffect } from 'react';
import EmojiGrid from './EmojiGrid';
import { StickerPicker } from './StickerPicker';
import { GifPicker } from './GifPicker';

interface UnifiedMediaPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (url: string) => void;
  onSelectGif: (url: string) => void;
  onClose: () => void;
  themeConfig?: any;
}

export default function UnifiedMediaPicker({
  onSelectEmoji,
  onSelectSticker,
  onSelectGif,
  onClose,
  themeConfig = {
    emojiHover: 'hover:bg-gray-700/50',
    emojiCategoryTitle: 'text-gray-500'
  }
}: UnifiedMediaPickerProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
  const [emojiSearchQuery, setEmojiSearchQuery] = useState('');
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [showSearch, setShowSearch] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cierra al apretar Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setEmojiSearchQuery('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSearch]);

  // Auto-focus al abrir la barra de búsqueda
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      // Pequeño timeout para permitir que la animación empiece antes de hacer focus
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [showSearch]);

  const scrollToCategory = (id: string) => {
    if (categoryRefs.current[id]) {
      categoryRefs.current[id]?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-transparent overflow-hidden animate-in slide-in-from-bottom-2 duration-300 ease-out">
      
      {/* Apple-Style Top Tab Bar (Textos) */}
      <div className="flex-shrink-0 flex items-center px-4 pt-2 border-b border-white/10 dark:border-white/5">
        <div className="flex space-x-6 w-full justify-center">
          <button
            onClick={() => setActiveTab('emoji')}
            className={`relative -mb-[1px] pb-1.5 text-[13px] font-medium transition-all duration-300 border-b-2 ${activeTab === 'emoji' ? 'text-blue-500 border-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 border-transparent'}`}
          >
            Emojis
          </button>
          <button
            onClick={() => setActiveTab('sticker')}
            className={`relative -mb-[1px] pb-1.5 text-[13px] font-medium transition-all duration-300 border-b-2 ${activeTab === 'sticker' ? 'text-blue-500 border-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 border-transparent'}`}
          >
            Stickers
          </button>
          <button
            onClick={() => setActiveTab('gif')}
            className={`relative -mb-[1px] pb-1.5 text-[13px] font-medium transition-all duration-300 border-b-2 ${activeTab === 'gif' ? 'text-blue-500 border-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 border-transparent'}`}
          >
            GIFs
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {activeTab === 'emoji' && (
          <div className="px-1 py-2 h-full flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <EmojiGrid 
                emojiSearchQuery={emojiSearchQuery} 
                onEmojiSelect={onSelectEmoji} 
                themeConfig={themeConfig} 
                categoryRefs={categoryRefs}
                buttonClassName="w-[30px] h-[30px] text-[18px]" 
              />
            </div>
            
            {/* Bottom Shortcuts Bar */}
            <div className="flex-shrink-0 flex items-center p-1 border-t border-white/10 dark:border-white/5 bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-xl mt-1 mx-1 overflow-hidden relative">
              
              {/* Botón Lupa (ahora al comienzo, lado izquierdo) */}
              <div className="mr-1 flex items-center justify-center relative z-10 bg-transparent">
                <button
                  onClick={() => {
                    setShowSearch(!showSearch);
                    if (showSearch) setEmojiSearchQuery('');
                  }}
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors"
                >
                  {showSearch ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Categorías Atajos (se deslizan hacia la derecha cuando se abre la búsqueda) */}
              <div className={`flex items-center justify-around flex-1 transition-all duration-300 ${showSearch ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}>
                {[
                  { id: 'smileys', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg> },
                  { id: 'gestures', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v4a2 2 0 0 0-4 0V4a2 2 0 0 0-4 0v6a2 2 0 0 0-4 0v7a8 8 0 0 0 16 0v-6z"></path></svg> },
                  { id: 'people', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> },
                  { id: 'animals', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg> },
                  { id: 'food', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> },
                  { id: 'hearts', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> },
                  { id: 'objects', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 12 3a4.65 4.65 0 0 0-4.5 8.5c.76.76 1.23 1.52 1.41 2.5"></path></svg> },
                  { id: 'symbols', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg> },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-300 hover:scale-110 transition-transform"
                    title={cat.id}
                  >
                    {cat.icon}
                  </button>
                ))}
              </div>

              {/* Barra de Búsqueda Deslizante (ahora viene desde la izquierda hacia la derecha) */}
              <div className={`absolute left-7 top-0 bottom-0 right-0 bg-transparent flex items-center px-1 transition-all duration-300 ${showSearch ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar emojis..."
                  value={emojiSearchQuery}
                  onChange={(e) => setEmojiSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-gray-900 dark:text-white text-[12px] text-left focus:outline-none placeholder-gray-500 px-1"
                />
              </div>

            </div>
          </div>
        )}
        
        {activeTab === 'sticker' && (
          <div className="h-full pt-2">
            <StickerPicker onSelectSticker={onSelectSticker} themeConfig={themeConfig} />
          </div>
        )}
        
        {activeTab === 'gif' && (
          <div className="h-full">
            <GifPicker onSelectGif={onSelectGif} />
          </div>
        )}
      </div>

    </div>
  );
}
