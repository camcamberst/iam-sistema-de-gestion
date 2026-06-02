"use client";

import { useState, useEffect, useRef } from 'react';
import AppleDropdown from '@/components/ui/AppleDropdown';

// ===========================================
// 🔍 APPLE-STYLE SEARCH BAR COMPONENT
// ===========================================

interface SearchFilter {
  id: string;
  label: string;
  value: string;
  options: { label: string; value: string }[];
}

interface AppleSearchBarProps {
  onSearch: (query: string, filters: Record<string, string>) => void;
  placeholder?: string;
  filters?: SearchFilter[];
  className?: string;
  onDropdownStateChange?: (isOpen: boolean) => void;
  showResultsInfo?: boolean;
  totalUsers?: number;
  filteredUsers?: number;
  onClearSearch?: () => void;
}

export default function AppleSearchBar({ 
  onSearch, 
  placeholder = "Buscar...", 
  filters = [],
  className = "",
  onDropdownStateChange,
  showResultsInfo = false,
  totalUsers = 0,
  filteredUsers = 0,
  onClearSearch
}: AppleSearchBarProps) {
  const [query, setQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  // Estados separados para móvil - mismo principio que el menú móvil del panel modelo
  const [mobileActiveDropdown, setMobileActiveDropdown] = useState<string | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Detectar si estamos en móvil
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Usar estado móvil o desktop según el tamaño de pantalla
  const currentActiveDropdown = isMobile ? mobileActiveDropdown : activeDropdown;
  const setCurrentActiveDropdown = isMobile ? setMobileActiveDropdown : setActiveDropdown;

  // ===========================================
  // 🔧 HELPER FUNCTIONS
  // ===========================================
  const handleSearch = () => {
    onSearch(query, selectedFilters);
  };

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => {
      onSearch(query, selectedFilters);
    }, 250);
    return () => clearTimeout(t);
  }, [query, selectedFilters]);

  // Sincronizar filtros externos con el estado interno
  useEffect(() => {
    const newFilters: Record<string, string> = {};
    filters.forEach(f => {
      newFilters[f.id] = f.value;
    });
    // Comparar para evitar actualizaciones de estado redundantes y bucles infinitos
    const hasChanges = Object.keys(newFilters).some(key => newFilters[key] !== selectedFilters[key]) ||
                        Object.keys(selectedFilters).some(key => newFilters[key] !== selectedFilters[key]);
    if (hasChanges) {
      setSelectedFilters(newFilters);
    }
  }, [filters]);

  // Atajos: Enter (buscar), Esc (cerrar panel)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [query, selectedFilters, isExpanded]);

  const handleFilterChange = (filterId: string, value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterId]: value
    }));
    // Cerrar dropdown después de selección - usar estado correcto según móvil/desktop
    setCurrentActiveDropdown(null);
    setActiveDropdown(null);
    setMobileActiveDropdown(null);
  };

  const handleFilterFocus = (filterId: string) => {
    // Cerrar otros dropdowns activos antes de abrir el nuevo
    if (isMobile) {
      setMobileActiveDropdown(filterId);
    } else {
      setActiveDropdown(filterId);
    }
  };

  const handleFilterBlur = (filterId: string) => {
    // Solo cerrar si este es el dropdown activo - usar estado correcto
    if (currentActiveDropdown === filterId) {
      setTimeout(() => {
        setCurrentActiveDropdown(null);
        setActiveDropdown(null);
        setMobileActiveDropdown(null);
      }, 200);
    }
  };

  // 🔧 FIX: Manejar clicks fuera del área de búsqueda
  // Usar el mismo principio que el menú móvil: solo click, no touchstart
  // Y deshabilitar backdrop cuando hay dropdowns abiertos
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // Verificar si el click está dentro de algún dropdown
      const isInsideAnyDropdown = Object.values(dropdownRefs.current).some(ref => 
        ref && ref.contains(target)
      );
      
      // Verificar si el click está dentro del contenedor principal
      const isInsideSearchBar = searchBarRef.current?.contains(target);
      
      // Si el click está fuera de todo, cerrar dropdowns
      // Pero no cerrar el panel expandido en móvil (solo cerrar dropdowns individuales)
      if (!isInsideSearchBar && !isInsideAnyDropdown) {
        setActiveDropdown(null);
        setMobileActiveDropdown(null);
        // No cerrar isExpanded aquí - solo cerrar dropdowns individuales
      }
    }

    // Usar solo click para evitar conflictos con eventos táctiles
    // Delay para permitir que los eventos táctiles se procesen primero
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  // Notificar cambios en el estado de dropdowns
  useEffect(() => {
    if (onDropdownStateChange) {
      const hasOpenDropdown = isExpanded || activeDropdown !== null || mobileActiveDropdown !== null;
      onDropdownStateChange(hasOpenDropdown);
    }
  }, [isExpanded, activeDropdown, mobileActiveDropdown, onDropdownStateChange]);

  const clearFilters = () => {
    setSelectedFilters({});
    setQuery('');
    if (onClearSearch) {
      onClearSearch();
    } else {
      onSearch('', {});
    }
  };

  const hasActiveFilters = Object.values(selectedFilters).some(value => value !== '');

  // ===========================================
  // 🎨 RENDER FUNCTIONS
  // ===========================================
  const renderFilter = (filter: SearchFilter) => {
    // Ajustar altura máxima para todos los dropdowns de filtros
    // Grupos y Estado: más compactos (150px)
    // Rol: tamaño medio (180px)
    let maxHeightOverride: string | undefined;
    if (filter.id === 'group' || filter.id === 'status') {
      maxHeightOverride = '150px';
    } else if (filter.id === 'role') {
      maxHeightOverride = '180px';
    }
    
    return (
      <div 
        key={filter.id} 
        className="space-y-1.5 relative z-0 w-full sm:w-40"
        ref={(el) => {
          if (el) {
            dropdownRefs.current[filter.id] = el;
          } else {
            delete dropdownRefs.current[filter.id];
          }
        }}
        style={{ 
          zIndex: currentActiveDropdown === filter.id ? 1000 : 'auto' 
        }}
      >
        <label className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 text-xs font-medium">
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
          <span>{filter.label}</span>
        </label>
        <div className="relative">
          <AppleDropdown
            value={selectedFilters[filter.id] || ''}
            options={filter.options}
            onChange={(v) => handleFilterChange(filter.id, v)}
            className=""
            variant="glass"
            placeholder="Todos"
          />
          {selectedFilters[filter.id] && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          )}
        </div>
      </div>
    );
  };

  // ===========================================
  // 🎨 MAIN RENDER
  // ===========================================
  return (
    <div ref={searchBarRef} className={`relative ${className}`}>
      {/* Search Input Container */}
      <div className="relative bg-transparent border-b border-black/5 dark:border-white/10 hover:border-black/10 dark:hover:border-white/20 transition-all duration-200 overflow-hidden group mb-2">
        <div className="flex items-center space-x-2 p-2">
          {/* Search Icon */}
          <div className="flex-shrink-0 pl-1">
            <svg className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Search Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 p-0"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1">
            {/* Filters Toggle */}
            {filters.length > 0 && (
              <button
                onClick={() => {
                  setIsExpanded(!isExpanded);
                  if (isExpanded) {
                    setActiveDropdown(null);
                    setMobileActiveDropdown(null);
                  }
                }}
                className={`relative p-1.5 transition-all duration-200 ${
                  isExpanded 
                    ? 'text-blue-500 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            )}


          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {filters.length > 0 && isExpanded && (
        <div 
          className="mt-2 relative animate-in slide-in-from-top-2 duration-200 z-[100]"
          onClick={(e) => {
            // Prevenir que los clics dentro del panel cierren dropdowns
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          style={{
            pointerEvents: 'auto'
          }}
        >
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            {filters.map(renderFilter)}
            
            {/* Action Buttons in the same row */}
            <div className="flex items-center space-x-2 pt-1 ml-auto">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn-apple-primary h-[34px] px-5 py-0 text-sm flex items-center justify-center"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display - Removido según solicitud */}
    </div>
  );
}
