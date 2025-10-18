"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PortfolioDropdown from "@/components/PortfolioDropdown";
import CalculatorDropdown from "@/components/CalculatorDropdown";
import AnticiposDropdown from "@/components/AnticiposDropdown";
import { supabase } from '@/lib/supabase';
import ChatWidget from '@/components/chat/ChatWidget';

export default function AdminLayout({ children }: { children: ReactNode }) {
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

  // Cerrar todos los dropdowns al cambiar de página
  useEffect(() => {
    setPortfolioDropdownOpen(false);
    setCalculatorDropdownOpen(false);
    setAnticiposDropdownOpen(false);
  }, [pathname]);

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

  // Funciones para manejar el dropdown - SOLUCIÓN RADICAL
  const handleMenuClick = (itemId: string) => {
    console.log(`🔍 [MENU] Click: ${itemId}, current: ${activeMenu}`);
    // Toggle: si ya está activo, lo cierra; si no, lo abre
    if (activeMenu === itemId) {
      setActiveMenu(null);
    } else {
      setActiveMenu(itemId);
    }
  };

  const handleMenuEnter = (itemId: string) => {
    console.log(`🔍 [MENU] Enter: ${itemId}`);
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
    setActiveMenu(itemId);
  };

  const handleMenuLeave = () => {
    console.log(`🔍 [MENU] Leave: setting timeout to close`);
    const timeout = setTimeout(() => {
      console.log(`🔍 [MENU] Timeout: closing menu`);
      setActiveMenu(null);
    }, 200); // Reducido a 200ms
    setMenuTimeout(timeout);
  };

  const handleDropdownEnter = () => {
    console.log(`🔍 [DROPDOWN] Enter`);
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
  };

  const handleDropdownLeave = () => {
    console.log(`🔍 [DROPDOWN] Leave`);
    const timeout = setTimeout(() => {
      console.log(`🔍 [DROPDOWN] Timeout: closing menu`);
      setActiveMenu(null);
    }, 100); // Delay muy corto
    setMenuTimeout(timeout);
  };

  // ===========================================
  // 🍎 APPLE.COM STYLE MENU STRUCTURE
  // ===========================================
  // Estado para el menú fijo
  const [menuItems, setMenuItems] = useState<Array<{
    id: string;
    label: string;
    href: string;
    subItems: Array<{label: string; href: string; icon?: React.ReactNode; description?: string}>;
  }>>([]);

  // Función para inicializar el menú una sola vez
  const initializeMenu = () => {
    if (!isClient) return;
    
    // Obtener el rol del usuario desde localStorage de forma segura
    let userRole = 'modelo';
    let userData = null;
    
    try {
      userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        userRole = parsed.role || 'modelo';
        // Establecer userInfo inmediatamente desde localStorage para no depender del fetch
        if (!userInfo && parsed?.id && parsed?.role) {
          setUserInfo({
            id: parsed.id,
            name: parsed.name || parsed.email?.split('@')[0] || 'Usuario',
            email: parsed.email || '',
            role: parsed.role,
            groups: parsed.groups || []
          });
        }
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
      userRole = 'modelo';
    }
    
    console.log('🔍 [MENU-INIT] User role:', userRole);

    // Menú base para todos los roles
    const baseItems: Array<{
      id: string;
      label: string;
      href: string;
      subItems: Array<{label: string; href: string; icon?: React.ReactNode; description?: string}>;
    }> = [
      {
        id: 'calculator',
        label: userRole === 'modelo' ? 'Mi Calculadora' : 'Gestión Calculadora',
        href: userRole === 'modelo' ? '/model/calculator' : '#',
        subItems: userRole === 'modelo' 
          ? [ { label: 'Ingresar Valores', href: '/model/calculator' } ]
          : []
      }
    ];

    // Agregar menú de anticipos para modelos
    if (userRole === 'modelo') {
      baseItems.push({
        id: 'anticipos',
        label: 'Mis Anticipos',
        href: '/model/anticipos/solicitar',
        subItems: [
          { label: 'Solicitar Anticipo', href: '/model/anticipos/solicitar' },
          { label: 'Mis Solicitudes', href: '/model/anticipos/solicitudes' },
          { label: 'Mi Historial', href: '/model/anticipos/historial' }
        ]
      });

      // Agregar Mi Portafolio para modelos
      baseItems.push({
        id: 'portafolio',
        label: 'Mi Portafolio',
        href: '/model/portafolio',
        subItems: []
      });
    }

    // Agregar opciones según el rol
    if (userRole === 'super_admin' || userRole === 'admin') {
      baseItems.unshift({
        id: 'users',
        label: 'Gestión Usuarios',
        href: '#',
        subItems: [
          { 
            label: 'Crear Usuario', 
            href: '/admin/users/create',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            ),
            description: 'Registra nuevos usuarios en el sistema'
          },
          { 
            label: 'Consultar Usuarios', 
        href: '/admin/users',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            description: 'Administra usuarios existentes'
          }
        ]
      });

      baseItems.push({
        id: 'anticipos',
        label: 'Gestión Anticipos',
        href: '#',
        subItems: [
          { 
            label: 'Solicitudes Pendientes', 
            href: '/admin/anticipos/pending',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            description: 'Revisa solicitudes por aprobar'
          },
          { 
            label: 'Historial Anticipos', 
            href: '/admin/anticipos/history',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
            description: 'Consulta el historial completo'
          }
        ]
      });

      baseItems.push({
        id: 'sedes',
        label: 'Gestión Sedes',
        href: '#',
        subItems: [
          { 
            label: 'Gestionar Sedes', 
            href: '/admin/sedes/gestionar',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ),
            description: 'Administra sedes y ubicaciones'
          },
          { 
            label: 'Portafolio Modelos', 
            href: '/admin/sedes/portafolio',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
            description: 'Gestiona portafolios por sede'
          },
          { 
            label: 'Dashboard Sedes', 
            href: '/admin/sedes/dashboard',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
            description: 'Vista general de todas las sedes'
          }
        ]
      });

      // Agregar opciones administrativas de calculadora
      const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
      if (calculatorIndex !== -1) {
        baseItems[calculatorIndex].subItems = [
          { 
            label: 'Definir RATES', 
            href: '/admin/rates',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
            description: 'Configura las tasas de conversión'
          },
          { 
            label: 'Configurar Calculadora', 
            href: '/admin/calculator/config',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            description: 'Configura parámetros del sistema'
          },
          { 
            label: 'Ver Calculadora Modelo', 
            href: '/admin/calculator/view-model',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ),
            description: 'Vista de la calculadora para modelos'
          }
        ];
      }
    }

    console.log('🔍 [MENU-INIT] Final menu items:', baseItems);
    setMenuItems(baseItems);
  };

  // Inicializar el menú solo una vez cuando el cliente esté listo
  useEffect(() => {
    if (isClient) {
      initializeMenu();
    }
  }, [isClient]);

  // Cargar información de usuario al montar
  useEffect(() => {
    if (isClient && !userInfo && !loadingUser) {
      loadUser();
    }
  }, [isClient]);

  // Comparación exacta y normalizada de rutas para subopciones
  const isExactPath = (a: string, b: string) => {
    const norm = (p: string) => p.replace(/\/+$/, '');
    return norm(a) === norm(b);
  };

  const isActive = (href: string) => {
    if (href === '#') return false;
    return pathname === href || pathname.startsWith(href + '/');
  };
  const isParentActive = (item: any) => {
    if (item.href !== '#') {
      return pathname === item.href || pathname.startsWith(item.href + '/');
    }
    return item.subItems?.some((subItem: any) => pathname === subItem.href || pathname.startsWith(subItem.href + '/'));
  };
  
  // Función para determinar si el dropdown debe mostrarse - SIMPLIFICADA
  const shouldShowDropdown = (item: any) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isActive = activeMenu === item.id;
    const shouldShow = hasSubItems && isActive;
    
    console.log(`🔍 [DROPDOWN] ${item.id}: hasSubItems=${hasSubItems}, isActive=${isActive}, shouldShow=${shouldShow}`);
    console.log(`🔍 [DROPDOWN] activeMenu=${activeMenu}, subItems=${item.subItems?.length || 0}`);
    
    return shouldShow;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Apple Style 2 Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-white/20 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/admin/dashboard" className="flex items-center space-x-3 group">
                <div className="w-9 h-9 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-md border border-white/20 group-hover:shadow-lg transition-all duration-300">
                  <span className="text-white font-bold text-sm tracking-wider">AIM</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent whitespace-nowrap">Sistema de Gestión</span>
                  <span className="text-xs text-gray-500 font-medium tracking-wide">Agencia Innova</span>
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

                  // Renderizar Mis Anticipos con el componente especial (solo para modelos)
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

                  // Renderizar otros items normalmente (solo para admins/super_admins)
                  // NOTA: Los items con componentes dedicados (calculator, anticipos, portafolio) 
                  // ya fueron renderizados arriba, este código solo maneja items administrativos
                  return (
                  <div
                    key={item.id}
                    className="relative"
                      onMouseEnter={() => handleMenuEnter(item.id)}
                      onMouseLeave={handleMenuLeave}
                      onClick={() => item.subItems && item.subItems.length > 0 && handleMenuClick(item.id)}
                    >
                      {item.href === '#' ? (
                        <span
                          className={`px-4 py-2 text-sm font-medium transition-all duration-300 ${item.subItems && item.subItems.length > 0 ? 'cursor-pointer' : 'cursor-default'} whitespace-nowrap rounded-lg hover:bg-white/60 hover:backdrop-blur-sm hover:shadow-sm ${
                            isParentActive(item) 
                              ? 'text-gray-900 bg-white/50 shadow-sm' 
                              : 'text-gray-700 hover:text-gray-900'
                          }`}
                        >
                          {item.label}
                        </span>
                      ) : (
                    <Link
                      href={item.href}
                          className={`px-4 py-2 text-sm font-medium transition-all duration-300 whitespace-nowrap rounded-lg hover:bg-white/60 hover:backdrop-blur-sm hover:shadow-sm ${
                        isActive(item.href) || isParentActive(item) 
                              ? 'text-gray-900 bg-white/50 shadow-sm' 
                              : 'text-gray-700 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </Link>
                      )}

                  {/* Dropdown Menu */}
                      {shouldShowDropdown(item) && (
                        <div
                          className="absolute top-full left-0 mt-2 w-80 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-xl z-50 animate-in slide-in-from-top-2 duration-200"
                          onMouseEnter={handleDropdownEnter}
                          onMouseLeave={handleDropdownLeave}
                        >
                          <div className="p-3">
                            <div className="mb-2">
                              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                {item.label}
                              </h3>
                            </div>
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                                className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg group ${
                                  isExactPath(pathname, subItem.href)
                                    ? 'bg-blue-50/80 text-blue-900 font-medium shadow-sm border border-blue-200/30'
                                    : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className={`flex-shrink-0 ${
                                    isExactPath(pathname, subItem.href) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                                  }`}>
                                    {subItem.icon || (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{subItem.label}</div>
                                    {subItem.description && (
                                      <div className={`text-xs ${
                                        isExactPath(pathname, subItem.href) ? 'text-blue-600' : 'text-gray-500'
                                      }`}>
                                        {subItem.description}
                                      </div>
                                    )}
                                  </div>
                                  {isExactPath(pathname, subItem.href) && (
                                    <div className="flex-shrink-0">
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                  );
                })
              ) : (
                <div className="text-gray-500 text-sm">Cargando menú...</div>
              )}
            </nav>

            {/* User Actions */}
            <div className="flex items-center space-x-3">
              <button className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-lg transition-all duration-200 hover:shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* User Button */}
              <div className="relative" ref={userPanelRef}>
                <button
                  onClick={() => {
                    setShowUserPanel((v) => !v);
                    if (!userInfo && !loadingUser) loadUser();
                  }}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg border border-white/30 hover:bg-white/60 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                    </svg>
                  </div>
                  <span className="hidden sm:block text-sm font-medium">Cuenta</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserPanel && (
                  <div className="absolute right-0 mt-3 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 z-50 animate-in slide-in-from-top-2 duration-200">
                    {loadingUser ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full mx-auto mb-2"></div>
                        <div className="text-xs text-gray-300">Cargando…</div>
                      </div>
                    ) : userInfo ? (
                      <div className="space-y-3">
                        {/* Header compacto */}
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-md bg-gray-700 text-white flex items-center justify-center shadow-sm">
                            <span className="text-sm font-semibold">{userInfo.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-100 truncate">{userInfo.name}</div>
                            <div className="text-xs text-gray-300 truncate">
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
                                  <span key={index} className="px-2 py-1 bg-gray-800 text-gray-300 rounded-md text-xs font-medium">
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
                              await supabase.auth.signOut();
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

      {/* ChatWidget para admin/super_admin/modelo */}
      {userInfo && (userInfo.role === 'admin' || userInfo.role === 'super_admin' || userInfo.role === 'modelo') && (
        <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
      )}
    </div>
  );
}