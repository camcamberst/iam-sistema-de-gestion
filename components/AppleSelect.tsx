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
  const [maxHeight, setMaxHeight] = useState<string>('20rem'); // max-h-80
  const ref = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      // Verificar que el clic no sea dentro del contenedor principal ni del dropdown
      const target = e.target as Node;
      const isClickInside = ref.current?.contains(target) || dropdownRef.current?.contains(target);
      if (!isClickInside) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // Usar 'click' en lugar de 'mousedown' para evitar cierre accidental durante scroll
    if (open) {
      document.addEventListener('click', onDoc);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('click', onDoc);
        document.removeEventListener('keydown', onKey);
      };
    }
  }, [open]);

  // 🔧 FIX: Mantener dropdown abierto cuando se está interactuando
  useEffect(() => {
    if (isHovering && !open) {
      setOpen(true);
    }
  }, [isHovering, open]);

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

  // Ajustar posición y altura del dropdown cuando se abre
  useEffect(() => {
    if (open && ref.current && dropdownRef.current) {
      // Pequeño delay para asegurar que el dropdown se renderice
      setTimeout(() => {
        const triggerElement = ref.current;
        const dropdownElement = dropdownRef.current;
        if (!triggerElement || !dropdownElement) return;

        // Obtener posición del trigger
        const triggerRect = triggerElement.getBoundingClientRect();
        
        // Buscar el modal padre (StandardModal) o contenedor con scroll para calcular espacio dentro del modal
        let modalContainer = triggerElement.closest('[class*="max-h-"]') || 
                           triggerElement.closest('[class*="overflow-y-auto"]') || 
                           triggerElement.closest('[class*="overflow-auto"]');
        
        // Margen estético entre dropdown y bordes del modal (aumentado para mejor apariencia)
        const aestheticMargin = 32; // 32px de margen para mejor estética
        
        let spaceBelow: number;
        let spaceAbove: number;
        
        if (modalContainer && modalContainer !== document.body) {
          // Calcular espacio disponible dentro del modal
          const containerRect = (modalContainer as HTMLElement).getBoundingClientRect();
          const triggerBottomInContainer = triggerRect.bottom - containerRect.top;
          const triggerTopInContainer = triggerRect.top - containerRect.top;
          
          // Buscar botones en la parte inferior del modal (Cancelar, Confirmar, etc.)
          // Buscar el último div con botones que esté después del trigger
          const allButtons = Array.from((modalContainer as HTMLElement).querySelectorAll('button'));
          const buttonsAfterTrigger = allButtons.filter(btn => {
            const btnRect = btn.getBoundingClientRect();
            return btnRect.top > triggerRect.bottom;
          });
          
          if (buttonsAfterTrigger.length > 0) {
            // Encontrar el botón más cercano al trigger (el primero en la lista)
            const closestButton = buttonsAfterTrigger.reduce((closest, current) => {
              const closestRect = closest.getBoundingClientRect();
              const currentRect = current.getBoundingClientRect();
              return currentRect.top < closestRect.top ? current : closest;
            });
            
            const buttonsContainer = closestButton.closest('div.flex') || closestButton.parentElement;
            if (buttonsContainer) {
              const buttonsRect = (buttonsContainer as HTMLElement).getBoundingClientRect();
              const buttonsTopInContainer = buttonsRect.top - containerRect.top;
              // Calcular espacio hasta los botones (con margen adicional de 16px)
              const spaceToButtons = buttonsTopInContainer - triggerBottomInContainer - 16;
              spaceBelow = Math.max(0, spaceToButtons);
            } else {
              // Si no se encuentra el contenedor, usar el espacio disponible
              spaceBelow = containerRect.height - triggerBottomInContainer;
            }
          } else {
            // Si no se encuentran botones después del trigger, usar el espacio disponible en el contenedor
            spaceBelow = containerRect.height - triggerBottomInContainer;
          }
          
          spaceAbove = triggerTopInContainer;
        } else {
          // Fallback: calcular espacio disponible en la ventana
          spaceBelow = window.innerHeight - triggerRect.bottom;
          spaceAbove = triggerRect.top;
        }
        
        // Altura estimada del dropdown (todas las opciones)
        const estimatedDropdownHeight = Math.min(options.length * 48 + 16, 320); // ~48px por opción + padding
        
        // SIEMPRE abrir hacia abajo - calcular altura máxima disponible con margen estético
        const availableHeight = Math.max(0, spaceBelow - aestheticMargin - 8); // Margen adicional de 8px
        const calculatedMaxHeight = Math.min(availableHeight, 320); // Máximo 320px (max-h-80)
        
        setMaxHeight(`${calculatedMaxHeight}px`);
        
        // Hacer scroll del modal/ventana para que el dropdown sea completamente visible hacia abajo
        // Usar el mismo contenedor que usamos para calcular el espacio
        let scrollContainer = modalContainer;
        
        if (scrollContainer && scrollContainer !== document.body) {
          // Calcular la posición del trigger dentro del contenedor
          const containerRect = (scrollContainer as HTMLElement).getBoundingClientRect();
          const triggerBottomInContainer = triggerRect.bottom - containerRect.top + scrollContainer.scrollTop;
          
          // Calcular cuánto espacio necesitamos para el dropdown completo
          const spaceNeededForDropdown = calculatedMaxHeight + aestheticMargin + 8;
          const currentSpaceBelow = containerRect.height - (triggerBottomInContainer - scrollContainer.scrollTop);
          
          // Si no hay suficiente espacio, hacer scroll para crear más espacio
          if (currentSpaceBelow < spaceNeededForDropdown) {
            const scrollOffset = spaceNeededForDropdown - currentSpaceBelow;
            (scrollContainer as HTMLElement).scrollTo({
              top: scrollContainer.scrollTop + scrollOffset,
              behavior: 'smooth'
            });
          }
        } else {
          // Si no hay contenedor con scroll, hacer scroll de la ventana
          const spaceNeededForDropdown = calculatedMaxHeight + aestheticMargin + 8;
          const currentSpaceBelow = window.innerHeight - triggerRect.bottom;
          
          if (currentSpaceBelow < spaceNeededForDropdown) {
            const scrollOffset = spaceNeededForDropdown - currentSpaceBelow;
            window.scrollTo({
              top: window.scrollY + scrollOffset,
              behavior: 'smooth'
            });
          }
        }
      }, 50); // Reducido a 50ms para respuesta más rápida
    }
  }, [open, options.length]);

  const selected = options.find(o => o.value === value);

  return (
    <div 
      className={`relative min-w-0 ${className}`} 
      ref={ref}
      onMouseEnter={() => {
        setIsHovering(true);
        if (!open) setOpen(true);
      }}
      onMouseLeave={(e) => {
        // Solo cerrar si el mouse no está entrando al dropdown
        const relatedTarget = e.relatedTarget as Node;
        if (dropdownRef.current && !dropdownRef.current.contains(relatedTarget)) {
          setIsHovering(false);
        }
      }}
    >
      {label && <div className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">{label}</div>}
      <div
        className="w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 dark:shadow-sm dark:shadow-orange-900/10 dark:ring-0.5 dark:ring-orange-500/15 text-gray-900 dark:text-gray-100 cursor-pointer flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <span className="truncate">{selected ? selected.label : (value === '' ? 'Todos' : placeholder)}</span>
        <svg 
          className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
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
        <div 
          ref={dropdownRef}
          className="absolute z-[9999] w-full mt-1 top-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-auto apple-scroll"
          style={{ 
            maxHeight,
            // Agregar padding visual para mejor espaciado
            paddingTop: '4px',
            paddingBottom: '4px'
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onMouseDown={(e) => {
            // Prevenir que el clic dentro del dropdown lo cierre
            e.stopPropagation();
          }}
          onWheel={(e) => {
            // Prevenir que el scroll cierre el dropdown
            e.stopPropagation();
          }}
        >
          {options.map((opt, index) => (
            <div key={opt.value}>
              {index > 0 && (
                <div className="w-full h-px bg-gray-100 dark:bg-gray-600/50 dark:shadow-sm dark:shadow-blue-900/10"></div>
              )}
              <button
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full px-4 py-3 text-sm cursor-pointer transition-colors duration-150 flex items-center justify-between ${
                  value === opt.value 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


