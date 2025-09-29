"use client";

import { useState, useEffect } from 'react';
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
}

export default function AppleSearchBar({ 
  onSearch, 
  placeholder = "Buscar...", 
  filters = [],
  className = ""
}: AppleSearchBarProps) {
  const [query, setQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(false);

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
  };

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
    <div key={filter.id} className="space-y-1 min-w-0">
      <label className="text-gray-500 text-xs font-medium">{filter.label}</label>
      <AppleSelect
        value={selectedFilters[filter.id] || ''}
        options={[{ label: 'Todos', value: '' }, ...filter.options]}
        onChange={(v) => handleFilterChange(filter.id, v)}
        className="text-[13px]"
      />
    </div>
  );

  // ===========================================
  // 🎨 MAIN RENDER
  // ===========================================
  return (
    <div className={`apple-card ${className}`}>
      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={placeholder}
            className="apple-input pl-3 pr-3 text-[13px] py-2 leading-normal"
          />
        </div>

        {/* Search Button */}
        <button onClick={handleSearch} title="Buscar" className="apple-button px-2 py-1.5 rounded-md text-xs">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M12.9 14.32a8 8 0 111.414-1.414l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </button>

        {/* Filters Toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2 py-1.5 rounded-md text-xs border ${isExpanded ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            title={isExpanded ? 'Ocultar filtros' : 'Mostrar filtros'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 5a1 1 0 000 2h14a1 1 0 100-2H3zm2 6a1 1 0 011-1h10a1 1 0 110 2H6a1 1 0 01-1-1zm3 5a1 1 0 011-1h4a1 1 0 110 2H9a1 1 0 01-1-1z" />
            </svg>
          </button>
        )}

        {/* Clear Button */}
        {(query || hasActiveFilters) && (
          <button
            onClick={clearFilters}
            className="apple-button-secondary px-2 py-1.5 text-xs text-red-500 hover:text-red-400 rounded-md"
            title="Limpiar búsqueda y filtros"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {filters.length > 0 && isExpanded && (
        <div className="mt-3 pt-3 border-t border-white/10 apple-slide-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filters.map(renderFilter)}
          </div>
          
          <div className="flex items-center justify-end space-x-2 mt-3">
            <button
              onClick={() => setIsExpanded(false)}
              className="apple-button-secondary px-2.5 py-1.5 text-xs rounded-md"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-gray-500 text-xs">Filtros activos:</span>
            {Object.entries(selectedFilters).map(([key, value]) => {
              if (!value) return null;
              const filter = filters.find(f => f.id === key);
              const option = filter?.options.find(o => o.value === value);
              return (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                >
                  <span>{filter?.label}: {option?.label}</span>
                  <button
                    onClick={() => handleFilterChange(key, '')}
                    className="ml-1 hover:text-blue-600"
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
  );
}
