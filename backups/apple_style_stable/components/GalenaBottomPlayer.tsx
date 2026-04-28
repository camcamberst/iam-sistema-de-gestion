'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useGalena } from '@/contexts/GalenaContext';

// Iconos vectoriales limpios
const PlayIcon = () => (
  <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
);

const PauseIcon = () => (
  <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
);

const PrevIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
);

const NextIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
);

const VolumeIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"></path></svg>
);

const HeartIcon = ({ solid }: { solid?: boolean }) => (
  <svg 
    className={`w-5 h-5 transition-all duration-300 ${solid ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]' : 'fill-transparent text-white/50 hover:text-white'}`} 
    stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

export default function GalenaBottomPlayer() {
  const pathname = usePathname();
  const { 
    currentStation, 
    isPlaying, 
    togglePlay, 
    playNext, 
    playPrev, 
    volume, 
    setVolume, 
    favorites, 
    toggleFavorite 
  } = useGalena();

  // Regla: No renderizar en el Dashboard (ya hay un widget ahí) ni en Móvil (allí usa la TopBar Dynamic Island)
  const isDashboard = pathname === '/admin/dashboard' || pathname === '/admin/model/dashboard';
  const isVisible = !isDashboard && currentStation;

  // Ajustar el padding inferior de la página global para dar espacio a la barra (soluciona colisiones con ChatWidget)
  React.useEffect(() => {
    if (isVisible && window.innerWidth >= 1024) { // lg breakpoint
      document.body.style.paddingBottom = '110px';
      return () => { document.body.style.paddingBottom = ''; };
    } else {
      document.body.style.paddingBottom = '';
    }
  }, [isVisible, pathname]);
  
  if (!isVisible) return null;

  const isFav = favorites.some(s => s.stationuuid === currentStation.stationuuid);

  return (
    <>
      <div className={`hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] h-[76px] w-[90%] max-w-[900px] bg-[#0A0A0C]/80 dark:bg-[#030303]/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden items-center px-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${!isPlaying && !currentStation ? 'translate-y-[150%] opacity-0 scale-95' : 'translate-y-0 opacity-100 scale-100'}`}>
        
        {/* Glow Boreal de Fondo (dentro de la cápsula) */}
        <div className="absolute inset-0 -z-10 rounded-[2.5rem] pointer-events-none">
          <div className={`absolute -inset-2 blur-2xl mix-blend-screen transition-opacity duration-1000 ${isPlaying ? 'opacity-40' : 'opacity-0'}`} style={{ background: 'linear-gradient(90deg, #c084fc, #22d3ee, #818cf8, #f472b6, #c084fc)', backgroundSize: '200% auto', animation: 'aurora-shift 5s linear infinite' }}></div>
        </div>

        {/* Zona Izquierda: Información de la Pista (Estilo Vinilo) */}
        <div className="flex items-center w-[35%] min-w-[200px] h-full relative z-10">
           <div className={`relative w-14 h-14 rounded-full overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-[#222] shrink-0 group transition-transform duration-1000 ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`}>
              {/* Filtro Oscuro de Surcos de Vinilo */}
              <div className="absolute inset-0 border-[4px] border-black/40 rounded-full z-10 pointer-events-none mix-blend-overlay"></div>
              {currentStation.favicon ? (
                <img src={currentStation.favicon} alt="Cover" className="w-full h-full object-cover scale-[1.1]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-800 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
              )}
              {/* Eje central giratorio */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#0A0A0C] border border-white/20 rounded-full z-20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center">
                <div className={`w-1 h-1 bg-white/40 rounded-full transition-transform duration-1000 ${isPlaying ? 'scale-100' : 'scale-50'}`}></div>
              </div>
           </div>
           <div className="ml-4 flex items-center gap-3 min-w-0 pr-2">
              <span className="text-white text-[15px] font-bold tracking-tight truncate hover:text-[#22d3ee] transition-colors cursor-pointer drop-shadow-md">{currentStation.name}</span>
           </div>
        </div>

        {/* Zona Central: Controles de Reproducción */}
        <div className="flex-1 max-w-[30%] flex flex-col items-center justify-center relative z-10 h-full">
           <div className="flex items-center gap-6">
             <button onClick={playPrev} className="text-white/40 hover:text-white transition-colors p-2" title="Anterior"><PrevIcon /></button>
             <button onClick={togglePlay} className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] group">
               {isPlaying ? <PauseIcon /> : <PlayIcon />}
             </button>
             <button onClick={playNext} className="text-white/40 hover:text-white transition-colors p-2" title="Siguiente"><NextIcon /></button>
           </div>
        </div>

        {/* Espacio Aislado - Flotando exactamente entre "Siguiente" y el Volumen (70% del eje) */}
        <div className="absolute left-[70.5%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center select-none z-20">
           <div className="flex items-center -mb-0.5">
             <button onClick={toggleFavorite} className="mr-3 active:scale-90 transition-transform relative z-20 flex-shrink-0 hover:scale-[1.15]">
               <HeartIcon solid={isFav} />
             </button>
             <div className="flex items-center pointer-events-none drop-shadow-sm">
               {/* Badge AIM Dinámico */}
               <div className="rounded-full px-3 pb-[2px] pt-[2.5px] flex items-center justify-center transition-all duration-700 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
                 <span className="font-extrabold text-[11px] tracking-widest pl-[1.5px] leading-none transition-colors duration-500 text-[#0F172A]">AIM</span>
               </div>
               {/* Separador Estilizado (Márgenes Ajustados) */}
               <div className="w-[3px] h-[16px] bg-[#94A3B8] rounded-full opacity-90 ml-[6px] mr-[6px]"></div>
               {/* Texto Galena */}
               <span className="relative text-white font-black text-[15px] tracking-tighter leading-none transition-all duration-1000 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  Galena
                <svg className="absolute -top-[4px] -right-[12px] w-[13px] h-[13px] origin-bottom-left rotate-[15deg] transition-all duration-700 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11a9 9 0 0 1 9 9" />
                  <path d="M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
                </svg>
             </span>
             </div>
           </div>
        </div>

        {/* Zona Derecha: Volumen */}
        <div className="flex items-center justify-end w-[35%] min-w-[200px] relative z-20">
           <div className="flex items-center gap-3 w-32 group shrink-0">
             <div className="text-white/40 group-hover:text-white/80 transition-colors"><VolumeIcon /></div>
             <input 
                type="range" 
                min="0" max="1" step="0.01" 
                value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:bg-white/30 transition-colors"
                style={{ background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)` }}
             />
           </div>
        </div>
      </div>
      
      {/* CSS Privado para EQ y Glow */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes eq-pulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
          50% { transform: scaleY(1.5); opacity: 1; }
        }
        .eq-animate {
          animation-name: eq-pulse;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        @keyframes aurora-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}} />
    </>
  );
}
