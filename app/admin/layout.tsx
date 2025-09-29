"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // ===========================================
  // 🍎 APPLE.COM STYLE MENU STRUCTURE
  // ===========================================
  const menuItems = [
    {
      id: 'users',
      label: 'Gestión de Usuarios',
      href: '/admin/users',
      subItems: [
        { label: 'Consultar Usuarios', href: '/admin/users' },
        { label: 'Crear Usuario', href: '/admin/users/create' }
      ]
    },
    {
      id: 'groups',
      label: 'Gestión de Grupos',
      href: '/admin/groups',
      subItems: [
        { label: 'Consultar Grupos', href: '/admin/groups' },
        { label: 'Crear Grupo', href: '/admin/groups/create' }
      ]
    },
    {
      id: 'reports',
      label: 'Reportes',
      href: '/admin/reports',
      subItems: [
        { label: 'Reportes de Usuarios', href: '/admin/reports/users' },
        { label: 'Estadísticas', href: '/admin/reports/stats' }
      ]
    },
    {
      id: 'settings',
      label: 'Configuración',
      href: '/admin/settings',
      subItems: [
        { label: 'Configuración General', href: '/admin/settings/general' },
        { label: 'Permisos', href: '/admin/settings/permissions' }
      ]
    }
  ];

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => item.subItems?.some((subItem: any) => pathname === subItem.href);

  return (
    <div className="min-h-screen bg-white">
      {/* Apple.com Style Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/admin" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AIM</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">Sistema de Gestión</span>
              </Link>
            </div>

            {/* Main Navigation - Apple.com Style */}
            <nav className="hidden md:flex items-center space-x-8">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setActiveMenu(item.id)}
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  <Link
                    href={item.href}
                    className={`text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive(item.href) || isParentActive(item) 
                        ? 'text-gray-900' 
                        : 'text-gray-600'
                    }`}
                  >
                    {item.label}
                  </Link>

                  {/* Dropdown Menu */}
                  {activeMenu === item.id && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <div className="py-2">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={`block px-4 py-3 text-sm transition-colors duration-200 ${
                              isActive(subItem.href)
                                ? 'bg-gray-50 text-gray-900 font-medium'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-4">
              <button className="text-gray-600 hover:text-gray-900 p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* User Button */}
              <div className="relative">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-semibold">U</div>
                  <span className="hidden sm:block text-sm">Cuenta</span>
                </button>
                {/* Dropdown panel (placeholder; wiring to auth pending) */}
                {/*
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4">
                  <div className="text-sm text-gray-900 font-medium">Nombre Apellido</div>
                  <div className="text-xs text-gray-500">correo@dominio.com</div>
                  <div className="text-xs text-gray-500 mt-1">ID: xxxxxxxx-xxxx</div>
                  <div className="text-xs text-gray-500 mt-1">Grupos: Cabecera, Diamante</div>
                </div>
                */}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden text-gray-600 hover:text-gray-900 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}