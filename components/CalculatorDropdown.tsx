'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Calculator, History, Settings } from 'lucide-react';

interface CalculatorDropdownProps {
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

export default function CalculatorDropdown({ isActive, isOpen, onToggle, onClose }: CalculatorDropdownProps) {
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const close = onClose || onToggle;

  // Cerrar dropdown al hacer click fuera (soporte para móvil y escritorio)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        close();
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
  }, [isOpen, close]);

  const handleToggle = () => {
    onToggle(); // Usar el estado del layout
  };

  const menuItems = [
    {
      label: 'Calculadora',
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
        className={`px-3 py-1.5 sm:px-4 sm:py-2 text-[14px] sm:text-[15px] transition-all duration-200 cursor-pointer whitespace-nowrap rounded-full touch-manipulation flex items-center space-x-1.5 group active:scale-[0.97] ${
          isActive || isOpen
            ? 'font-bold text-gray-900 dark:text-white bg-black/5 dark:bg-white/15 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-black/10 dark:border-white/20 backdrop-blur-md' 
            : 'font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 hover:shadow-[0_0_10px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_0_10px_rgba(255,255,255,0.1)] border border-transparent'
        }`}
      >
        <span>Mis Ingresos</span>
        <ChevronDown 
          className={`w-3.5 h-3.5 lg:w-4 lg:h-4 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          } ${
            isActive || isOpen ? 'text-gray-900 dark:text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 z-[9999999] animate-in slide-in-from-top-2 duration-200">
          {/* Glass Layer - Aislada para evitar bugs de WebKit/Blink */}
          <div className="absolute inset-0 bg-white dark:bg-gray-900 bg-opacity-40 dark:bg-opacity-40 backdrop-filter backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] -z-10"></div>
          
          <div className="relative z-10 p-2 sm:p-3">
            <div className="mb-2 px-2 pt-1">
              <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Mis Ingresos
              </h3>
            </div>
            
            <div className="space-y-1">
              {menuItems.map((item) => {
                const isCurrentPage = pathname === item.href;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => close()}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      close();
                    }}
                    className={`block px-3 py-2.5 sm:px-4 sm:py-3 text-sm transition-all duration-200 rounded-xl group touch-manipulation active:scale-[0.98] ${
                      isCurrentPage
                        ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm border border-black/5 dark:border-white/5'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`flex-shrink-0 transition-colors duration-200 ${
                        isCurrentPage ? 'text-gray-900 dark:text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                      }`}>
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium tracking-tight">{item.label}</div>
                        <div className={`text-xs mt-0.5 leading-snug ${
                          isCurrentPage ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                        }`}>
                          {item.description}
                        </div>
                      </div>
                      {isCurrentPage && (
                        <div className="flex-shrink-0">
                          <Settings className="w-4 h-4 text-gray-900 dark:text-white" />
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
