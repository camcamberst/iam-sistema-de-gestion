"use client";

import { useState, useEffect } from 'react';

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
    <div key={filter.id} className="space-y-2">
      <label className="text-white/80 text-sm font-medium">
        {filter.label}
      </label>
      <select
        value={selectedFilters[filter.id] || ''}
        onChange={(e) => handleFilterChange(filter.id, e.target.value)}
        className="apple-input text-sm"
      >
        <option value="">Todos</option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  // ===========================================
  // 🎨 MAIN RENDER
  // ===========================================
  return (
    <div className={`apple-card ${className}`}>
      {/* Search Input */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={placeholder}
            className="apple-input pl-12 pr-4"
          />
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          className="apple-button px-6 py-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Filters Toggle */}
        {filters.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`apple-button-secondary px-4 py-3 ${
              hasActiveFilters ? 'bg-blue-500/20 border-blue-500/50' : ''
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {hasActiveFilters && (
              <span className="absolute -top-2 -right-2 w-3 h-3 bg-red-500 rounded-full" />
            )}
          </button>
        )}

        {/* Clear Button */}
        {(query || hasActiveFilters) && (
          <button
            onClick={clearFilters}
            className="apple-button-secondary px-4 py-3 text-red-400 hover:text-red-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {filters.length > 0 && isExpanded && (
        <div className="mt-6 pt-6 border-t border-white/10 apple-slide-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filters.map(renderFilter)}
          </div>
          
          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              onClick={() => setIsExpanded(false)}
              className="apple-button-secondary px-4 py-2"
            >
              Cerrar
            </button>
            <button
              onClick={handleSearch}
              className="apple-button px-6 py-2"
            >
              Aplicar Filtros
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-white/60 text-sm">Filtros activos:</span>
            {Object.entries(selectedFilters).map(([key, value]) => {
              if (!value) return null;
              const filter = filters.find(f => f.id === key);
              const option = filter?.options.find(o => o.value === value);
              return (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
                >
                  <span>{filter?.label}: {option?.label}</span>
                  <button
                    onClick={() => handleFilterChange(key, '')}
                    className="ml-1 hover:text-blue-200"
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
