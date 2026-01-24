"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import AppleDropdown from '@/components/ui/AppleDropdown';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SavingsStats {
  total_ahorrado: number;
  total_retirado: number;
  saldo_actual: number;
  total_solicitudes: number;
  solicitudes_pendientes: number;
  solicitudes_aprobadas: number;
  solicitudes_rechazadas: number;
  total_retiros: number;
  retiros_pendientes: number;
  retiros_aprobados: number;
  retiros_realizados: number;
  total_ajustes: number;
  modelos_con_ahorro: number;
  promedio_ahorro_por_modelo: number;
}

interface MonthlyData {
  month: string;
  ingresos: number;
  retiros: number;
  saldo: number;
  solicitudes: number;
}

interface GroupStats {
  group_id: string;
  group_name: string;
  total_ahorrado: number;
  total_retirado: number;
  saldo_actual: number;
  modelos_con_ahorro: number;
}

export default function EstadisticasAhorrosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SavingsStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [groupStats, setGroupStats] = useState<GroupStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('todos');
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, selectedPeriod]);

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

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        router.push('/login');
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const periodParam = selectedPeriod !== 'todos' ? `&period=${selectedPeriod}` : '';
      const response = await fetch(`/api/admin/savings/stats?${periodParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setMonthlyData(data.monthlyData || []);
        setGroupStats(data.groupStats || []);
      } else {
        setError(data.error || 'Error al cargar estadísticas');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Error al cargar estadísticas');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Estadísticas de Ahorros
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Resumen completo del sistema de ahorros
                  </p>
                </div>
                <AppleDropdown
                  options={[
                    { value: 'todos', label: 'Todos los períodos' },
                    { value: 'ultimo_mes', label: 'Último mes' },
                    { value: 'ultimos_3_meses', label: 'Últimos 3 meses' },
                    { value: 'ultimos_6_meses', label: 'Últimos 6 meses' },
                    { value: 'este_ano', label: 'Este año' }
                  ]}
                  value={selectedPeriod}
                  onChange={(value) => setSelectedPeriod(value)}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Estadísticas Generales */}
        {stats && (
          <>
            <InfoCardGrid
              className="mb-8"
              cards={[
                {
                  value: formatCurrency(stats.saldo_actual),
                  label: 'Saldo Total Actual',
                  color: 'blue'
                },
                {
                  value: formatCurrency(stats.total_ahorrado),
                  label: 'Total Ahorrado',
                  color: 'green'
                },
                {
                  value: formatCurrency(stats.total_retirado),
                  label: 'Total Retirado',
                  color: 'purple'
                },
                {
                  value: stats.modelos_con_ahorro.toString(),
                  label: 'Modelos con Ahorro',
                  color: 'purple'
                }
              ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Estadísticas de Solicitudes */}
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Solicitudes de Ahorro
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stats.total_solicitudes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Aprobadas</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">{stats.solicitudes_aprobadas}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pendientes</span>
                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{stats.solicitudes_pendientes}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Rechazadas</span>
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{stats.solicitudes_rechazadas}</span>
                  </div>
                </div>
              </div>

              {/* Estadísticas de Retiros */}
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Retiros
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stats.total_retiros}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Realizados</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">{stats.retiros_realizados}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Aprobados</span>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{stats.retiros_aprobados}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pendientes</span>
                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{stats.retiros_pendientes}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Gráfico de Tendencias Mensuales */}
            {monthlyData.length > 0 && (
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Tendencias Mensuales
                </h2>
                <div className="space-y-3">
                  {monthlyData.map((data, index) => {
                    const maxSaldo = Math.max(...monthlyData.map(d => d.saldo), 1);
                    const percentage = (data.saldo / maxSaldo) * 100;
                    
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>{new Date(data.month + '-01').toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}</span>
                          <span className="font-semibold">{formatCurrency(data.saldo)}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
                          <span>Ingresos: {formatCurrency(data.ingresos)}</span>
                          <span>Retiros: {formatCurrency(data.retiros)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Estadísticas por Grupo */}
            {groupStats.length > 0 && (
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Estadísticas por Grupo
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Grupo</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Ahorrado</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Retirado</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Saldo Actual</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Modelos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStats.map((group, index) => (
                        <tr key={group.group_id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">{group.group_name}</td>
                          <td className="py-3 px-4 text-sm text-right text-green-600 dark:text-green-400 font-medium">{formatCurrency(group.total_ahorrado)}</td>
                          <td className="py-3 px-4 text-sm text-right text-purple-600 dark:text-purple-400 font-medium">{formatCurrency(group.total_retirado)}</td>
                          <td className="py-3 px-4 text-sm text-right text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(group.saldo_actual)}</td>
                          <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-400">{group.modelos_con_ahorro}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
