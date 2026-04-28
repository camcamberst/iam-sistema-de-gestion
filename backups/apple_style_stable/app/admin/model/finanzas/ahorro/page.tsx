"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { CreditCard, Wallet, TrendingUp, History, Info, Clock, AlertTriangle } from 'lucide-react';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import GlassCard from '@/components/ui/GlassCard';
import PageHeader from '@/components/ui/PageHeader';
import PillTabs from '@/components/ui/PillTabs';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';

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

interface Goal {
  id: string;
  nombre_meta: string;
  monto_meta: number;
  monto_actual: number;
  porcentaje_progreso: number;
  fecha_limite?: string;
  estado: 'activa' | 'completada' | 'cancelada';
  is_completed?: boolean;
  faltante: number;
}

export default function MiAhorroPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState({ nombre_meta: '', monto_meta: '', fecha_limite: '' });
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

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
        setGoals(data.goals || []);
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

  const [navigatingTo, setNavigatingTo] = useState<string>('');

  if (loading) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-6xl mx-auto max-sm:px-0 sm:px-6 lg:px-8 pb-4 sm:pb-2 pt-6 sm:pt-2 relative z-10">
        <PageHeader
          title="Mi Ahorro"
          subtitle="Gestiona tus ahorros y retiros"
          glow="model"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          actionClassName="max-sm:hidden"
          actions={
            <PillTabs
              tabs={[
                { id: 'solicitar', label: 'Solicitar Ahorro' },
                { id: 'retiros', label: 'Solicitar Retiro' }
              ]}
              activeTab={navigatingTo}
              onTabChange={(tab) => {
                setNavigatingTo(tab);
                router.push(`/admin/model/finanzas/ahorro/${tab}`);
              }}
              className="mx-auto md:mx-0"
            />
          }
        />

        {/* Controles de Pestañas (Exclusivo en MÓVIL, centrado y debajo del header, con margen conservador) */}
        <div className="w-full sm:hidden flex justify-center max-sm:px-4 mb-6">
          <PillTabs
            tabs={[
              { id: 'solicitar', label: 'Solicitar Ahorro' },
              { id: 'retiros', label: 'Solicitar Retiro' }
            ]}
            activeTab={navigatingTo}
            onTabChange={(tab) => {
              setNavigatingTo(tab);
              router.push(`/admin/model/finanzas/ahorro/${tab}`);
            }}
          />
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
          <div className="mb-4 sm:mb-8 relative z-0">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 max-sm:px-4 sm:px-0">
              <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v10m-2-6h4m-4 2h4" />
              </svg>
              <h2 className="text-[17px] font-bold tracking-tight text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Resumen de Ahorros
              </h2>
            </div>
          
            <div className="max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] max-sm:backdrop-blur-xl max-sm:ring-1 max-sm:ring-black/[0.05] max-sm:dark:ring-white/[0.1] rounded-xl max-sm:p-2.5 max-sm:shadow-sm max-sm:mx-2 sm:mx-0 sm:bg-white/[0.03] sm:dark:bg-white/[0.02] sm:backdrop-blur-xl sm:border sm:border-white/[0.06] sm:shadow-lg sm:shadow-black/10 sm:rounded-2xl sm:p-5 mb-1.5 sm:mb-2">
              <InfoCardGrid
                columns={3}
                cards={[
                  {
                    value: formatCurrency(balance.saldo_actual),
                    label: "Saldo",
                    color: "blue",
                    size: "sm"
                  },
                  {
                    value: formatCurrency(balance.total_ahorrado),
                    label: "Ahorrado",
                    color: "green",
                    size: "sm"
                  },
                  {
                    value: formatCurrency(balance.total_retirado),
                    label: "Retirado",
                    color: "purple",
                    size: "sm"
                  }
                ]}
              />
          </div>
          </div>
        )}

        {/* Los botones han sido movidos al header */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 sm:mt-6">
          {/* Gráfico de Crecimiento */}
          <div className="relative z-0">
            <div className="flex items-center gap-2 mb-3 max-sm:px-4 sm:px-0">
              <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-[17px] font-bold tracking-tight text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Crecimiento de Ahorros
              </h2>
            </div>
            <div className="max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] max-sm:backdrop-blur-xl max-sm:ring-1 max-sm:ring-black/[0.05] max-sm:dark:ring-white/[0.1] rounded-xl max-sm:p-3 max-sm:shadow-sm max-sm:mx-2 sm:mx-0 sm:bg-white/[0.03] sm:dark:bg-white/[0.02] sm:backdrop-blur-xl sm:border sm:border-white/[0.06] sm:shadow-lg sm:shadow-black/10 sm:rounded-2xl sm:p-5">
            {chartData.length > 0 ? (
              <div className="space-y-4">
                {/* Gráfico de barras mejorado */}
                <div className="relative h-48 flex items-end justify-between gap-2">
                  {chartData.map((data, index) => {
                    const maxSaldo = Math.max(...chartData.map(d => d.saldo), 1);
                    const height = (data.saldo / maxSaldo) * 100;
                    const prevData = index > 0 ? chartData[index - 1] : null;
                    const trend = prevData ? (data.saldo > prevData.saldo ? 'up' : data.saldo < prevData.saldo ? 'down' : 'stable') : 'stable';
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center group">
                        <div className="relative w-full flex flex-col items-center">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                            <div className="font-semibold mb-1">{new Date(data.month + '-01').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</div>
                            <div>Saldo: {formatCurrency(data.saldo)}</div>
                            <div className="text-gray-400">Ingresos: {formatCurrency(data.ingresos)}</div>
                            <div className="text-gray-400">Retiros: {formatCurrency(data.retiros)}</div>
                            {trend === 'up' && <div className="text-green-400 mt-1">↑ Crecimiento</div>}
                            {trend === 'down' && <div className="text-red-400 mt-1">↓ Disminución</div>}
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></div>
                          </div>
                          
                          {/* Barra */}
                          <div className="w-full flex flex-col items-center">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden" style={{ height: '180px' }}>
                              <div
                                className={`w-full rounded-t-lg transition-all duration-500 ${
                                  trend === 'up' ? 'bg-gradient-to-t from-green-500 to-green-400' :
                                  trend === 'down' ? 'bg-gradient-to-t from-red-500 to-red-400' :
                                  'bg-gradient-to-t from-blue-500 to-blue-400'
                                }`}
                                style={{ height: `${height}%` }}
                              ></div>
                            </div>
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                              {new Date(data.month + '-01').toLocaleDateString('es-CO', { month: 'short' })}
                            </div>
                            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1">
                              {formatCurrency(data.saldo)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex items-center justify-center space-x-4 text-[12px] font-semibold text-[#6F7A96] pt-4 border-t border-[#252C40]">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
                    <span>Crecimiento</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#F43F5E]"></div>
                    <span>Disminución</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#4B85FF]"></div>
                    <span>Estable</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-[#0F121C] rounded-xl border border-[#252C40]">
                <p className="text-[14px] font-medium text-[#6F7A96]">No hay datos de crecimiento disponibles</p>
              </div>
            )}
            </div>
          </div>

          {/* Últimos Movimientos */}
          <div className="relative z-0 flex flex-col">
            <div className="flex items-center justify-between mb-3 max-sm:px-4 sm:px-0">
              <div className="flex items-center gap-2">
                <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <h2 className="text-[17px] font-bold tracking-tight text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  Movimientos
                </h2>
              </div>
              <Link
                href="/admin/model/finanzas/ahorro/historial"
                className="text-[13px] font-bold text-[#4B85FF] hover:text-[#7C9FFF] transition-colors whitespace-nowrap"
              >
                Ver historial
              </Link>
            </div>
            
            <div className="max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] max-sm:backdrop-blur-xl max-sm:ring-1 max-sm:ring-black/[0.05] max-sm:dark:ring-white/[0.1] rounded-xl max-sm:p-3 max-sm:shadow-sm max-sm:mx-2 sm:mx-0 sm:bg-white/[0.03] sm:dark:bg-white/[0.02] sm:backdrop-blur-xl sm:border sm:border-white/[0.06] sm:shadow-lg sm:shadow-black/10 sm:rounded-2xl sm:p-5 flex-1 flex flex-col">
            {movements.length > 0 ? (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-96 pr-1 custom-scrollbar">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-4 bg-[#0F121C] rounded-xl border border-[#252C40] shadow-sm"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
                        movement.tipo === 'ahorro' ? 'bg-[#0A201A] border border-[#10B981]/20' :
                        movement.tipo === 'retiro' ? 'bg-[#1F0A0E] border border-[#F43F5E]/20' :
                        'bg-[#0A1120] border border-[#4B85FF]/20'
                      }`}>
                        {movement.tipo === 'ahorro' ? (
                          <svg className="w-[18px] h-[18px] text-[#10B981] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        ) : movement.tipo === 'retiro' ? (
                          <svg className="w-[18px] h-[18px] text-[#F43F5E] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        ) : (
                          <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-white truncate">
                          {movement.descripcion}
                        </p>
                        <p className="text-[12px] font-semibold text-[#6F7A96] mt-0.5">
                          {formatDate(movement.fecha)}
                          {movement.periodo && ` • ${movement.periodo}`}
                          {movement.admin && ` • ${movement.admin}`}
                        </p>
                      </div>
                    </div>
                    <div className={`text-[15px] font-bold ml-3 leading-none ${
                      movement.monto >= 0 
                        ? 'text-[#10B981]' 
                        : 'text-[#F43F5E]'
                    }`}>
                      {movement.monto >= 0 ? '+' : ''}{formatCurrency(movement.monto)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-[#0F121C] rounded-xl border border-[#252C40] mt-auto">
                <p className="text-[14px] font-medium text-[#6F7A96]">No hay movimientos registrados</p>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Metas de Ahorro */}
        <div className="mt-6 sm:mt-8 relative z-0">
          <div className="flex items-center justify-between mb-3 max-sm:px-4 sm:px-0">
            <div className="flex items-center gap-2">
              <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-[17px] font-bold tracking-tight text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Mis Metas de Ahorro
              </h2>
            </div>
            <button
              onClick={() => setShowGoalModal(true)}
              className="px-5 py-2 sm:py-2.5 h-auto flex items-center justify-center text-[12px] sm:text-[13px] font-bold rounded-xl bg-gradient-to-r from-[#536FFF] to-[#6948FF] text-white shadow-[0_0_15px_rgba(83,111,255,0.4)] active:scale-95 transition-all duration-200 touch-manipulation whitespace-nowrap"
            >
              Nueva Meta
            </button>
          </div>
          
          <div className="max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] max-sm:backdrop-blur-xl max-sm:ring-1 max-sm:ring-black/[0.05] max-sm:dark:ring-white/[0.1] rounded-xl max-sm:p-3 max-sm:shadow-sm max-sm:mx-2 sm:mx-0 sm:bg-white/[0.03] sm:dark:bg-white/[0.02] sm:backdrop-blur-xl sm:border sm:border-white/[0.06] sm:shadow-lg sm:shadow-black/10 sm:rounded-2xl sm:p-5">

          {goals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="p-5 bg-[#0F121C] rounded-xl border border-[#252C40] shadow-sm flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-[16px] font-bold text-white truncate">
                        {goal.nombre_meta}
                      </h3>
                      {goal.fecha_limite && (
                        <p className="text-[12px] font-semibold text-[#6F7A96] mt-1">
                          Límite: {formatDate(goal.fecha_limite)}
                        </p>
                      )}
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide uppercase flex-shrink-0 ${
                      goal.estado === 'completada' ? 'bg-[#0A201A] text-[#10B981] border border-[#10B981]/20' :
                      goal.estado === 'cancelada' ? 'bg-[#1F0A0E] text-[#F43F5E] border border-[#F43F5E]/20' :
                      'bg-[#0A1120] text-[#4B85FF] border border-[#4B85FF]/20'
                    }`}>
                      {goal.estado === 'completada' ? 'Lograda' :
                       goal.estado === 'cancelada' ? 'Anulada' :
                       'Activa'}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[13px] font-bold text-[#6F7A96]">
                        Progreso
                      </span>
                      <span className="text-[18px] font-black text-white leading-none">
                        {(goal.porcentaje_progreso ?? 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#1A1F2C] rounded-full h-2.5 mb-2 overflow-hidden border border-[#252C40]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (goal.porcentaje_progreso ?? 0) >= 100
                            ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
                            : 'bg-gradient-to-r from-[#4B85FF] to-[#3B82F6]'
                        }`}
                        style={{ width: `${Math.min(100, goal.porcentaje_progreso ?? 0)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[12px] font-semibold">
                      <span className="text-[#10B981]">{formatCurrency(goal.monto_actual ?? 0)}</span>
                      <span className="text-[#6F7A96]">{formatCurrency(goal.monto_meta ?? 0)}</span>
                    </div>
                  </div>

                  {goal.estado === 'activa' && (goal.faltante ?? 0) > 0 && (
                    <p className="text-[12px] font-semibold text-[#A855F7] bg-[#20102A] border border-[#A855F7]/20 rounded-lg p-2 text-center mb-auto">
                      Faltan {formatCurrency(goal.faltante ?? 0)}
                    </p>
                  )}

                  {goal.estado === 'activa' && (
                    <div className="flex space-x-2 mt-4 pt-4 border-t border-[#252C40]">
                      <button
                        onClick={() => {
                          setEditingGoal(goal);
                          setShowEditModal(true);
                        }}
                        className="flex-1 py-2 text-[13px] bg-[#1A2033] hover:bg-[#253454] text-[#4B85FF] rounded-xl transition-all font-bold"
                      >
                        Editar
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('¿Estás segura de que deseas cancelar esta meta?')) return;
                          
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            if (!token) return;

                            const response = await fetch(`/api/model/savings/goals/${goal.id}`, {
                              method: 'DELETE',
                              headers: {
                                'Authorization': `Bearer ${token}`
                              }
                            });

                            const data = await response.json();
                            if (data.success) {
                              if (user) await loadDashboardData(user.id);
                            } else {
                              setError(data.error || 'Error al cancelar meta');
                            }
                          } catch (error) {
                            console.error('Error canceling goal:', error);
                            setError('Error al cancelar meta');
                          }
                        }}
                        className="flex-1 py-2 text-[13px] bg-[#1F0A0E] hover:bg-[#2E1016] text-[#F43F5E] rounded-xl transition-all font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-[#0F121C] rounded-xl border border-[#252C40]">
              <p className="text-[14px] font-medium text-[#6F7A96]">Crea metas para configurar tus próximos objetivos</p>
            </div>
          )}
          </div>
        </div>

        {/* Modal para crear meta */}
        {showGoalModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Nueva Meta de Ahorro
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Nombre de la Meta *
                  </label>
                  <input
                    type="text"
                    value={newGoal.nombre_meta}
                    onChange={(e) => setNewGoal({ ...newGoal, nombre_meta: e.target.value })}
                    placeholder="Ej: Vacaciones, Emergencia, etc."
                    className="w-full bg-gray-50 dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block p-3 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Monto Meta (COP) *
                  </label>
                  <input
                    type="text"
                    value={newGoal.monto_meta}
                    onChange={(e) => setNewGoal({ ...newGoal, monto_meta: e.target.value.replace(/[^\d]/g, '') })}
                    placeholder="Ej: 5000000"
                    className="w-full bg-gray-50 dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block p-3 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Fecha Límite (Opcional)
                  </label>
                  <input
                    type="date"
                    value={newGoal.fecha_limite}
                    onChange={(e) => setNewGoal({ ...newGoal, fecha_limite: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block p-3 transition-colors"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={async () => {
                      if (!newGoal.nombre_meta || !newGoal.monto_meta) return;
                      
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        if (!token) return;

                        const response = await fetch('/api/model/savings/goals', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            nombre_meta: newGoal.nombre_meta,
                            monto_meta: parseFloat(newGoal.monto_meta),
                            fecha_limite: newGoal.fecha_limite || null
                          })
                        });

                        const data = await response.json();
                        if (data.success) {
                          setShowGoalModal(false);
                          setNewGoal({ nombre_meta: '', monto_meta: '', fecha_limite: '' });
                          if (user) await loadDashboardData(user.id);
                        } else {
                          setError(data.error || 'Error al crear meta');
                        }
                      } catch (error) {
                        console.error('Error creating goal:', error);
                        setError('Error al crear meta');
                      }
                    }}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4),0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5),0_6px_16px_rgba(16,185,129,0.35)] active:scale-[0.97] transition-all duration-300 ease-out flex items-center justify-center"
                  >
                    Crear Meta
                  </button>
                  <button
                    onClick={() => {
                      setShowGoalModal(false);
                      setNewGoal({ nombre_meta: '', monto_meta: '', fecha_limite: '' });
                    }}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.97] transition-all duration-300 ease-out"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para editar meta */}
        {showEditModal && editingGoal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Editar Meta de Ahorro
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Nombre de la Meta *
                  </label>
                  <input
                    type="text"
                    value={editingGoal.nombre_meta}
                    onChange={(e) => setEditingGoal({ ...editingGoal, nombre_meta: e.target.value })}
                    placeholder="Ej: Vacaciones, Emergencia, etc."
                    className="w-full bg-gray-50 dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block p-3 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Monto Meta (COP) *
                  </label>
                  <input
                    type="text"
                    value={editingGoal.monto_meta.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d]/g, '');
                      setEditingGoal({ ...editingGoal, monto_meta: parseFloat(value) || 0 });
                    }}
                    placeholder="Ej: 5000000"
                    className="w-full bg-gray-50 dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block p-3 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Fecha Límite (Opcional)
                  </label>
                  <input
                    type="date"
                    value={editingGoal.fecha_limite ? new Date(editingGoal.fecha_limite).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingGoal({ ...editingGoal, fecha_limite: e.target.value || undefined })}
                    className="w-full bg-gray-50 dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block p-3 transition-colors"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={async () => {
                      if (!editingGoal.nombre_meta || !editingGoal.monto_meta) return;
                      
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        if (!token) return;

                        const response = await fetch(`/api/model/savings/goals/${editingGoal.id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            nombre_meta: editingGoal.nombre_meta,
                            monto_meta: editingGoal.monto_meta,
                            fecha_limite: editingGoal.fecha_limite || null
                          })
                        });

                        const data = await response.json();
                        if (data.success) {
                          setShowEditModal(false);
                          setEditingGoal(null);
                          if (user) await loadDashboardData(user.id);
                        } else {
                          setError(data.error || 'Error al actualizar meta');
                        }
                      } catch (error) {
                        console.error('Error updating goal:', error);
                        setError('Error al actualizar meta');
                      }
                    }}
                    className="flex-1 px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4),0_4px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5),0_6px_16px_rgba(99,102,241,0.35)] active:scale-[0.97] transition-all duration-300 ease-out flex items-center justify-center"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingGoal(null);
                    }}
                    className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-[0.97] transition-all duration-300 ease-out"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
