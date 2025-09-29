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
          id: 'performance-reports',
          title: 'Rendimiento del Sistema',
          icon: '⚡',
          href: '/admin/reports/performance'
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
          id: 'security-settings',
          title: 'Seguridad',
          icon: '🔒',
          href: '/admin/settings/security'
        },
        {
          id: 'notifications-settings',
          title: 'Notificaciones',
          icon: '🔔',
          href: '/admin/settings/notifications'
        }
      ]
    }
  ];

  // ===========================================
  // 🎯 NAVIGATION LOGIC
  // ===========================================
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (item.href && pathname === item.href) return true;
    if (item.subItems) {
      return item.subItems.some(subItem => 
        subItem.href && pathname === subItem.href
      );
    }
    return false;
  };

  const isSubItemActive = (subItem: MenuItem): boolean => {
    return subItem.href ? pathname === subItem.href : false;
  };

  // ===========================================
  // 🎨 RENDER FUNCTIONS
  // ===========================================
  const renderMenuItem = (item: MenuItem) => {
    const isExpanded = expandedItems.includes(item.id);
    const isActive = isItemActive(item);
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div key={item.id} className="mb-1">
        {/* Main Menu Item */}
        <div
          className={`
            flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer
            transition-all duration-200 ease-out
            ${isActive 
              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            }
          `}
          onClick={() => hasSubItems && toggleExpanded(item.id)}
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium text-sm">{item.title}</span>
            {item.badge && (
              <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                {item.badge}
              </span>
            )}
          </div>
          
          {hasSubItems && (
            <span className={`
              text-gray-400 transition-transform duration-200
              ${isExpanded ? 'rotate-180' : ''}
            `}>
              ▼
            </span>
          )}
        </div>

        {/* Sub Items */}
        {hasSubItems && isExpanded && (
          <div className="ml-4 mt-1 space-y-1">
            {item.subItems!.map(subItem => (
              <Link
                key={subItem.id}
                href={subItem.href!}
                className={`
                  flex items-center space-x-3 px-4 py-2 rounded-lg
                  transition-all duration-200 ease-out
                  ${isSubItemActive(subItem)
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                onClick={onClose}
              >
                <span className="text-sm">{subItem.icon}</span>
                <span className="text-sm font-medium">{subItem.title}</span>
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
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-80 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-out z-50
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AIM</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Sistema de Gestión
                </h2>
                <p className="text-gray-500 text-xs">
                  Panel Administrativo
                </p>
              </div>
            </div>
            
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-gray-500">✕</span>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6">
          <nav className="px-4 space-y-2">
            {menuItems.map(renderMenuItem)}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
              <span className="text-white text-xl">🍎</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              AIM Sistema
            </h3>
            <p className="text-white/30 text-xs mt-1">
              Diseño Apple-style
            </p>
          </div>
        </div>
      </div>
    </>
  );
}