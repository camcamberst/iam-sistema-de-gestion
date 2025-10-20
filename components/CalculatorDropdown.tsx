'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Calculator, History, Settings } from 'lucide-react';

interface CalculatorDropdownProps {
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export default function CalculatorDropdown({ isActive, isOpen, onToggle }: CalculatorDropdownProps) {
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle(); // Cerrar usando el estado del layout
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleToggle = () => {
    onToggle(); // Usar el estado del layout
  };

  const menuItems = [
    {
      label: 'Ingresar Valores',
      href: '/model/calculator',
      icon: <Calculator className="w-4 h-4" />,
      description: 'Registra tus ganancias diarias'
    },
    {
      label: 'Mi Historial',
      href: '/model/calculator/history',
      icon: <History className="w-4 h-4" />,
      description: 'Ve tu historial de ingresos'
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón del dropdown */}
      <button
        onClick={handleToggle}
        className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-pointer whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-700/60 hover:backdrop-blur-sm hover:shadow-sm flex items-center space-x-2 ${
          isActive 
            ? 'theme-text-primary bg-white/50 dark:bg-gray-700/50 shadow-sm' 
            : 'theme-text-secondary hover:theme-text-primary'
        }`}
      >
        <span>Mi Calculadora</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 theme-bg-secondary backdrop-blur-md theme-border rounded-xl theme-shadow z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="p-3">
            <div className="mb-2">
              <h3 className="text-xs font-semibold theme-text-secondary uppercase tracking-wide mb-2">
                Mi Calculadora
              </h3>
            </div>
            
            {menuItems.map((item) => {
              const isCurrentPage = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onToggle()}
                  className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg group ${
                    isCurrentPage
                      ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 font-medium shadow-sm border border-blue-200/30 dark:border-blue-700/30'
                      : 'theme-text-secondary hover:bg-white/60 dark:hover:bg-gray-700/60 hover:theme-text-primary hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 ${
                      isCurrentPage ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.label}</div>
                      <div className={`text-xs ${
                        isCurrentPage ? 'text-blue-600 dark:text-blue-400' : 'theme-text-secondary'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                    {isCurrentPage && (
                      <div className="flex-shrink-0">
                        <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
