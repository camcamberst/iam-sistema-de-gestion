'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AppleSidebar from '../../components/AppleSidebar';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo';
  groups: string[];
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (!userData) {
          router.push('/login');
          return;
        }

        const parsedUser = JSON.parse(userData);
        
        // Verificar que sea super_admin
        if (parsedUser.role !== 'super_admin') {
          router.push('/login');
          return;
        }

        setUser(parsedUser);
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const getMenuItems = () => {
    return [
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
          { label: 'Reportes de Actividad', href: '/admin/reports/activity' }
        ]
      },
      {
        id: 'settings',
        label: 'Configuración',
        href: '/admin/settings',
        subItems: [
          { label: 'Configuración General', href: '/admin/settings/general' },
          { label: 'Configuración de Sistema', href: '/admin/settings/system' }
        ]
      },
      {
        id: 'calculator',
        label: 'Gestionar Calculadora',
        href: '/admin/calculadora',
        subItems: [
          { label: 'Panel Calculadora', href: '/admin/calculadora' },
          { label: 'Definir RATES', href: '/admin/rates' },
          { label: 'Configurar Calculadora', href: '/admin/calculator/config' },
          { label: 'Ver Calculadora Modelo', href: '/admin/calculator/view' }
        ]
      }
    ];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <AppleSidebar 
        user={user}
        menuItems={getMenuItems()}
        currentPath={pathname}
      />
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
}
