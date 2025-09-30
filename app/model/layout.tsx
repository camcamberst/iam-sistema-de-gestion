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

export default function ModelLayout({
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
        
        // Verificar que sea modelo
        if (parsedUser.role !== 'modelo') {
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
        id: 'calculator',
        label: 'Mi Calculadora',
        href: '/model/dashboard',
        subItems: []
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
