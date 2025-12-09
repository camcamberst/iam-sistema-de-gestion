"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from '@/lib/supabase';
import { modernLogout } from '@/lib/auth-modern';
import ChatWidget from '@/components/chat/ChatWidget';
import ThemeToggle from '@/components/ThemeToggle';

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | string;
    groups: string[];
  } | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Cliente centralizado de Supabase

  const loadUser = async () => {
    try {
      setLoadingUser(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        setUserInfo(null);
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('id,name,email,role')
        .eq('id', uid)
        .single();
      let groups: string[] = [];
      if (userRow && userRow.role !== 'super_admin') {
        const { data: ug } = await supabase
          .from('user_groups')
          .select('groups(name)')
          .eq('user_id', uid);
        groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
      }
      setUserInfo({
        id: userRow?.id || uid,
        name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
        email: userRow?.email || auth.user?.email || '',
        role: (userRow?.role as any) || 'modelo',
        groups,
      });
    } finally {
      setLoadingUser(false);
    }
  };

  // Hidratar y cargar userInfo al montar
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!userInfo && !loadingUser) {
      // Inicial rápido desde localStorage
      try {
        const local = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed?.id && parsed?.role) {
            setUserInfo({
              id: parsed.id,
              name: parsed.name || parsed.email?.split('@')[0] || 'Usuario',
              email: parsed.email || '',
              role: parsed.role,
              groups: parsed.groups || []
            });
          }
        }
      } catch {}
      // Confirmación desde Supabase
      loadUser();
    }
  }, [isClient]);

  // Funciones para manejar el dropdown con delay
  const handleMenuEnter = (itemId: string) => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
    setActiveMenu(itemId);
  };

  const handleMenuLeave = () => {
    const timeout = setTimeout(() => {
      setActiveMenu(null);
    }, 300); // 300ms de delay antes de cerrar
    setMenuTimeout(timeout);
  };

  const handleDropdownEnter = () => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
  };

  const handleDropdownLeave = () => {
    const timeout = setTimeout(() => {
      setActiveMenu(null);
    }, 150); // Delay más corto cuando se sale del dropdown
    setMenuTimeout(timeout);
  };

  // Cleanup timeout al desmontar el componente
  useEffect(() => {
    return () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout);
      }
    };
  }, [menuTimeout]);

  // Manejar clic fuera del panel de usuario
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userPanelRef.current && !userPanelRef.current.contains(event.target as Node)) {
        setShowUserPanel(false);
      }
    };

    if (showUserPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserPanel]);

  // ===========================================
  // 🍎 APPLE.COM STYLE MENU STRUCTURE
  // ===========================================
  const getMenuItems = () => {
    // Obtener el rol del usuario desde localStorage
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    const userRole = userData ? JSON.parse(userData).role : 'modelo';

    // Menú base para todos los roles
    const baseItems = [
      {
        id: 'calculator',
        label: userRole === 'modelo' ? 'Mi Calculadora' : 'Gestión Calculadora',
        href: '#', // Sin navegación directa
        subItems: userRole === 'modelo' ? [ { label: 'Ingresar Valores', href: '/model/calculator' } ] : []
      }
    ];

    // Agregar opciones según el rol
    if (userRole === 'super_admin' || userRole === 'admin') {
      baseItems.unshift({
        id: 'users',
        label: 'Gestión Usuarios',
        href: '#', // Sin navegación directa
        subItems: [
          { label: 'Crear Usuario', href: '/admin/users/create' },
          { label: 'Consultar Usuarios', href: '/admin/users' }
        ]
      });

      baseItems.push({
        id: 'anticipos',
        label: 'Gestión Anticipos',
        href: '#', // Sin navegación directa
        subItems: [
          { label: 'Solicitudes Pendientes', href: '/admin/anticipos/pending' },
          { label: 'Historial Anticipos', href: '/admin/anticipos/history' }
        ]
      });

      baseItems.push({
        id: 'sedes',
        label: 'Gestión Sedes',
        href: '#', // Sin navegación directa
        subItems: [
          { label: 'Gestionar Sedes', href: '/admin/sedes/gestionar' },
          { label: 'Portafolio Modelos', href: '/admin/sedes/portafolio' },
          { label: 'Dashboard Sedes', href: '/admin/sedes/dashboard' }
        ]
      });

      // Agregar opciones administrativas de calculadora SOLO para admins/super_admins
      const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
      if (calculatorIndex !== -1) {
        baseItems[calculatorIndex].subItems = [
          { label: 'Definir RATES', href: '/admin/rates' },
          { label: 'Crear Plataforma', href: '/admin/calculator/create-platform' },
          { label: 'Configurar Calculadora', href: '/admin/calculator/config' },
          { label: 'Ver Calculadora Modelo', href: '/admin/calculator/view-model' }
        ];
      }
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => item.subItems?.some((subItem: any) => pathname === subItem.href);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Apple Style 2 Header */}
      <header className="bg-white dark:bg-gray-900 backdrop-blur-md border border-white/20 dark:border-gray-700/30 sticky top-0 z-[99999] shadow-lg dark:shadow-lg dark:shadow-purple-900/15 dark:ring-0.5 dark:ring-purple-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/superadmin/dashboard" className="flex items-center space-x-3 group">
                <div className="w-9 h-9 bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300 rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-700/30 group-hover:shadow-lg transition-all duration-300">
                  <span className="text-white dark:text-gray-900 font-bold text-sm tracking-wider">AIM</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent whitespace-nowrap">Sistema de Gestión</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium tracking-wide">Agencia Innova</span>
                </div>
              </Link>
            </div>

            {/* Main Navigation - Apple Style 2 */}
            <nav className="hidden md:flex items-center space-x-6">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => handleMenuEnter(item.id)}
                  onMouseLeave={handleMenuLeave}
                >
                  {item.href === '#' ? (
                    <span
                      className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-default whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm ${
                        isParentActive(item) 
                          ? 'text-gray-900 dark:text-white bg-white/50 dark:bg-gray-800/50 shadow-sm' 
                          : 'text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={`px-4 py-2 text-sm font-medium transition-all duration-300 whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm ${
                        isActive(item.href) || isParentActive(item) 
                          ? 'text-gray-900 dark:text-white bg-white/50 dark:bg-gray-800/50 shadow-sm' 
                          : 'text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}

                  {/* Dropdown Menu */}
                  {activeMenu === item.id && (
                    <div 
                      className="absolute top-full left-0 mt-2 w-72 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-xl z-[9999999] animate-in slide-in-from-top-2 duration-200"
                      onMouseEnter={handleDropdownEnter}
                      onMouseLeave={handleDropdownLeave}
                    >
                      <div className="p-2">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg ${
                              isActive(subItem.href)
                                ? 'bg-blue-50/80 text-blue-900 font-medium shadow-sm border border-blue-200/30'
                                : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
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
            <div className="flex items-center space-x-3">
              <button className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-lg transition-all duration-200 hover:shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* User Button */}
              <div className="relative" ref={userPanelRef}>
                <button
                  onClick={() => {
                    setShowUserPanel((v) => !v);
                    if (!userInfo && !loadingUser) loadUser();
                  }}
                  className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-lg border border-white/20 dark:border-gray-700/30 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                    </svg>
                  </div>
                  <span className="hidden sm:block text-sm font-medium">Cuenta</span>
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserPanel && (
                  <div className="absolute right-0 mt-3 w-72 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/30 dark:border-gray-700/30 rounded-lg shadow-xl p-4 z-50 animate-in slide-in-from-top-2 duration-200">
                    {loadingUser ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full mx-auto mb-2"></div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">Cargando…</div>
                      </div>
                    ) : userInfo ? (
                      <div className="space-y-3">
                        {/* Header compacto */}
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-md bg-gray-700 text-white flex items-center justify-center shadow-sm">
                            <span className="text-sm font-semibold">{userInfo.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{userInfo.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                              {String(userInfo.role).replace('_',' ').charAt(0).toUpperCase() + String(userInfo.role).replace('_',' ').slice(1)} · {userInfo.email}
                            </div>
                          </div>
                        </div>
                        
                        {/* Información compacta - Estilo sobrio */}
                        <div className="space-y-2">
                          {userInfo.role !== 'super_admin' && userInfo.groups?.length > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-medium">{userInfo.role === 'modelo' ? 'Grupo' : 'Grupos'}</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {userInfo.groups.map((group, index) => (
                                  <span key={index} className="px-2 py-1 bg-gray-800 text-white rounded-md text-xs font-medium">
                                    {group}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-medium">ID</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(userInfo.id)}
                                className="text-gray-200 font-mono text-xs hover:text-gray-400 transition-colors duration-200 cursor-pointer"
                                title="Hacer clic para copiar"
                              >
                                {userInfo.id}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Botón de logout compacto */}
                        <div className="pt-3 border-t border-gray-700">
                          <button
                            onClick={async () => {
                              await modernLogout();
                              setUserInfo(null);
                              location.href = '/';
                            }}
                            className="w-full px-3 py-2 text-xs rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 hover:text-gray-100 transition-all duration-200 font-medium flex items-center justify-center space-x-1.5"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Cerrar sesión</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <svg className="w-6 h-6 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div className="text-xs text-gray-600">No autenticado</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden text-gray-600 hover:text-gray-900 p-2 cursor-default">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* ChatWidget para super_admin/admin/modelo */}
      {userInfo && (userInfo.role === 'super_admin' || userInfo.role === 'admin' || userInfo.role === 'modelo') && (
        <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
      )}
    </div>
  );
}