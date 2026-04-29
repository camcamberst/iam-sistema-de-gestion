'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

// Tipos base para la estación
export interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
}

export const CATEGORIES = [
  { id: 'electronic', name: 'Electrónica', tags: 'electronic,house,dance,techno' },
  { id: 'latino', name: 'Latino', tags: 'latin,reggaeton,salsa,bachata' },
  { id: 'jazz', name: 'Jazz & Blues', tags: 'jazz,blues,soul' },
  { id: 'lofi', name: 'Lo-Fi / Focus', tags: 'lofi,chillout,ambient' },
  { id: 'pop', name: 'Hits & Pop', tags: 'pop,top40,hits' },
];

export const AURORA_PALETTES = [
  {
    main: "bg-purple-500/50 dark:bg-purple-600/60",
    secondary: "bg-cyan-400/30 dark:bg-cyan-500/40",
    accent: "bg-pink-500/20 dark:bg-fuchsia-600/20",
    textVars: { '--c1': '#c084fc', '--c2': '#22d3ee', '--c3': '#e879f9' }
  },
  {
    main: "bg-emerald-500/40 dark:bg-emerald-600/50",
    secondary: "bg-teal-400/30 dark:bg-teal-500/40",
    accent: "bg-blue-500/20 dark:bg-indigo-600/20",
    textVars: { '--c1': '#34d399', '--c2': '#2dd4bf', '--c3': '#818cf8' }
  },
  {
    main: "bg-orange-500/40 dark:bg-orange-600/50",
    secondary: "bg-amber-400/30 dark:bg-amber-500/40",
    accent: "bg-rose-500/20 dark:bg-red-600/20",
    textVars: { '--c1': '#fb923c', '--c2': '#fbbf24', '--c3': '#f87171' }
  },
  {
    main: "bg-blue-500/50 dark:bg-blue-600/60",
    secondary: "bg-indigo-400/30 dark:bg-indigo-500/40",
    accent: "bg-purple-500/20 dark:bg-violet-600/20",
    textVars: { '--c1': '#60a5fa', '--c2': '#818cf8', '--c3': '#a78bfa' }
  },
  {
    main: "bg-pink-500/50 dark:bg-pink-600/60",
    secondary: "bg-fuchsia-400/30 dark:bg-fuchsia-500/40",
    accent: "bg-purple-500/20 dark:bg-purple-600/20",
    textVars: { '--c1': '#f472b6', '--c2': '#e879f9', '--c3': '#c084fc' }
  }
];

interface GalenaContextProps {
  stations: Station[];
  loading: boolean;
  activeCategory: typeof CATEGORIES[0] | { id: string, name: string, tags: string };
  setActiveCategory: (cat: any) => void;
  currentStation: Station | null;
  isPlaying: boolean;
  volume: number;
  setVolume: (v: number) => void;
  errorMsg: string;
  favorites: Station[];
  toggleFavorite: () => void;
  auroraPalette: typeof AURORA_PALETTES[0];
  togglePlay: () => void;
  playStation: (station: Station) => void;
  playNext: () => void;
  playPrev: () => void;
  stopAudio: () => void;
  hasInitialized: boolean;
  triggerInit: () => void;
}

// Singleton global del Audio para que sobreviva a las recargas de página / Fast Refresh de Next.js
let globalAudioInstance: HTMLAudioElement | null = null;
let globalCurrentStation: Station | null = null;
let globalIsPlaying: boolean = false;

const GalenaContext = createContext<GalenaContextProps | undefined>(undefined);

export function GalenaProvider({ children }: { children: ReactNode }) {
  const [hasInitialized, setHasInitialized] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[3]); // Empezar en Lo-Fi
  const [currentStation, setCurrentStationState] = useState<Station | null>(globalCurrentStation);
  
  const [isPlaying, setIsPlayingState] = useState(globalIsPlaying);
  
  const setCurrentStation = (station: Station | null) => {
    globalCurrentStation = station;
    setCurrentStationState(station);
  };
  
  const setIsPlaying = (playing: boolean) => {
    globalIsPlaying = playing;
    setIsPlayingState(playing);
  };
  const [volume, setVolume] = useState(0.5);
  const [errorMsg, setErrorMsg] = useState('');
  const [favorites, setFavorites] = useState<Station[]>([]);
  const [auroraPalette, setAuroraPalette] = useState(AURORA_PALETTES[0]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const triggerInit = () => {
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  };

  useEffect(() => {
    if (currentStation) {
      setAuroraPalette(prev => {
        const others = AURORA_PALETTES.filter(p => p !== prev);
        return others[Math.floor(Math.random() * others.length)];
      });
    }
  }, [currentStation]);

  const toggleFavorite = () => {
    if (!currentStation) return;
    setFavorites(prev => {
      const isFav = prev.some(s => s.stationuuid === currentStation.stationuuid);
      if (isFav) {
        return prev.filter(s => s.stationuuid !== currentStation.stationuuid);
      } else {
        return [currentStation, ...prev];
      }
    });
  };

  // Inicializar audio de manera perezosa, anclado al Singleton Global
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!globalAudioInstance) {
        globalAudioInstance = new Audio();
        globalAudioInstance.volume = volume;
      }
      
      // Asignar a la referencia local para los controladores
      audioRef.current = globalAudioInstance;
      
      // Sincronizar estado visual si el global ya estaba reproduciendo
      if (!globalAudioInstance.paused && globalAudioInstance.src) {
        setIsPlaying(true);
      }
      
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleError = (e: any) => {
        console.error('🎵 [GALENA] Error de stream:', e);
        setIsPlaying(false);
        setErrorMsg('El stream actual no está disponible. Intenta otra emisora.');
      };

      globalAudioInstance.addEventListener('playing', handlePlay);
      globalAudioInstance.addEventListener('pause', handlePause);
      globalAudioInstance.addEventListener('error', handleError);

      return () => {
        if (globalAudioInstance) {
          globalAudioInstance.removeEventListener('playing', handlePlay);
          globalAudioInstance.removeEventListener('pause', handlePause);
          globalAudioInstance.removeEventListener('error', handleError);
          // NO PAUSAMOS NI VACIAMOS EL SRC AQUÍ. 
          // Esto garantiza que la navegación de Next.js (y los hot-reloads) no destruyan el stream activo.
        }
      };
    }
  }, []);

  useEffect(() => {
    if (!hasInitialized) return; // Lazy Load: no buscar emisoras hasta que el widget se renderice o lo solicite
    
    const fetchStations = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const tagQuery = activeCategory.tags.split(',')[0];
        const res = await fetch(`https://de1.api.radio-browser.info/json/stations/search?tag=${tagQuery}&limit=30&hidebroken=true&order=clickcount&reverse=true`);
        
        if (!res.ok) throw new Error('Error de conexión con la antena');
        
        const data = await res.json();
        const validStations: Station[] = data
          .filter((s: any) => s.url_resolved && s.name && s.name.trim().length > 0)
          .slice(0, 15);
          
        setStations(validStations);
        
        // No autoseleccionar estación inicial para evitar que la píldora inferior se muestre prematuramente
      } catch (err: any) {
        console.error('🎵 [GALENA] Error:', err);
        setErrorMsg('Interferencia detectada. Reintentando sintonizar...');
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
  }, [activeCategory, hasInitialized]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    triggerInit(); // Si por casualidad la isla lanza play, inicializa!
    if (!audioRef.current) return;
    
    if (!currentStation) {
      const activeList = activeCategory.id === 'favorites' ? favorites : stations;
      if (activeList.length > 0) {
        playStation(activeList[0]);
      }
      return;
    }
    
    if (audioRef.current.src !== currentStation.url_resolved) {
      audioRef.current.src = currentStation.url_resolved;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      setErrorMsg('');
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error al reproducir:', error);
          setErrorMsg('El navegador bloqueó el audio o el stream está caído.');
          setIsPlaying(false);
        });
      }
    }
  };

  const playStation = (station: Station) => {
    triggerInit();
    setCurrentStation(station);
    if (audioRef.current) {
      audioRef.current.src = station.url_resolved;
      audioRef.current.play().catch(e => {
        console.error("Error reproduciendo nueva emisora", e);
        setErrorMsg('Imposible conectar con esta emisora.');
      });
      setIsPlaying(true);
    }
  };

  const playNext = () => {
    const activeList = activeCategory.id === 'favorites' ? favorites : stations;
    if (activeList.length === 0) return;
    if (!currentStation) {
      playStation(activeList[0]);
      return;
    }
    const currentIndex = activeList.findIndex(s => s.stationuuid === currentStation.stationuuid);
    if (currentIndex >= 0 && currentIndex < activeList.length - 1) {
      playStation(activeList[currentIndex + 1]);
    } else if (currentIndex === activeList.length - 1) {
      playStation(activeList[0]);
    }
  };

  const playPrev = () => {
    const activeList = activeCategory.id === 'favorites' ? favorites : stations;
    if (activeList.length === 0) return;
    if (!currentStation) {
      playStation(activeList[activeList.length - 1]);
      return;
    }
    const currentIndex = activeList.findIndex(s => s.stationuuid === currentStation.stationuuid);
    if (currentIndex > 0) {
      playStation(activeList[currentIndex - 1]);
    } else if (currentIndex === 0) {
      playStation(activeList[activeList.length - 1]);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setIsPlaying(false);
    setCurrentStation(null); // Provocará que IsVisible pase a false y la barra se oculte
  };

  return (
    <GalenaContext.Provider
      value={{
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
        hasInitialized,
        triggerInit
      }}
    >
      {children}
    </GalenaContext.Provider>
  );
}

export function useGalena() {
  const context = useContext(GalenaContext);
  if (!context) {
    throw new Error('useGalena debe usarse dentro de un GalenaProvider');
  }
  return context;
}
