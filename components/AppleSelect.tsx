"use client";

import { useEffect, useRef, useState } from "react";

interface Option { 
  label: string; 
  value: string; 
  color?: string; 
}

interface AppleSelectProps {
  label?: string;
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export default function AppleSelect({ label, value, options, placeholder = "Selecciona", onChange, className = "", onFocus, onBlur }: AppleSelectProps) {
  const [open, setOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // 🔧 FIX: Zona de tolerancia para evitar cierre accidental
  useEffect(() => {
    if (isHovering) {
      setOpen(true);
    } else {
      // Delay para permitir movimiento del cursor
      const timer = setTimeout(() => {
        if (!isHovering) {
          setOpen(false);
        }
      }, 150); // 150ms de tolerancia
      return () => clearTimeout(timer);
    }
  }, [isHovering]);

  // 🔧 FIX: Manejar focus/blur para coordinación entre dropdowns
  const handleFocus = () => {
    onFocus?.();
    setOpen(true);
  };

  const handleBlur = () => {
    onBlur?.();
    // Delay para permitir selección
    setTimeout(() => {
      if (!isHovering) {
        setOpen(false);
      }
    }, 100);
  };

  // Scroll automático cuando se abre el dropdown
  useEffect(() => {
    if (open && ref.current) {
      // Pequeño delay para asegurar que el dropdown se renderice
      setTimeout(() => {
        ref.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div 
      className={`relative min-w-0 ${className}`} 
      ref={ref}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {label && <div className="text-gray-500 text-xs font-medium mb-1">{label}</div>}
      <div
        className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-lg bg-white text-gray-900 cursor-pointer flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span className="truncate">{selected ? selected.label : (value === '' ? 'Todos' : placeholder)}</span>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto apple-scroll">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors duration-150 flex items-center justify-between ${
                opt.value !== options[0]?.value ? 'border-t border-gray-100' : ''
              } ${
                value === opt.value 
                  ? 'bg-blue-50 text-blue-900' 
                  : 'hover:bg-gray-50 text-gray-900'
              }`}
            >
              <span>{opt.label}</span>
              {opt.color && (
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0 ml-2"
                  style={{ backgroundColor: opt.color }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


