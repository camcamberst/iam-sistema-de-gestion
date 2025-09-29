"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ===========================================
// 🍎 APPLE-STYLE SIDEBAR COMPONENT
// ===========================================

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  href?: string;
  subItems?: MenuItem[];
  badge?: string;
  isActive?: boolean;
  isExpanded?: boolean;
}

interface AppleSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppleSidebar({ isOpen, onClose }: AppleSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // ===========================================
  // 📋 ESCALABLE MENU STRUCTURE
  // ===========================================
  const menuItems: MenuItem[] = [
    {
      id: 'users',
      title: 'Gestión de Usuarios',
      icon: '👥',
      subItems: [
        {
          id: 'create-user',
          title: 'Crear Usuario',
          icon: '➕',
          href: '/admin/users/create'
        },
        {
          id: 'list-users',
          title: 'Consultar Usuarios',
          icon: '🔍',
          href: '/admin/users'
        }
      ]
    },
    {
      id: 'calculator',
      title: 'Gestionar Calculadora',
      icon: '🧮',
      subItems: [
        {
          id: 'calculator-home',
          title: 'Panel Calculadora',
          icon: '🧰',
          href: '/admin/calculadora'
        },
        {
          id: 'define-rates',
          title: 'Definir RATES',
          icon: '💱',
          href: '/admin/rates'
        }
      ]
    },
    {
      id: 'groups',
      title: 'Gestión de Grupos',
      icon: '🏢',
      subItems: [
        {
          id: 'create-group',
          title: 'Crear Grupo',
          icon: '➕',
          href: '/admin/groups/create'
        },
        {
          id: 'list-groups',
          title: 'Consultar Grupos',
          icon: '🔍',
          href: '/admin/groups'
        }
      ]
    },
    {
      id: 'reports',
      title: 'Reportes y Analytics',
      icon: '📊',
      subItems: [
        {
          id: 'user-reports',
          title: 'Reportes de Usuarios',
          icon: '📈',
          href: '/admin/reports/users'
        },
        {
          id: 'group-reports',
          title: 'Estadísticas de Grupos',
          icon: '📊',
          href: '/admin/reports/groups'
        },
        {
          id: 'audit-reports',
          title: 'Auditoría del Sistema',
          icon: '🔒',
          href: '/admin/audit'
        }
      ]
    },
    {
      id: 'settings',
      title: 'Configuración',
      icon: '⚙️',
      subItems: [
        {
          id: 'general-settings',
          title: 'Configuración General',
          icon: '🔧',
          href: '/admin/settings/general'
        },
        {
          id: 'permissions',
          title: 'Permisos del Sistema',
          icon: '🔐',
          href: '/admin/settings/permissions'
        },
        {
          id: 'backup',
          title: 'Backup y Restauración',
          icon: '💾',
          href: '/admin/settings/backup'
        }
      ]
    }
  ];

  // ===========================================
  // 🔧 HELPER FUNCTIONS
  // ===========================================
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (item.href) {
      return pathname === item.href;
    }
    if (item.subItems) {
      return item.subItems.some(subItem => pathname === subItem.href);
    }
    return false;
  };

  const isSubItemActive = (subItem: MenuItem): boolean => {
    return pathname === subItem.href;
  };

  // ===========================================
  // 🎨 RENDER FUNCTIONS
  // ===========================================
  const renderMenuItem = (item: MenuItem) => {
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.includes(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div key={item.id} className="mb-2">
        {/* Main Menu Item */}
        <div
          className={`
            flex items-center justify-between p-4 rounded-xl cursor-pointer
            transition-all duration-300 ease-out
            ${isActive 
              ? 'apple-glass bg-gradient-to-r from-blue-500/20 to-purple-500/20' 
              : 'hover:bg-white/10'
            }
          `}
          onClick={() => hasSubItems && toggleExpanded(item.id)}
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{item.icon}</span>
            <span className="text-white font-medium">{item.title}</span>
            {item.badge && (
              <span className="px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                {item.badge}
              </span>
            )}
          </div>
          
          {hasSubItems && (
            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>

        {/* Sub Items */}
        {hasSubItems && isExpanded && (
          <div className="ml-6 space-y-1 apple-slide-in">
            {item.subItems!.map((subItem) => (
              <Link
                key={subItem.id}
                href={subItem.href!}
                className={`
                  flex items-center space-x-3 p-3 rounded-lg
                  transition-all duration-300 ease-out
                  ${isSubItemActive(subItem)
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }
                `}
                onClick={onClose}
              >
                <span className="text-lg">{subItem.icon}</span>
                <span className="font-medium">{subItem.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ===========================================
  // 🎨 MAIN RENDER
  // ===========================================
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        apple-sidebar
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">AIM</span>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Sistema de Gestión</h2>
                <p className="text-white/60 text-sm">Panel Administrativo</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
            >
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-6 space-y-2 overflow-y-auto h-full">
          {menuItems.map(renderMenuItem)}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-white/10">
          <div className="text-center">
            <p className="text-white/40 text-xs">
              © 2024 AIM Sistema de Gestión
            </p>
            <p className="text-white/30 text-xs mt-1">
              Diseño Apple-style
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
