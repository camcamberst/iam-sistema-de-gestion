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

  // Cerrar dropdown al hacer click fuera (soporte para móvil y escritorio)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle(); // Cerrar usando el estado del layout
      }
    };

    if (isOpen) {
      // Agregar ambos eventos para soportar móvil y escritorio
    document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  const handleToggle = () => {
    onToggle(); // Usar el estado del layout
  };

  const menuItems = [
    {
      label: 'Ingresar Valores',
      href: '/admin/model/calculator',
      icon: <Calculator className="w-4 h-4" />,
      description: 'Registra tus ganancias diarias'
    },
    {
      label: 'Mi Historial',
      href: '/admin/model/calculator/historial',
      icon: <History className="w-4 h-4" />,
      description: 'Historial de períodos archivados de la calculadora'
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón del dropdown */}
      <button
        onClick={handleToggle}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleToggle();
        }}
        className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-pointer whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm active:bg-white/80 dark:active:bg-gray-800/80 flex items-center space-x-2 touch-manipulation ${
          isActive 
            ? 'text-gray-900 dark:text-gray-100 bg-white/50 dark:bg-gray-800/50 shadow-sm' 
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
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
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-300 rounded-xl shadow-xl dark:shadow-lg z-[9999999] animate-in slide-in-from-top-2 duration-200">
          <div className="p-3">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-800 uppercase tracking-wide mb-2">
                Mi Calculadora
              </h3>
            </div>
            
            {menuItems.map((item) => {
              const isCurrentPage = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                  className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg group touch-manipulation active:bg-gray-100 dark:active:bg-gray-200 ${
                    isCurrentPage
                      ? 'bg-blue-50 dark:bg-blue-50 text-blue-900 dark:text-blue-600 font-medium shadow-sm border border-blue-200 dark:border-blue-200'
                      : 'text-gray-900 dark:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-50 hover:text-gray-900 dark:hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 ${
                      isCurrentPage ? 'text-blue-600 dark:text-blue-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-600'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.label}</div>
                      <div className={`text-xs ${
                        isCurrentPage ? 'text-blue-600 dark:text-blue-500' : 'text-gray-500 dark:text-gray-600'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                    {isCurrentPage && (
                      <div className="flex-shrink-0">
                        <Settings className="w-4 h-4 text-blue-600 dark:text-blue-500" />
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
