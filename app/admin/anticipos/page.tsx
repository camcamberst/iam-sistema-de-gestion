'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@supabase/supabase-js";

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

export default function GestionAnticiposPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // Load current user
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setUser(null);
          setLoading(false);
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
        
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'admin',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        
        setUser(current);
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-16">
        <div className="relative bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-8 max-w-md">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 mb-2">Acceso Denegado</h1>
            <p className="text-sm text-gray-600">Solo administradores pueden acceder a esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-10">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Gestión de Anticipos</h1>
                  <p className="text-sm text-gray-600 mt-1">Administra las solicitudes de anticipo del sistema</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Solicitudes Pendientes */}
          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-4 hover:shadow-lg transition-all duration-300 flex flex-col h-full group">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Solicitudes Pendientes</h3>
            <p className="text-gray-500 text-xs mb-3 flex-grow">
              Revisa y gestiona las solicitudes pendientes de aprobación
            </p>
            <div className="w-full px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all duration-300 mt-auto text-center cursor-default text-xs shadow-md group-hover:shadow-lg transform group-hover:scale-105">
              Gestionar Solicitudes
            </div>
          </div>

          {/* Historial de Anticipos */}
          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-4 hover:shadow-lg transition-all duration-300 flex flex-col h-full group">
            <div className="flex items-center mb-3">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Historial de Anticipos</h3>
            <p className="text-gray-500 text-xs mb-3 flex-grow">
              Consulta el historial completo de anticipos procesados
            </p>
            <div className="w-full px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 mt-auto text-center cursor-default text-xs shadow-md group-hover:shadow-lg transform group-hover:scale-105">
              Ver Historial
            </div>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="mt-6 relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-4">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded flex items-center justify-center">
              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Resumen del Sistema</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="text-center p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 shadow-sm">
              <div className="text-base font-bold text-gray-900">-</div>
              <div className="text-xs text-gray-500 font-medium">Solicitudes Pendientes</div>
            </div>
            <div className="text-center p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 shadow-sm">
              <div className="text-base font-bold text-gray-900">-</div>
              <div className="text-xs text-gray-500 font-medium">Solicitudes Aprobadas</div>
            </div>
            <div className="text-center p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 shadow-sm">
              <div className="text-base font-bold text-gray-900">-</div>
              <div className="text-xs text-gray-500 font-medium">Total Procesadas</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
