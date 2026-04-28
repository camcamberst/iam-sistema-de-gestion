"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import PortfolioDropdown from "@/components/PortfolioDropdown";
import CalculatorDropdown from "@/components/CalculatorDropdown";
import AnticiposDropdown from "@/components/AnticiposDropdown";
import { supabase } from '@/lib/supabase';
import { modernLogout } from '@/lib/auth-modern';
import { buildMenuItems, MenuItem, UserRole } from '@/lib/menu-config';
import dynamic from 'next/dynamic';

import ClientOnly from '@/components/ClientOnly';

const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false });
import ThemeToggle from '@/components/ThemeToggle';
import AvatarCropperModal from '@/components/ui/AvatarCropperModal';

import { GalenaProvider } from '@/contexts/GalenaContext';
import GalenaDynamicIsland from '@/components/GalenaDynamicIsland';
import GalenaBottomPlayer from '@/components/GalenaBottomPlayer';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false);
  const [calculatorDropdownOpen, setCalculatorDropdownOpen] = useState(false);
  const [anticiposDropdownOpen, setAnticiposDropdownOpen] = useState(false);
  // Estado separado para el menú móvil para evitar conflictos con los componentes de escritorio
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff' | string;
    groups: string[];
    avatar_url?: string;
  } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarFileToCrop, setAvatarFileToCrop] = useState<File | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);
  const [bottomSheetActive, setBottomSheetActive] = useState<string | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Estado para el Apple Dynamic Dock
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollYRef = useRef(0);

  // Cliente centralizado de Supabase

  // Manejar hidratación del cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Efecto Dynamic Glass Dock (Scroll tracker)
  useEffect(() => {
    if (!isClient) return;
    
    // Función debounce pasiva para evitar rebotes o jittering
    const handleScroll = () => {
      // En dispositivos móviles (< 768px), la barra superior siempre queda anclada
      if (window.innerWidth < 768) {
        setIsScrolled(false);
        return;
      }

      const currentScrollY = window.scrollY;
      
      // La barra se oculta de forma permanente al bajar de 50px de la pantalla
      if (currentScrollY > 50) {
        setIsScrolled(true);
      } else {
        // Solo reaparece cuando alcanzas físicamente la parte superior
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isClient]);

  // Cerrar todos los dropdowns al cambiar de página
  useEffect(() => {
    // Agregar un pequeño delay para asegurar que la navegación se complete
    const timer = setTimeout(() => {
      setPortfolioDropdownOpen(false);
      setCalculatorDropdownOpen(false);
      setAnticiposDropdownOpen(false);
      setBottomSheetActive(null);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [pathname]);

  // Prevenir scroll del body cuando el menú móvil o Action Sheet está abierto
  useEffect(() => {
    if (bottomSheetActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [bottomSheetActive]);

  // Escuchar estado de chat (unread count) desde el componente de chat
  useEffect(() => {
    const handleUnread = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.count === 'number') {
        setChatUnreadCount(customEvent.detail.count);
      }
    };
    window.addEventListener('aim-chat-unread-count', handleUnread);
    return () => window.removeEventListener('aim-chat-unread-count', handleUnread);
  }, []);

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

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userInfo) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen original no debe pesar más de 5MB.');
      return;
    }

    setAvatarFileToCrop(file);
    if (event.target) event.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!userInfo) return;
    try {
      setIsUploadingAvatar(true);
      
      // Intentar borrar la imagen anterior de supabase storage para no saturar
      if (userInfo.avatar_url) {
        try {
          const urlParts = userInfo.avatar_url.split('/');
          const oldFilename = urlParts[urlParts.length - 1];
          if (oldFilename) {
            await supabase.storage.from('avatars').remove([oldFilename]);
            console.log('Imagen anterior eliminada exitosamente');
          }
        } catch (delError) {
          console.error('No se pudo borrar imagen anterior:', delError);
        }
      }

      // La extension siempre sera jpg por el nuevo proceso de canvas a jpeg
      const fileName = `${userInfo.id}-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userInfo.id);

      if (updateError) throw updateError;

      setUserInfo(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      setAvatarFileToCrop(null);
      
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.avatar_url = avatarUrl;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch (e) {}

    } catch (error: any) {
      console.error('Error al procesar/subir avatar:', error);
      alert('Hubo un error al procesar tu foto.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
        .select('id,name,email,role,avatar_url')
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
        avatar_url: userRow?.avatar_url || null,
      });
    } finally {
      setLoadingUser(false);
    }
  };

  // Funciones para manejar el dropdown - SOLUCIÓN RADICAL
  const handleMenuClick = (itemId: string) => {
    // Toggle: si ya está activo, lo cierra; si no, lo abre
    if (activeMenu === itemId) {
      setActiveMenu(null);
    } else {
      setActiveMenu(itemId);
    }
  };

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
    }, 200); // Reducido a 200ms
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
    }, 100); // Delay muy corto
    setMenuTimeout(timeout);
  };

  // ===========================================
  // 🍎 APPLE.COM STYLE MENU STRUCTURE
  // ===========================================
  // Estado para el menú fijo
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);;

  // Función helper para obtener el rol del usuario (desde userInfo o localStorage)
  const getUserRole = (): 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff' => {
    if (userInfo?.role) {
      return userInfo.role as 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff';
    }
    
    if (!isClient) return 'modelo';
    
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        return (parsed.role || 'modelo') as 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff';
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
    }
    
    return 'modelo';
  };

  // Función para inicializar el menú (usa la config extraída en lib/menu-config.tsx)
  const initializeMenu = () => {
    if (!isClient) return;

    let userRole = getUserRole();

    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        userRole = parsed.role || 'modelo';
        if (!userInfo && parsed?.id && parsed?.role) {
          setUserInfo({
            id: parsed.id,
            name: parsed.name || parsed.email?.split('@')[0] || 'Usuario',
            email: parsed.email || '',
            role: parsed.role,
            groups: parsed.groups || [],
            avatar_url: parsed.avatar_url || null
          });
        }
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
      userRole = 'modelo';
    }

    setMenuItems(buildMenuItems(userRole as UserRole));
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
    
    return shouldShow;
  };

  // Para el historial embebido (iframe) queremos "full-bleed" visual (sin max-width ni padding),
  // para que no parezca una ventana dentro de otra.
  const isFullBleedHistorial =
    pathname.startsWith('/admin/model/calculator/historial') ||
    pathname.startsWith('/admin/calculator/historial-modelo');

  // Detectamos si estamos en una vista de modelo que usa el nuevo fondo dinámico
  const isModelDashboard = userInfo?.role === 'modelo' && (pathname === '/admin/dashboard' || pathname.startsWith('/admin/model'));
  const layoutBgClass = isModelDashboard 
    ? "min-h-screen bg-[#fbf9fa] dark:bg-[#060205]"
    : "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900";

  return (
    <GalenaProvider>
      <div className={layoutBgClass}>
      {/* Apple Glass Edge-to-Edge Header */}
      <header 
        className={`sticky top-0 z-[9999999] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolled ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        {/* Capa de cristal independiente para prevenir bug de stacking context en Chrome */}
        <div className={`absolute inset-0 pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isScrolled 
            ? 'bg-transparent backdrop-blur-none border-transparent dark:border-transparent shadow-none' 
            : 'bg-white/95 md:bg-white/70 dark:bg-[#0a0f1a]/90 md:dark:bg-[#0a0f1a]/70 backdrop-blur-xl border-b border-gray-200/80 dark:border-white/[0.05] shadow-[0_4px_20px_rgba(0,0,0,0.04)] md:shadow-none dark:shadow-none'
        }`} />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-10 md:px-12 lg:px-16 relative">
          <div className="flex items-center justify-between h-14 md:h-16 relative">
            {/* Logo */}
            <div className={`flex items-center flex-shrink-0 min-w-0 pr-2 sm:pr-4 z-50 bg-transparent transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled ? 'opacity-0 -translate-x-8 pointer-events-none' : 'opacity-100 translate-x-0 pointer-events-auto'
            }`}>
              <Link href={getUserRole() === 'modelo' ? '/admin/model/dashboard' : '/admin/dashboard'} className="flex items-center space-x-1 group">
                <div className="w-6 h-6 sm:w-7 md:w-8 sm:h-7 md:h-8 bg-[#0a0f1a] dark:bg-white rounded-[8px] md:rounded-[12px] flex items-center justify-center shadow-lg border border-white/10 dark:border-black/5 group-hover:scale-105 transition-all duration-300 flex-shrink-0">
                  <span className="text-white dark:text-[#0a0f1a] font-extrabold text-[9px] sm:text-[10px] md:text-[12px] tracking-wider">AIM</span>
                </div>
                <div className={`flex items-center space-x-0.5 sm:space-x-1 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
                  isScrolled 
                    ? 'max-w-0 opacity-0 -translate-x-4 pointer-events-none' 
                    : 'max-w-[200px] md:max-w-xs opacity-100 translate-x-0'
                }`}>
                  <span className="text-[#0a0f1a] dark:text-white font-medium text-base sm:text-lg md:text-2xl opacity-60 pb-0.5">|</span>
                  <div className="relative inline-flex items-center">
                    <span className="absolute text-[15px] sm:text-lg md:text-[22px] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 blur-[6px] opacity-70 dark:opacity-90 select-none pointer-events-none" aria-hidden="true">Aurora</span>
                    <span className="relative text-[15px] sm:text-lg md:text-[22px] font-black text-[#0a0f1a] dark:text-white tracking-tight whitespace-nowrap">Aurora</span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Galena Dynamic Island - Espacio Central Apple Style (Móvil/Tablet) */}
            <div className={`flex lg:hidden flex-1 items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto ${
              isScrolled ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
            }`}>
               <GalenaDynamicIsland />
            </div>

            {/* Retractable Menu Container (Dynamic Dock) */}
            <div className={`flex items-center justify-end flex-shrink-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isScrolled ? 'opacity-0 -translate-x-12 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}>
              {/* Main Navigation - Apple Style 2 (Oculto en móvil) */}
              <nav className="hidden md:flex items-center space-x-1 md:space-x-2 mr-1 md:mr-3">
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
                  if (item.id === 'calculator') {
                    return (
                      <CalculatorDropdown
                        key={item.id}
                        isActive={isActive(item.href)}
                        isOpen={calculatorDropdownOpen}
                        onToggle={() => setCalculatorDropdownOpen(!calculatorDropdownOpen)}
                      />
                    );
                  }

                  // Renderizar Mis Finanzas con el componente especial (solo para modelos)
                  if (item.id === 'finanzas') {
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
                          className={`px-4 py-2 text-sm transition-all duration-300 ${item.subItems && item.subItems.length > 0 ? 'cursor-pointer' : 'cursor-default'} whitespace-nowrap rounded-xl ${
                            isParentActive(item) 
                              ? 'font-semibold text-gray-900 dark:text-white bg-white/90 dark:bg-gray-800/80 shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/5 backdrop-blur-md' 
                              : 'font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          {item.label}
                        </span>
                      ) : (
                    <Link
                      href={item.href}
                          className={`px-4 py-2 text-sm transition-all duration-300 whitespace-nowrap rounded-xl ${
                        isActive(item.href) || isParentActive(item) 
                              ? 'font-semibold text-gray-900 dark:text-white bg-white/90 dark:bg-gray-800/80 shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)] border border-black/5 dark:border-white/5 backdrop-blur-md' 
                              : 'font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                      )}

                  {/* Dropdown Menu */}
                      {shouldShowDropdown(item) && (
                        <div
                          className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-xl z-[9999999] animate-in slide-in-from-top-2 duration-200"
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
                                    : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
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
            <div className={`flex items-center space-x-0.5 sm:space-x-1.5 md:space-x-3`}>
              {/* Botón Sexshop */}
              <Link
                href={getUserRole() === 'modelo' ? '/admin/model/shop' : '/admin/shop/orders'}
                className={`hidden md:flex p-2 md:p-2.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith('/admin/model/shop') || pathname.startsWith('/admin/shop')
                    ? 'font-semibold text-pink-700 dark:text-pink-300 bg-white/90 dark:bg-pink-900/60 shadow-[0_2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_10px_rgba(236,72,153,0.15)] border border-black/5 dark:border-pink-500/20 backdrop-blur-md'
                    : 'text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                }`}
                title="Sexshop"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </Link>

              
              {/* Theme Toggle */}
              <div className="scale-75 sm:scale-90 md:scale-100">
                <ThemeToggle />
              </div>
              {/* User Button - Solo icono en móvil */}
              <div className="relative" ref={userPanelRef}>
                <button
                  onClick={() => {
                    setShowUserPanel((v) => !v);
                    if (!userInfo && !loadingUser) loadUser();
                  }}
                  className="group flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-1 sm:p-1.5 md:pl-1.5 md:pr-3.5 md:py-1.5 rounded-full bg-white/60 dark:bg-gray-800/40 hover:bg-white/90 dark:hover:bg-gray-700/60 shadow-sm border border-gray-200/50 dark:border-white/10 backdrop-blur-md transition-all duration-300"
                >
                  <div className="w-5 h-5 sm:w-6 md:w-7 sm:h-6 md:h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-sm overflow-hidden relative group-hover:scale-105 transition-transform duration-300">
                    {userInfo?.avatar_url ? (
                      <img src={userInfo.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                    ) : (
                      <svg className="w-2.5 h-2.5 sm:w-3 md:w-4 sm:h-3 md:h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                      </svg>
                    )}
                  </div>
                  <span className="hidden md:block text-sm font-medium ml-2">Cuenta</span>
                  <svg className="hidden md:block w-4 h-4 text-gray-400 dark:text-gray-500 ml-1 transition-transform duration-300 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserPanel && (
                  <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white/80 dark:bg-[#0a0f1a]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-3 z-[9999999] animate-in slide-in-from-top-2 duration-300">
                    {loadingUser ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Autenticando…</div>
                      </div>
                    ) : userInfo ? (
                      <div className="space-y-3">
                        {/* Header Glassmórfico */}
                        <div className="flex items-center space-x-3 p-2 rounded-xl bg-gradient-to-br from-gray-100/50 to-white/30 dark:from-gray-800/50 dark:to-gray-900/30 border border-black/5 dark:border-white/5">
                          <div className="relative group w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex-shrink-0">
                            {userInfo.avatar_url ? (
                               <img src={userInfo.avatar_url} alt={userInfo.name} className="absolute inset-0 w-full h-full object-cover object-center" />
                            ) : (
                               <span className="text-base sm:text-lg font-bold drop-shadow-sm">{userInfo.name.charAt(0).toUpperCase()}</span>
                            )}
                            
                            {/* Hover Overlay for Upload */}
                            <label className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity z-10">
                              {isUploadingAvatar ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              )}
                              <input 
                                type="file" 
                                accept="image/jpeg,image/png,image/gif,image/webp" 
                                className="hidden"
                                disabled={isUploadingAvatar}
                                onChange={handleAvatarUpload}
                              />
                            </label>
                          </div>
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="text-sm sm:text-[15px] leading-tight font-semibold text-gray-900 dark:text-white truncate">{userInfo.name}</div>
                            <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 truncate mb-0.5">
                              {String(userInfo.role).replace('_',' ').toUpperCase()}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-none">
                              {userInfo.email}
                            </div>
                          </div>
                        </div>
                        
                        {/* Metadatos */}
                        <div className="px-1 space-y-2.5">
                          {userInfo.role !== 'super_admin' && userInfo.groups?.length > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500 dark:text-gray-400 font-medium">{userInfo.role === 'modelo' ? 'Grupo Activo' : 'Grupos'}</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {userInfo.groups.map((group: string, index: number) => (
                                  <span key={index} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-semibold tracking-wide border border-indigo-100 dark:border-indigo-500/20">
                                    {group}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">ID de Sesión</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(userInfo.id)}
                              className="group flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Copiar ID completo"
                            >
                              <span className="text-gray-600 dark:text-gray-300 font-mono text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
                                {userInfo.id.substring(0, 13)}...
                              </span>
                              <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Botón Logout Apple Style */}
                        <div className="pt-1.5">
                          <button
                            onClick={async () => {
                              await modernLogout();
                              setUserInfo(null);
                              location.href = '/';
                            }}
                            className="w-full px-4 py-2 rounded-xl bg-red-50/50 hover:bg-red-50 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 transition-all duration-300 font-semibold text-xs flex items-center justify-center space-x-2 group"
                          >
                            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Cerrar sesión</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2.5">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">Sesión Expirada</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button - Conservado mágicamente para acceso extra (si desean) pero oculto ya que usaremos tab bar, lo eliminamos. */}
            </div> {/* Fin Contenedor Retráctil */}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Apple/Rappi Style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[500] bg-white/95 dark:bg-[#0a0f1a]/80 dark:bg-gradient-to-t dark:from-[#05050a] dark:to-[#141226]/90 backdrop-blur-3xl rounded-t-[28px] border-t border-gray-200/90 dark:border-purple-500/30 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-10px_25px_rgba(168,85,247,0.15),inset_0_1px_0_rgba(255,255,255,0.05)] transition-transform duration-300 translate-y-0 group-[.keyboard-open]/body:translate-y-[150%]">
        <div className="flex items-center justify-between px-4 py-3.5">
          {/* Ingresos (Calculadora) */}
          <button 
            onClick={() => { const item = menuItems.find(i => i.id === 'calculator'); if (item && item.subItems?.length) setBottomSheetActive('calculator'); else router.push('/admin/model/calculator'); }}
            className={`relative flex flex-col items-center justify-center p-1 w-[20%] transition-transform active:scale-[0.85] ${(pathname.includes('calculator') || bottomSheetActive === 'calculator') ? 'text-[#0a0f1a] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {(pathname.includes('calculator') || bottomSheetActive === 'calculator') && (
              <div className="absolute m-auto w-7 h-7 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 blur-[6px] opacity-70 pointer-events-none"></div>
            )}
            <svg className="relative z-10 w-[24px] h-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>

          {/* Servicios (Finanzas/Anticipos) */}
          <button 
            onClick={() => { const item = menuItems.find(i => i.id === 'finanzas'); if (item && item.subItems?.length) setBottomSheetActive('finanzas'); else router.push('/admin/model/anticipos/solicitar'); }}
            className={`relative flex flex-col items-center justify-center p-1 w-[20%] transition-transform active:scale-[0.85] ${(pathname.includes('anticipos') || pathname.includes('finanzas') || bottomSheetActive === 'finanzas') ? 'text-[#0a0f1a] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {(pathname.includes('anticipos') || pathname.includes('finanzas') || bottomSheetActive === 'finanzas') && (
              <div className="absolute m-auto w-7 h-7 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 blur-[6px] opacity-70 pointer-events-none"></div>
            )}
            <svg className="relative z-10 w-[24px] h-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </button>

          {/* Asistente (Chat Integrado) */}
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-aim-chat'))}
            className={`relative flex flex-col items-center justify-center p-1 w-[20%] transition-transform active:scale-[0.85] ${chatUnreadCount > 0 ? 'text-[#0a0f1a] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {chatUnreadCount > 0 && (
              <div className="absolute m-auto w-7 h-7 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 blur-[6px] opacity-70 pointer-events-none"></div>
            )}
            <div className="relative z-10">
              <svg className="w-[24px] h-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {chatUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0a0f1a]">
                  {chatUnreadCount}
                </span>
              )}
            </div>
          </button>

          {/* Plataformas (Portafolio) */}
          <button 
            onClick={() => router.push('/admin/model/portafolio')}
            className={`relative flex flex-col items-center justify-center p-1 w-[20%] transition-transform active:scale-[0.85] ${pathname.includes('portafolio') ? 'text-[#0a0f1a] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {pathname.includes('portafolio') && (
              <div className="absolute m-auto w-7 h-7 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 blur-[6px] opacity-70 pointer-events-none"></div>
            )}
            <svg className="relative z-10 w-[24px] h-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </button>

          {/* Store (Sexshop) */}
          <button 
            onClick={() => router.push(getUserRole() === 'modelo' ? '/admin/model/shop' : '/admin/shop/orders')}
            className={`relative flex flex-col items-center justify-center p-1 w-[20%] transition-transform active:scale-[0.85] ${(pathname.includes('shop') || pathname.includes('store')) ? 'text-[#0a0f1a] dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            {(pathname.includes('shop') || pathname.includes('store')) && (
              <div className="absolute m-auto w-7 h-7 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-500 blur-[6px] opacity-70 pointer-events-none"></div>
            )}
            <svg className="relative z-10 w-[24px] h-[24px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Action Sheet (para submenús) */}
      {bottomSheetActive && (
        <div className="fixed inset-0 z-[9999999] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setBottomSheetActive(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0a0f1a]/95 backdrop-blur-3xl rounded-t-[32px] p-6 pb-12 animate-slide-up shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.5)] border-t border-black/5 dark:border-white/10">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6" />
            
            {/* Glowing Aurora Orbs Background for Sheet */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 dark:bg-fuchsia-600/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/10 dark:bg-blue-600/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative z-10">
              <h3 className="text-[22px] font-black text-gray-900 dark:text-white mb-5 tracking-tight px-2">
                {menuItems.find(i => i.id === bottomSheetActive)?.label || "Opciones"}
              </h3>
              <div className="space-y-3">
                {menuItems.find(i => i.id === bottomSheetActive)?.subItems?.map(sub => (
                  <button
                    key={sub.href}
                    onClick={() => { setBottomSheetActive(null); router.push(sub.href); }}
                    className="w-full flex items-center p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-300 active:scale-[0.98] shadow-sm group"
                  >
                    <div className={`p-2.5 rounded-xl mr-4 group-hover:scale-110 transition-transform ${bottomSheetActive === 'calculator' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                      {sub.icon || <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900 dark:text-white text-[15px]">{sub.label}</div>
                      {sub.description && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{sub.description}</div>}
                    </div>
                    <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setBottomSheetActive(null)} 
                className="w-full mt-6 py-4 rounded-2xl font-bold bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 transition-all active:scale-[0.98]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="min-h-screen pb-[68px] md:pb-0 transition-[padding] duration-300 group-[.keyboard-open]/body:pb-[350px] md:group-[.keyboard-open]/body:pb-0">
        <div
          className={
            isFullBleedHistorial
              ? 'max-w-none mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 w-full'
              : 'max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8'
          }
        >
          {children}
        </div>
      </main>

      {/* Galena Desktop Bottom Player (Spotify-Style) */}
      <GalenaBottomPlayer />

      {/* ChatWidget para admin/super_admin/modelo/superadmin_aff — oculto en la sexshop */}
      {!loadingUser && userInfo && isClient && (
        <>
          <ChatWidget 
            userId={userInfo.id}
            userRole={userInfo.role}
          />
          {avatarFileToCrop && (
            <AvatarCropperModal
              imageFile={avatarFileToCrop}
              onClose={() => setAvatarFileToCrop(null)}
              onCropComplete={handleCropComplete}
              isProcessing={isUploadingAvatar}
            />
          )}
        </>
      )}
    </div>
    </GalenaProvider>
  );
}