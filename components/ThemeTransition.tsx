"use client";

import React, { useState, useEffect } from 'react';

interface ThemeTransitionProps {
  children: React.ReactNode;
}

const ThemeTransition: React.FC<ThemeTransitionProps> = ({ children }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Detectar cambios de tema
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          const newTheme = isDark ? 'dark' : 'light';
          
          if (newTheme !== theme) {
            setTheme(newTheme);
            setIsTransitioning(true);
            
            // Efecto de transición con múltiples capas
            setTimeout(() => {
              setIsTransitioning(false);
            }, 600);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [theme]);

  return (
    <div 
      className={`relative transition-all duration-500 ease-in-out ${
        isTransitioning 
          ? 'opacity-90 scale-[0.98] blur-[1px]' 
          : 'opacity-100 scale-100 blur-0'
      }`}
    >
      {/* Efecto de overlay durante la transición */}
      {isTransitioning && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 dark:from-gray-900/20 dark:via-gray-800/20 dark:to-gray-900/20 animate-pulse" />
          <div className="absolute inset-0 bg-white/5 dark:bg-black/5 backdrop-blur-sm" />
          {/* Efecto de partículas sutiles */}
          <div className="absolute inset-0 bg-gradient-radial from-blue-400/20 via-transparent to-transparent animate-ping" />
        </div>
      )}
      
      {children}
    </div>
  );
};

export default ThemeTransition;
