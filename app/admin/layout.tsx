"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | string;
    groups: string[];
  } | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  // Manejar hidratación del cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  // ===========================================
  // 🍎 APPLE.COM STYLE MENU STRUCTURE
  // ===========================================
  const getMenuItems = () => {
    // Obtener el rol del usuario desde localStorage de forma segura
    let userRole = 'modelo';
    let userData = null;
    
    if (isClient) {
      try {
        userData = localStorage.getItem('user');
        if (userData) {
          const parsed = JSON.parse(userData);
          userRole = parsed.role || 'modelo';
        }
      } catch (error) {
        console.warn('Error parsing user data from localStorage:', error);
        userRole = 'modelo';
      }
    }
    
    console.log('🔍 [MENU] User role:', userRole);
    console.log('🔍 [MENU] User data:', userData);

    // Menú base para todos los roles
    const baseItems: Array<{
      id: string;
      label: string;
      href: string;
      subItems: Array<{label: string; href: string}>;
    }> = [
      {
        id: 'calculator',
        label: userRole === 'modelo' ? 'Mi Calculadora' : 'Gestión Calculadora',
        href: userRole === 'modelo' ? '#' : '#', // Sin navegación directa
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
        href: '#', // Sin navegación directa
        subItems: [
          { label: 'Solicitar Anticipo', href: '/model/anticipos/solicitar' },
          { label: 'Mis Solicitudes', href: '/model/anticipos/solicitudes' },
          { label: 'Mi Historial', href: '/model/anticipos/historial' }
        ]
      });
    }

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
          { label: 'Asignaciones', href: '/admin/sedes/asignaciones' },
          { label: 'Dashboard Sedes', href: '/admin/sedes/dashboard' }
        ]
      });


      // Agregar opciones administrativas de calculadora SOLO para admins/super_admins
      const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
      if (calculatorIndex !== -1) {
        baseItems[calculatorIndex].subItems = [
          { label: 'Definir RATES', href: '/admin/rates' },
          { label: 'Configurar Calculadora', href: '/admin/calculator/config' },
          { label: 'Ver Calculadora Modelo', href: '/admin/calculator/view-model' }
        ];
      }
    }

    console.log('🔍 [MENU] Final menu items:', baseItems);
    return baseItems;
  };

  const menuItems = getMenuItems();
  
  // Debug logs
  console.log('🔍 [RENDER] Menu items length:', menuItems.length);
  console.log('🔍 [RENDER] Menu items:', menuItems);

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => item.subItems?.some((subItem: any) => pathname === subItem.href);

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
                menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => handleMenuEnter(item.id)}
                    onMouseLeave={handleMenuLeave}
                  >
                    {item.href === '#' ? (
                      <span
                        className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-default whitespace-nowrap rounded-lg hover:bg-white/60 hover:backdrop-blur-sm hover:shadow-sm ${
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
                  {activeMenu === item.id && (
                    <div 
                      className="absolute top-full left-0 mt-2 w-72 bg-white/90 backdrop-blur-md border border-white/30 rounded-xl shadow-xl z-50 animate-in slide-in-from-top-2 duration-200"
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
                                : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
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
              <div className="relative">
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
                  <div className="absolute right-0 mt-3 w-80 bg-white/90 backdrop-blur-md border border-white/30 rounded-xl shadow-xl p-5 z-50 animate-in slide-in-from-top-2 duration-200">
                    {loadingUser ? (
                      <div className="text-sm text-gray-500 text-center py-4">Cargando información…</div>
                    ) : userInfo ? (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900">{userInfo.name}</div>
                            <div className="text-xs text-gray-600">{userInfo.email}</div>
                          </div>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">ID:</span>
                            <span className="text-gray-700 font-mono">{userInfo.id.slice(0, 8)}...</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rol:</span>
                            <span className="text-gray-700 font-medium capitalize">{String(userInfo.role).replace('_',' ')}</span>
                          </div>
                          {userInfo.role !== 'super_admin' && userInfo.groups?.length > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Grupos:</span>
                              <span className="text-gray-700">{userInfo.groups.join(', ')}</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-3 border-t border-gray-200/50">
                          <button
                            onClick={async () => {
                              await supabase.auth.signOut();
                              setUserInfo(null);
                              location.href = '/';
                            }}
                            className="w-full px-4 py-2.5 text-sm rounded-lg bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50 text-red-700 hover:from-red-100 hover:to-rose-100 hover:shadow-sm transition-all duration-200 font-medium"
                          >
                            Cerrar sesión
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 text-center py-4">No autenticado</div>
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
    </div>
  );
}