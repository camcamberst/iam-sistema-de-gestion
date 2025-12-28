"use client";

import { useState, useEffect, useRef } from 'react';
import AppleSelect from './AppleSelect';

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
    setActiveDropdown(filterId);
  };

  const handleFilterBlur = (filterId: string) => {
    // Solo cerrar si este es el dropdown activo
    // Delay más largo para evitar cierre accidental en móvil
    if (activeDropdown === filterId) {
      setTimeout(() => {
        setActiveDropdown(null);
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
  const renderFilter = (filter: SearchFilter) => (
    <div 
      key={filter.id} 
      className="space-y-2 min-w-0 relative z-0"
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
        <AppleSelect
          value={selectedFilters[filter.id] || ''}
          options={filter.options}
          onChange={(v) => handleFilterChange(filter.id, v)}
          className="text-sm bg-white dark:bg-gray-700 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
          onFocus={() => handleFilterFocus(filter.id)}
          onBlur={() => handleFilterBlur(filter.id)}
        />
        {selectedFilters[filter.id] && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
        )}
      </div>
    </div>
  );

  // ===========================================
  // 🎨 MAIN RENDER
  // ===========================================
  return (
    <div ref={searchBarRef} className={`relative ${className}`}>
      {/* Search Input Container */}
      <div className="relative bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center space-x-2 p-3">
          {/* Search Icon */}
          <div className="flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0"
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
                className={`p-2 rounded-md text-xs transition-all duration-200 ${
                  isExpanded 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
                }`}
                title={isExpanded ? 'Ocultar filtros' : 'Mostrar filtros'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {hasActiveFilters && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                )}
              </button>
            )}

            {/* Clear Button */}
            {(query || hasActiveFilters) && (
              <button
                onClick={clearFilters}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-md transition-all duration-200"
                title="Limpiar búsqueda y filtros"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {filters.length > 0 && isExpanded && (
        <div 
          className="mt-3 relative bg-white dark:bg-gray-800 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-600 shadow-xl p-4 animate-in slide-in-from-top-2 duration-200 z-[100]"
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
            // Deshabilitar pointer events en el backdrop cuando hay dropdowns abiertos
            // Similar al menú móvil del panel modelo
            pointerEvents: 'auto'
          }}
        >
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-sm flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Filtros Avanzados</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4">
            {filters.map(renderFilter)}
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
              {hasActiveFilters ? `${Object.values(selectedFilters).filter(v => v).length} filtro(s) activo(s)` : 'Sin filtros aplicados'}
            </div>
            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-md transition-all duration-200"
                >
                  Limpiar todo
                </button>
              )}
              <button
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs rounded-md transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {(hasActiveFilters || query || (showResultsInfo && totalUsers > 0)) && !isExpanded && (
        <div className="mt-3 relative bg-blue-50 dark:bg-blue-900/20 backdrop-blur-sm rounded-lg border border-blue-200 dark:border-blue-700/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-wrap">
              {/* Información de resultados - Oculto en móvil */}
              {showResultsInfo && totalUsers > 0 && (
                <div className="hidden sm:flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    {filteredUsers === 0 
                      ? 'No se encontraron usuarios con los criterios especificados'
                      : `Mostrando ${filteredUsers} de ${totalUsers} usuarios`
                    }
                  </span>
                </div>
              )}
              
              {/* Filtros activos */}
              {hasActiveFilters && (
                <div className="flex items-center space-x-2 flex-wrap">
                  <div className="hidden sm:flex items-center space-x-1">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-700 dark:text-blue-300 text-xs font-medium">Filtros activos:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(selectedFilters).map(([key, value]) => {
                      if (!value) return null;
                      const filter = filters.find(f => f.id === key);
                      const option = filter?.options.find(o => o.value === value);
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 rounded-full text-xs border border-blue-200 dark:border-blue-600/50"
                        >
                          <span className="font-medium">{filter?.label}:</span>
                          <span>{option?.label}</span>
                          <button
                            onClick={() => handleFilterChange(key, '')}
                            className="ml-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Botón Editar */}
              {hasActiveFilters && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium transition-colors duration-150"
                >
                  Editar
                </button>
              )}
              
              {/* Botón Limpiar */}
              {(query || hasActiveFilters) && (
                <button
                  onClick={clearFilters}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium transition-colors duration-150"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
