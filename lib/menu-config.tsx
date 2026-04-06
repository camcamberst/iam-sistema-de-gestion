"use client";

import React from 'react';

/**
 * 🍎 Definición de menú Apple Style 2 para AIM Sistema de Gestión
 * 
 * Extraído de app/admin/layout.tsx para reducir su tamaño.
 * Contiene la configuración de navegación por rol.
 */

// Tipado del menú
export interface SubMenuItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  subItems: SubMenuItem[];
}

export type UserRole = 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff' | 'gestor' | 'fotografia';

// =====================================================
// 🎨 Iconos SVG reutilizables para el menú
// =====================================================

const icons = {
  add: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  money: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  building: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  person: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  calculator: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  eye: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  history: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 1018 0 9 9 0 00-18 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
    </svg>
  ),
  box: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
};

// =====================================================
// 🍎 Generador de menú por rol
// =====================================================

export function buildMenuItems(userRole: UserRole): MenuItem[] {
  // --- GESTOR ---
  if (userRole === 'gestor') {
    return [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/gestor/dashboard',
        subItems: []
      },
      {
        id: 'gestion-agencia',
        label: 'Gestión Agencia',
        href: '#',
        subItems: [
          { label: 'Stats', href: '/gestor/gestion-agencia/stats', icon: icons.chart, description: 'Registrar ingresos exactos de modelos por período' },
          { label: 'Rates Históricas', href: '/gestor/gestion-agencia/rates-historicas', icon: icons.money, description: 'Configurar rates históricas para recalcular períodos pasados' }
        ]
      }
    ];
  }

  // --- FOTOGRAFIA ---
  if (userRole === 'fotografia') {
    return [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/fotografia/dashboard',
        subItems: []
      }
    ];
  }

  const baseItems: MenuItem[] = [
    {
      id: 'calculator',
      label: userRole === 'modelo' ? 'Mis Ingresos' : 'Gestión Calculadora',
      href: userRole === 'modelo' ? '/admin/model/calculator' : '#',
      subItems: userRole === 'modelo'
        ? [
            { label: 'Calculadora', href: '/admin/model/calculator' },
            { label: 'Mi Historial', href: '/admin/model/calculator/historial' }
          ]
        : []
    }
  ];

  // --- MODELO ---
  if (userRole === 'modelo') {
    baseItems.push({
      id: 'finanzas',
      label: 'Mis Servicios',
      href: '/admin/model/anticipos/solicitar',
      subItems: [
        { label: 'Mis Anticipos', href: '/admin/model/anticipos/solicitar' },
        { label: 'Mi Ahorro', href: '/admin/model/finanzas/ahorro' }
      ]
    });
    baseItems.push({
      id: 'portafolio',
      label: 'Mis Plataformas',
      href: '/admin/model/portafolio',
      subItems: []
    });
  }

  // --- ADMIN / SUPER_ADMIN ---
  if (userRole === 'super_admin' || userRole === 'admin') {
    // Gestión Usuarios
    baseItems.unshift({
      id: 'users',
      label: 'Gestión Usuarios',
      href: '#',
      subItems: [
        { label: 'Crear Usuario', href: '/admin/users/create', icon: icons.add, description: 'Registra nuevos usuarios en el sistema' },
        { label: 'Consultar Usuarios', href: '/admin/users', icon: icons.users, description: 'Administra usuarios existentes' }
      ]
    });

    // Gestión Finanzas
    baseItems.push({
      id: 'finanzas',
      label: 'Gestión Finanzas',
      href: '#',
      subItems: [
        { label: 'Solicitudes Pendientes', href: '/admin/anticipos/pending', icon: icons.clock, description: 'Revisa solicitudes de anticipos por aprobar' },
        { label: 'Gestión Ahorros', href: '/admin/finanzas/ahorros', icon: icons.money, description: 'Gestiona solicitudes de ahorro y retiros' }
      ]
    });

    // Gestión Agencia / Sedes
    const sedesSubItems: SubMenuItem[] = [
      { label: 'Gestionar Sedes', href: '/admin/sedes/gestionar', icon: icons.building, description: 'Administra sedes y ubicaciones' },
      { label: 'Portafolio Modelos', href: '/admin/sedes/portafolio', icon: icons.person, description: 'Gestiona portafolios por sede' },
      { label: 'Dashboard Sedes', href: '/admin/sedes/dashboard', icon: icons.chart, description: 'Vista general de todas las sedes' }
    ];

    if (userRole === 'super_admin') {
      sedesSubItems.push({ label: 'Gestionar Afiliados', href: '/admin/affiliates/gestionar', icon: icons.building, description: 'Administra estudios afiliados' });
    }

    baseItems.push({ id: 'sedes', label: 'Gestión Agencia', href: '#', subItems: sedesSubItems });

    // Opciones administrativas de calculadora
    const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
    if (calculatorIndex !== -1) {
      const calcSubItems: SubMenuItem[] = [
        { label: 'Definir RATES', href: '/admin/rates', icon: icons.calculator, description: 'Configura las tasas de conversión' }
      ];
      if (userRole === 'super_admin') {
        calcSubItems.push({ label: 'Gestionar Plataformas', href: '/admin/calculator/platforms', icon: icons.box, description: 'Administrar, crear, editar y eliminar plataformas' });
      }
      calcSubItems.push(
        { label: 'Configurar Calculadora', href: '/admin/calculator/config', icon: icons.settings, description: 'Configura parámetros del sistema' },
        { label: 'Ver Calculadora Modelo', href: '/admin/calculator/view-model', icon: icons.eye, description: 'Vista de la calculadora para modelos' },
        { label: 'Ver Historial Modelo', href: '/admin/calculator/historial-modelo', icon: icons.history, description: 'Historial de facturación por modelo' }
      );
      baseItems[calculatorIndex].subItems = calcSubItems;
    }
  }

  // --- SUPERADMIN_AFF ---
  if (userRole === 'superadmin_aff') {
    // Gestión Usuarios (de su estudio)
    baseItems.unshift({
      id: 'users',
      label: 'Gestión Usuarios',
      href: '#',
      subItems: [
        { label: 'Crear Usuario', href: '/admin/users/create', icon: icons.add, description: 'Registra nuevos usuarios en tu estudio' },
        { label: 'Consultar Usuarios', href: '/admin/users', icon: icons.users, description: 'Administra usuarios de tu estudio' }
      ]
    });

    // Gestión Finanzas (de su estudio)
    baseItems.push({
      id: 'finanzas',
      label: 'Gestión Finanzas',
      href: '#',
      subItems: [
        { label: 'Solicitudes Pendientes', href: '/admin/anticipos/pending', icon: icons.clock, description: 'Revisa solicitudes de anticipos' },
        { label: 'Gestión Ahorros', href: '/admin/finanzas/ahorros', icon: icons.money, description: 'Gestiona solicitudes de ahorro y retiros' }
      ]
    });

    // Gestión Sedes (de su estudio)
    baseItems.push({
      id: 'sedes',
      label: 'Gestión Sedes',
      href: '#',
      subItems: [
        { label: 'Gestionar Sedes', href: '/admin/sedes/gestionar', icon: icons.building, description: 'Administra sedes de tu estudio' },
        { label: 'Portafolio Modelos', href: '/admin/sedes/portafolio', icon: icons.person, description: 'Gestiona portafolios de tu estudio' },
        { label: 'Dashboard Sedes', href: '/admin/sedes/dashboard', icon: icons.chart, description: 'Vista general de las sedes de tu estudio' }
      ]
    });

    // Calculadora (de su estudio)
    const calculatorIndex = baseItems.findIndex(item => item.id === 'calculator');
    if (calculatorIndex !== -1) {
      baseItems[calculatorIndex].label = 'Gestión Calculadora';
      baseItems[calculatorIndex].subItems = [
        { label: 'Configurar Calculadora', href: '/admin/calculator/config', icon: icons.settings, description: 'Configura parámetros de tu estudio' },
        { label: 'Ver Calculadora Modelo', href: '/admin/calculator/view-model', icon: icons.eye, description: 'Vista de la calculadora para modelos' },
        { label: 'Ver Historial Modelo', href: '/admin/calculator/historial-modelo', icon: icons.history, description: 'Historial de facturación por modelo' }
      ];
    }
  }

  return baseItems;
}

// =====================================================
// 🔧 FUNCIÓN HELPER PARA OBTENER MENÚ POR ROL (Backward Compatibility)
// =====================================================

export function getMenuForRole(role: string): MenuItem[] {
  return buildMenuItems(role as UserRole);
}
