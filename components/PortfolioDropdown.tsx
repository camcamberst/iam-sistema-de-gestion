'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Building2, BarChart3, Eye } from 'lucide-react';

interface PortfolioDropdownProps {
  isActive: boolean;
  onToggle: () => void;
}

export default function PortfolioDropdown({ isActive, onToggle }: PortfolioDropdownProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    onToggle();
  };

  const menuItems = [
    {
      label: 'Ver Portafolio',
      href: '/model/portafolio',
      icon: <Building2 className="w-4 h-4" />,
      description: 'Gestiona tus plataformas'
    },
    {
      label: 'Análisis y Estadísticas',
      href: '/model/portafolio?tab=analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Ve tus métricas'
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón del dropdown */}
      <button
        onClick={handleToggle}
        className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-pointer whitespace-nowrap rounded-lg hover:bg-white/60 hover:backdrop-blur-sm hover:shadow-sm flex items-center space-x-2 ${
          isActive 
            ? 'text-gray-900 bg-white/50 shadow-sm' 
            : 'text-gray-700 hover:text-gray-900'
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
        <div className="absolute top-full left-0 mt-2 w-80 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-xl z-50 animate-in slide-in-from-top-2 duration-200">
          <div className="p-3">
            <div className="mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
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
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg group ${
                    isCurrentPage
                      ? 'bg-blue-50/80 text-blue-900 font-medium shadow-sm border border-blue-200/30'
                      : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`flex-shrink-0 ${
                      isCurrentPage ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{item.label}</div>
                      <div className={`text-xs ${
                        isCurrentPage ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        {item.description}
                      </div>
                    </div>
                    {isCurrentPage && (
                      <div className="flex-shrink-0">
                        <Eye className="w-4 h-4 text-blue-600" />
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
