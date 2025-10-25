"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PortfolioDropdown from "@/components/PortfolioDropdown";
import CalculatorDropdown from "@/components/CalculatorDropdown";
import AnticiposDropdown from "@/components/AnticiposDropdown";
import { supabase } from '@/lib/supabase';
import { modernLogout } from '@/lib/auth-modern';
import ChatWidget from '@/components/chat/ChatWidget';
import ThemeToggle from '@/components/ThemeToggle';

export default function ModelLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false);
  const [calculatorDropdownOpen, setCalculatorDropdownOpen] = useState(false);
  const [anticiposDropdownOpen, setAnticiposDropdownOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | string;
    groups: string[];
  } | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);

  // Cliente centralizado de Supabase

  // Manejar hidratación del cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Cargar usuario automáticamente al montar el layout
  useEffect(() => {
    loadUser();
  }, []);

  // Cargar usuario cuando el cliente esté listo
  useEffect(() => {
    if (isClient && !userInfo && !loadingUser) {
      loadUser();
    }
  }, [isClient]);

  // Cerrar todos los dropdowns al cambiar de página
  useEffect(() => {
    setPortfolioDropdownOpen(false);
    setCalculatorDropdownOpen(false);
    setAnticiposDropdownOpen(false);
  }, [pathname]);

  // Scroll al inicio de la página en cada cambio de ruta
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Cleanup timeout al desmontar el componente
  useEffect(() => {
    return () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout);
      }
    };
  }, [menuTimeout]);

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

  // Funciones de manejo de menú eliminadas - ahora se usan componentes dedicados

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
  // 🍎 APPLE.COM STYLE MENU STRUCTURE FOR MODEL
  // ===========================================
  // Estado para el menú - PERSISTENTE
  const [menuItems, setMenuItems] = useState<Array<{
    id: string;
    label: string;
    href: string;
    subItems: Array<{label: string; href: string}>;
  }>>([]);

  // Función para inicializar el menú una sola vez
  const initializeMenu = () => {
    if (!isClient) return;
    
    console.log('🔍 [MENU-INIT] Initializing menu for model');
    
    // Menú específico para modelos
    const baseItems: Array<{
      id: string;
      label: string;
      href: string;
      subItems: Array<{label: string; href: string}>;
    }> = [
      {
        id: 'calculator',
        label: 'Mi Calculadora',
        href: '/model/calculator',
        subItems: [
          { label: 'Ingresar Valores', href: '/model/calculator' },
          { label: 'Mi Historial', href: '/model/calculator/history' }
        ]
      },
      {
        id: 'anticipos',
        label: 'Mis Anticipos',
        href: '/model/anticipos/solicitar',
        subItems: [
          { label: 'Solicitar Anticipo', href: '/model/anticipos/solicitar' },
          { label: 'Mis Solicitudes', href: '/model/anticipos/solicitudes' },
          { label: 'Mi Historial', href: '/model/anticipos/historial' }
        ]
      },
      {
        id: 'portafolio',
        label: 'Mi Portafolio',
        href: '/model/portafolio',
        subItems: []
      }
    ];
    
    console.log('🔍 [MENU-INIT] Final menu items:', baseItems);
    setMenuItems(baseItems);
  };

  useEffect(() => {
    if (isClient) {
      initializeMenu();
    }
  }, [isClient]);
  
  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => item.subItems?.some((subItem: any) => pathname === subItem.href);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Apple Style 2 Header */}
      <header className="bg-white dark:bg-gray-800/80 backdrop-blur-md border border-white/20 dark:border-gray-600/20 sticky top-0 z-[99999] shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/admin/model/dashboard" className="flex items-center space-x-3 group">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-600/20 group-hover:shadow-lg transition-all duration-300">
                  <span className="text-white font-bold text-sm tracking-wider">AIM</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">Sistema de Gestión</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium tracking-wide">Agencia Innova</span>
                </div>
              </Link>
            </div>

            {/* Main Navigation - Apple Style 2 */}
            <nav className="flex items-center space-x-6">
              {menuItems.length > 0 ? (
                menuItems.map((item) => {
                  // Renderizar Mi Portafolio con el componente especial
                  if (item.id === 'portafolio') {
                    return (
                      <PortfolioDropdown
                        key={item.id}
                        isActive={isActive(item.href)}
                        isOpen={portfolioDropdownOpen}
                        onToggle={() => setPortfolioDropdownOpen(!portfolioDropdownOpen)}
                      />
                    );
                  }

                  // Renderizar Mi Calculadora con el componente especial
                  if (item.id === 'calculator' && item.label === 'Mi Calculadora') {
                    return (
                      <CalculatorDropdown
                        key={item.id}
                        isActive={isActive(item.href)}
                        isOpen={calculatorDropdownOpen}
                        onToggle={() => setCalculatorDropdownOpen(!calculatorDropdownOpen)}
                      />
                    );
                  }

                  // Renderizar Mis Anticipos con el componente especial
                  if (item.id === 'anticipos' && item.label === 'Mis Anticipos') {
                    return (
                      <AnticiposDropdown
                        key={item.id}
                        isActive={isActive(item.href)}
                        isOpen={anticiposDropdownOpen}
                        onToggle={() => setAnticiposDropdownOpen(!anticiposDropdownOpen)}
                      />
                    );
                  }

                  // No debería llegar aquí para modelos, pero por seguridad
                  return null;
                })
              ) : (
                <div className="text-gray-600 dark:text-white text-sm">Cargando menú...</div>
              )}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-3">
              <button className="p-2.5 text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/60 dark:hover:bg-gray-700/60 rounded-lg transition-all duration-200 hover:shadow-sm">
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
                  className="flex items-center space-x-2 text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-lg border border-white/20 dark:border-gray-600/20 hover:bg-white/60 dark:hover:bg-gray-700/60 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                    </svg>
                  </div>
                  <span className="hidden sm:block text-sm font-medium">Cuenta</span>
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserPanel && (
                  <div className="absolute right-0 mt-3 w-72 bg-white/95 dark:bg-gray-700/95 backdrop-blur-md border border-white/30 dark:border-gray-600/30 rounded-lg shadow-xl p-4 z-50 animate-in slide-in-from-top-2 duration-200 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                    {loadingUser ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-600 dark:border-gray-400 border-t-gray-400 dark:border-t-gray-200 rounded-full mx-auto mb-2"></div>
                        <div className="text-xs text-gray-600 dark:text-white">Cargando…</div>
                      </div>
                    ) : userInfo ? (
                      <div className="space-y-3">
                        {/* Header compacto */}
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-md bg-gray-700 dark:bg-gray-600 text-white flex items-center justify-center shadow-sm">
                            <span className="text-sm font-semibold">{userInfo.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userInfo.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                              {String(userInfo.role).replace('_',' ').charAt(0).toUpperCase() + String(userInfo.role).replace('_',' ').slice(1)} · {userInfo.email}
                            </div>
                          </div>
                        </div>
                        
                        {/* Información compacta - Estilo sobrio */}
                        <div className="space-y-2">
                          {userInfo.role !== 'super_admin' && userInfo.groups?.length > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 dark:text-gray-400 font-medium">{userInfo.role === 'modelo' ? 'Grupo' : 'Grupos'}</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {userInfo.groups.map((group, index) => (
                                  <span key={index} className="px-2 py-1 bg-gray-800 dark:bg-gray-600 text-gray-300 dark:text-gray-200 rounded-md text-xs font-medium">
                                    {group}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 dark:text-gray-400 font-medium">ID</span>
                              <button
                                onClick={() => navigator.clipboard.writeText(userInfo.id)}
                                className="text-gray-200 dark:text-gray-300 font-mono text-xs hover:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer"
                                title="Hacer clic para copiar"
                              >
                                {userInfo.id}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Botón de logout elegante */}
                        <div className="pt-3 border-t border-gray-700 dark:border-gray-600">
                          <button
                            onClick={async () => {
                              await modernLogout();
                              setUserInfo(null);
                              location.href = '/';
                            }}
                            className="w-full px-3 py-2 text-xs rounded-md bg-gray-800 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500 border border-gray-600 dark:border-gray-500 text-gray-200 dark:text-gray-100 hover:text-gray-100 dark:hover:text-white transition-all duration-200 font-medium flex items-center justify-center space-x-1.5"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                            </svg>
                            <span>Cerrar sesión</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <svg className="w-6 h-6 text-gray-400 dark:text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div className="text-xs text-gray-600 dark:text-white">No autenticado</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-100 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* ChatWidget para modelos */}
      {userInfo && userInfo.role === 'modelo' && (
        <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
      )}
    </div>
  );
}

