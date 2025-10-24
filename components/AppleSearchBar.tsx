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
}

export default function AppleSearchBar({ 
  onSearch, 
  placeholder = "Buscar...", 
  filters = [],
  className = "",
  onDropdownStateChange
}: AppleSearchBarProps) {
  const [query, setQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

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
    // Cerrar dropdown después de selección
    setActiveDropdown(null);
  };

  const handleFilterFocus = (filterId: string) => {
    // Cerrar otros dropdowns activos
    setActiveDropdown(filterId);
  };

  // 🔧 FIX: Manejar clicks fuera del área de búsqueda
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
        setIsExpanded(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notificar cambios en el estado de dropdowns
  useEffect(() => {
    if (onDropdownStateChange) {
      const hasOpenDropdown = isExpanded || activeDropdown !== null;
      onDropdownStateChange(hasOpenDropdown);
    }
  }, [isExpanded, activeDropdown, onDropdownStateChange]);

  const clearFilters = () => {
    setSelectedFilters({});
    setQuery('');
    onSearch('', {});
  };

  const hasActiveFilters = Object.values(selectedFilters).some(value => value !== '');

  // ===========================================
  // 🎨 RENDER FUNCTIONS
  // ===========================================
  const renderFilter = (filter: SearchFilter) => (
    <div key={filter.id} className="space-y-2 min-w-0">
      <label className="flex items-center space-x-1 text-gray-600 text-xs font-medium">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        <span>{filter.label}</span>
      </label>
      <div className="relative">
        <AppleSelect
          value={selectedFilters[filter.id] || ''}
          options={filter.options}
          onChange={(v) => handleFilterChange(filter.id, v)}
          className="text-sm bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
          onFocus={() => handleFilterFocus(filter.id)}
          onBlur={() => {
            setTimeout(() => setActiveDropdown(null), 100);
          }}
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
      <div className="relative bg-white/80 backdrop-blur-sm rounded-lg border border-white/30 shadow-sm hover:shadow-md transition-all duration-200">
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
              className="w-full bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-400 focus:ring-0"
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
                  }
                }}
                className={`p-2 rounded-md text-xs transition-all duration-200 ${
                  isExpanded 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50/50'
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
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50/50 rounded-md transition-all duration-200"
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
        <div className="mt-3 relative bg-white/95 backdrop-blur-sm rounded-lg border border-white/30 shadow-xl p-4 animate-in slide-in-from-top-2 duration-200 z-[100]">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-sm flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Filtros Avanzados</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filters.map(renderFilter)}
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-600/30 dark:shadow-sm dark:shadow-blue-900/5">
            <div className="text-xs text-gray-500">
              {hasActiveFilters ? `${Object.values(selectedFilters).filter(v => v).length} filtro(s) activo(s)` : 'Sin filtros aplicados'}
            </div>
            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50/50 rounded-md transition-all duration-200"
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
      {hasActiveFilters && !isExpanded && (
        <div className="mt-3 relative bg-blue-50/80 backdrop-blur-sm rounded-lg border border-blue-200/30 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-wrap">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-blue-700 text-xs font-medium">Filtros activos:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(selectedFilters).map(([key, value]) => {
                  if (!value) return null;
                  const filter = filters.find(f => f.id === key);
                  const option = filter?.options.find(o => o.value === value);
                  return (
                    <span
                      key={key}
                      className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100/80 text-blue-800 rounded-full text-xs border border-blue-200/50"
                    >
                      <span className="font-medium">{filter?.label}:</span>
                      <span>{option?.label}</span>
                      <button
                        onClick={() => handleFilterChange(key, '')}
                        className="ml-1 hover:text-blue-600 transition-colors duration-150"
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
            <button
              onClick={() => setIsExpanded(true)}
              className="text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors duration-150"
            >
              Editar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
