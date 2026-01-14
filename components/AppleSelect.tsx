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
  maxHeightOverride?: string; // Altura máxima personalizada para el dropdown
}

export default function AppleSelect({ label, value, options, placeholder = "Selecciona", onChange, className = "", onFocus, onBlur, maxHeightOverride }: AppleSelectProps) {
  const [open, setOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [maxHeight, setMaxHeight] = useState<string>(maxHeightOverride || '20rem'); // max-h-80 o personalizado
  const ref = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchHandled, setTouchHandled] = useState(false);
  // Refs para detectar si es scroll vs toque intencional
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMoveRef = useRef<boolean>(false);
  
  // Detectar si estamos en móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      // Verificar que el clic no sea dentro del contenedor principal ni del dropdown
      const target = e.target as Node;
      const isClickInside = ref.current?.contains(target) || dropdownRef.current?.contains(target);
      if (!isClickInside) {
        setOpen(false);
        setIsHovering(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setIsHovering(false);
      }
    }
    // Usar solo 'click' para evitar cierre accidental durante scroll o touch
    // No usar touchstart para evitar conflictos con eventos táctiles
    if (open) {
      // Usar capture phase para detectar clics antes de que se propaguen
      // Delay para permitir que los eventos táctiles se procesen primero
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', onDoc, true);
        document.addEventListener('keydown', onKey);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', onDoc, true);
        document.removeEventListener('keydown', onKey);
      };
    }
  }, [open]);

  // 🔧 FIX: Manejar focus/blur para coordinación entre dropdowns
  const handleFocus = () => {
    onFocus?.();
    setOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    onBlur?.();
    // Verificar si el nuevo foco está dentro del componente
    const relatedTarget = e.relatedTarget as Node;
    const isFocusInside = ref.current?.contains(relatedTarget) || dropdownRef.current?.contains(relatedTarget);
    
    // Solo cerrar si el foco no está dentro del componente
    if (!isFocusInside) {
      setTimeout(() => {
        if (!isHovering) {
          setOpen(false);
        }
      }, 150);
    }
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
        let finalMaxHeight: number;
        if (maxHeightOverride) {
          // Si hay override, usar ese valor directamente sin cálculos adicionales
          finalMaxHeight = parseFloat(maxHeightOverride);
          setMaxHeight(`${finalMaxHeight}px`);
        } else {
          // Solo calcular dinámicamente si no hay override
          const availableHeight = Math.max(0, spaceBelow - aestheticMargin - 8); // Margen adicional de 8px
          finalMaxHeight = Math.min(availableHeight, 320); // Máximo 320px (max-h-80)
          setMaxHeight(`${finalMaxHeight}px`);
        }
        
        // Hacer scroll del modal/ventana para que el dropdown sea completamente visible hacia abajo
        // Usar el mismo contenedor que usamos para calcular el espacio
        let scrollContainer = modalContainer;
        
        if (scrollContainer && scrollContainer !== document.body) {
          // Calcular la posición del trigger dentro del contenedor
          const containerRect = (scrollContainer as HTMLElement).getBoundingClientRect();
          const triggerBottomInContainer = triggerRect.bottom - containerRect.top + scrollContainer.scrollTop;
          
          // Calcular cuánto espacio necesitamos para el dropdown completo
          const spaceNeededForDropdown = finalMaxHeight + aestheticMargin + 8;
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
          const spaceNeededForDropdown = finalMaxHeight + aestheticMargin + 8;
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
        // Solo mantener hover si el mouse está entrando al dropdown
        const relatedTarget = e.relatedTarget as Node;
        if (dropdownRef.current && dropdownRef.current.contains(relatedTarget)) {
          // El mouse está entrando al dropdown, mantener hover
          return;
        }
        // Si el mouse sale completamente del componente, cerrar
        setIsHovering(false);
      }}
    >
      {label && <div className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">{label}</div>}
      <div
        className="w-full px-3 py-2.5 text-sm text-left border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer flex items-center justify-between hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 touch-manipulation"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={(e) => {
          // En móvil, prevenir mousedown
          if (isMobile) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Prevenir que el mousedown cierre el dropdown antes del click
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          // En móvil, marcar que se está manejando un toque
          if (isMobile) {
            setTouchHandled(true);
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          // En móvil, solo abrir con toque explícito
          if (isMobile && !open) {
            e.preventDefault();
            handleFocus();
            setTouchHandled(false);
          }
        }}
        onClick={(e) => {
          // En móvil, ignorar clicks de mouse - solo permitir toques
          if (isMobile && !touchHandled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // Prevenir propagación para evitar conflictos
          e.stopPropagation();
          // Solo abrir/cerrar con click explícito (en desktop)
          if (!isMobile && !open) {
            handleFocus();
          }
          setTouchHandled(false);
        }}
      >
        <span className="truncate text-[0.9rem]">
          {selected ? selected.label : (value === '' ? 'Todos' : placeholder)}
        </span>
        <svg 
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${
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
          className="absolute z-[9999] w-full mt-1 top-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg dark:shadow-lg dark:shadow-cyan-900/10 dark:ring-0.5 dark:ring-cyan-500/15 overflow-auto apple-scroll"
          style={{ 
            maxHeight,
            // Sin altura mínima cuando hay override para permitir tamaño compacto según contenido
            minHeight: maxHeightOverride ? 'auto' : '144px',
            // Agregar padding visual para mejor espaciado
            paddingTop: '4px',
            paddingBottom: '4px'
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onMouseDown={(e) => {
            // Prevenir que el clic dentro del dropdown lo cierre
            e.stopPropagation();
            e.preventDefault();
          }}
          onTouchStart={(e) => {
            // Prevenir que el touch dentro del dropdown lo cierre
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            // Prevenir que el touch end cierre el dropdown
            e.stopPropagation();
          }}
          onWheel={(e) => {
            // Prevenir que el scroll cierre el dropdown
            e.stopPropagation();
          }}
          onClick={(e) => {
            // Prevenir que clicks dentro del dropdown lo cierren
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
                onClick={(e) => { 
                  // En móvil, ignorar clicks de mouse - solo permitir toques
                  if (isMobile && !touchHandled) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  e.preventDefault();
                  onChange(opt.value); 
                  setOpen(false);
                  setTouchHandled(false);
                }}
                onMouseDown={(e) => {
                  // En móvil, prevenir mousedown
                  if (isMobile) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  // Registrar posición inicial del toque y tiempo
                  const touch = e.touches[0];
                  touchStartRef.current = {
                    x: touch.clientX,
                    y: touch.clientY,
                    time: Date.now()
                  };
                  touchMoveRef.current = false;
                  // Marcar que se está manejando un toque
                  setTouchHandled(true);
                }}
                onTouchMove={(e) => {
                  e.stopPropagation();
                  // Si hay movimiento, es un scroll, no una selección
                  if (touchStartRef.current) {
                    const touch = e.touches[0];
                    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
                    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
                    // Si el movimiento es mayor a 10px, es un scroll
                    if (deltaX > 10 || deltaY > 10) {
                      touchMoveRef.current = true;
                    }
                  }
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  // En móvil, solo ejecutar si:
                  // 1. No hubo movimiento significativo (no es scroll)
                  // 2. El toque fue rápido (menos de 500ms)
                  if (isMobile && touchStartRef.current) {
                    const touch = e.changedTouches[0];
                    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
                    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
                    const deltaTime = Date.now() - touchStartRef.current.time;
                    
                    // Solo seleccionar si:
                    // - No hubo movimiento significativo (menos de 10px)
                    // - El toque fue rápido (menos de 500ms)
                    // - No se detectó movimiento durante el touch
                    if (!touchMoveRef.current && deltaX < 10 && deltaY < 10 && deltaTime < 500) {
                      onChange(opt.value);
                      setOpen(false);
                    }
                    
                    // Resetear referencias
                    touchStartRef.current = null;
                    touchMoveRef.current = false;
                    setTouchHandled(false);
                  }
                }}
                className={`w-full px-4 py-3 text-sm text-left cursor-pointer transition-colors duration-150 flex items-center justify-between touch-manipulation active:scale-[0.98] ${
                  value === opt.value 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.color && (
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0 ml-3 ring-1 ring-black/5"
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


