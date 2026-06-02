'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import BillingSummary from '../../../../components/BillingSummary';
import AnnouncementManager from '../../../../components/AnnouncementManager';
import ManualPeriodClosure from '../../../../components/ManualPeriodClosure';
import ModelProductivityPanel from '../../../../components/ModelProductivityPanel';
import { getColombiaDate } from '@/utils/calculator-dates';
import PageHeader from '../../../../components/ui/PageHeader';
import AppleDropdown from '../../../../components/ui/AppleDropdown';

interface DashboardStats {
  totalSedes: number;
  totalRooms: number;
  totalModelos: number;
  asignacionesActivas: number;
  sedesConRooms: number;
  sedesSinRooms: number;
}

interface SedeDisponibilidad {
  sede_id: string;
  sede_nombre: string;
  rooms_totales: number;
  total_espacios: number;
  espacios_disponibles: number; // slots (room+jornada) con disponibilidad
}

/** Por cada room: si en esa jornada hay al menos un espacio (máx 2 modelos por room+jornada). */
interface RoomJornadaDisponibilidad {
  room_id: string;
  room_name: string;
  manana: boolean;
  tarde: boolean;
  noche: boolean;
}

/** Fila para la tabla "todas las sedes": sede + room + jornadas. */
interface FilaDisponibilidadSede {
  sede_id: string;
  sede_nombre: string;
  room_id: string;
  room_name: string;
  manana: boolean;
  tarde: boolean;
  noche: boolean;
}

/** Resumen por sede: total_slots, slots_ocupados, slots_disponibles. */
interface ResumenSede {
  sede: string;
  total_slots: number;
  slots_ocupados: number;
  slots_disponibles: number;
}

interface TickerData {
  rates: { usd_cop: number; eur_usd: number; gbp_usd: number };
  productivity: {
    totalModels: number;
    modelsWithData: number;
    modelsPorEncima: number;
    modelsPorDebajo: number;
    avgPorcentaje: number;
    topModel: { prefix: string; usdBruto: number; porcentaje: number } | null;
    bottomModel: { prefix: string; usdBruto: number; porcentaje: number } | null;
  };
  platforms: {
    top3: Array<{ name: string; totalUsd: number; modelCount: number }>;
    topBySede: { sedeName: string; platformName: string; totalUsd: number } | null;
  };
  availability: {
    totalAssignments: number;
    totalRooms: number;
    sedesConRooms: number;
    highOccupancy: { name: string; pct: number; freeSlots: number; totalSlots: number } | null;
    mostFree: { name: string; freeCount: number; shift: string } | null;
  };
  announcements: {
    latest: { title: string; publishedAt: string } | null;
    activeCount: number;
  };
  period: {
    type: 'P1' | 'P2';
    label: string;
    daysRemaining: number;
    dateStr: string;
    timeStr: string;
  };
  configuredModels: number;
}

interface Group {
  id: string;
  name: string;
  is_manager: boolean;
}

interface Room {
  id: string;
  room_name: string;
  group_id: string;
  is_active: boolean;
  groups: {
    id: string;
    name: string;
  };
}

interface HubWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  activeHub: 'facturacion' | 'productividad' | 'disponibilidad' | 'operaciones' | 'anuncios' | null;
  onNavigate: (hub: 'facturacion' | 'productividad' | 'disponibilidad' | 'operaciones' | 'anuncios') => void;
}

function HubWindow({ isOpen, onClose, title, subtitle, children, activeHub, onNavigate }: HubWindowProps) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !activeHub) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX - touchEndX;

    if (Math.abs(diffX) > 60) {
      const hubList = ['facturacion', 'productividad', 'disponibilidad', 'anuncios', 'operaciones'] as const;
      const currentIndex = hubList.indexOf(activeHub);
      if (currentIndex !== -1) {
        if (diffX > 0) {
          // Swipe left -> Next Hub
          const nextIndex = (currentIndex + 1) % hubList.length;
          onNavigate(hubList[nextIndex]);
        } else {
          // Swipe right -> Prev Hub
          const prevIndex = (currentIndex - 1 + hubList.length) % hubList.length;
          onNavigate(hubList[prevIndex]);
        }
      }
    }
    setTouchStartX(null);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getAmbientGlow = () => {
    switch (activeHub) {
      case 'facturacion':
        return 'bg-amber-500/10 dark:bg-amber-500/10';
      case 'productividad':
        return 'bg-purple-500/10 dark:bg-purple-500/10';
      case 'disponibilidad':
        return 'bg-cyan-500/10 dark:bg-cyan-500/10';
      case 'anuncios':
        return 'bg-emerald-500/10 dark:bg-emerald-500/10';
      case 'operaciones':
        return 'bg-rose-500/10 dark:bg-rose-500/10';
      default:
        return 'bg-blue-500/10 dark:bg-blue-500/10';
    }
  };

  const getHubNeonLineStyle = () => {
    switch (activeHub) {
      case 'facturacion':
        return 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.75),0_0_3px_rgba(245,158,11,0.85)]';
      case 'productividad':
        return 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.75),0_0_3px_rgba(168,85,247,0.85)]';
      case 'disponibilidad':
        return 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.75),0_0_3px_rgba(6,182,212,0.85)]';
      case 'anuncios':
        return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.75),0_0_3px_rgba(16,185,129,0.85)]';
      case 'operaciones':
        return 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.75),0_0_3px_rgba(244,63,94,0.85)]';
      default:
        return 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.75),0_0_3px_rgba(59,130,246,0.85)]';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-10 font-sans">
      {/* Overlay backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-3xl transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Window container */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-7xl h-[85vh] md:h-[80vh] bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-scale-up"
      >
        
        {/* Glow ambient representation (Dynamic Neon Glow matching active hub) */}
        <div className={`absolute top-0 right-0 w-80 h-80 ${getAmbientGlow()} rounded-full blur-3xl mix-blend-screen pointer-events-none transition-all duration-700`} />
        {/* Apple Style Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md select-none relative z-10">
          <style dangerouslySetInnerHTML={{ __html: `
            .apple-dock-zoom {
              transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease, box-shadow 0.25s ease, border-color 0.25s ease;
            }
          ` }} />

          {/* Symmetrical Apple Dots with Hub Navigation (Neon Magnification Wave) */}
          <div className="flex items-center space-x-3 w-1/4 relative z-20 h-8">
            <div className="hidden md:flex items-center space-x-3">
              {/* Facturación (Amber) */}
              <button
                onClick={() => onNavigate('facturacion')}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === 'facturacion'
                    ? 'border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.85),0_0_4px_rgba(245,158,11,0.95)] scale-110 opacity-100'
                    : 'border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.15)] opacity-60 hover:opacity-100 hover:border-amber-500 hover:shadow-[0_0_14px_rgba(245,158,11,0.7)]'
                }`}
                title="Facturación & Cierres"
              />
              {/* Realtime (Purple) */}
              <button
                onClick={() => onNavigate('productividad')}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === 'productividad'
                    ? 'border-2 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.85),0_0_4px_rgba(168,85,247,0.95)] scale-110 opacity-100'
                    : 'border-purple-500/40 shadow-[0_0_6px_rgba(168,85,247,0.15)] opacity-60 hover:opacity-100 hover:border-purple-500 hover:shadow-[0_0_14px_rgba(168,85,247,0.7)]'
                }`}
                title="Realtime"
              />
              {/* Disponibilidad (Cyan) */}
              <button
                onClick={() => onNavigate('disponibilidad')}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === 'disponibilidad'
                    ? 'border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.85),0_0_4px_rgba(6,182,212,0.95)] scale-110 opacity-100'
                    : 'border-cyan-500/40 shadow-[0_0_6px_rgba(6,182,212,0.15)] opacity-60 hover:opacity-100 hover:border-cyan-500 hover:shadow-[0_0_14px_rgba(6,182,212,0.7)]'
                }`}
                title="Disponibilidad"
              />
              {/* Anuncios (Emerald) */}
              <button
                onClick={() => onNavigate('anuncios')}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === 'anuncios'
                    ? 'border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.85),0_0_4px_rgba(16,185,129,0.95)] scale-110 opacity-100'
                    : 'border-emerald-500/40 shadow-[0_0_6px_rgba(16,185,129,0.15)] opacity-60 hover:opacity-100 hover:border-emerald-500 hover:shadow-[0_0_14px_rgba(16,185,129,0.7)]'
                }`}
                title="Anuncios"
              />
              {/* Operaciones (Rose) */}
              <button
                onClick={() => onNavigate('operaciones')}
                className={`w-3.5 h-3.5 rounded-full bg-transparent border apple-dock-zoom cursor-pointer origin-center hover:scale-[1.65] ${
                  activeHub === 'operaciones'
                    ? 'border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.85),0_0_4px_rgba(244,63,94,0.95)] scale-110 opacity-100'
                    : 'border-rose-500/40 shadow-[0_0_6px_rgba(244,63,94,0.15)] opacity-60 hover:opacity-100 hover:border-rose-500 hover:shadow-[0_0_14px_rgba(244,63,94,0.7)]'
                }`}
                title="Operaciones"
              />
            </div>
          </div>

          {/* Centered Title */}
          <div className="text-center flex-1 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-wide truncate">
              {title}
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 font-medium truncate mt-0.5">
              {subtitle}
            </p>
          </div>

          {/* Symmetrical modern close button on the right */}
          <div className="w-1/4 flex justify-end relative z-20">
            <button 
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-all duration-300 active:scale-95 cursor-pointer"
              aria-label="Cerrar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Dynamic Neon Glowing Line Separator (Delineates the window header, matching active hub) */}
        <div className={`h-[1.5px] w-full ${getHubNeonLineStyle()} pointer-events-none opacity-80 relative z-20`} />

        {/* Dynamic Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-transparent text-gray-900 dark:text-white relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSedesPage() {
  const [activeHub, setActiveHub] = useState<'facturacion' | 'productividad' | 'disponibilidad' | 'operaciones' | 'anuncios' | null>(null);
  const [activeMetricIndex, setActiveMetricIndex] = useState(0);
  const [tickerData, setTickerData] = useState<TickerData | null>(null);

  // Estados para el carrusel móvil rotativo 3D
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const [showMobileDescription, setShowMobileDescription] = useState(false);
  const [lastTapMobile, setLastTapMobile] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Estados y referencias para la interactividad táctil de la isla informativa (ticker)
  const tickerTrackRef = useRef<HTMLDivElement>(null);
  const tickerOffsetRef = useRef<number>(0);
  const tickerIsPausedRef = useRef<boolean>(false);
  const tickerIsDraggingRef = useRef<boolean>(false);
  const tickerTouchStartXRef = useRef<number>(0);
  const tickerStartOffsetRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [tickerIsPaused, setTickerIsPaused] = useState<boolean>(false);
  const [lastTickerTap, setLastTickerTap] = useState<number>(0);

  const handleTickerTouchStart = (e: React.TouchEvent) => {
    tickerTouchStartXRef.current = e.touches[0].clientX;
    tickerStartOffsetRef.current = tickerOffsetRef.current;
    tickerIsDraggingRef.current = false;
  };

  const handleTickerTouchMove = (e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - tickerTouchStartXRef.current;
    if (Math.abs(diffX) > 5) {
      tickerIsDraggingRef.current = true;
      const nextOffset = tickerStartOffsetRef.current + diffX;
      tickerOffsetRef.current = nextOffset;
      if (tickerTrackRef.current) {
        tickerTrackRef.current.style.transform = `translateX(${nextOffset}px)`;
      }
    }
  };

  const handleTickerTouchEnd = (e: React.TouchEvent, hub: 'facturacion' | 'productividad' | 'disponibilidad' | 'operaciones' | 'anuncios') => {
    if (tickerIsDraggingRef.current) {
      tickerIsDraggingRef.current = false;
      // Pausar automáticamente tras arrastrar para que se quede exactamente donde está
      tickerIsPausedRef.current = true;
      setTickerIsPaused(true);
      return;
    }

    // Prevenir eventos click emulados en pantallas táctiles
    if (e) {
      e.preventDefault();
    }

    const now = Date.now();
    if (now - lastTickerTap < 300) {
      // Es un Doble Tap
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (hub) {
        setActiveHub(hub);
      }
    } else {
      // Es un Tap simple
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = setTimeout(() => {
        const nextPaused = !tickerIsPausedRef.current;
        tickerIsPausedRef.current = nextPaused;
        setTickerIsPaused(nextPaused);
        tapTimeoutRef.current = null;
      }, 250);
    }
    setLastTickerTap(now);
  };

  // Bucle de animación por JavaScript (requestAnimationFrame) de alto rendimiento
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      if (!tickerIsPausedRef.current && !tickerIsDraggingRef.current && tickerTrackRef.current) {
        const halfWidth = tickerTrackRef.current.scrollWidth / 2;
        if (halfWidth > 0) {
          tickerOffsetRef.current -= 0.8; // Velocidad del desplazamiento automático
          if (tickerOffsetRef.current <= -halfWidth) {
            tickerOffsetRef.current += halfWidth;
          } else if (tickerOffsetRef.current > 0) {
            tickerOffsetRef.current -= halfWidth;
          }
          tickerTrackRef.current.style.transform = `translateX(${tickerOffsetRef.current}px)`;
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Escuchar tecla ESC para cerrar el Hub activo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Si hay una foto ampliada abierta en el DOM, dejamos que se cierre la foto y no el hub
        const isPhotoZoomed = document.querySelector('[alt="Avatar Ampliado"]');
        if (isPhotoZoomed) {
          return;
        }
        setActiveHub(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [stats, setStats] = useState<DashboardStats>({
    totalSedes: 0,
    totalRooms: 0,
    totalModelos: 0,
    asignacionesActivas: 0,
    sedesConRooms: 0,
    sedesSinRooms: 0
  });

  // Auto-rotar las métricas de la isla dinámica cada 5 segundos
  useEffect(() => {
    if (stats.totalSedes === 0) return;
    const interval = setInterval(() => {
      setActiveMetricIndex((prev) => (prev + 1) % 4);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeMetricIndex, stats.totalSedes]);


  // Estados para consulta de períodos históricos
  const [showHistoricalQuery, setShowHistoricalQuery] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('P1');
  const [targetDate, setTargetDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>('');
  
  // Estados para resumen de disponibilidad
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [sedeDisponibilidad, setSedeDisponibilidad] = useState<SedeDisponibilidad | null>(null);
  const [disponibilidadPorRoom, setDisponibilidadPorRoom] = useState<RoomJornadaDisponibilidad[]>([]);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const [availableSedes, setAvailableSedes] = useState<Group[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  // Ver todas las sedes en una sola tabla
  const [showTodasSedes, setShowTodasSedes] = useState(false);
  const [disponibilidadTodasSedes, setDisponibilidadTodasSedes] = useState<FilaDisponibilidadSede[]>([]);
  const [loadingTodasSedes, setLoadingTodasSedes] = useState(false);

  // Estados para editar RATES de cierre
  const [showEditRatesModal, setShowEditRatesModal] = useState(false);
  const [collapsedHistorica, setCollapsedHistorica] = useState(true);
  const [collapsedDisponibilidad, setCollapsedDisponibilidad] = useState(true);
  const [seleccionSedeCollapsed, setSeleccionSedeCollapsed] = useState(true);
  const [todasSedesCollapsed, setTodasSedesCollapsed] = useState(true);
  const [resumenDisponibilidadCollapsed, setResumenDisponibilidadCollapsed] = useState(true);
  const [cierrePeriodoCollapsed, setCierrePeriodoCollapsed] = useState(true);
  const [anunciosCollapsed, setAnunciosCollapsed] = useState(true);
  const [closureValidation, setClosureValidation] = useState<any>(null);
  const [loadingPeriodInfo, setLoadingPeriodInfo] = useState(false);
  const [periodInfo, setPeriodInfo] = useState<{
    records_count: number;
    current_rates: { eur_usd: number | null; gbp_usd: number | null; usd_cop: number | null };
  } | null>(null);
  const [editRates, setEditRates] = useState<{ eur_usd: string; gbp_usd: string; usd_cop: string }>({
    eur_usd: '',
    gbp_usd: '',
    usd_cop: ''
  });
  const [savingRates, setSavingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);

  // Funciones para consulta histórica
  const getMonthName = (month: string) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[parseInt(month) - 1] || '';
  };

  const calculateTargetDate = () => {
    if (!selectedMonth || !selectedYear) return;

    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    
    let day: number;
    if (selectedPeriod === 'P1') {
      day = 15; // Período 1: día 15
    } else {
      // Período 2: último día del mes
      day = new Date(year, month, 0).getDate();
    }

    const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setTargetDate(targetDateStr);
  };

  useEffect(() => {
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();

    // Manejar errores de extensiones del navegador (inofensivos)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || '';
      // Silenciar errores conocidos de extensiones del navegador
      if (
        errorMessage.includes('message channel closed') ||
        errorMessage.includes('listener indicated an asynchronous response') ||
        errorMessage.includes('Extension context invalidated')
      ) {
        event.preventDefault(); // Prevenir que se muestre en la consola
        console.debug('Error de extensión del navegador silenciado:', errorMessage);
        return;
      }
      // Permitir que otros errores se muestren normalmente
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear && selectedPeriod) {
      calculateTargetDate();
    }
  }, [selectedMonth, selectedYear, selectedPeriod]);

  // Scroll automático cuando se abre un dropdown
  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => {
        const dropdownElement = document.querySelector('.dropdown-container');
        if (dropdownElement) {
          dropdownElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 100);
    }
  }, [dropdownOpen]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    if (!dropdownOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      try {
        const target = event.target as Element;
        if (dropdownOpen && !target.closest('.dropdown-container')) {
          setDropdownOpen(null);
        }
      } catch (error) {
        // Silenciar errores de extensiones del navegador
        console.debug('Error en handleClickOutside (probablemente extensión del navegador):', error);
      }
    };

    // Usar capture phase para mejor compatibilidad
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
    };
  }, [dropdownOpen]);


  // Cargar datos del dashboard después de cargar la información del usuario
  useEffect(() => {
    if (userRole && userGroups.length >= 0) {
      loadDashboardData();
    }
  }, [userRole, userGroups]);

  // Cargar datos reales para el ticker de la barra dinámica
  useEffect(() => {
    if (loading || stats.totalSedes === 0) return;
    const fetchTickerData = async () => {
      try {
        const res = await fetch('/api/admin/dashboard-ticker', { cache: 'no-store' });
        const json = await res.json();
        if (json.success && json.ticker) {
          setTickerData(json.ticker);
        }
      } catch (e) {
        console.debug('Error cargando datos del ticker:', e);
      }
    };
    fetchTickerData();
  }, [loading, stats.totalSedes]);

  // Cargar disponibilidad cuando se seleccione una sede (y cuando lleguen las asignaciones)
  useEffect(() => {
    if (selectedSede && availableSedes.length > 0) {
      loadSedeDisponibilidad(selectedSede);
    }
  }, [selectedSede, availableSedes]);

  const loadUserInfo = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserRole(parsed.role || 'admin');
        setUserGroups(parsed.groups?.map((g: any) => g.id) || []);
        setUserId(parsed.id || '');
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
    }
  };

  // Función para cargar información del período
  const loadPeriodInfo = async (periodDate: string, periodType: string) => {
    try {
      setLoadingPeriodInfo(true);
      setRatesError(null);

      // Obtener token de autenticación
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = (await import('@/lib/supabase')).supabase;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setRatesError('Sesión no válida');
        return;
      }

      const response = await fetch(`/api/admin/calculator-history/update-period-rates?period_date=${periodDate}&period_type=${periodType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        setRatesError(data.error || 'Error al cargar información del período');
        return;
      }

      setPeriodInfo(data);
      
      // Prellenar formulario con tasas actuales
      setEditRates({
        eur_usd: data.current_rates?.eur_usd?.toString() || '',
        gbp_usd: data.current_rates?.gbp_usd?.toString() || '',
        usd_cop: data.current_rates?.usd_cop?.toString() || ''
      });

    } catch (err: any) {
      console.error('Error cargando información del período:', err);
      setRatesError(err.message || 'Error al cargar información del período');
    } finally {
      setLoadingPeriodInfo(false);
    }
  };

  // Función para guardar las tasas
  const savePeriodRates = async () => {
    if (!selectedMonth || !selectedYear || !selectedPeriod) return;

    try {
      setSavingRates(true);
      setRatesError(null);

      // Calcular period_date y period_type
      // IMPORTANTE: El period_date debe ser la fecha de INICIO del período
      // (día 1 para P1, día 16 para P2), igual que cuando se archivan los registros
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const periodType = selectedPeriod === 'P1' ? '1-15' : '16-31';
      
      let day: number;
      if (selectedPeriod === 'P1') {
        day = 1; // Fecha de inicio del período P1 (1-15)
      } else {
        day = 16; // Fecha de inicio del período P2 (16-31)
      }
      const periodDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Obtener token de autenticación
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = (await import('@/lib/supabase')).supabase;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setRatesError('Sesión no válida');
        return;
      }

      // Obtener información del usuario
      const userData = localStorage.getItem('user');
      let adminName = 'Desconocido';
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          adminName = parsed.name || parsed.email || 'Desconocido';
        } catch (e) {
          // Ignorar error de parsing
        }
      }

      const response = await fetch('/api/admin/calculator-history/update-period-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period_date: periodDate,
          period_type: periodType,
          rates: {
            eur_usd: editRates.eur_usd ? Number(editRates.eur_usd) : undefined,
            gbp_usd: editRates.gbp_usd ? Number(editRates.gbp_usd) : undefined,
            usd_cop: editRates.usd_cop ? Number(editRates.usd_cop) : undefined
          },
          admin_id: userId,
          admin_name: adminName
        })
      });

      const data = await response.json();

      if (!data.success) {
        setRatesError(data.error || 'Error al actualizar tasas');
        return;
      }

      // Éxito: cerrar modal y recargar datos
      setShowEditRatesModal(false);
      setRatesError(null);
      
      // Mostrar notificación de éxito
      alert(`✅ Tasas actualizadas exitosamente para ${data.updated_count} registros del período ${periodDate} (${periodType})`);
      
      // Recargar la página para actualizar los datos mostrados
      window.location.reload();

    } catch (err: any) {
      console.error('Error guardando tasas:', err);
      setRatesError(err.message || 'Error al guardar tasas');
    } finally {
      setSavingRates(false);
    }
  };

  const loadSedeDisponibilidad = async (sedeId: string) => {
    if (!sedeId) {
      setSedeDisponibilidad(null);
      setDisponibilidadPorRoom([]);
      return;
    }

    try {
      setLoadingDisponibilidad(true);
      const res = await fetch(`/api/sedes/disponibilidad?sedeId=${encodeURIComponent(sedeId)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error obteniendo disponibilidad. Revisa que la función get_disponibilidad_por_sedes exista en Supabase.');
      setDisponibilidadPorRoom(data.rows || []);
      if (data.summary) {
        setSedeDisponibilidad({
          sede_id: sedeId,
          sede_nombre: data.summary.sede_nombre,
          rooms_totales: data.summary.rooms_totales,
          total_espacios: data.summary.total_espacios,
          espacios_disponibles: data.summary.espacios_disponibles ?? 0
        });
      } else {
        const rows = data.rows || [];
        const espaciosDisponibles = rows.reduce((acc: number, r: any) =>
          acc + (r.manana ? 1 : 0) + (r.tarde ? 1 : 0) + (r.noche ? 1 : 0), 0);
        const sedeInfo = availableSedes.find(s => s.id === sedeId);
        setSedeDisponibilidad({
          sede_id: sedeId,
          sede_nombre: sedeInfo?.name || 'Sede',
          rooms_totales: rows.length,
          total_espacios: rows.length * 3,
          espacios_disponibles: espaciosDisponibles
        });
      }
    } catch (error) {
      console.error('❌ [DASHBOARD] Error cargando disponibilidad:', error);
      setError('Error cargando disponibilidad de la sede');
    } finally {
      setLoadingDisponibilidad(false);
    }
  };

  /** Resumen por sede calculado a partir de disponibilidadTodasSedes */
  const resumenPorSede = useMemo((): ResumenSede[] => {
    const bySede = new Map<string, { total: number; ocupados: number; disponibles: number }>();
    for (const row of disponibilidadTodasSedes) {
      const current = bySede.get(row.sede_nombre) ?? { total: 0, ocupados: 0, disponibles: 0 };
      current.total += 3; // 3 jornadas por room
      current.disponibles += (row.manana ? 1 : 0) + (row.tarde ? 1 : 0) + (row.noche ? 1 : 0);
      current.ocupados += (row.manana ? 0 : 1) + (row.tarde ? 0 : 1) + (row.noche ? 0 : 1);
      bySede.set(row.sede_nombre, current);
    }
    return Array.from(bySede.entries())
      .map(([sede, v]) => ({
        sede,
        total_slots: v.total,
        slots_ocupados: v.ocupados,
        slots_disponibles: v.disponibles
      }))
      .sort((a, b) => a.sede.localeCompare(b.sede));
  }, [disponibilidadTodasSedes]);

  const loadTodasSedesDisponibilidad = async () => {
    if (!availableSedes.length) return;
    try {
      setLoadingTodasSedes(true);
      setDisponibilidadTodasSedes([]);
      const sedeIds = availableSedes.map(s => s.id).join(',');
      const res = await fetch(`/api/sedes/disponibilidad?sedeIds=${encodeURIComponent(sedeIds)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error obteniendo disponibilidad');
      setDisponibilidadTodasSedes(data.rows || []);
    } catch (error) {
      console.error('Error cargando disponibilidad de todas las sedes:', error);
      setError('Error cargando disponibilidad de todas las sedes');
    } finally {
      setLoadingTodasSedes(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos reales desde la API con filtrado por rol
      const [groupsResponse, roomsResponse, usersResponse, assignmentsResponse] = await Promise.all([
        fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userRole, userGroups })
        }),
        fetch('/api/groups/rooms'),
        fetch('/api/users'),
        fetch('/api/assignments/all')
      ]);

      const [groupsData, roomsData, usersData, assignmentsData] = await Promise.all([
        groupsResponse.json(),
        roomsResponse.json(),
        usersResponse.json(),
        assignmentsResponse.json()
      ]);

      // Filtrar datos según el rol del usuario
      let filteredGroups = groupsData.success ? groupsData.groups || [] : [];
      let filteredRooms = roomsData.success ? roomsData.rooms || [] : [];
      let filteredAssignments = assignmentsData.success ? assignmentsData.assignments || [] : [];

      // Si es admin (no super_admin ni superadmin_aff), filtrar por sus grupos
      if (userRole !== 'super_admin' && userRole !== 'superadmin_aff' && userGroups.length > 0) {
        filteredRooms = filteredRooms.filter((room: any) => userGroups.includes(room.group_id));
        filteredAssignments = filteredAssignments.filter((assignment: any) => userGroups.includes(assignment.group_id));
      }

      // Filtrar sedes operativas (excluir Otros y Satélites) para el dropdown
      const sedesOperativas = filteredGroups.filter((group: any) => 
        group.name !== 'Otros' && 
        group.name !== 'Satélites'
      );
      setAvailableSedes(sedesOperativas);

      // Calcular estadísticas reales
      const totalSedes = filteredGroups.length;
      const totalRooms = filteredRooms.length;
      
      // Filtrar modelos de manera segura
      let totalModelos = 0;
      console.log('🔍 [DASHBOARD] usersData:', usersData);
      if (usersData.success && usersData.users && Array.isArray(usersData.users)) {
        const activeModels = usersData.users.filter((u: any) => u.role === 'modelo' && u.is_active);
        totalModelos = activeModels.length;
        console.log('✅ [DASHBOARD] Modelos encontrados:', totalModelos);
        
        // Los datos de modelos para el ticker se cargan desde /api/admin/dashboard-ticker
      } else {
        console.error('❌ [DASHBOARD] Error en usersData:', {
          success: usersData.success,
          hasUsers: !!usersData.users,
          isArray: Array.isArray(usersData.users),
          error: usersData.error
        });
      }
      
      const asignacionesActivas = filteredAssignments.length;
      
      // Calcular sedes con y sin rooms
      const sedesConRooms = filteredGroups.filter((group: any) => 
        filteredRooms.some((room: any) => room.group_id === group.id)
      ).length;
      
      const sedesSinRooms = totalSedes - sedesConRooms;

      setStats({
        totalSedes,
        totalRooms,
        totalModelos,
        asignacionesActivas,
        sedesConRooms,
        sedesSinRooms
      });

    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
      setError('Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Helper de Renderizado: Cápsula de Métricas con datos 100% reales desde Supabase
  const renderMetricsCapsule = () => {
    // ═══════════════════════════════════════════════════════════════
    // Construir ticker items dinámicamente desde datos reales
    // ═══════════════════════════════════════════════════════════════
    type HubType = 'facturacion' | 'productividad' | 'disponibilidad' | 'operaciones' | 'anuncios';
    const tickerItems: Array<{
      id: string;
      title: string;
      detail: string;
      icon: React.ReactNode;
      bgClass: string;
      hub: HubType;
    }> = [];

    const iconProd = (d: string) => (
      <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={d} />
      </svg>
    );
    const iconFact = (d: string) => (
      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      </svg>
    );
    const iconDisp = (d: string) => (
      <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={d} />
      </svg>
    );
    const iconAnun = (d: string) => (
      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      </svg>
    );
    const iconOps = (paths: string[]) => (
      <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {paths.map((d, i) => <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />)}
      </svg>
    );

    if (tickerData) {
      const t = tickerData;

      // ── 🟣 PRODUCTIVIDAD (6 items) ──────────────────────────────────
      if (t.productivity.totalModels > 0) {
        tickerItems.push({
          id: 'prod_total',
          title: 'Modelos Activas',
          detail: `${t.productivity.totalModels} modelos activas · ${t.productivity.modelsWithData} con datos registrados en el período`,
          icon: iconProd('M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'),
          bgClass: 'bg-purple-500/10 text-purple-500',
          hub: 'productividad',
        });
      }
      if (t.productivity.modelsPorEncima > 0) {
        tickerItems.push({
          id: 'prod_encima',
          title: 'Por Encima de Objetivo',
          detail: `${t.productivity.modelsPorEncima} modelo${t.productivity.modelsPorEncima > 1 ? 's están' : ' está'} por encima de su objetivo mínimo del período`,
          icon: iconProd('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'),
          bgClass: 'bg-purple-500/10 text-purple-500',
          hub: 'productividad',
        });
      }
      if (t.productivity.modelsPorDebajo > 0) {
        tickerItems.push({
          id: 'prod_debajo',
          title: 'Por Debajo de Objetivo',
          detail: `${t.productivity.modelsPorDebajo} modelo${t.productivity.modelsPorDebajo > 1 ? 's están' : ' está'} por debajo de su objetivo · promedio general: ${t.productivity.avgPorcentaje}%`,
          icon: iconProd('M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'),
          bgClass: 'bg-purple-500/10 text-purple-500',
          hub: 'productividad',
        });
      }
      if (t.productivity.topModel) {
        tickerItems.push({
          id: 'prod_top',
          title: 'Top Modelo',
          detail: `${t.productivity.topModel.prefix} lidera con USD $${t.productivity.topModel.usdBruto.toFixed(2)} brutos · ${t.productivity.topModel.porcentaje}% de su objetivo`,
          icon: iconProd('M13 10V3L4 14h7v7l9-11h-7z'),
          bgClass: 'bg-purple-500/10 text-purple-500',
          hub: 'productividad',
        });
      }
      if (t.productivity.bottomModel) {
        tickerItems.push({
          id: 'prod_bottom',
          title: 'Requiere Atención',
          detail: `${t.productivity.bottomModel.prefix} lleva USD $${t.productivity.bottomModel.usdBruto.toFixed(2)} · ${t.productivity.bottomModel.porcentaje}% de su objetivo`,
          icon: iconProd('M20 12H4'),
          bgClass: 'bg-purple-500/10 text-purple-500',
          hub: 'productividad',
        });
      }
      if (t.productivity.avgPorcentaje > 0) {
        tickerItems.push({
          id: 'prod_avg',
          title: 'Promedio General',
          detail: `El promedio general de cumplimiento de objetivo es ${t.productivity.avgPorcentaje}% entre ${t.productivity.modelsWithData} modelos`,
          icon: iconProd('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'),
          bgClass: 'bg-purple-500/10 text-purple-500',
          hub: 'productividad',
        });
      }

      // ── 🟡 FACTURACIÓN (5 items) ────────────────────────────────────
      if (t.rates.usd_cop > 0) {
        tickerItems.push({
          id: 'fact_rates',
          title: 'Tasas Vigentes',
          detail: `1 USD = ${t.rates.usd_cop.toLocaleString('es-CO')} COP · EUR/USD = ${t.rates.eur_usd} · GBP/USD = ${t.rates.gbp_usd}`,
          icon: iconFact('M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
          bgClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-500',
          hub: 'facturacion',
        });
      }
      if (t.platforms.top3.length > 0) {
        const p1 = t.platforms.top3[0];
        tickerItems.push({
          id: 'fact_top1',
          title: 'Plataforma Líder',
          detail: `${p1.name} lidera el período con USD $${p1.totalUsd.toFixed(2)} entre ${p1.modelCount} modelo${p1.modelCount > 1 ? 's' : ''}`,
          icon: iconFact('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'),
          bgClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-500',
          hub: 'facturacion',
        });
      }
      if (t.platforms.top3.length > 1) {
        const p2 = t.platforms.top3[1];
        tickerItems.push({
          id: 'fact_top2',
          title: '2ª Plataforma',
          detail: `${p2.name} es la 2ª más rentable con USD $${p2.totalUsd.toFixed(2)} entre ${p2.modelCount} modelo${p2.modelCount > 1 ? 's' : ''}`,
          icon: iconFact('M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'),
          bgClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-500',
          hub: 'facturacion',
        });
      }
      if (t.platforms.top3.length >= 3) {
        const totalTop3 = t.platforms.top3.reduce((s, p) => s + p.totalUsd, 0);
        tickerItems.push({
          id: 'fact_top3_sum',
          title: 'Top 3 Plataformas',
          detail: `${t.platforms.top3.map(p => p.name).join(', ')} suman USD $${totalTop3.toFixed(2)} en el período`,
          icon: iconFact('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'),
          bgClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-500',
          hub: 'facturacion',
        });
      }
      if (t.platforms.topBySede) {
        tickerItems.push({
          id: 'fact_sede_top',
          title: 'Sede Destacada',
          detail: `Sede ${t.platforms.topBySede.sedeName} lidera con ${t.platforms.topBySede.platformName} generando USD $${t.platforms.topBySede.totalUsd.toFixed(2)}`,
          icon: iconFact('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'),
          bgClass: 'bg-amber-500/10 border border-amber-500/20 text-amber-500',
          hub: 'facturacion',
        });
      }

      // ── 🔵 DISPONIBILIDAD (4 items) ─────────────────────────────────
      if (t.availability.totalAssignments > 0 || t.availability.totalRooms > 0) {
        tickerItems.push({
          id: 'disp_general',
          title: 'Asignaciones',
          detail: `${t.availability.totalAssignments} asignaciones activas en ${t.availability.totalRooms} rooms de ${t.availability.sedesConRooms} sedes`,
          icon: iconDisp('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'),
          bgClass: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-500',
          hub: 'disponibilidad',
        });
      }
      if (t.availability.highOccupancy) {
        const ho = t.availability.highOccupancy;
        tickerItems.push({
          id: 'disp_high_occ',
          title: 'Mayor Ocupación',
          detail: `Sede ${ho.name}: ${ho.pct}% de ocupación · ${ho.freeSlots} slots libres de ${ho.totalSlots} totales`,
          icon: iconDisp('M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'),
          bgClass: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-500',
          hub: 'disponibilidad',
        });
      }
      if (t.availability.mostFree) {
        const mf = t.availability.mostFree;
        tickerItems.push({
          id: 'disp_free',
          title: 'Slots Libres',
          detail: `Sede ${mf.name} tiene ${mf.freeCount} turnos libres en jornada ${mf.shift}`,
          icon: iconDisp('M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'),
          bgClass: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-500',
          hub: 'disponibilidad',
        });
      }
      tickerItems.push({
        id: 'disp_rooms',
        title: 'Infraestructura',
        detail: `${stats.totalRooms} rooms activos en ${stats.sedesConRooms} sedes con asignaciones · ${stats.sedesSinRooms} sedes sin rooms`,
        icon: iconDisp('M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'),
        bgClass: 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-500',
        hub: 'disponibilidad',
      });

      // ── 🟢 ANUNCIOS (2 items) ───────────────────────────────────────
      if (t.announcements.latest) {
        tickerItems.push({
          id: 'anun_latest',
          title: 'Último Comunicado',
          detail: t.announcements.latest.title,
          icon: iconAnun('M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z'),
          bgClass: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500',
          hub: 'anuncios',
        });
      }
      if (t.announcements.activeCount > 0) {
        tickerItems.push({
          id: 'anun_count',
          title: 'Cartelera',
          detail: `${t.announcements.activeCount} comunicado${t.announcements.activeCount > 1 ? 's' : ''} activo${t.announcements.activeCount > 1 ? 's' : ''} en la cartelera de anuncios`,
          icon: iconAnun('M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'),
          bgClass: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500',
          hub: 'anuncios',
        });
      }

      // ── 🔴 OPERACIONES (3 items) ────────────────────────────────────
      tickerItems.push({
        id: 'ops_period',
        title: 'Período Actual',
        detail: `${t.period.label} · ${t.period.daysRemaining} día${t.period.daysRemaining !== 1 ? 's' : ''} restante${t.period.daysRemaining !== 1 ? 's' : ''} para cierre`,
        icon: iconOps(['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z']),
        bgClass: 'bg-rose-500/10 border border-rose-500/20 text-rose-500',
        hub: 'operaciones',
      });
      if (t.configuredModels > 0) {
        tickerItems.push({
          id: 'ops_config',
          title: 'Calculadoras',
          detail: `${t.configuredModels} modelos tienen su calculadora configurada y activa`,
          icon: iconOps(['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z']),
        bgClass: 'bg-rose-500/10 border border-rose-500/20 text-rose-500',
        hub: 'operaciones',
      });
      }
      tickerItems.push({
        id: 'ops_date',
        title: 'Fecha Colombia',
        detail: `${t.period.dateStr} · ${t.period.timeStr.split(' ')[1] || t.period.timeStr}`,
        icon: iconOps(['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z']),
        bgClass: 'bg-rose-500/10 border border-rose-500/20 text-rose-500',
        hub: 'operaciones',
      });
    }

    // Si no hay datos aún, mostrar shimmer de carga
    if (tickerItems.length === 0) {
      return (
        <div className="relative rounded-full h-14 sm:h-16 bg-black/90 dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.02)] flex items-center overflow-hidden w-full select-none">
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-full">
            <div className="absolute -top-10 -left-10 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-10 right-20 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          </div>
          <div className="flex items-center space-x-4 px-8 w-full relative z-10">
            <div className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 bg-white/[0.08] rounded-full animate-pulse" />
              <div className="h-2 w-64 bg-white/[0.05] rounded-full animate-pulse" />
            </div>
            <div className="text-zinc-600 text-xs font-medium animate-pulse">Cargando datos reales...</div>
          </div>
        </div>
      );
    }

    const doubledItems = [...tickerItems, ...tickerItems];

    return (
      <div 
        className="relative rounded-full h-14 sm:h-16 bg-black/90 dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.02)] flex items-center overflow-hidden w-full select-none"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .ticker-track {
            display: flex;
            width: max-content;
            will-change: transform;
          }
          .ticker-item {
            transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
            user-select: none;
            -webkit-user-select: none;
          }
          .ticker-item:hover {
            transform: scale(1.03);
            background-color: rgba(255, 255, 255, 0.06);
            border-color: rgba(255, 255, 255, 0.15);
          }
        ` }} />

        {/* Ambient Aurora Orbs background inside the pill */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-full">
          <div className="absolute -top-10 -left-10 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
          <div className="absolute -bottom-10 right-20 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        </div>

        {/* Infinite Scrolling Marquee Track */}
        <div 
          className="w-full overflow-hidden relative z-10 py-1"
          onTouchStart={handleTickerTouchStart}
          onTouchMove={handleTickerTouchMove}
        >
          <div 
            ref={tickerTrackRef}
            className="ticker-track"
            style={{ willChange: 'transform' }}
          >
            {doubledItems.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                onClick={() => {
                  // En escritorios o clicks normales que no sean táctiles
                  setActiveHub(item.hub);
                }}
                onTouchEnd={(e) => handleTickerTouchEnd(e, item.hub)}
                className="ticker-item flex items-center space-x-3 px-5 py-2 bg-white/[0.03] dark:bg-white/[0.02] border border-white/[0.06] rounded-full mx-3 flex-shrink-0 cursor-pointer backdrop-blur-md select-none"
                title={`Entrar al Hub de ${item.title}`}
              >
                <div className={`w-7.5 h-7.5 rounded-full ${item.bgClass} flex items-center justify-center flex-shrink-0 relative overflow-hidden p-1.5`}>
                  <div className="absolute inset-0 bg-current opacity-10" />
                  {item.icon}
                </div>
                <div className="flex items-baseline space-x-2 select-none">
                  <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap tracking-tight select-none">
                    {item.title}
                  </span>
                  <span className="text-zinc-400 text-[10px] sm:text-xs font-semibold whitespace-nowrap select-none">
                    {item.detail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHubCardsGrid = () => (
    <div className="flex flex-row overflow-x-auto pb-6 gap-5 mb-12 lg:grid lg:grid-cols-5 lg:overflow-x-visible lg:gap-5 snap-x scrollbar-thin snap-mandatory select-none max-sm:px-4">
      <div 
        onClick={() => setActiveHub('facturacion')}
        className="flex-shrink-0 w-[280px] sm:w-[320px] lg:w-auto min-h-[310px] snap-start group relative cursor-pointer overflow-hidden rounded-3xl bg-white/70 dark:bg-[#1a1a1c]/50 hover:bg-white/90 dark:hover:bg-[#1a1a1c]/75 border border-amber-500/30 dark:border-amber-500/20 hover:border-amber-500/60 dark:hover:border-amber-500/50 p-6 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] dark:hover:shadow-[0_0_35px_rgba(245,158,11,0.25)] backdrop-blur-md"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="relative flex flex-col h-full justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center h-5 gap-1.5 px-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-[10px] text-amber-500 font-bold tracking-wide leading-none">Activo</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-amber-500 dark:text-amber-400 tracking-wide transition-colors whitespace-nowrap">
                Presente & Pasado
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0 opacity-0 max-h-0 -translate-y-2 group-hover:opacity-100 group-hover:max-h-20 group-hover:mt-2 group-hover:translate-y-0 overflow-hidden transition-all duration-500 ease-out">
                Consulta montos generados en el periodo actual e histórico de facturación.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-1.5 transition-transform duration-300">
            <span>Entrar al Hub</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Hub 2: Realtime */}
      <div 
        onClick={() => setActiveHub('productividad')}
        className="flex-shrink-0 w-[280px] sm:w-[320px] lg:w-auto min-h-[310px] snap-start group relative cursor-pointer overflow-hidden rounded-3xl bg-white/70 dark:bg-[#1a1a1c]/50 hover:bg-white/90 dark:hover:bg-[#1a1a1c]/75 border border-purple-500/30 dark:border-purple-500/20 hover:border-purple-500/60 dark:hover:border-purple-500/50 p-6 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] dark:hover:shadow-[0_0_35px_rgba(168,85,247,0.25)] backdrop-blur-md"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="relative flex flex-col h-full justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center h-5 gap-1.5 px-2.5 rounded-full bg-purple-500/10 border border-purple-500/20 animate-pulse select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                <span className="text-[10px] text-purple-500 font-bold tracking-wide leading-none">En vivo</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-purple-500 dark:text-purple-400 tracking-wide transition-colors">
                Realtime
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0 opacity-0 max-h-0 -translate-y-2 group-hover:opacity-100 group-hover:max-h-20 group-hover:mt-2 group-hover:translate-y-0 overflow-hidden transition-all duration-500 ease-out">
                Monitorea el estatus de transmisión y tokens de las modelos en vivo.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:translate-x-1.5 transition-transform duration-300">
            <span>Entrar al Hub</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Hub 3: Disponibilidad */}
      <div 
        onClick={() => setActiveHub('disponibilidad')}
        className="flex-shrink-0 w-[280px] sm:w-[320px] lg:w-auto min-h-[310px] snap-start group relative cursor-pointer overflow-hidden rounded-3xl bg-white/70 dark:bg-[#1a1a1c]/50 hover:bg-white/90 dark:hover:bg-[#1a1a1c]/75 border border-cyan-500/30 dark:border-cyan-500/20 hover:border-cyan-500/60 dark:hover:border-cyan-500/50 p-6 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] dark:hover:shadow-[0_0_35px_rgba(6,182,212,0.25)] backdrop-blur-md"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="relative flex flex-col h-full justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center h-5 gap-1.5 px-2.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 animate-pulse select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
                <span className="text-[10px] text-cyan-500 font-bold tracking-wide leading-none">Slots</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-500 dark:text-cyan-400 tracking-wide transition-colors">
                Disponibilidad
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0 opacity-0 max-h-0 -translate-y-2 group-hover:opacity-100 group-hover:max-h-20 group-hover:mt-2 group-hover:translate-y-0 overflow-hidden transition-all duration-500 ease-out">
                Visualiza la ocupación de rooms y turnos de transmisión en las sedes.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1.5 transition-transform duration-300">
            <span>Entrar al Hub</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Hub 4: Anuncios */}
      <div 
        onClick={() => setActiveHub('anuncios')}
        className="flex-shrink-0 w-[280px] sm:w-[320px] lg:w-auto min-h-[310px] snap-start group relative cursor-pointer overflow-hidden rounded-3xl bg-white/70 dark:bg-[#1a1a1c]/50 hover:bg-white/90 dark:hover:bg-[#1a1a1c]/75 border border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 p-6 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] dark:hover:shadow-[0_0_35px_rgba(16,185,129,0.25)] backdrop-blur-md"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="relative flex flex-col h-full justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center h-5 gap-1.5 px-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-pulse select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="text-[10px] text-emerald-500 font-bold tracking-wide leading-none">Cartelera</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-emerald-500 dark:text-emerald-400 tracking-wide transition-colors">
                Anuncios
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0 opacity-0 max-h-0 -translate-y-2 group-hover:opacity-100 group-hover:max-h-20 group-hover:mt-2 group-hover:translate-y-0 overflow-hidden transition-all duration-500 ease-out">
                Gestiona comunicados oficiales y noticias de la cartelera informativa.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1.5 transition-transform duration-300">
            <span>Entrar al Hub</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Hub 5: Operaciones */}
      <div 
        onClick={() => setActiveHub('operaciones')}
        className="flex-shrink-0 w-[280px] sm:w-[320px] lg:w-auto min-h-[310px] snap-start group relative cursor-pointer overflow-hidden rounded-3xl bg-white/70 dark:bg-[#1a1a1c]/50 hover:bg-white/90 dark:hover:bg-[#1a1a1c]/75 border border-rose-500/30 dark:border-rose-500/20 hover:border-rose-500/60 dark:hover:border-rose-500/50 p-6 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(244,63,94,0.2)] dark:hover:shadow-[0_0_35px_rgba(244,63,94,0.25)] backdrop-blur-md"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/0 via-rose-500/0 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <div className="relative flex flex-col h-full justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-300 shadow-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="inline-flex items-center justify-center h-5 gap-1.5 px-2.5 rounded-full bg-rose-500/10 border border-rose-500/20 animate-pulse select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                <span className="text-[10px] text-rose-500 font-bold tracking-wide leading-none">Cierre</span>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-rose-500 dark:text-rose-400 tracking-wide transition-colors">
                Operaciones
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0 opacity-0 max-h-0 -translate-y-2 group-hover:opacity-100 group-hover:max-h-20 group-hover:mt-2 group-hover:translate-y-0 overflow-hidden transition-all duration-500 ease-out">
                Realiza cierres manuales de periodos y audita la facturación consolidada.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 group-hover:translate-x-1.5 transition-transform duration-300">
            <span>Entrar al Hub</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  // Carrusel Móvil Rotativo 3D para los Hubs de Sedes
  const renderMobileHubCarousel = () => {
    type SedeHubType = 'facturacion' | 'productividad' | 'disponibilidad' | 'operaciones' | 'anuncios';
    const cards = [
      {
        title: "Presente & Pasado",
        subtitle: "Facturación & Cierres",
        desc: "Consulta montos generados en el periodo actual e histórico de facturación.",
        metric: stats.totalSedes > 0 ? "Facturación" : "---",
        submetric: "Cierres & Tasas",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        badge: "Cierres",
        badgeColor: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
        ledColor: "bg-amber-500",
        hub: "facturacion" as SedeHubType,
        colorClass: "border-amber-500/30 dark:border-amber-500/20 text-amber-500",
        activeGlowClass: "border-amber-500/70 dark:border-amber-500/60 shadow-[0_0_30px_rgba(245,158,11,0.25)] dark:shadow-[0_0_35px_rgba(245,158,11,0.3)] text-amber-500",
        glowGradient: "from-amber-500/0 via-amber-500/0 to-amber-500/[0.08]"
      },
      {
        title: "Realtime",
        subtitle: "Productividad en Vivo",
        desc: "Monitorea el estatus de transmisión y tokens de las modelos en vivo.",
        metric: stats.totalModelos > 0 ? `${stats.totalModelos} Modelos` : "Realtime",
        submetric: "Transmisión",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
        badge: "En vivo",
        badgeColor: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
        ledColor: "bg-purple-500",
        hub: "productividad" as SedeHubType,
        colorClass: "border-purple-500/30 dark:border-purple-500/20 text-purple-500",
        activeGlowClass: "border-purple-500/70 dark:border-purple-500/60 shadow-[0_0_30px_rgba(168,85,247,0.25)] dark:shadow-[0_0_35px_rgba(168,85,247,0.3)] text-purple-500",
        glowGradient: "from-purple-500/0 via-purple-500/0 to-purple-500/[0.08]"
      },
      {
        title: "Disponibilidad",
        subtitle: "Ocupación de Rooms",
        desc: "Visualiza la ocupación de rooms y turnos de transmisión en las sedes.",
        metric: `${stats.asignacionesActivas} Activas`,
        submetric: `${stats.totalRooms} Rooms`,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
        badge: "Slots",
        badgeColor: "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400",
        ledColor: "bg-cyan-500",
        hub: "disponibilidad" as SedeHubType,
        colorClass: "border-cyan-500/30 dark:border-cyan-500/20 text-cyan-500",
        activeGlowClass: "border-cyan-500/70 dark:border-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.25)] dark:shadow-[0_0_35px_rgba(6,182,212,0.3)] text-cyan-500",
        glowGradient: "from-cyan-500/0 via-cyan-500/0 to-cyan-500/[0.08]"
      },
      {
        title: "Anuncios",
        subtitle: "Cartelera Informativa",
        desc: "Gestiona comunicados oficiales y noticias de la cartelera informativa.",
        metric: "Comunicados",
        submetric: "Noticias Sede",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        ),
        badge: "Anuncios",
        badgeColor: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        ledColor: "bg-emerald-500",
        hub: "anuncios" as SedeHubType,
        colorClass: "border-emerald-500/30 dark:border-emerald-500/20 text-emerald-500",
        activeGlowClass: "border-emerald-500/70 dark:border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.25)] dark:shadow-[0_0_35px_rgba(16,185,129,0.3)] text-emerald-500",
        glowGradient: "from-emerald-500/0 via-emerald-500/0 to-emerald-500/[0.08]"
      },
      {
        title: "Operaciones",
        subtitle: "Cierre de Periodo",
        desc: "Realiza cierres manuales de periodos y audita la facturación consolidada.",
        metric: "Cierre Manual",
        submetric: "Auditoría",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
        badge: "Cierre",
        badgeColor: "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400",
        ledColor: "bg-rose-500",
        hub: "operaciones" as SedeHubType,
        colorClass: "border-rose-500/30 dark:border-rose-500/20 text-rose-500",
        activeGlowClass: "border-rose-500/70 dark:border-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.25)] dark:shadow-[0_0_35px_rgba(244,63,94,0.3)] text-rose-500",
        glowGradient: "from-rose-500/0 via-rose-500/0 to-rose-500/[0.08]"
      }
    ];

    const getCardStyle = (index: number) => {
      const diff = index - activeMobileIndex;
      let offset = diff;
      if (offset > 2) offset -= 5;
      if (offset < -2) offset += 5;

      const absOffset = Math.abs(offset);
      
      const translateX = offset * 135; 
      const scale = 1 - absOffset * 0.12; 
      const opacity = 1 - absOffset * 0.20; // 80% opacity for side cards to make text super crisp and readable!
      const zIndex = 10 - absOffset;
      const isCenter = offset === 0;

      const height = isCenter && showMobileDescription ? 330 : 250;

      return {
        transform: `translateX(${translateX}px) scale(${scale})`,
        opacity: opacity > 0 ? opacity : 0,
        zIndex,
        height: `${height}px`,
        cursor: isCenter ? 'pointer' : 'default',
        pointerEvents: absOffset <= 1 ? ('auto' as const) : ('none' as const),
      };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartX === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchStartX - touchEndX;

      if (diffX > 50) {
        // Swipe left -> next
        setActiveMobileIndex((prev) => (prev + 1) % 5);
        setShowMobileDescription(false);
      } else if (diffX < -50) {
        // Swipe right -> prev
        setActiveMobileIndex((prev) => (prev - 1 + 5) % 5);
        setShowMobileDescription(false);
      }
      setTouchStartX(null);
    };

    const handleCardTap = (hub: SedeHubType, isCenter: boolean) => {
      if (!isCenter) {
        const idx = cards.findIndex(c => c.hub === hub);
        if (idx !== -1) {
          setActiveMobileIndex(idx);
          setShowMobileDescription(false);
        }
        return;
      }

      const now = Date.now();
      if (now - lastTapMobile < 300) {
        setActiveHub(hub);
      } else {
        if (showMobileDescription) {
          setActiveHub(hub);
        } else {
          setShowMobileDescription(true);
        }
      }
      setLastTapMobile(now);
    };

    const activeCard = cards[activeMobileIndex];

    return (
      <div className="w-full flex flex-col items-center py-4 relative overflow-hidden select-none">
        <style dangerouslySetInnerHTML={{ __html: `
          .carousel-container-3d {
            position: relative;
            width: 100%;
            height: 350px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: visible;
          }
          .carousel-card-3d {
            position: absolute;
            width: 230px;
            transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease, height 0.6s cubic-bezier(0.25, 1, 0.5, 1);
          }
        ` }} />

        {/* 3D Carousel Window */}
        <div 
          className="carousel-container-3d"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {cards.map((c, index) => {
            const isCenter = index === activeMobileIndex;
            const cardStyle = getCardStyle(index);

            return (
              <div
                key={c.hub}
                style={cardStyle}
                onClick={() => handleCardTap(c.hub, isCenter)}
                className={`carousel-card-3d flex-shrink-0 group relative overflow-hidden rounded-[2.2rem] bg-white dark:bg-zinc-900 border p-6 transition-all duration-300 flex flex-col justify-between ${isCenter ? c.activeGlowClass : `${c.colorClass} shadow-md`}`}
              >
                {/* Glow ambient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${c.glowGradient} opacity-20`} />

                <div className="relative flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shadow-md">
                      {c.icon}
                    </div>
                    <div className="flex items-center justify-center h-6 select-none pr-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.ledColor} animate-pulse`} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-800 dark:text-zinc-100 tracking-tight leading-snug">
                      {c.title}
                    </h3>
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 block leading-none pt-0.5">
                      {c.subtitle}
                    </span>
                    <div 
                      className={`overflow-hidden transition-all duration-500 ease-out ${
                        isCenter && showMobileDescription 
                          ? "max-h-24 opacity-100 mt-2.5 translate-y-0" 
                          : "max-h-0 opacity-0 mt-0 -translate-y-2 pointer-events-none"
                      }`}
                    >
                      <p className="text-[10.5px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white leading-none whitespace-nowrap">
                      {c.metric}
                    </span>
                  </div>

                  <div className="flex items-center text-[9px] font-bold text-pink-500/80">
                    <span>
                      {isCenter && showMobileDescription 
                        ? "Tap de nuevo para ingresar" 
                        : "Tap para info · Doble tap para entrar"
                      }
                    </span>
                    <svg className="w-2.5 h-2.5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Swipe Indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {cards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveMobileIndex(idx);
                setShowMobileDescription(false);
              }}
              className={`w-1.5 h-1.5 rounded-full border-none transition-all duration-300 ${
                idx === activeMobileIndex
                  ? "bg-pink-500 w-3 shadow-[0_0_8px_rgba(236,72,153,0.8)]"
                  : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400"
              }`}
              title={`Ver hub ${idx + 1}`}
            />
          ))}
        </div>


      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-48 bg-transparent text-gray-900 dark:text-zinc-100">
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        
        {/* Mensaje de alerta para admins sin sedes asignadas */}
        {userRole === 'admin' && availableSedes.length === 0 && (
          <div className="mb-8 px-4 sm:px-0">
            <div className="bg-gradient-to-r from-yellow-500/[0.04] to-orange-500/[0.04] dark:bg-yellow-900/10 dark:border-yellow-700/30 backdrop-blur-md rounded-2xl p-6 border border-yellow-500/20 shadow-xl">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-yellow-600 dark:text-yellow-500">Sin Sedes Asignadas</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    No tienes sedes asignadas para ver estadísticas. Contacta al Super Admin para que te asigne sedes en el panel de control.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Master PageHeader integrating welcome details */}
        <PageHeader
          title="Dashboard de Sedes"
          subtitle="Launchpad Operativo · Administra la facturación · Monitorea la productividad · Consulta disponibilidad · Coordina operaciones"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 012-2h-2a2 2 0 00-2-2H6z" />
            </svg>
          }
          className="mb-6 px-4 sm:px-0"
        />

        {/* Concentric metrics capsule rendered outside */}
        <div className="mb-8 px-4 sm:px-0">
          {renderMetricsCapsule()}
        </div>

        {/* Interactive Grid of Hubs (Desktop) */}
        <div className="px-4 sm:px-0 hidden md:block">
          {renderHubCardsGrid()}
        </div>

        {/* Interactive Carousel of Hubs (Mobile 3D rotary) */}
        <div className="px-4 sm:px-0 md:hidden">
          {renderMobileHubCarousel()}
        </div>

        {/* Messages / Global Error */}
        {error && (
          <div className="mb-6 mx-4 sm:mx-0 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-semibold">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* FLOATING HUBS (OVERLAYS) - Unified Single Premium Window wrapper to avoid jumps and resets */}
        {activeHub && (
          <HubWindow 
            isOpen={activeHub !== null}
            onClose={() => setActiveHub(null)}
            title={
              activeHub === 'facturacion'
                ? "Hub de Facturación & Cierres"
                : activeHub === 'productividad'
                ? "Hub de Productividad Realtime"
                : activeHub === 'disponibilidad'
                ? "Hub de Disponibilidad de Rooms"
                : activeHub === 'operaciones'
                ? "Hub de Operaciones"
                : activeHub === 'anuncios'
                ? "Hub de Anuncios"
                : ""
            }
            subtitle={
              activeHub === 'facturacion'
                ? "Montos acumulados del periodo actual y consulta histórica de cierres anteriores"
                : activeHub === 'productividad'
                ? "Monitoreo al instante de transmisiones y métricas de desempeño"
                : activeHub === 'disponibilidad'
                ? "Jornadas de transmisión de modelos y ocupación de espacios"
                : activeHub === 'operaciones'
                ? "Cierre manual de periodos y control de operaciones de cierre"
                : activeHub === 'anuncios'
                ? "Gestión de comunicados oficiales y cartelera informativa"
                : ""
            }
            activeHub={activeHub}
            onNavigate={setActiveHub}
          >
            {activeHub === 'facturacion' && (
              <div className="space-y-8 animate-in fade-in duration-300">
            {/* Billing Summary Actual */}
            {userId && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'superadmin_aff') && (
              <div className="text-gray-900 dark:text-gray-100">
                <BillingSummary 
                  userRole={userRole as 'admin' | 'super_admin' | 'superadmin_aff'} 
                  userId={userId}
                  userGroups={userGroups}
                />
              </div>
            )}

            {/* Consulta Histórica */}
            {/* Header de Consulta Histórica (Minimalista, por fuera de la caja) */}
            <div className="flex items-center justify-between px-1 mt-6">
              <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
                <div className="flex items-center justify-center text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                  <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex items-baseline">
                  <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                    Consulta de Periodos Históricos
                  </h2>
                  <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                    Busca y audita periodos archivados anteriores
                  </span>
                </div>
              </div>

              {/* Acciones alineadas a la derecha simétricamente */}
              <div className="flex items-center space-x-2">

                <button
                  onClick={() => {
                    if (showHistoricalQuery) {
                      // Al ocultar la sección, limpiar filtros y resultados para volver al estado inicial del hub
                      setSelectedMonth('');
                      setSelectedYear('');
                      setSelectedPeriod('P1');
                      setTargetDate('');
                    }
                    setShowHistoricalQuery(!showHistoricalQuery);
                  }}
                  className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors duration-200 active:scale-90"
                  title={showHistoricalQuery ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${showHistoricalQuery ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sibling Card Body of historical filters, rendered conditionally */}
            {showHistoricalQuery && (
              <div className="bg-white/20 dark:bg-[#1a1a1c]/20 backdrop-blur-md rounded-[2rem] sm:rounded-full border border-white/20 dark:border-white/[0.08] shadow-lg py-3.5 px-6 sm:px-8 mb-6 mt-2 relative z-40 animate-in fade-in slide-in-from-top-2 duration-200 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                {/* Año */}
                <div className="flex flex-col items-center sm:items-start min-w-[110px] sm:min-w-[130px] w-full sm:w-auto">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ml-1">Año</span>
                  <AppleDropdown
                    options={Array.from({ length: 5 }, (_, i) => {
                      const year = (new Date().getFullYear() - i).toString();
                      return { value: year, label: year };
                    })}
                    value={selectedYear}
                    onChange={setSelectedYear}
                    placeholder="Año"
                    className="w-full sm:w-[110px] sm:max-w-[110px] text-xs sm:text-sm"
                  />
                </div>

                {/* Mes */}
                <div className="flex flex-col items-center sm:items-start min-w-[110px] sm:min-w-[130px] w-full sm:w-auto">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ml-1">Mes</span>
                  <AppleDropdown
                    options={Array.from({ length: 12 }, (_, i) => {
                      const month = (i + 1).toString();
                      return { value: month, label: getMonthName(month) };
                    })}
                    value={selectedMonth}
                    onChange={setSelectedMonth}
                    placeholder="Mes"
                    className="w-full sm:w-[120px] sm:max-w-[120px] text-xs sm:text-sm"
                  />
                </div>

                {/* Periodo */}
                <div className="flex flex-col items-center sm:items-start min-w-[110px] sm:min-w-[130px] w-full sm:w-auto">
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ml-1">Periodo</span>
                  <AppleDropdown
                    options={[
                      { value: 'P1', label: 'P1' },
                      { value: 'P2', label: 'P2' }
                    ]}
                    value={selectedPeriod}
                    onChange={setSelectedPeriod}
                    placeholder="Periodo"
                    className="w-full sm:w-[100px] sm:max-w-[100px] text-xs sm:text-sm"
                  />
                </div>

                {/* Rates (Botón Pill al flanco derecho de los drops) */}
                {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin_aff') && selectedMonth && selectedYear && selectedPeriod && (
                  <div className="flex flex-col items-center sm:items-start min-w-[90px] w-full sm:w-auto animate-in fade-in zoom-in duration-300">
                    <span className="hidden sm:block text-[10px] select-none opacity-0 mb-1">Rates</span>
                    <button
                      onClick={async () => {
                        const year = parseInt(selectedYear);
                        const month = parseInt(selectedMonth);
                        const periodType = selectedPeriod === 'P1' ? '1-15' : '16-31';
                        let day = selectedPeriod === 'P1' ? 1 : 16;
                        const periodDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        await loadPeriodInfo(periodDate, periodType);
                        setShowEditRatesModal(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2 min-h-[32px] sm:min-h-[34px] flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50/80 dark:bg-purple-900/30 backdrop-blur-sm border border-purple-200/50 dark:border-purple-700/50 rounded-full hover:bg-purple-100/80 dark:hover:bg-purple-800/40 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Rates</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resultado Consulta Histórica (Fuera del contenedor de filtros para evitar doble caja) */}
            {selectedMonth && selectedYear && selectedPeriod && targetDate && (
              <div className="text-gray-900 dark:text-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                <BillingSummary 
                  userRole={userRole as 'admin' | 'super_admin' | 'superadmin_aff'} 
                  userId={userId}
                  userGroups={userGroups}
                  selectedDate={targetDate}
                  selectedPeriod={selectedPeriod === 'P1' ? 'period-1' : 'period-2'}
                />
              </div>
            )}
            </div>
            )}

            {activeHub === 'productividad' && userId && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'superadmin_aff') && (
              <div className="text-gray-900 dark:text-gray-100 w-full animate-in fade-in duration-300">
                <ModelProductivityPanel
                  userId={userId}
                  userRole={userRole as 'admin' | 'super_admin' | 'superadmin_aff'}
                  userGroups={userGroups}
                />
              </div>
            )}

            {activeHub === 'disponibilidad' && (
              <div className="space-y-6 text-gray-900 dark:text-gray-100 animate-in fade-in duration-300">
            
            {/* Search Bar / Selector section */}
            <div className="mb-4 sm:mb-8 relative z-50">
              <div className="flex items-start justify-between px-1 mb-1.5 sm:mb-2">
                <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
                  <div className="flex items-center justify-center text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] mt-0.5">
                    <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex items-baseline min-w-0">
                    <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                      Selección de Sede
                    </h2>
                    <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                      Filtra rooms y jornadas por sede
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSeleccionSedeCollapsed(c => !c)}
                  className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-cyan-500 transition-colors duration-200 active:scale-90 mt-0.5"
                  title={seleccionSedeCollapsed ? 'Expandir' : 'Contraer'}
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${seleccionSedeCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {!seleccionSedeCollapsed && (
                <div className="relative z-50 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-1 max-sm:px-4">
                    <div className="flex-1 max-w-xs relative dropdown-container">
                      <button
                        onClick={() => setDropdownOpen(dropdownOpen === 'sede' ? null : 'sede')}
                        className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white flex items-center justify-between hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      >
                        <span>
                          {selectedSede ? availableSedes.find(s => s.id === selectedSede)?.name || 'Selecciona una sede...' : 'Selecciona una sede...'}
                        </span>
                        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${dropdownOpen === 'sede' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {dropdownOpen === 'sede' && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 rounded-xl shadow-2xl z-[99999] max-h-56 overflow-y-auto">
                          <div className="py-1">
                            {availableSedes.map((sede) => (
                              <button
                                key={sede.id}
                                onClick={() => {
                                  setSelectedSede(sede.id);
                                  setResumenDisponibilidadCollapsed(false); // auto-expand
                                  setDropdownOpen(null);
                                  setShowTodasSedes(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 text-xs text-gray-700 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${selectedSede === sede.id ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold' : ''}`}
                              >
                                {sede.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedSede && (
                      <button
                        onClick={() => setSelectedSede('')}
                        className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-zinc-400 hover:text-gray-900 dark:hover:text-white flex-shrink-0"
                        title="Cerrar consulta"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(null);
                        setSelectedSede('');
                        setShowTodasSedes(true);
                        setTodasSedesCollapsed(false); // auto-expand
                        loadTodasSedesDisponibilidad();
                      }}
                      disabled={!availableSedes.length || loadingTodasSedes}
                      className="px-6 py-2.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-fuchsia-600 rounded-full shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(6,182,212,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {loadingTodasSedes ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                          <span>Cargando...</span>
                        </>
                      ) : (
                        <span>Ver todas las sedes</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Conditionally show table of all sedes */}
            {showTodasSedes && (
              <div className="mb-4 sm:mb-8 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start justify-between px-1 mb-1.5 sm:mb-2 max-sm:px-4">
                  <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
                    <div className="flex items-center justify-center text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] mt-0.5">
                      <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="flex items-baseline min-w-0">
                      <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                        Disponibilidad por Sede y Room
                      </h2>
                      <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                        Vista consolidada de todas las sedes
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <button
                      onClick={() => setTodasSedesCollapsed(c => !c)}
                      className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-cyan-500 transition-colors duration-200 active:scale-90"
                      title={todasSedesCollapsed ? 'Expandir' : 'Contraer'}
                    >
                      <svg className={`w-4 h-4 transition-transform duration-200 ${todasSedesCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowTodasSedes(false)}
                      className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-red-500 transition-colors duration-200 active:scale-90"
                      title="Cerrar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-[#1a1a1c]/60 backdrop-blur-sm rounded-[1.75rem] shadow-md border border-black/[0.04] dark:border-white/[0.05] overflow-hidden hover:shadow-lg transition-all duration-300 relative z-40 max-sm:!bg-transparent max-sm:!border-none max-sm:!shadow-none max-sm:!p-0 max-sm:!backdrop-blur-none">
                  {!todasSedesCollapsed && (
                    <>
                      {/* Neon Glowing Line Separator (Availability Cyan Accent) */}
                      <div className="h-[1.5px] w-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.75),0_0_3px_rgba(6,182,212,0.85)] pointer-events-none opacity-70" />
                      
                      <div className="p-6 max-sm:p-0 animate-in fade-in duration-200">
                        {loadingTodasSedes ? (
                          <div className="flex items-center justify-center py-8 text-zinc-400 max-sm:px-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400 mr-3" />
                            <span>Cargando todas las sedes...</span>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {resumenPorSede.length > 0 && (
                              <div className="space-y-3 max-sm:px-4">
                                <h4 className="text-[11px] sm:text-xs font-semibold text-gray-500 dark:text-zinc-400 px-1">Resumen por Sede</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                  {resumenPorSede.map((r) => (
                                    <div
                                      key={r.sede}
                                      className="bg-black/5 dark:bg-white/[0.02] border border-black/10 dark:border-white/[0.08] rounded-xl p-4 shadow-sm"
                                    >
                                      <div className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={r.sede}>
                                        {r.sede}
                                      </div>
                                      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                        <span className="font-bold text-cyan-600 dark:text-cyan-400">{r.slots_disponibles}/{r.total_slots} disp.</span>
                                        <span>·</span>
                                        <span>{r.slots_ocupados} ocup.</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Listado de Disponibilidad de Todas las Sedes */}
                            <div className="space-y-3 max-sm:px-4">
                              {/* Column headers — mismos anchos fijos que las filas */}
                              <div className="hidden sm:flex items-center px-3 py-2 bg-black/[0.02] dark:bg-black/10 border-b border-black/[0.03] dark:border-white/[0.05] gap-3 rounded-full mb-1">
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider">Sede / Room</span>
                                </div>
                                <div className="flex items-center justify-end gap-3 sm:gap-0">
                                  <span className="w-[100px] flex-shrink-0 inline-block text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Mañana</span>
                                  <span className="w-[100px] flex-shrink-0 inline-block text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Tarde</span>
                                  <span className="w-[100px] flex-shrink-0 inline-block text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Noche</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {disponibilidadTodasSedes.map((row) => (
                                  <div key={`${row.sede_id}-${row.room_id}`} className="flex flex-col sm:flex-row sm:items-center p-3 bg-white/40 dark:bg-[#1a1a1c]/40 border border-black/[0.04] dark:border-white/[0.05] rounded-xl hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:shadow-md transition-all duration-300 gap-3">
                                    {/* Left: Sede & Room details with bare icon */}
                                    <div className="flex-1 min-w-0 flex items-center space-x-3">
                                      <svg 
                                        className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.7)] flex-shrink-0"
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                      </svg>
                                      <div className="min-w-0 flex-1">
                                        <span className="text-[10px] text-gray-500 dark:text-zinc-400 block font-semibold uppercase tracking-wider">
                                          {row.sede_nombre}
                                        </span>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white block mt-0.5 truncate">
                                          {row.room_name}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {/* Shifts with premium styled cyan/zinc pills and dots */}
                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-0 max-sm:w-full">
                                      <div className="w-[100px] flex-shrink-0 flex items-center justify-between sm:justify-center max-sm:w-full">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider sm:hidden">Mañana</span>
                                        {row.manana ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)] gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                            Disponible
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                                            Ocupado
                                          </span>
                                        )}
                                      </div>
                                      <div className="w-[100px] flex-shrink-0 flex items-center justify-between sm:justify-center max-sm:w-full">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider sm:hidden">Tarde</span>
                                        {row.tarde ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)] gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                            Disponible
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                                            Ocupado
                                          </span>
                                        )}
                                      </div>
                                      <div className="w-[100px] flex-shrink-0 flex items-center justify-between sm:justify-center max-sm:w-full">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider sm:hidden">Noche</span>
                                        {row.noche ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)] gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                            Disponible
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                                            Ocupado
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {disponibilidadTodasSedes.length === 0 && !loadingTodasSedes && (
                                  <div className="text-center py-8 text-zinc-500 bg-white/10 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl">No hay rooms en las sedes disponibles.</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Conditionally show table of a single Sede */}
            {selectedSede && (
              <div className="mb-4 sm:mb-8 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start justify-between px-1 mb-1.5 sm:mb-2 max-sm:px-4">
                  <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
                    <div className="flex items-center justify-center text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] mt-0.5">
                      <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                      </svg>
                    </div>
                    <div className="flex items-baseline min-w-0">
                      <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                        Resumen de Disponibilidad
                      </h2>
                      <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                        Jornadas y rooms de la sede seleccionada
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <button
                      onClick={() => setResumenDisponibilidadCollapsed(c => !c)}
                      className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-cyan-500 transition-colors duration-200 active:scale-90"
                      title={resumenDisponibilidadCollapsed ? 'Expandir' : 'Contraer'}
                    >
                      <svg className={`w-4 h-4 transition-transform duration-200 ${resumenDisponibilidadCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedSede('')}
                      className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-red-500 transition-colors duration-200 active:scale-90"
                      title="Cerrar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-[#1a1a1c]/60 backdrop-blur-sm rounded-[1.75rem] shadow-md border border-black/[0.04] dark:border-white/[0.05] overflow-hidden hover:shadow-lg transition-all duration-300 relative z-40 max-sm:!bg-transparent max-sm:!border-none max-sm:!shadow-none max-sm:!p-0 max-sm:!backdrop-blur-none">
                  {/* Header of Sede inside the box (Purple productivity style matching) */}
                  <div 
                    className="px-5 py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200"
                    onClick={() => setResumenDisponibilidadCollapsed(c => !c)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
                      {/* Left: Chevron + Bare building icon + Info */}
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200">
                          <svg 
                            className={`w-4 h-4 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${!resumenDisponibilidadCollapsed ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        
                        <svg 
                          className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.7)] flex-shrink-0"
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                        </svg>

                        {sedeDisponibilidad && (
                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                              {sedeDisponibilidad.sede_nombre}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mt-0.5">
                              {sedeDisponibilidad.rooms_totales} room{sedeDisponibilidad.rooms_totales !== 1 ? 's' : ''} • {sedeDisponibilidad.espacios_disponibles}/{sedeDisponibilidad.total_espacios} espacios disp.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right: Consolidated metrics aligned tabulary */}
                      {sedeDisponibilidad && (
                        <div className="grid grid-cols-2 gap-x-6 lg:mr-[36px] xl:mr-[36px]">
                          <div className="flex flex-col items-start min-w-[120px] tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">Espacios disponibles</span>
                            <span className="text-xs sm:text-sm font-bold text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.15)] truncate mt-0.5">
                              {sedeDisponibilidad.espacios_disponibles}/{sedeDisponibilidad.total_espacios}
                            </span>
                          </div>
                          <div className="flex flex-col items-start min-w-[120px] tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">Rooms Totales</span>
                            <span className="text-xs sm:text-sm font-bold text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.15)] truncate mt-0.5">
                              {sedeDisponibilidad.rooms_totales}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!resumenDisponibilidadCollapsed && (
                    <>
                      {/* Neon Glowing Line Separator (Availability Cyan Accent) */}
                      <div className="h-[1.5px] w-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.75),0_0_3px_rgba(6,182,212,0.85)] pointer-events-none opacity-70" />
                      
                      <div className="p-6 max-sm:p-0 animate-in fade-in duration-200">
                        {loadingDisponibilidad ? (
                          <div className="flex items-center justify-center py-8 text-zinc-400 max-sm:px-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400 mr-3" />
                            <span>Cargando disponibilidad...</span>
                          </div>
                        ) : sedeDisponibilidad ? (
                          <div className="space-y-6">
                            {/* Listado de Disponibilidad al Estilo de Planilla Premium */}
                            <div className="space-y-3 max-sm:px-4">
                              {/* Column headers — mismos anchos fijos que las filas */}
                              <div className="hidden sm:flex items-center px-3 py-2 bg-black/[0.02] dark:bg-black/10 border-b border-black/[0.03] dark:border-white/[0.05] gap-3 rounded-full mb-1">
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider">Room</span>
                                </div>
                                <div className="flex items-center justify-end gap-3 sm:gap-0">
                                  <span className="w-[100px] flex-shrink-0 inline-block text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Mañana</span>
                                  <span className="w-[100px] flex-shrink-0 inline-block text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Tarde</span>
                                  <span className="w-[100px] flex-shrink-0 inline-block text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Noche</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {disponibilidadPorRoom.map((row) => (
                                  <div key={row.room_id} className="flex flex-col sm:flex-row sm:items-center p-3 bg-white/40 dark:bg-[#1a1a1c]/40 border border-black/[0.04] dark:border-white/[0.05] rounded-xl hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:shadow-md transition-all duration-300 gap-3">
                                    {/* Left: Room details with bare icon */}
                                    <div className="flex-1 min-w-0 flex items-center space-x-3">
                                      <svg 
                                        className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.7)] flex-shrink-0"
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                      </svg>
                                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                        {row.room_name}
                                      </span>
                                    </div>
                                    
                                    {/* Shifts with premium styled cyan/zinc pills and dots */}
                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-0 max-sm:w-full">
                                      <div className="w-[100px] flex-shrink-0 flex items-center justify-between sm:justify-center max-sm:w-full">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider sm:hidden">Mañana</span>
                                        {row.manana ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)] gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                            Disponible
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                                            Ocupado
                                          </span>
                                        )}
                                      </div>
                                      <div className="w-[100px] flex-shrink-0 flex items-center justify-between sm:justify-center max-sm:w-full">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider sm:hidden">Tarde</span>
                                        {row.tarde ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)] gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                            Disponible
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                                            Ocupado
                                          </span>
                                        )}
                                      </div>
                                      <div className="w-[100px] flex-shrink-0 flex items-center justify-between sm:justify-center max-sm:w-full">
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider sm:hidden">Noche</span>
                                        {row.noche ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)] gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                                            Disponible
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400 dark:text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                                            Ocupado
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {disponibilidadPorRoom.length === 0 && (
                                  <div className="text-center py-8 text-zinc-500 bg-white/10 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl">No hay rooms en esta sede.</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-zinc-500">No se pudo cargar la disponibilidad de esta sede.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
            )}

            {activeHub === 'operaciones' && userId && userRole === 'super_admin' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Cierre manual de Periodo */}
                <div className="mb-4 sm:mb-8">
                  <div className="flex items-start justify-between px-1 mb-1.5 sm:mb-2 max-sm:px-4">
                    <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
                      <div className="flex items-center justify-center text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] mt-0.5">
                        <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div className="flex items-baseline min-w-0">
                        <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                          Cierre Manual de Período
                        </h2>
                        <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                          Control de operaciones de cierre
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setCierrePeriodoCollapsed(c => !c)}
                      className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-rose-500 transition-colors duration-200 active:scale-90 mt-0.5"
                      title={cierrePeriodoCollapsed ? 'Expandir' : 'Contraer'}
                    >
                      <svg className={`w-4 h-4 transition-transform duration-200 ${cierrePeriodoCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div className="bg-white/20 dark:bg-[#1a1a1c]/20 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/[0.08] shadow-lg relative z-40 overflow-hidden max-sm:!bg-transparent max-sm:!border-none max-sm:!shadow-none max-sm:!p-0 max-sm:!backdrop-blur-none">
                    {!cierrePeriodoCollapsed && (
                      <div className="p-6 max-sm:p-0 animate-in fade-in duration-200 text-gray-900 dark:text-gray-100">
                        <ManualPeriodClosure 
                          userId={userId}
                          userRole="super_admin"
                          groupId={userGroups[0]}
                          onValidationChange={setClosureValidation}
                        />
                      </div>
                    )}
                  </div>

                  {/* Píldora de Validación debajo de la caja principal (Estilo Boreal Hub de Operaciones) */}
                  {!cierrePeriodoCollapsed && closureValidation && !closureValidation.can_cleanup && closureValidation.validation_errors?.length > 0 && (
                    <div className="mt-4 w-full px-5 py-3 sm:py-3.5 bg-transparent backdrop-blur-md border border-rose-500/20 dark:border-rose-500/30 rounded-full flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.08)] animate-in fade-in slide-in-from-top-1 duration-300 select-none">
                      <div className="flex items-center gap-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 min-w-0 flex-1">
                        <svg className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 flex-shrink-0 drop-shadow-[0_0_6px_rgba(244,63,94,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="flex-shrink-0 uppercase tracking-wider text-[10px] bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">Requiere completar pasos anteriores</span>
                        <span className="truncate text-[11px] text-zinc-600 dark:text-zinc-300 font-semibold">
                          {closureValidation.validation_errors.map((err: string) => 
                            err.replace(/^[❌⚠️\s]+/, '').replace(/^ℹ️\s+/, '')
                          ).join('. ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-rose-500 dark:text-rose-400/80 font-bold uppercase tracking-wider pl-2 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
                        {"ACCI\u00d3N PENDIENTE"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hub 5: Anuncios */}
            {activeHub === 'anuncios' && userId && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'superadmin_aff') && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="mb-4 sm:mb-8 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start justify-between px-1 mb-1.5 sm:mb-2 max-sm:px-4">
                  <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
                    <div className="flex items-center justify-center text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] mt-0.5">
                      <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <div className="flex items-baseline min-w-0">
                      <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                        Anuncios & Publicaciones
                      </h2>
                      <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                        Gestión de comunicados oficiales
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setAnunciosCollapsed(c => !c)}
                    className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-emerald-500 transition-colors duration-200 active:scale-90 mt-0.5"
                    title={anunciosCollapsed ? 'Expandir' : 'Contraer'}
                  >
                    <svg className={`w-4 h-4 transition-transform duration-200 ${anunciosCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div className="bg-white/20 dark:bg-[#1a1a1c]/20 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/[0.08] shadow-lg relative z-40 overflow-hidden max-sm:!bg-transparent max-sm:!border-none max-sm:!shadow-none max-sm:!p-0 max-sm:!backdrop-blur-none">
                  {!anunciosCollapsed && (
                    <div className="p-6 max-sm:p-0 animate-in fade-in duration-200 text-gray-900 dark:text-gray-100">
                      <AnnouncementManager 
                        userId={userId}
                        userRole={userRole as 'super_admin' | 'admin' | 'superadmin_aff'}
                        userGroups={userGroups}
                      />
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </HubWindow>
        )}

        {/* Modal para Editar RATES de cierre (fuera de las ventanas flotantes por temas de z-index y stacking context) */}
        {showEditRatesModal && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
            {/* Overlay backdrop with high backdrop-blur (Section 5) */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-3xl transition-opacity duration-300 animate-fade-in"
              onClick={() => {
                if (!savingRates) {
                  setShowEditRatesModal(false);
                  setRatesError(null);
                }
              }}
            />
            
            {/* Modal Content (Section 5: Centered Glass Modal) */}
            <div className="relative w-full max-w-2xl bg-white/85 dark:bg-[#1a1a1c]/85 backdrop-blur-3xl border border-white/50 dark:border-white/10 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-scale-up text-gray-900 dark:text-white">
              
              {/* Glow Ambiental (Section 5) */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl mix-blend-screen pointer-events-none" />
              
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-black/[0.06] dark:border-white/[0.08] relative z-10">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">Editar RATES de cierre</h2>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                      {selectedMonth && selectedYear && selectedPeriod ? 
                        `${getMonthName(selectedMonth)} ${selectedYear} - ${selectedPeriod} (${selectedPeriod === 'P1' ? 'Días 1-15' : 'Días 16-31'})` : 
                        'Selecciona un período'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!savingRates) {
                      setShowEditRatesModal(false);
                      setRatesError(null);
                    }
                  }}
                  disabled={savingRates}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed p-1.5 active:scale-95 transition-all flex-shrink-0"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto max-h-[60vh] relative z-10 custom-scrollbar">
                {/* Resumen de registros afectados */}
                {loadingPeriodInfo ? (
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  </div>
                ) : periodInfo ? (
                  <>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300">Resumen del período</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
                        Esta acción <strong className="font-bold">reemplazará</strong> las tasas históricas guardadas y <strong className="font-bold">recalculará</strong> todos los valores derivados en <strong className="font-bold">{periodInfo.records_count}</strong> registros históricos del período seleccionado.
                      </p>
                      <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-2 leading-relaxed font-semibold">
                        ⚠️ Importante: Las tasas guardadas en "Mi Historial" de todas las modelos para este período serán reemplazadas por las nuevas tasas. Todos los valores (USD bruto, USD modelo, COP modelo) serán recalculados automáticamente.
                      </p>
                      <p className="text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 mt-2 leading-relaxed font-semibold">
                        ✅ Solo afecta períodos cerrados (archivados). No afecta las RATES actuales ni los cálculos del período en curso.
                      </p>
                    </div>

                    {/* Tasas actuales (si existen) */}
                    {periodInfo.current_rates && (
                      (periodInfo.current_rates.eur_usd !== null || periodInfo.current_rates.gbp_usd !== null || periodInfo.current_rates.usd_cop !== null) && (
                        <div className="bg-black/5 dark:bg-[#1a1a1c]/40 border border-black/10 dark:border-white/10 rounded-2xl p-4">
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">Tasas actuales del período:</h4>
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div className="bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl p-2.5 text-center">
                              <label className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider block font-semibold">EUR → USD</label>
                              <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                                {periodInfo.current_rates.eur_usd !== null ? periodInfo.current_rates.eur_usd.toFixed(4) : 'N/A'}
                              </div>
                            </div>
                            <div className="bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl p-2.5 text-center">
                              <label className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider block font-semibold">GBP → USD</label>
                              <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                                {periodInfo.current_rates.gbp_usd !== null ? periodInfo.current_rates.gbp_usd.toFixed(4) : 'N/A'}
                              </div>
                            </div>
                            <div className="bg-black/5 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-xl p-2.5 text-center">
                              <label className="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider block font-semibold">USD → COP</label>
                              <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
                                {periodInfo.current_rates.usd_cop !== null ? periodInfo.current_rates.usd_cop.toFixed(2) : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {/* Formulario de edición */}
                    <div className="space-y-4">
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">Nuevas tasas:</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* EUR → USD */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                            EUR → USD
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={editRates.eur_usd}
                            onChange={(e) => setEditRates({ ...editRates, eur_usd: e.target.value })}
                            className="w-full px-3 py-2.5 text-xs sm:text-sm border border-black/10 dark:border-white/10 rounded-xl bg-white/40 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            placeholder="1.0100"
                            disabled={savingRates}
                          />
                        </div>

                        {/* GBP → USD */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                            GBP → USD
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={editRates.gbp_usd}
                            onChange={(e) => setEditRates({ ...editRates, gbp_usd: e.target.value })}
                            className="w-full px-3 py-2.5 text-xs sm:text-sm border border-black/10 dark:border-white/10 rounded-xl bg-white/40 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            placeholder="1.2000"
                            disabled={savingRates}
                          />
                        </div>

                        {/* USD → COP */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1.5">
                            USD → COP
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editRates.usd_cop}
                            onChange={(e) => setEditRates({ ...editRates, usd_cop: e.target.value })}
                            className="w-full px-3 py-2.5 text-xs sm:text-sm border border-black/10 dark:border-white/10 rounded-xl bg-white/40 dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                            placeholder="3900.00"
                            disabled={savingRates}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {ratesError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-semibold text-red-600 dark:text-red-400">{ratesError}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-zinc-400 font-medium">
                    No se pudo cargar la información del período
                  </div>
                )}
              </div>

              {/* Footer Section 16 - Premium Píldora Transparente button group wrapper */}
              <div className="flex justify-end p-4 sm:p-6 border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-black/20 relative z-10">
                <div className="p-1.5 backdrop-blur-xl bg-gray-100/50 dark:bg-[#1a1a1c]/60 border border-black/5 dark:border-white/10 rounded-[2rem] flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (!savingRates) {
                        setShowEditRatesModal(false);
                        setRatesError(null);
                      }
                    }}
                    disabled={savingRates}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      // Confirmación antes de guardar
                      const scopeText = userRole === 'super_admin' 
                        ? 'todas las modelos globalmente' 
                        : userRole === 'superadmin_aff'
                        ? 'las modelos de tu estudio'
                        : 'las modelos de tus grupos';
                      const confirmMessage = `¿Estás seguro de actualizar las tasas históricas para ${periodInfo?.records_count || 0} registros del período ${selectedMonth && selectedYear && selectedPeriod ? `${getMonthName(selectedMonth)} ${selectedYear} - ${selectedPeriod}` : ''}?\n\n⚠️ Esta acción:\n- Reemplazará las tasas guardadas en "Mi Historial" de ${scopeText}\n- Recalculará todos los valores derivados (USD bruto, USD modelo, COP modelo)\n- Solo afecta períodos CERRADOS (archivados), NO afecta el período en curso\n\n¿Continuar?`;
                      
                      if (window.confirm(confirmMessage)) {
                        await savePeriodRates();
                      }
                    }}
                    disabled={savingRates || !periodInfo || !editRates.eur_usd || !editRates.gbp_usd || !editRates.usd_cop}
                    className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-purple-600 rounded-full hover:from-purple-600 hover:to-purple-700 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation w-full sm:w-auto text-center shadow-md shadow-purple-500/25"
                  >
                    {savingRates ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Guardar Tasas</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
