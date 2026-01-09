"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import PortfolioDropdown from "@/components/PortfolioDropdown";
import CalculatorDropdown from "@/components/CalculatorDropdown";
import AnticiposDropdown from "@/components/AnticiposDropdown";
import { supabase } from '@/lib/supabase';
import { modernLogout } from '@/lib/auth-modern';
import dynamic from 'next/dynamic';

import ClientOnly from '@/components/ClientOnly';

const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false });
import ThemeToggle from '@/components/ThemeToggle';

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
  const [mobileCalculatorDropdownOpen, setMobileCalculatorDropdownOpen] = useState(false);
  const [mobileAnticiposDropdownOpen, setMobileAnticiposDropdownOpen] = useState(false);
  const [mobilePortfolioDropdownOpen, setMobilePortfolioDropdownOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff' | string;
    groups: string[];
  } | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileItems, setExpandedMobileItems] = useState<Set<string>>(new Set());

  // Cliente centralizado de Supabase

  // Manejar hidratación del cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Cerrar todos los dropdowns al cambiar de página
  useEffect(() => {
    // Agregar un pequeño delay para asegurar que la navegación se complete
    const timer = setTimeout(() => {
      setPortfolioDropdownOpen(false);
      setCalculatorDropdownOpen(false);
      setAnticiposDropdownOpen(false);
      // Cerrar también los dropdowns del menú móvil
      setMobilePortfolioDropdownOpen(false);
      setMobileCalculatorDropdownOpen(false);
      setMobileAnticiposDropdownOpen(false);
      setMobileMenuOpen(false); // Cerrar menú móvil al navegar
    }, 100);
    
    return () => clearTimeout(timer);
  }, [pathname]);

  // Prevenir scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

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

  // Función para inicializar el menú una sola vez
  const initializeMenu = () => {
    if (!isClient) return;
    
    // Obtener el rol del usuario desde localStorage de forma segura
    let userRole = getUserRole();
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
        href: userRole === 'modelo' ? '/admin/model/calculator' : '#',
        subItems: userRole === 'modelo'
          ? [ { label: 'Ingresar Valores', href: '/admin/model/calculator' } ]
          : []
      }
    ];

    // Agregar menú de anticipos para modelos
    if (userRole === 'modelo') {
      baseItems.push({
        id: 'anticipos',
        label: 'Mis Anticipos',
        href: '/admin/model/anticipos/solicitar',
        subItems: [
          { label: 'Solicitar Anticipo', href: '/admin/model/anticipos/solicitar' },
          { label: 'Mis Solicitudes', href: '/admin/model/anticipos/solicitudes' },
          { label: 'Mi Historial', href: '/admin/model/anticipos/historial' }
        ]
      });

      // Agregar Mi Portafolio para modelos
      baseItems.push({
        id: 'portafolio',
        label: 'Mi Portafolio',
        href: '/admin/model/portafolio',
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

      // Mostrar "Gestión Agencia" para todos los usuarios (los límites se aplican en las páginas)
      const sedesSubItems = [
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
      ];

      // Agregar "Gestionar Afiliados" solo para super_admin
      if (userRole === 'super_admin') {
        sedesSubItems.push({
          label: 'Gestionar Afiliados',
          href: '/admin/affiliates/gestionar',
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          description: 'Administra estudios afiliados'
        });
      }

      baseItems.push({
        id: 'sedes',
        label: 'Gestión Agencia',
        href: '#',
        subItems: sedesSubItems
      });

      // Agregar opciones administrativas de calculadora
      const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
      if (calculatorIndex !== -1) {
        const calculatorSubItems: Array<{label: string; href: string; icon?: React.ReactNode; description?: string}> = [
          { 
            label: 'Definir RATES', 
            href: '/admin/rates',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
            description: 'Configura las tasas de conversión'
          }
        ];

        // Agregar "Gestionar Plataformas" solo para super_admin
        if (userRole === 'super_admin') {
          calculatorSubItems.push({
            label: 'Gestionar Plataformas',
            href: '/admin/calculator/platforms',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            ),
            description: 'Administrar, crear, editar y eliminar plataformas'
          });
        }

        calculatorSubItems.push(
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
        );

        baseItems[calculatorIndex].subItems = calculatorSubItems;
      }
    }

    // Agregar menú completo para superadmin_aff (gestión de su estudio afiliado)
    if (userRole === 'superadmin_aff') {
      // Gestión Usuarios (solo de su estudio)
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
            description: 'Registra nuevos usuarios en tu estudio'
          },
          { 
            label: 'Consultar Usuarios', 
            href: '/admin/users',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            description: 'Administra usuarios de tu estudio'
          }
        ]
      });

      // Gestión Anticipos (solo de su estudio)
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
            description: 'Revisa solicitudes de tu estudio'
          },
          { 
            label: 'Historial Anticipos', 
            href: '/admin/anticipos/history',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            ),
            description: 'Consulta el historial de tu estudio'
          }
        ]
      });

      // Gestión Sedes (solo de su estudio)
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
            description: 'Administra sedes de tu estudio'
          },
          { 
            label: 'Portafolio Modelos', 
            href: '/admin/sedes/portafolio',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
            description: 'Gestiona portafolios de tu estudio'
          },
          { 
            label: 'Dashboard Sedes', 
            href: '/admin/sedes/dashboard',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ),
            description: 'Vista general de las sedes de tu estudio'
          }
        ]
      });

      // Gestión Calculadora (solo de su estudio)
      const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
      if (calculatorIndex !== -1) {
        baseItems[calculatorIndex].label = 'Gestión Calculadora';
        baseItems[calculatorIndex].subItems = [
          { 
            label: 'Definir RATES', 
            href: '/admin/rates',
            icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ),
            description: 'Configura las tasas de conversión de tu estudio'
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
            description: 'Configura parámetros de tu estudio'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Apple Style 2 Header */}
      <header className="bg-white dark:bg-gray-900 backdrop-blur-md border border-white/20 dark:border-gray-700/30 sticky top-0 z-[9999999] shadow-lg dark:shadow-lg dark:shadow-green-900/15 dark:ring-0.5 dark:ring-green-400/20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <div className="flex items-center flex-1 min-w-0 pr-1 sm:pr-0">
              <Link href={getUserRole() === 'modelo' ? '/admin/model/dashboard' : '/admin/dashboard'} className="flex items-center space-x-1 sm:space-x-1.5 md:space-x-3 group">
                <div className="w-6 h-6 sm:w-7 md:w-9 sm:h-7 md:h-9 bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300 rounded-md sm:rounded-lg md:rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-700/30 group-hover:shadow-lg transition-all duration-300 flex-shrink-0">
                  <span className="text-white dark:text-gray-900 font-bold text-[9px] sm:text-[10px] md:text-sm tracking-wider">AIM</span>
                </div>
                <div className="flex flex-col min-w-0 hidden sm:flex">
                  <span className="text-xs sm:text-sm md:text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent truncate leading-tight">Sistema de Gestión</span>
                  <span className="hidden md:block text-xs text-gray-600 dark:text-gray-300 font-medium tracking-wide">Agencia Innova</span>
                </div>
              </Link>
            </div>

            {/* Main Navigation - Apple Style 2 (Oculto en móvil) */}
            <nav className="hidden md:flex items-center space-x-6">
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
                          className={`px-4 py-2 text-sm font-medium transition-all duration-300 ${item.subItems && item.subItems.length > 0 ? 'cursor-pointer' : 'cursor-default'} whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm ${
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

            {/* User Actions (Oculto en móvil cuando el menú está abierto) */}
            <div className={`flex items-center space-x-1 sm:space-x-1.5 md:space-x-3 ${mobileMenuOpen ? 'hidden' : 'flex'}`}>
              {/* Botón de búsqueda - Oculto en móvil */}
              <button className="hidden md:flex p-2 md:p-2.5 text-gray-600 hover:text-gray-900 hover:bg-white/60 rounded-lg transition-all duration-200 hover:shadow-sm">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              
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
                  className="flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 p-1 sm:p-1.5 md:px-3 md:py-2 rounded-lg border border-white/20 dark:border-gray-700/30 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                >
                  <div className="w-5 h-5 sm:w-6 md:w-7 sm:h-6 md:h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-sm">
                    <svg className="w-2.5 h-2.5 sm:w-3 md:w-4 sm:h-3 md:h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                    </svg>
                  </div>
                  <span className="hidden md:block text-sm font-medium ml-2">Cuenta</span>
                  <svg className="hidden md:block w-4 h-4 text-gray-400 dark:text-gray-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserPanel && (
                  <div className="absolute right-0 mt-3 w-64 sm:w-72 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-white/30 dark:border-gray-700/30 rounded-lg shadow-xl p-3 sm:p-4 z-[9999999] animate-in slide-in-from-top-2 duration-200">
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
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 flex-shrink-0"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop - Deshabilitado cuando hay un dropdown abierto */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999998] md:hidden"
            onClick={(e) => {
              // Solo cerrar si el clic fue directamente en el backdrop Y no hay dropdowns abiertos
              if (e.target === e.currentTarget && !mobileCalculatorDropdownOpen && !mobileAnticiposDropdownOpen && !mobilePortfolioDropdownOpen && !calculatorDropdownOpen && !anticiposDropdownOpen && !portfolioDropdownOpen) {
                setMobileMenuOpen(false);
              }
            }}
            style={{ 
              pointerEvents: (mobileCalculatorDropdownOpen || mobileAnticiposDropdownOpen || mobilePortfolioDropdownOpen || calculatorDropdownOpen || anticiposDropdownOpen || portfolioDropdownOpen) ? 'none' : 'auto' 
            }}
          />
          {/* Mobile Menu Drawer */}
          <div 
            className="fixed top-14 md:top-16 left-0 right-0 bottom-0 bg-white dark:bg-gray-900 z-[9999999] md:hidden overflow-y-auto animate-in slide-in-from-top-2 duration-300"
            onClick={(e) => {
              // Prevenir que los clics dentro del drawer cierren el menú
              e.stopPropagation();
            }}
          >
            <div className="p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
              {menuItems.length > 0 ? (
                menuItems.map((item) => {
                  const isExpanded = expandedMobileItems.has(item.id);
                  
                  // Renderizar Mi Portafolio
                  if (item.id === 'portafolio') {
                    return (
                      <div key={item.id} className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                        <button
                          onClick={(e) => {
                            // Solo toggle si el clic NO fue en una sub opción
                            const target = e.target as HTMLElement;
                            if (!target.closest('.sub-menu-item')) {
                              e.stopPropagation();
                              setMobilePortfolioDropdownOpen(!mobilePortfolioDropdownOpen);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                            isActive(item.href) || mobilePortfolioDropdownOpen
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className="font-medium">{item.label}</span>
                          <svg
                            className={`w-5 h-5 transition-transform ${mobilePortfolioDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {mobilePortfolioDropdownOpen && (
                          <div 
                            className="mt-2 ml-4 space-y-1 sub-menu-container" 
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Link
                              href="/admin/model/portafolio"
                              onClick={(e) => {
                                // Detener TODA la propagación
                                e.stopPropagation();
                                e.preventDefault();
                                console.log('🔍 [MENU] Click en sub opción (Link): Mi Portafolio');
                                
                                // Navegar manualmente después de un pequeño delay para asegurar que el evento se procese
                                setTimeout(() => {
                                  router.push('/admin/model/portafolio');
                                }, 10);
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                              }}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                // Navegar en touch también
                                setTimeout(() => {
                                  router.push('/admin/model/portafolio');
                                }, 10);
                              }}
                              className="sub-menu-item w-full text-left block px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer touch-manipulation"
                            >
                              Mi Portafolio
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Renderizar Mi Calculadora
                  if (item.id === 'calculator' && item.label === 'Mi Calculadora') {
                    return (
                      <div 
                        key={item.id} 
                        className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2"
                        onClick={(e) => {
                          // Prevenir que clics en el contenedor cierren el dropdown
                          e.stopPropagation();
                        }}
                      >
                        <button
                          onClick={(e) => {
                            // Solo toggle si el clic NO fue en una sub opción
                            const target = e.target as HTMLElement;
                            if (!target.closest('.sub-menu-item') && !target.closest('.sub-menu-container')) {
                              e.stopPropagation();
                              setMobileCalculatorDropdownOpen(!mobileCalculatorDropdownOpen);
                            }
                          }}
                          onMouseDown={(e) => {
                            const target = e.target as HTMLElement;
                            if (!target.closest('.sub-menu-item') && !target.closest('.sub-menu-container')) {
                              e.stopPropagation();
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                            isActive(item.href) || mobileCalculatorDropdownOpen
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className="font-medium">{item.label}</span>
                          <svg
                            className={`w-5 h-5 transition-transform ${mobileCalculatorDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {mobileCalculatorDropdownOpen && (
                          <div 
                            className="mt-2 ml-4 space-y-1 sub-menu-container" 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={(e) => {
                                  // Detener TODA la propagación
                                  e.stopPropagation();
                                  e.preventDefault();
                                  console.log('🔍 [MENU] Click en sub opción (Link):', subItem.label, subItem.href);
                                  
                                  // Navegar manualmente después de un pequeño delay para asegurar que el evento se procese
                                  setTimeout(() => {
                                    router.push(subItem.href);
                                  }, 10);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  // Navegar en touch también
                                  setTimeout(() => {
                                    router.push(subItem.href);
                                  }, 10);
                                }}
                                className={`sub-menu-item w-full text-left block px-4 py-2 text-sm rounded-lg transition-all cursor-pointer touch-manipulation ${
                                  isActive(subItem.href)
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Renderizar Mis Anticipos
                  if (item.id === 'anticipos' && item.label === 'Mis Anticipos') {
                    return (
                      <div key={item.id} className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                        <button
                          onClick={(e) => {
                            // Solo toggle si el clic NO fue en una sub opción
                            const target = e.target as HTMLElement;
                            if (!target.closest('.sub-menu-item')) {
                              e.stopPropagation();
                              setMobileAnticiposDropdownOpen(!mobileAnticiposDropdownOpen);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                            isActive(item.href) || mobileAnticiposDropdownOpen
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span className="font-medium">{item.label}</span>
                          <svg
                            className={`w-5 h-5 transition-transform ${mobileAnticiposDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {mobileAnticiposDropdownOpen && (
                          <div 
                            className="mt-2 ml-4 space-y-1 sub-menu-container" 
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            onTouchEnd={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                onClick={(e) => {
                                  // Detener TODA la propagación
                                  e.stopPropagation();
                                  e.preventDefault();
                                  console.log('🔍 [MENU] Click en sub opción (Link):', subItem.label, subItem.href);
                                  
                                  // Navegar manualmente después de un pequeño delay para asegurar que el evento se procese
                                  setTimeout(() => {
                                    router.push(subItem.href);
                                  }, 10);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                }}
                                onTouchEnd={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  // Navegar en touch también
                                  setTimeout(() => {
                                    router.push(subItem.href);
                                  }, 10);
                                }}
                                className={`sub-menu-item w-full text-left block px-4 py-2 text-sm rounded-lg transition-all cursor-pointer touch-manipulation ${
                                  isActive(subItem.href)
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Renderizar otros items administrativos
                  return (
                    <div key={item.id} className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                      {item.href === '#' ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.subItems && item.subItems.length > 0) {
                                const newExpanded = new Set(expandedMobileItems);
                                if (newExpanded.has(item.id)) {
                                  newExpanded.delete(item.id);
                                } else {
                                  newExpanded.add(item.id);
                                }
                                setExpandedMobileItems(newExpanded);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                              isParentActive(item)
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span className="font-medium">{item.label}</span>
                            {item.subItems && item.subItems.length > 0 && (
                              <svg
                                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {isExpanded && item.subItems && item.subItems.length > 0 && (
                            <div className="mt-2 ml-4 space-y-1" onClick={(e) => e.stopPropagation()}>
                              {item.subItems.map((subItem) => (
                                <button
                                  key={subItem.href}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Cerrar todos los dropdowns
                                    setCalculatorDropdownOpen(false);
                                    setAnticiposDropdownOpen(false);
                                    setPortfolioDropdownOpen(false);
                                    // Navegar usando router
                                    router.push(subItem.href);
                                    // El useEffect detectará el cambio de pathname y cerrará el menú
                                  }}
                                  className={`w-full text-left block px-4 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                                    isActive(subItem.href)
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2">
                                    {subItem.icon && <span className="flex-shrink-0">{subItem.icon}</span>}
                                    <div className="flex-1">
                                      <div>{subItem.label}</div>
                                      {subItem.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                          {subItem.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          href={item.href}
                          className={`block px-4 py-3 rounded-lg transition-all duration-200 ${
                            isActive(item.href)
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-sm px-4 py-3">Cargando menú...</div>
              )}
              
              {/* User Info en móvil */}
              {userInfo && (
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center">
                        <span className="text-sm font-semibold">{userInfo.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {userInfo.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{userInfo.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await modernLogout();
                        setUserInfo(null);
                        setMobileMenuOpen(false);
                        location.href = '/';
                      }}
                      className="w-full px-4 py-2 text-sm rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          {children}
        </div>
      </main>

      {/* ChatWidget para admin/super_admin/modelo */}
      {userInfo && (userInfo.role === 'admin' || userInfo.role === 'super_admin' || userInfo.role === 'modelo') && (
        <ClientOnly>
          <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
        </ClientOnly>
      )}
    </div>
  );
}