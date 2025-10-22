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
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white/80 backdrop-blur-sm text-sm text-gray-900 flex items-center justify-between cursor-pointer hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 ml-2 flex-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.085l3.71-3.855a.75.75 0 111.08 1.04l-4.24 4.41a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
      </div>
      {open && (
        <div className="apple-scroll absolute z-[9999] mt-2 left-0 w-full bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-lg max-h-56 overflow-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors duration-200 ${
                value === opt.value 
                  ? 'bg-blue-50 text-blue-900 font-medium' 
                  : 'text-gray-700 hover:bg-gray-50'
              } ${opt.value !== options[options.length - 1]?.value ? 'border-b border-gray-100/50' : ''}`}
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


