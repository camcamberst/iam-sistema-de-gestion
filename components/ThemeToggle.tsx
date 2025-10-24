"use client";

import React, { useState, useEffect } from 'react';

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Cargar tema desde localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      // Usar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = prefersDark ? 'dark' : 'light';
      setTheme(initialTheme);
      document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Efecto de transición suave con múltiples propiedades
    document.documentElement.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    document.body.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Aplicar el cambio de tema
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    
    // Efecto de ripple en el botón
    const button = document.querySelector('[data-theme-toggle]') as HTMLElement;
    if (button) {
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = 'scale(1)';
      }, 150);
    }
    
    // Remover las transiciones después de completarse
    setTimeout(() => {
      document.documentElement.style.transition = '';
      document.body.style.transition = '';
    }, 600);
  };

  if (!mounted) {
    return (
      <div className="p-2.5 text-gray-600 rounded-lg">
        <div className="w-5 h-5"></div>
      </div>
    );
  }

  return (
    <button
      data-theme-toggle
      onClick={toggleTheme}
      className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-lg transition-all duration-200 hover:shadow-sm
                 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
      title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
    >
      {theme === 'light' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h1M3 12H2m15.325 6.675l-.707.707M6.707 6.707l-.707-.707m10.626 0l.707-.707M6.707 17.293l-.707.707M12 18a6 6 0 100-12 6 6 0 000 12z" />
        </svg>
      )}
    </button>
  );
};

export default ThemeToggle;
