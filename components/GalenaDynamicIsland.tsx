'use client';

import React from 'react';
import { useGalena, CATEGORIES } from '@/contexts/GalenaContext';

export default function GalenaDynamicIsland() {
  const { currentStation, isPlaying, togglePlay, playNext, playPrev, auroraPalette, activeCategory, setActiveCategory, stopAudio } = useGalena();

  // Función para ciclar de categoría rápidamente
  const handleCategoryNext = () => {
    const currentIndex = CATEGORIES.findIndex(c => c.id === activeCategory.id);
    const nextCat = CATEGORIES[(currentIndex + 1) % CATEGORIES.length];
    setActiveCategory(nextCat);
  };

  // "Isla" no se rinde si no hay estación cargada
  // La Isla existe siempre en el DOM pero maneja su vida útil, retiro y aparición por CSS
  const isVisible = currentStation && isPlaying;

  return (
    <div className={`flex lg:hidden mx-auto items-center justify-between rounded-[20px] bg-[#1c1c1e] dark:bg-[#0a0f1a] border border-white/10 dark:border-white/5 transition-all duration-[1200ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] shadow-xl overflow-hidden ${
      isVisible 
        ? 'max-w-[200px] sm:max-w-[220px] w-full opacity-100 scale-100 p-1 pr-2 mt-2 mb-2' 
        : 'max-w-0 h-0 p-0 m-0 border-0 opacity-0 scale-75 pointer-events-none -translate-y-4'
    }`}>
      {/* 1. Cover Art Minified */}
      <div className={`relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 transition-transform duration-500 ${isPlaying ? 'scale-100' : 'scale-90 opacity-80'}`}>
        {currentStation?.favicon ? (
          <img src={currentStation.favicon} alt="" className="w-full h-full object-cover" onError={(e) => { const target = e.currentTarget as HTMLImageElement; if (!target.src.includes('/images/aim-icon.png')) { target.src = '/images/aim-icon.png'; } else { target.style.display = 'none'; } }} />
        ) : (
          <div className={`w-full h-full ${auroraPalette?.main || 'bg-indigo-500'} flex items-center justify-center`}>
            <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
        )}
        {/* EQ superpuesto si está sonando */}
        {isPlaying && (
           <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-[2px]">
              <span className="w-[2px] bg-white rounded-full h-[6px] animate-[bounce_1s_infinite]"></span>
              <span className="w-[2px] bg-white rounded-full h-[4px] animate-[bounce_1s_infinite_0.2s]"></span>
              <span className="w-[2px] bg-white rounded-full h-[8px] animate-[bounce_1s_infinite_0.4s]"></span>
           </div>
        )}
      </div>

      {/* 2. Selector Rápido de Categoría / Ticker */}
      <div className={`flex flex-col flex-1 min-w-0 px-2 items-center justify-center transition-all duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
        <button 
          onClick={handleCategoryNext}
          className="text-[11px] text-white/80 hover:text-white font-medium tracking-wide truncate bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-full border border-white/5 active:scale-95 transition-all"
        >
          {activeCategory.name}
        </button>
      </div>

      {/* 3. Controles Ultra-Compactos completos */}
      <div className={`flex items-center gap-1 shrink-0 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        
        <button onClick={playPrev} className="px-0.5 text-white/40 hover:text-white transition-colors" title="Anterior">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>

        {/* Botón Stop Premium */}
        <button onClick={stopAudio} className="px-0.5 text-white/30 hover:text-white active:scale-90 transition-colors" title="Detener">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
        </button>
        
        <button onClick={togglePlay} className="p-1 text-white hover:text-blue-400 active:scale-90 transition-all" title="Pausar">
          {isPlaying ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        <button onClick={playNext} className="px-0.5 text-white/40 hover:text-white transition-colors" title="Siguiente">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>
    </div>
  );
}
