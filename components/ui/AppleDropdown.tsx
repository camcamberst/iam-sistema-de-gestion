'use client';

import { useState, useEffect, useRef } from 'react';

interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'red' | 'yellow' | 'gray';
  disabled?: boolean;
}

interface AppleDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxHeight?: string;
  autoOpen?: boolean;
}

const badgeColors = {
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray: 'bg-gray-100 text-gray-800'
};

export default function AppleDropdown({
  options,
  value,
  onChange,
  placeholder = 'Selecciona una opción',
  className = '',
  disabled = false,
  maxHeight = 'max-h-60',
  autoOpen = false
}: AppleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-abrir dropdown cuando autoOpen es true
  useEffect(() => {
    if (autoOpen && options.length > 1) { // > 1 porque el primer option es el placeholder
      setIsOpen(true);
    } else if (!autoOpen) {
      setIsOpen(false);
    }
  }, [autoOpen, options.length]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cerrar dropdown con Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Scroll automático cuando se abre el dropdown
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Pequeño delay para asegurar que el dropdown se renderice
      setTimeout(() => {
        dropdownRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [isOpen]);

  const selectedOption = options.find(option => option.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between w-full">
          <span className={selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center space-x-2">
            {selectedOption?.badge && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                badgeColors[selectedOption.badgeColor || 'gray']
              }`}>
                {selectedOption.badge}
              </span>
            )}
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>
      
      {isOpen && (
        <div className={`absolute z-[99998] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${maxHeight} overflow-auto apple-scroll`}>
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              No hay opciones disponibles
            </div>
          ) : (
            options.map((option, index) => (
              <div
                key={option.value}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors duration-150 flex items-center justify-between ${
                  index > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                } ${
                  option.disabled 
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                } ${
                  option.value === value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100' : ''
                }`}
                onClick={() => !option.disabled && handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {option.badge && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    badgeColors[option.badgeColor || 'gray']
                  }`}>
                    {option.badge}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
