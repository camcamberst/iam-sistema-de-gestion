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
  theme?: 'indigo' | 'blue' | 'emerald' | 'fuchsia' | 'violet';
  pill?: boolean;
  size?: 'sm' | 'md';
}

const badgeColors = {
  green: 'bg-transparent text-green-500 border border-green-500/30 drop-shadow-[0_0_2px_rgba(34,197,94,0.3)]',
  blue: 'bg-transparent text-blue-500 border border-blue-500/30 drop-shadow-[0_0_2px_rgba(59,130,246,0.3)]',
  red: 'bg-transparent text-red-500 border border-red-500/30 drop-shadow-[0_0_2px_rgba(239,68,68,0.3)]',
  yellow: 'bg-transparent text-yellow-500 border border-yellow-500/30 drop-shadow-[0_0_2px_rgba(234,179,8,0.3)]',
  gray: 'bg-transparent text-gray-400 border border-gray-400/30 drop-shadow-[0_0_2px_rgba(156,163,175,0.3)]'
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
  variant = 'glass',
  theme = 'indigo',
  pill = false,
  size = 'md'
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

  // Resolve maxHeight to a style property if it contains specific arbitrary or standard CSS units.
  // This guarantees that custom limits like max-h-[124px] are enforced by the browser.
  const getStyleMaxHeight = () => {
    if (!maxHeight) return undefined;
    if (maxHeight.startsWith('max-h-[')) {
      const match = maxHeight.match(/max-h-\[(.*?)\]/);
      if (match && match[1]) {
        return match[1]; // e.g. "124px"
      }
    }
    // Pre-map standard Tailwind heights as fallbacks
    const standardHeights: { [key: string]: string } = {
      'max-h-10': '2.5rem',
      'max-h-12': '3rem',
      'max-h-16': '4rem',
      'max-h-20': '5rem',
      'max-h-24': '6rem',
      'max-h-28': '7rem',
      'max-h-32': '8rem',
      'max-h-36': '9rem',
      'max-h-40': '10rem',
      'max-h-44': '11rem',
      'max-h-48': '12rem',
      'max-h-52': '13rem',
      'max-h-56': '14rem',
      'max-h-60': '15rem', // 240px
      'max-h-64': '16rem',
      'max-h-72': '18rem',
      'max-h-80': '20rem',
      'max-h-96': '24rem',
    };
    if (standardHeights[maxHeight]) {
      return standardHeights[maxHeight];
    }
    if (maxHeight.endsWith('px') || maxHeight.endsWith('rem') || maxHeight.endsWith('%') || maxHeight.endsWith('vh')) {
      return maxHeight;
    }
    return undefined;
  };

  const styleMaxHeight = getStyleMaxHeight();

  const isEmerald = theme === 'emerald';
  const isBlue = theme === 'blue';
  const isFuchsia = theme === 'fuchsia';
  const isViolet = theme === 'violet';
  
  let focusRingClass = "focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40";
  let inputFocusRingClass = "focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";
  
  if (isEmerald) {
    focusRingClass = "focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40";
    inputFocusRingClass = "focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500";
  } else if (isBlue) {
    focusRingClass = "focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40";
    inputFocusRingClass = "focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500";
  } else if (isFuchsia) {
    focusRingClass = "focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500/40";
    inputFocusRingClass = "focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500";
  } else if (isViolet) {
    focusRingClass = "focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40";
    inputFocusRingClass = "focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500";
  }

  const roundedClass = pill ? '!rounded-full' : 'rounded-xl';
  const isSm = size === 'sm';
  const buttonBaseClass = "w-full text-left flex items-center justify-between transition-all duration-300";
  const glassClass = `px-4 ${isSm ? 'h-9 text-[11px] font-bold' : (pill ? 'py-1.5 h-auto text-[11px] font-bold' : 'py-1.5 text-sm')} ${roundedClass} bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-gray-100 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] ${focusRingClass} shadow-[0_4px_12px_rgba(0,0,0,0.02)]`;
  const inputClass = `${isSm ? 'px-3 h-9 text-[11px] font-bold' : 'px-4 h-11 text-sm font-medium'} ${roundedClass} bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] ${inputFocusRingClass} shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all`;
  
  // Apply standard responsive max-width rules from docs/DROPDOWN_POLICIES.md:
  // Mobile (max-width: 640px): max-width: 100%
  // Tablet (641px - 1024px): max-width: 18rem (288px)
  // Desktop (1025px+): max-width: 20rem (320px)
  const hasWidthConstraint = className.includes('w-') || className.includes('max-w-');
  const defaultWidthClasses = hasWidthConstraint ? '' : 'w-full max-w-full sm:max-w-[18rem] lg:max-w-[20rem]';

  return (
    <div className={`relative ${defaultWidthClasses} ${className} ${isOpen ? 'z-50' : ''}`} ref={dropdownRef}>
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
          <span className={selectedOption ? (variant === 'input' ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-900 dark:text-white font-medium') : (variant === 'input' ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400 font-medium')}>
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
        <div 
          className={`absolute z-[99998] w-full mt-1.5 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-3xl border border-black/5 dark:border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${styleMaxHeight ? '' : maxHeight} overflow-y-auto overflow-x-hidden apple-scroll`}
          style={styleMaxHeight ? { maxHeight: styleMaxHeight } : undefined}
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              No hay opciones disponibles
            </div>
          ) : (
            options
              .filter(option => {
                if (options.length > 1) {
                  const labelLower = (option.label || '').toLowerCase();
                  if (option.value === '' || labelLower === 'selecciona un modelo' || labelLower === 'seleccionar modelo...' || labelLower === placeholder.toLowerCase()) {
                    return false;
                  }
                }
                return true;
              })
              .map((option, index) => (
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
                      ? (isEmerald 
                          ? 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-green-500/10 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-green-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20'
                          : (isBlue
                              ? 'bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 dark:from-blue-500/20 dark:via-cyan-500/20 dark:to-teal-500/20 text-blue-700 dark:text-blue-300 font-bold border border-blue-500/20'
                              : (isFuchsia
                                  ? 'bg-gradient-to-r from-fuchsia-500/10 via-pink-500/10 to-rose-500/10 dark:from-fuchsia-500/20 dark:via-pink-500/20 dark:to-rose-500/20 text-fuchsia-700 dark:text-fuchsia-300 font-bold border border-fuchsia-500/20'
                                  : (isViolet
                                      ? 'bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 dark:from-violet-500/20 dark:via-purple-500/20 dark:to-indigo-500/20 text-violet-700 dark:text-violet-300 font-bold border border-violet-500/20'
                                      : 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-violet-500/20 text-indigo-700 dark:text-white font-bold border border-indigo-500/20')))) 
                      : ''
                    }`}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                  >
                  <span className="truncate pr-2">{option.label}</span>
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
