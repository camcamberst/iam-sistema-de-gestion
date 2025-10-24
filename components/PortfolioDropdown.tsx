'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Building2, Eye } from 'lucide-react';

interface PortfolioDropdownProps {
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export default function PortfolioDropdown({ isActive, isOpen, onToggle }: PortfolioDropdownProps) {
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
      label: 'Ver Portafolio',
      href: '/model/portafolio',
      icon: <Building2 className="w-4 h-4" />,
      description: 'Gestiona tus plataformas'
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón del dropdown */}
      <button
        onClick={handleToggle}
        className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-pointer whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm flex items-center space-x-2 ${
          isActive 
            ? 'text-gray-900 dark:text-gray-100 bg-white/50 dark:bg-gray-800/50 shadow-sm' 
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
        }`}
      >
        <span>Mi Portafolio</span>
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/30 dark:border-gray-700/30 rounded-xl shadow-xl dark:shadow-2xl dark:shadow-purple-900/30 dark:ring-1 dark:ring-purple-400/30 z-[9998] animate-in slide-in-from-top-2 duration-200">
          <div className="p-3">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-100 uppercase tracking-wide mb-2">
                Mi Portafolio
              </h3>
            </div>
            
            {menuItems.map((item) => {
              const isCurrentPage = pathname === item.href || 
                (item.href.includes('?tab=analytics') && pathname === '/model/portafolio');
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onToggle()}
                  className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg group ${
                    isCurrentPage
                      ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 font-medium shadow-sm border border-blue-200/30 dark:border-blue-700/30'
                      : 'text-gray-900 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-gray-100 hover:shadow-sm'
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
                        isCurrentPage ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                    {isCurrentPage && (
                      <div className="flex-shrink-0">
                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
