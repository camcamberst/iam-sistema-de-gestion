'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BillingSummary from '@/components/BillingSummary';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function HistorialFacturacionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('P1');
  const [targetDate, setTargetDate] = useState<string>('');

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear && selectedPeriod) {
      calculateTargetDate();
    }
  }, [selectedMonth, selectedYear, selectedPeriod]);

  const loadUser = async () => {
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      
      if (authError || !auth?.user?.id) {
        router.push('/');
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (userError || !userRow) {
        router.push('/');
        return;
      }

      if (userRow.role !== 'super_admin' && userRow.role !== 'admin') {
        router.push('/admin/dashboard');
        return;
      }

      setUser(userRow);
      setUserRole(userRow.role);

      // Obtener grupos si es admin
      if (userRow.role === 'admin') {
        const { data: ug, error: groupsError } = await supabase
          .from('user_groups')
          .select('group_id, groups(name)')
          .eq('user_id', userRow.id);

        if (!groupsError && ug) {
          const groupNames = ug.map((item: any) => item.groups.name);
          setUserGroups(groupNames);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading user:', error);
      router.push('/');
    }
  };

  const calculateTargetDate = () => {
    if (!selectedMonth || !selectedYear) return;

    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    
    let day: number;
    if (selectedPeriod === 'P1') {
      day = 15; // Período 1: día 15
    } else {
      // Período 2: último día del mes
      day = new Date(year, month, 0).getDate();
    }

    const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setTargetDate(targetDateStr);
  };

  const getMonthName = (month: string) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[parseInt(month) - 1] || '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    Historial de Facturación
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Consulta períodos históricos de facturación
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Acceso: <span className="font-medium text-blue-600">
                  {userRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros de Consulta */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Período</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Año */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                >
                  <option value="">Seleccionar año</option>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <option key={year} value={year.toString()}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Mes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                >
                  <option value="">Seleccionar mes</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    const monthName = getMonthName(month.toString());
                    return (
                      <option key={month} value={month.toString()}>
                        {monthName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Período */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                >
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                </select>
              </div>

              {/* Información del período seleccionado */}
              <div className="flex items-end">
                {selectedMonth && selectedYear && selectedPeriod && (
                  <div className="w-full p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-blue-800">
                      {getMonthName(selectedMonth)} {selectedYear} - {selectedPeriod}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {selectedPeriod === 'P1' ? 'Días 1-15' : 'Días 16-31'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de Facturación */}
        {targetDate && user && (
          <BillingSummary 
            userRole={userRole as 'admin' | 'super_admin'} 
            userId={user.id}
            userGroups={userGroups}
            selectedDate={targetDate}
            selectedPeriod={selectedPeriod}
          />
        )}

        {/* Mensaje cuando no hay selección */}
        {!targetDate && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 border border-white/20 shadow-lg text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un período</h3>
            <p className="text-gray-600">Elige año, mes y período para consultar el historial de facturación</p>
          </div>
        )}
      </div>
    </div>
  );
}
