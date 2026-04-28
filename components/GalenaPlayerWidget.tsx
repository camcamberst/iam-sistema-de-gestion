'use client';

import React, { useState, useEffect, useRef } from 'react';

// Tipos base para la estación
interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
}

// Las paletas y categorías se movieron a GalenaContext para su acceso global

import { useGalena, CATEGORIES } from '@/contexts/GalenaContext';

export default function GalenaPlayerWidget() {
  const {
    stations,
    loading,
    activeCategory,
    setActiveCategory,
    currentStation,
    isPlaying,
    volume,
    setVolume,
    errorMsg,
    favorites,
    toggleFavorite,
    auroraPalette,
    togglePlay,
    playStation,
    playNext,
    playPrev,
    stopAudio,
    triggerInit
  } = useGalena();

  // Asegura inicializar memoria API si abren el admin y tocan el Widget primero
  useEffect(() => {
    triggerInit();
  }, [triggerInit]);

  // --- Lógica de Auto-Scroll por Proximidad (Edge Scrolling) ---
  const listRef = useRef<HTMLDivElement>(null);
  const scrollSpeedRef = useRef<number>(0);
  const scrollAnimationRef = useRef<number | null>(null);

  const startScrollLoop = () => {
    if (scrollAnimationRef.current === null) {
      const scrollLoop = () => {
        if (listRef.current && scrollSpeedRef.current !== 0) {
          listRef.current.scrollTop += scrollSpeedRef.current;
          scrollAnimationRef.current = requestAnimationFrame(scrollLoop);
        } else {
          scrollAnimationRef.current = null;
        }
      };
      scrollAnimationRef.current = requestAnimationFrame(scrollLoop);
    }
  };

  const stopScrollLoop = () => {
    scrollSpeedRef.current = 0;
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const threshold = 60; // Píxeles de sensibilidad en los bordes top/bottom

    if (y < threshold) {
      // Zona superior -> Scroll Up
      const logicSpeed = (threshold - y) / 8;
      scrollSpeedRef.current = -(Math.min(logicSpeed, 2.5)); 
      startScrollLoop();
    } else if (y > rect.height - threshold) {
      // Zona inferior -> Scroll Down
      const logicSpeed = (y - (rect.height - threshold)) / 8;
      scrollSpeedRef.current = Math.min(logicSpeed, 2.5);
      startScrollLoop();
    } else {
      // Zona central (muerta) -> Detener
      stopScrollLoop();
    }
  };

  const handleMouseLeave = () => {
    stopScrollLoop();
  };

  useEffect(() => {
    return () => stopScrollLoop(); // Cleanup
  }, []);

  // UI
  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-[2rem] bg-gradient-to-br from-gray-900/80 to-black/95 dark:from-[#050505]/95 dark:to-[#000000]/95 backdrop-blur-[80px] flex flex-col sm:flex-row h-[auto] sm:h-[280px] border border-white/10 dark:border-white/5 dark:border-t-purple-500/20 shadow-2xl dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_25px_50px_rgba(0,0,0,0.9)]">
      
      {/* Glow Boreal unificado (mismo efecto de la cápsula inferior) */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div 
          className={`absolute -inset-2 blur-3xl mix-blend-screen transition-opacity duration-1000 ${isPlaying ? 'opacity-30 dark:opacity-40' : 'opacity-0'}`} 
          style={{ 
            background: 'linear-gradient(90deg, var(--c1), var(--c2), var(--c3), var(--c2), var(--c1))', 
            backgroundSize: '200% auto', 
            animation: 'aurora-shift 5s linear infinite',
            ...(auroraPalette.textVars as React.CSSProperties)
          }}
        ></div>
      </div>

      {/* Panel Izquierdo: Reproductor iPod Style */}
      <div className="relative z-10 w-full sm:w-[310px] p-2.5 sm:p-5 flex flex-col justify-between border-b sm:border-b-0 sm:border-r border-white/5 bg-black/20 h-full">
        
        {/* Cabecera AIM | Galena */}
        <div className="relative flex items-center justify-center mb-1 w-full mt-1">
          <div className="flex items-center relative">
            {/* Badge AIM Dinámico (Live Indicator Verde y Blanco) */}
            <div className={`rounded-[14px] px-3.5 py-1.5 flex items-center justify-center shadow-sm transition-all duration-700 relative ${isPlaying ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-white'}`}>
              <span className={`font-extrabold text-[13px] tracking-wide leading-none transition-colors duration-500 ${isPlaying ? 'text-white' : 'text-gray-900'}`}>
                AIM
              </span>
            </div>
            
            {/* Separador Asimétrico Cercano al Logo (Engrosado) */}
            <div className="w-[3px] h-[20px] bg-[#94A3B8] rounded-full ml-[6px] mr-[7px] opacity-90"></div>
            
            <span className={`relative text-white font-black text-[24px] tracking-tighter leading-none pb-[1px] mr-3 transition-all duration-1000 ${isPlaying ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.25)] animate-[pulse_4s_ease-in-out_infinite]' : 'drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]'}`}>
               Galena
               {/* Icono de Ondas iluminado dinámicamente */}
               <svg 
                 className={`absolute -top-[5px] -right-[11px] w-[17px] h-[17px] text-white origin-bottom-left rotate-[15deg] transition-all duration-700 ${isPlaying ? 'drop-shadow-[0_0_5px_rgba(147,197,253,0.4)] text-blue-50 animate-[pulse_2s_ease-in-out_infinite]' : 'drop-shadow-[0_2px_6px_rgba(255,255,255,0.5)]'}`} 
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               >
                 <path d="M4 11a9 9 0 0 1 9 9" />
                 <path d="M4 4a16 16 0 0 1 16 16" />
                 <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
               </svg>
            </span>
          </div>
        </div>

        {/* Portada Cover Art Pseudo (Estilo Vinilo) */}
        <div className="flex flex-col items-center mt-2 flex-grow justify-center">
          <div className={`relative w-16 h-16 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.5)] border-2 border-[#222] transition-transform duration-1000 ${isPlaying ? 'animate-[spin_12s_linear_infinite] shadow-blue-500/10' : 'grayscale-[0.5]'}`}>
            {/* Filtro Oscuro de Surcos de Vinilo */}
            <div className="absolute inset-0 border-[5px] sm:border-[6px] border-black/40 rounded-full z-10 pointer-events-none mix-blend-overlay"></div>
            {currentStation?.favicon ? (
               <img src={currentStation.favicon} alt="Cover" className="w-full h-full object-cover scale-[1.1]" onError={(e) => { const target = e.currentTarget as HTMLImageElement; if (!target.src.includes('/images/aim-icon.png')) { target.src = '/images/aim-icon.png'; } else { target.style.display = 'none'; } }} />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-800 flex items-center justify-center">
                <svg className="w-10 h-10 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              </div>
            )}
            
            {/* Eje central giratorio */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 bg-[#0A0A0C] border border-white/20 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center">
              <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white/40 rounded-full transition-transform duration-1000 ${isPlaying ? 'scale-100' : 'scale-50'}`}></div>
            </div>
            
            {/* Glossy Reflection overlay (iPod cover style) */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-40 pointer-events-none z-30"></div>
          </div>
          
          <div className="text-center mt-1 w-full px-2 pt-1">
            <h3 className="text-white text-[15px] sm:text-[16px] font-semibold tracking-tight truncate leading-none drop-shadow-md">
              {currentStation?.name || 'Radio no sintonizada'}
            </h3>
          </div>
        </div>

        {/* Controles Dinámicos */}
        <div className="flex flex-col items-center mt-2 sm:mt-3 mb-0 sm:mb-1">
          {/* Fila Principal de Botones Multimedia */}
          <div className="flex items-center gap-4 mb-2 sm:mb-3">
            {/* Prev */}
            <button onClick={playPrev} className="text-white/50 hover:text-white active:scale-95 transition-all duration-200" title="Emisora Anterior">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            
            {/* Stop (Oculto en móvil para simetría) */}
            <button onClick={stopAudio} className="hidden sm:block text-white/50 hover:text-red-400 active:scale-95 transition-all duration-200" title="Detener Frecuencia">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            </button>
            
            {/* Play/Pause */}
            <button 
              onClick={togglePlay}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 bg-white text-black hover:scale-105 active:scale-[0.90] hover:bg-gray-100 shadow-xl ${isPlaying ? 'shadow-white/20' : ''}`}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            
            {/* Next */}
            <button onClick={playNext} className="text-white/50 hover:text-white active:scale-95 transition-all duration-200" title="Siguiente Emisora">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
            
            {/* Botón Favoritos (Sustituye al antiguo ecualizador) */}
            <button 
              onClick={toggleFavorite}
              className={`transition-all duration-300 ml-1 hidden sm:block ${currentStation ? 'hover:scale-110 cursor-pointer' : 'opacity-20 cursor-not-allowed'}`} 
              title={currentStation && favorites.some(s => s.stationuuid === currentStation.stationuuid) ? "Quitar de Favoritos" : "Guardar en Favoritos"}
              disabled={!currentStation}
            >
               <svg 
                 className={`w-[17px] h-[17px] transition-all duration-500 ${currentStation && favorites.some(s => s.stationuuid === currentStation.stationuuid) ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]' : 'fill-transparent text-white/30 hover:text-white/80'}`} 
                 stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"
               >
                 <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
               </svg>
            </button>
          </div>
          
          {/* Volumen deslizador estilo iPod */}
          <div className="flex items-center gap-3 w-full px-4 text-white/50">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
            />
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"></path></svg>
          </div>
        </div>
        
        {errorMsg && (
            <p className="text-red-400 text-[10px] text-center mt-2 px-2 bg-red-900/20 py-1 rounded">{errorMsg}</p>
        )}
      </div>

      {/* Panel Derecho: Explorador de Emisoras */}
      <div className="relative z-10 flex-1 py-3 pl-3 pr-1 sm:py-5 sm:pl-6 sm:pr-0 flex flex-col h-full sm:h-[280px] overflow-hidden">
        {/* Chips de Géneros */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 shrink-0 mask-fade-right scrollbar-hide">
          <button
            onClick={() => setActiveCategory({ id: 'favorites', name: 'Favoritas', tags: '' })}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 border flex items-center gap-1.5 shrink-0 ${
              activeCategory.id === 'favorites' 
                ? 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]' 
                : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className={`w-3 h-3 ${activeCategory.id === 'favorites' ? 'fill-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'fill-transparent'}`} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            Tus Favoritas
          </button>
          
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap active:scale-95 transition-all duration-300 border ${
                activeCategory.id === cat.id 
                  ? 'bg-white text-black border-white shadow-lg shadow-white/20' 
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Lista de emisoras con barra de scroll oculta y auto-desplazamiento mágico */}
        <div 
          ref={listRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="flex-1 min-h-0 max-h-[140px] sm:max-h-none overflow-y-auto pr-1 sm:pr-2 [&::-webkit-scrollbar]:hidden"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)' }}
        >
          {loading && activeCategory.id !== 'favorites' ? (
            <div className="flex flex-col gap-3 mt-2 h-full justify-center items-center">
               <div className="w-8 h-8 border-4 border-white/10 border-t-white/80 rounded-full animate-spin"></div>
               <span className="text-xs text-white/50 tracking-widest uppercase mt-2">Buscando Frecuencias...</span>
            </div>
          ) : (activeCategory.id === 'favorites' ? favorites : stations).length > 0 ? (
            <div className="flex flex-col gap-1.5 mt-2 pb-2">
              {(activeCategory.id === 'favorites' ? favorites : stations).map((station) => (
                <div 
                  key={station.stationuuid}
                  onClick={() => playStation(station)}
                  className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                    currentStation?.stationuuid === station.stationuuid 
                      ? 'bg-blue-500/20 border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' 
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      {station.favicon ? (
                         <img src={station.favicon} alt="" className="w-full h-full object-cover" onError={(e) => { const target = e.currentTarget as HTMLImageElement; if (!target.src.includes('/images/aim-icon.png')) { target.src = '/images/aim-icon.png'; } else { target.style.display = 'none'; } }} />
                      ) : (
                        <span className="text-white/30 text-xs text-center leading-none">FM</span>
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className={`text-sm font-semibold truncate ${currentStation?.stationuuid === station.stationuuid ? 'text-white' : 'text-gray-300 group-hover:text-white transition-colors'}`}>
                        {station.name}
                      </span>
                      <span className="text-[11px] text-gray-500 truncate uppercase mt-0.5 tracking-wider">
                         {station.tags.split(',').slice(0, 2).join(' • ') || 'Radio'}
                      </span>
                    </div>
                  </div>
                  
                  {currentStation?.stationuuid === station.stationuuid && isPlaying ? (
                     <div className="flex items-center justify-center gap-0.5 w-8 h-8 shrink-0">
                        <span className="w-1 bg-white/80 rounded-full h-1/2 animate-[bounce_1s_infinite]"></span>
                        <span className="w-1 bg-white/80 rounded-full h-1/3 animate-[bounce_1s_infinite_0.2s]"></span>
                        <span className="w-1 bg-white/80 rounded-full h-2/3 animate-[bounce_1s_infinite_0.4s]"></span>
                     </div>
                  ) : (
                    <div className="flex items-center justify-end shrink-0">
                      <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${currentStation?.stationuuid === station.stationuuid ? 'bg-white text-black' : 'bg-transparent text-white/30 group-hover:bg-white/10 group-hover:text-white'}`}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
               <span className="text-xs text-white/40">No hay estaciones disponibles en esta categoría.</span>
            </div>
          )}
        </div>

        {/* Pie Flotante: Texto Legal/Informativo Animado */}
        <div className="absolute bottom-1 left-0 right-0 flex justify-center w-full select-none pointer-events-none z-20">
          <span 
            className={`text-[9px] uppercase tracking-[0.15em] font-medium text-center flex items-center gap-1.5 transition-opacity duration-1000 ${isPlaying ? 'animate-boreal-morph opacity-90' : 'text-white/30 opacity-70'}`}
            style={isPlaying ? auroraPalette.textVars as React.CSSProperties : {}}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.64-2.25 1.64-1.74 0-2.1-.96-2.18-1.68H8.01c.12 1.85 1.49 2.99 2.89 3.32V19h2.4v-1.71c1.64-.31 2.74-1.43 2.74-2.98 0-2.01-1.65-2.77-3.73-3.17z"/></svg>
            Música libre de copyright, ideal para transmitir
          </span>
        </div>
      </div>
      
      {/* CSS local para barras de scroll sutiles */}
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .mask-fade-right {
          mask-image: linear-gradient(to right, black 85%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
        }
        @keyframes boreal-morph {
          0% { color: var(--c1); }
          33% { color: var(--c2); }
          66% { color: var(--c3); }
          100% { color: var(--c1); }
        }
        @keyframes aurora-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .animate-boreal-morph {
          animation: boreal-morph 6s ease-in-out infinite;
        }
      `}} />
    </div>
  );
}
