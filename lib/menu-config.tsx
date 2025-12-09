import React from 'react';

// =====================================================
// 🍎 CONFIGURACIÓN DE MENÚS POR ROL
// =====================================================
// Sistema centralizado para gestionar menús según roles
// Permite agregar nuevos roles sin modificar layouts
// =====================================================

export interface MenuSubItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  subItems: MenuSubItem[];
}

export type Role = 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia';

// =====================================================
// 📋 CONFIGURACIÓN DE MENÚS POR ROL
// =====================================================

const modeloMenu: MenuItem[] = [
  {
    id: 'calculator',
    label: 'Mi Calculadora',
    href: '/admin/model/calculator',
    subItems: [
      { label: 'Ingresar Valores', href: '/admin/model/calculator' }
    ]
  },
  {
    id: 'anticipos',
    label: 'Mis Anticipos',
    href: '/admin/model/anticipos/solicitar',
    subItems: [
      { label: 'Solicitar Anticipo', href: '/admin/model/anticipos/solicitar' },
      { label: 'Mis Solicitudes', href: '/admin/model/anticipos/solicitudes' },
      { label: 'Mi Historial', href: '/admin/model/anticipos/historial' }
    ]
  },
  {
    id: 'portafolio',
    label: 'Mi Portafolio',
    href: '/admin/model/portafolio',
    subItems: []
  }
];

const adminMenu: MenuItem[] = [
  {
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
  },
  {
    id: 'calculator',
    label: 'Gestión Calculadora',
    href: '#',
    subItems: [
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
        label: 'Crear Plataforma', 
        href: '/admin/calculator/create-platform',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
        description: 'Crear nueva plataforma para el sistema',
        requiresSuperAdmin: true
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
    ]
  },
  {
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
  },
  {
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
  }
];

const superAdminMenu: MenuItem[] = [
  // Super Admin tiene acceso a todo lo de admin, más opciones adicionales si las hay
  ...adminMenu
  // Aquí puedes agregar opciones exclusivas de super admin si las necesitas
];

// =====================================================
// 🎯 MENÚS PARA NUEVOS ROLES
// =====================================================
// TODO: Definir los menús específicos para gestor y fotografia
// Por ahora, dejamos plantillas vacías que puedes completar

const gestorMenu: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/gestor/dashboard',
    subItems: []
  }
  // TODO: Agregar más opciones de menú según las funcionalidades específicas
];

const fotografiaMenu: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/fotografia/dashboard',
    subItems: []
  }
  // TODO: Agregar más opciones de menú según las funcionalidades específicas
];

// =====================================================
// 📊 MAPA DE MENÚS POR ROL
// =====================================================

export const MENU_CONFIG: Record<Role, MenuItem[]> = {
  'super_admin': superAdminMenu,
  'admin': adminMenu,
  'modelo': modeloMenu,
  'gestor': gestorMenu,
  'fotografia': fotografiaMenu
};

// =====================================================
// 🔧 FUNCIÓN HELPER PARA OBTENER MENÚ POR ROL
// =====================================================

export function getMenuForRole(role: string): MenuItem[] {
  // Validar que el rol existe en la configuración
  const validRole = role as Role;
  if (MENU_CONFIG[validRole]) {
    return MENU_CONFIG[validRole];
  }
  
  // Fallback: si el rol no existe, retornar menú de modelo (más restrictivo)
  console.warn(`⚠️ [MENU-CONFIG] Rol "${role}" no encontrado, usando menú de modelo por defecto`);
  return MENU_CONFIG['modelo'];
}

// =====================================================
// ✅ VALIDACIÓN DE ROLES
// =====================================================

export function isValidRole(role: string): role is Role {
  return role in MENU_CONFIG;
}

