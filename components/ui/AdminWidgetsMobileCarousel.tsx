'use client';

import React, { useState, useEffect, useRef } from 'react';

interface Props {
  children?: React.ReactNode;
  mobileChildren?: React.ReactNode[];
  desktopChildren?: React.ReactNode;
}

export default function AdminWidgetsMobileCarousel({ children, mobileChildren, desktopChildren }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const childrenArray = mobileChildren ? React.Children.toArray(mobileChildren) : React.Children.toArray(children);
  const total = childrenArray.length;
  const isInfinite = total > 1;
  const displayArray = isInfinite ? Array(40).fill(childrenArray).flat() : childrenArray;

  const [currentIndex, setCurrentIndex] = useState(() => isInfinite ? total * 20 : 0);
  const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number} | null>(null);
  const lastActionTime = useRef<number>(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint is 1024px
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNext = () => {
    const now = Date.now();
    if (now - lastActionTime.current < 300) return; // Prevenir doble disparo (fantasma)
    lastActionTime.current = now;
    setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    const now = Date.now();
    if (now - lastActionTime.current < 300) return;
    lastActionTime.current = now;
    setCurrentIndex((prev) => prev - 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Proteger SOLAMENTE botones, inputs y links reales.
    // Permitimos tap en la tabla o textos para que rote más fácil.
    if (
      target.closest('button') || 
      target.closest('a') || 
      target.closest('input') ||
      target.closest('textarea')
    ) {
      return;
    }

    if (e.type === 'touchend' && touchStartPos) {
      const touchEvent = e as React.TouchEvent;
      const endX = touchEvent.changedTouches[0].clientX;
      const endY = touchEvent.changedTouches[0].clientY;
      const diffX = touchStartPos.x - endX;
      const diffY = touchStartPos.y - endY;
      
      // Si el usuario scrolleó verticalmente significativamente, dejarlo pasar sin rotar
      if (Math.abs(diffY) > 15) {
        setTouchStartPos(null);
        return;
      }

      // Swipe horizontal
      if (Math.abs(diffX) > 40) {
        if (diffX > 0) handleNext();
        else handlePrev();
        setTouchStartPos(null);
        return;
      }
      
      // Tap limpio (movimiento menor a 15px)
      if (Math.abs(diffX) <= 15 && Math.abs(diffY) <= 15) {
        handleNext();
      }
      setTouchStartPos(null);
    } else if (e.type === 'click') {
      handleNext();
    }
  };

  // Escritorio: Renderizar los elementos directamente para que se integren al grid del padre
  if (!isMobile) {
    return <>{desktopChildren !== undefined ? desktopChildren : children}</>;
  }

  // Móvil: Carrusel rotativo de altura dinámica según el widget activo
  return (
    <div 
      className="relative w-full overflow-hidden touch-pan-y cursor-pointer"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      onClickCapture={handleTouchEnd}
      onTouchStartCapture={handleTouchStart}
      onTouchEndCapture={handleTouchEnd}
    >
      <div className="relative w-full flex items-start">
        {displayArray.map((child, index) => {
          const offset = index - currentIndex;
          // Optimización extrema: solo renderizar el nodo activo y sus 2 vecinos más cercanos
          if (Math.abs(offset) > 2) return null;
          
          const isActive = offset === 0;
          
          return (
            <div
              key={index}
              className={`w-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isActive ? 'relative' : 'absolute top-0 left-0'}`}
              style={{
                transform: `translateX(${offset * 100}%) scale(${isActive ? 1 : 0.96})`,
                opacity: isActive ? 1 : 0,
                zIndex: isActive ? 10 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div className="pb-8"> {/* Padding inferior para dejar espacio a los dots */}
                {child}
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicadores de Widget Activo */}
      {isInfinite && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-row gap-1.5 opacity-60">
          {childrenArray.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                (currentIndex % total) === idx ? 'w-4 bg-purple-500 dark:bg-purple-400' : 'w-1.5 bg-gray-400 dark:bg-gray-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
