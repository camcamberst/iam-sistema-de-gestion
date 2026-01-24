"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Balance {
  total_ahorrado: number;
  total_retirado: number;
  saldo_actual: number;
}

interface Movement {
  id: string;
  tipo: 'ahorro' | 'retiro' | 'ajuste';
  monto: number;
  fecha: string;
  periodo?: string;
  descripcion: string;
  admin?: string;
}

interface ChartData {
  month: string;
  ingresos: number;
  retiros: number;
  saldo: number;
}

export default function MiAhorroPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (!userData || userData.role !== 'modelo') {
        router.push('/login');
        return;
      }

      setUser(userData);
      await loadDashboardData(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const response = await fetch(`/api/model/savings/dashboard?modelId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        if (data.balance) {
          setBalance({
            total_ahorrado: data.balance.total_ahorrado,
            total_retirado: data.balance.total_retirado,
            saldo_actual: data.balance.saldo_actual
          });
        }
        setMovements(data.movements || []);
        setChartData(data.chartData || []);
      } else {
        setError(data.error || 'Error al cargar datos');
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setError('Error al cargar datos del dashboard');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Mi Ahorro
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Gestiona tus ahorros y retiros
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/admin/model/finanzas/ahorro/solicitar"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm"
                  >
                    Solicitar Ahorro
                  </Link>
                  <Link
                    href="/admin/model/finanzas/ahorro/retiros"
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium text-sm"
                  >
                    Solicitar Retiro
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Balance Cards */}
        {balance && (
          <InfoCardGrid 
            className="mb-8"
            cards={[
              {
                value: formatCurrency(balance.saldo_actual),
                label: 'Saldo Actual',
                color: 'blue'
              },
              {
                value: formatCurrency(balance.total_ahorrado),
                label: 'Total Ahorrado',
                color: 'green'
              },
              {
                value: formatCurrency(balance.total_retirado),
                label: 'Total Retirado',
                color: 'purple'
              }
            ]}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Crecimiento */}
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Crecimiento de Ahorros
            </h2>
            {chartData.length > 0 ? (
              <div className="space-y-3">
                {chartData.map((data, index) => {
                  const maxSaldo = Math.max(...chartData.map(d => d.saldo), 1);
                  const percentage = (data.saldo / maxSaldo) * 100;
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>{data.month}</span>
                        <span className="font-semibold">{formatCurrency(data.saldo)}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No hay datos de crecimiento disponibles</p>
              </div>
            )}
          </div>

          {/* Últimos Movimientos */}
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Últimos Movimientos
            </h2>
            {movements.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-white backdrop-blur-sm rounded-lg border border-gray-200/30 dark:border-gray-500/30 shadow-sm"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        movement.tipo === 'ahorro' ? 'bg-green-100 dark:bg-green-100' :
                        movement.tipo === 'retiro' ? 'bg-red-100 dark:bg-red-100' :
                        'bg-blue-100 dark:bg-blue-100'
                      }`}>
                        {movement.tipo === 'ahorro' ? (
                          <svg className="w-4 h-4 text-green-600 dark:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        ) : movement.tipo === 'retiro' ? (
                          <svg className="w-4 h-4 text-red-600 dark:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-800 truncate">
                          {movement.descripcion}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-600">
                          {formatDate(movement.fecha)}
                          {movement.periodo && ` • ${movement.periodo}`}
                          {movement.admin && ` • ${movement.admin}`}
                        </p>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ml-3 ${
                      movement.monto >= 0 
                        ? 'text-green-600 dark:text-green-600' 
                        : 'text-red-600 dark:text-red-600'
                    }`}>
                      {movement.monto >= 0 ? '+' : ''}{formatCurrency(movement.monto)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No hay movimientos registrados</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
