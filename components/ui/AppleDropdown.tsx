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
  variant?: 'glass' | 'input';
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
  autoOpen = false,
  variant = 'glass'
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

  const buttonBaseClass = "w-full text-left flex items-center justify-between transition-all duration-300";
  const glassClass = "px-3 py-1.5 text-sm rounded-xl bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-gray-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 shadow-[0_4px_12px_rgba(0,0,0,0.02)]";
  const inputClass = "px-3 py-3 h-auto text-sm font-semibold rounded-xl bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all";
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`${buttonBaseClass} ${variant === 'input' ? inputClass : glassClass} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between w-full">
          <span className={selectedOption ? (variant === 'input' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-900 dark:text-white font-semibold') : (variant === 'input' ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400 font-medium')}>
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
              className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-300 ${
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
        <div className={`absolute z-[99998] min-w-full w-max max-w-[90vw] mt-1.5 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-3xl border border-black/5 dark:border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${maxHeight} overflow-y-auto overflow-x-hidden apple-scroll`}>
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No hay opciones disponibles
            </div>
          ) : (
            options.map((option, index) => (
              <div key={option.value}>
                {index > 0 && (
                  <div className="w-full h-px bg-black/[0.04] dark:bg-white/[0.06]"></div>
                )}
                <div
                  className={`px-3 py-2 text-sm cursor-pointer transition-all duration-200 flex items-center justify-between rounded-lg mx-0.5 my-0.5 ${
                    option.disabled 
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                      : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  } ${
                    option.value === value 
                      ? 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-violet-500/20 text-indigo-700 dark:text-white font-bold border border-indigo-500/20' 
                      : ''
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
