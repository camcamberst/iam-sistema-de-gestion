"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { CreditCard, Wallet, TrendingUp, History, Info, Clock, AlertTriangle } from 'lucide-react';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import GlassCard from '@/components/ui/GlassCard';
import PageHeader from '@/components/ui/PageHeader';
import PillTabs from '@/components/ui/PillTabs';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';
import AppleDatePicker from '@/components/ui/AppleDatePicker';
import StandardModal from '@/components/ui/StandardModal';

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
  const [msgIndex, setMsgIndex] = useState(0);

  const router = useRouter();

  useEffect(() => {
    loadUser();
    const t = setInterval(() => setMsgIndex((prev) => prev + 1), 6000);
    return () => clearInterval(t);
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
      <div className="max-w-screen-2xl mx-auto max-sm:px-0 px-4 sm:px-6 lg:px-20 xl:px-32 py-8 pt-6 sm:pt-8 relative z-10">
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
          <div className="mb-6 relative overflow-hidden bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-xl border border-fuchsia-500/30 dark:border-fuchsia-400/30 rounded-xl p-4 shadow-lg shadow-fuchsia-500/10">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-fuchsia-500 to-cyan-500"></div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 bg-fuchsia-500/20">
                <svg className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{error}</p>
            </div>
          </div>
        )}

        {/* Balance Cards */}
        {balance && (
          <div className="mb-4 sm:mb-8 relative z-0 max-sm:px-2">
            <div className="flex items-center gap-2 mb-2 sm:mb-3 max-sm:px-4 sm:px-0">
              <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v10m-2-6h4m-4 2h4" />
              </svg>
              <h2 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Resumen de Ahorros
              </h2>
            </div>
          
            <div className="glass-card bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden mb-4 sm:mb-6 transition-all duration-500">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 sm:mt-6 max-sm:px-2">
          {/* Gráfico de Crecimiento */}
          <div className="relative z-0">
            <div className="flex items-center gap-2 mb-3 max-sm:px-4 sm:px-0">
              <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Crecimiento de Ahorros
              </h2>
            </div>
            <div className="glass-card bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden transition-all duration-500">
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
              <div className="text-center py-10 bg-black/[0.04] dark:bg-white/[0.04] rounded-xl border border-black/5 dark:border-white/10">
                <p className="text-[14px] font-medium text-gray-500 dark:text-[#6F7A96]">No hay datos de crecimiento disponibles</p>
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
                <h2 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
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
            
            <div className="glass-card bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex-1 flex flex-col overflow-hidden transition-all duration-500">
            {movements.length > 0 ? (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-96 pr-1 custom-scrollbar">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-4 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl border border-black/5 dark:border-white/[0.08] shadow-sm"
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
                        <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">
                          {movement.descripcion}
                        </p>
                        <p className="text-[12px] font-semibold text-gray-500 dark:text-[#6F7A96] mt-0.5">
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
              <div className="text-center py-10 bg-black/[0.04] dark:bg-white/[0.04] rounded-xl border border-black/5 dark:border-white/10 mt-auto">
                <p className="text-[14px] font-medium text-gray-500 dark:text-[#6F7A96]">No hay movimientos registrados</p>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Metas de Ahorro */}
        <div className="mt-6 sm:mt-8 relative z-0 max-sm:px-2">
          <div className="flex items-center justify-between mb-3 max-sm:px-4 sm:px-0">
            <div className="flex items-center gap-2">
              <svg className="w-[18px] h-[18px] text-[#4B85FF] stroke-[2] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h2 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-white drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Mi Meta de Ahorro
              </h2>
            </div>
            {!goals.some(g => g.estado === 'activa') && (
              <button
                onClick={() => setShowGoalModal(true)}
                className="px-4 py-2 sm:py-2 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white text-[10px] sm:text-[11px] font-bold rounded-full transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(232,121,249,0.6)] uppercase tracking-wider"
              >
                <span className="relative z-10 flex items-center tracking-widest uppercase gap-1">
                  NUEVA META
                </span>
              </button>
            )}
          </div>
          
          <div className="glass-card bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden transition-all duration-500">

          {goals.length > 0 ? (
            <div className="flex flex-col gap-4">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex flex-col gap-2 p-1"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2 px-1">
                      <h3 className="text-[16px] font-bold text-gray-900 dark:text-white truncate drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                        {goal.nombre_meta}
                      </h3>
                    </div>
                  </div>

                  <div className="mb-auto">
                    {/* Caja Objetivo Boreal (Proyección + Progreso) */}
                    <div className="relative overflow-hidden rounded-[1rem] sm:rounded-xl bg-black/[0.08] dark:bg-black/20 backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-700">
                      
                      {/* Efecto Aurora de Fondo Dinámico */}
                      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none z-0">
                        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[70%] bg-cyan-500/15 blur-[50px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-aurora-1"></div>
                        <div className="absolute top-[10%] -right-[15%] w-[60%] h-[70%] bg-fuchsia-500/15 blur-[60px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-aurora-2"></div>
                        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] bg-indigo-500/15 blur-[45px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-aurora-3"></div>
                      </div>

                      <div className="relative p-3 z-10">
                        {/* Cabecera Proyección (Marquee dinámico) */}
                        {(() => {
                          const msgs = [];
                          if (goal.estado !== 'activa') {
                            msgs.push({ text: `Meta ${goal.estado}`, color: 'text-gray-500', bgClass: 'bg-gray-400 text-gray-400' });
                          } else {
                            let projColor = 'text-blue-500 dark:text-blue-400';
                            let projBg = 'bg-blue-400 text-blue-400';
                            let projText = 'Ahorra para calcular tu futuro';
                            if (goal.proyeccion?.estado_ritmo === 'viable') {
                              projColor = 'text-emerald-500 dark:text-emerald-400';
                              projBg = 'bg-emerald-400 text-emerald-400';
                              projText = `Alcanzable en ${goal.proyeccion.meses_necesarios} meses`;
                            } else if (goal.proyeccion?.estado_ritmo === 'riesgo') {
                              projColor = 'text-amber-500 dark:text-amber-400';
                              projBg = 'bg-amber-400 text-amber-400';
                              projText = `Llegarás muy justo al límite`;
                            } else if (goal.proyeccion?.estado_ritmo === 'inviable') {
                              projColor = 'text-rose-500 dark:text-rose-400';
                              projBg = 'bg-rose-400 text-rose-400';
                              projText = `Tiempo insuficiente al ritmo actual`;
                            }
                            msgs.push({ text: projText, color: projColor, bgClass: projBg });

                            if (goal.fecha_limite) {
                              msgs.push({ 
                                text: `Límite: ${formatDate(goal.fecha_limite)}`, 
                                color: 'text-indigo-500 dark:text-indigo-400', 
                                bgClass: 'bg-indigo-400 text-indigo-400' 
                              });
                            }

                            if (goal.monto_meta) {
                              msgs.push({
                                text: `Tu meta de ahorro total es: ${formatCurrency(goal.monto_meta)}`,
                                color: 'text-cyan-500 dark:text-cyan-400',
                                bgClass: 'bg-cyan-400 text-cyan-400'
                              });
                            }

                            if ((goal.faltante ?? 0) > 0) {
                              msgs.push({ 
                                text: `Faltan ${formatCurrency(goal.faltante ?? 0)}`, 
                                color: 'text-fuchsia-500 dark:text-fuchsia-400', 
                                bgClass: 'bg-fuchsia-400 text-fuchsia-400' 
                              });
                            }
                          }
                          const currentMessage = msgs[msgIndex % msgs.length] || { text: '', color: '', bgClass: '' };

                          return (
                            <div className="flex items-center flex-1 min-w-0 mb-3">
                              <div className="text-base leading-none font-semibold text-gray-900 dark:text-gray-100 shrink-0 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                                Objetivo
                              </div>
                              <div className={`transition-all duration-500 ease-in-out w-[2.5px] h-3.5 sm:h-4 ml-1 mr-2 sm:mr-2.5 shrink-0 rounded-full shadow-none dark:shadow-[0_0_6px_currentColor] ${currentMessage.bgClass}`}></div>
                              <div className="text-xs sm:text-[13px] leading-none font-bold tracking-tight flex items-center h-5 flex-1 relative overflow-hidden">
                                <div key={msgIndex} className={`absolute inset-y-0 left-0 flex items-center whitespace-nowrap animate-slide-bar min-w-0 truncate message-glow max-sm:-translate-y-[0.5px] ${currentMessage.color}`}>
                                  {currentMessage.text}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Barra Neón Boreal */}
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="relative flex-1 bg-gray-900/80 rounded-full h-1.5 ring-1 ring-white/5">
                            <div 
                              className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_current] flex items-center justify-end"
                              style={{ 
                                width: `${Math.min(goal.porcentaje_progreso ?? 0, 100)}%`,
                                backgroundImage: (goal.porcentaje_progreso ?? 0) < 100 
                                  ? 'linear-gradient(90deg, #c026d3, #06b6d4, #10b981)' 
                                  : 'linear-gradient(90deg, #10b981, #34d399, #10b981)',
                              }}
                            >
                              {(goal.porcentaje_progreso ?? 0) > 0 && (
                                <div className="absolute -right-1.5 w-3 h-3 bg-white rounded-full 
                                                shadow-[0_0_10px_3px_rgba(255,255,255,0.8),0_0_20px_6px_rgba(6,182,212,0.6)] 
                                                border border-white/50 z-10 transition-transform duration-1000">
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Píldora Porcentaje */}
                          <div className="px-2 py-[3px] rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[10px] font-extrabold text-[#e2e8f0] shadow-sm flex items-center justify-center shrink-0 min-w-[38px] tracking-wider text-center">
                            {Math.round(goal.porcentaje_progreso ?? 0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                </div>
              ))}
              <style jsx>{`
                :global(.dark) .message-glow {
                  filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 1.5px rgba(255,255,255,0.5));
                }
                @keyframes aurora-1 {
                  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
                  33% { transform: translate(30%, 15%) scale(1.1); opacity: 1; }
                  66% { transform: translate(15%, 35%) scale(0.9); opacity: 0.7; }
                }
                @keyframes aurora-2 {
                  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
                  33% { transform: translate(-30%, 20%) scale(0.9); opacity: 0.9; }
                  66% { transform: translate(-15%, -15%) scale(1.1); opacity: 0.6; }
                }
                @keyframes aurora-3 {
                  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
                  50% { transform: translate(35%, -30%) scale(1.2); opacity: 0.6; }
                }
                .animate-aurora-1 { animation: aurora-1 12s ease-in-out infinite alternate; }
                .animate-aurora-2 { animation: aurora-2 15s ease-in-out infinite alternate; }
                .animate-aurora-3 { animation: aurora-3 18s ease-in-out infinite alternate; }

                @keyframes slide-bar {
                  0% { transform: translateX(-100%); opacity: 0; filter: blur(2px); }
                  8% { transform: translateX(0); opacity: 1; filter: blur(0); }
                  92% { transform: translateX(0); opacity: 1; filter: blur(0); }
                  100% { transform: translateX(-100%); opacity: 0; filter: blur(2px); }
                }
                .animate-slide-bar {
                  animation: slide-bar 6000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
              `}</style>
            </div>
          ) : (
            <div className="text-center py-10 bg-black/[0.04] dark:bg-white/[0.04] rounded-xl border border-black/5 dark:border-white/10">
              <p className="text-[14px] font-medium text-gray-500 dark:text-[#6F7A96]">Crea metas para configurar tus próximos objetivos</p>
            </div>
          )}
          </div>
        </div>

        {/* Modal para crear meta */}
        <StandardModal
          isOpen={showGoalModal}
          onClose={() => {
            setShowGoalModal(false);
            setNewGoal({ nombre_meta: '', monto_meta: '', fecha_limite: '' });
          }}
          title="Nueva Meta de Ahorro"
          maxWidthClass="max-w-md"
          overflowClass="overflow-visible"
          formSpaceYClass="space-y-3 sm:space-y-4"
        >
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Nombre de la Meta *
              </label>
              <input
                type="text"
                value={newGoal.nombre_meta}
                onChange={(e) => setNewGoal({ ...newGoal, nombre_meta: e.target.value })}
                placeholder="Ej: Vacaciones, Emergencia, etc."
                className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white text-[13px] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block px-4 py-2.5 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Monto Meta (COP) *
              </label>
              <input
                type="text"
                value={newGoal.monto_meta}
                onChange={(e) => setNewGoal({ ...newGoal, monto_meta: e.target.value.replace(/[^\d]/g, '') })}
                placeholder="Ej: 5000000"
                className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white text-[13px] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block px-4 py-2.5 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                Fecha Límite (Opcional)
              </label>
              <AppleDatePicker
                value={newGoal.fecha_limite}
                onChange={(date) => setNewGoal({ ...newGoal, fecha_limite: date })}
                placeholder="Seleccionar fecha..."
              />
            </div>

            <div className="flex space-x-3 pt-2">
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
                className="flex-1 px-4 py-2.5 text-[13px] font-bold rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(232,121,249,0.5)] active:scale-[0.97] transition-all duration-300 ease-out flex items-center justify-center tracking-wide"
              >
                Crear Meta
              </button>
              <button
                onClick={() => {
                  setShowGoalModal(false);
                  setNewGoal({ nombre_meta: '', monto_meta: '', fecha_limite: '' });
                }}
                className="px-5 py-2.5 text-[13px] font-bold rounded-full bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 active:scale-[0.97] transition-all duration-300 ease-out tracking-wide"
              >
                Cancelar
              </button>
          </div>
        </StandardModal>

        {/* Modal para editar meta */}
        <StandardModal
          isOpen={showEditModal && editingGoal !== null}
          onClose={() => {
            setShowEditModal(false);
            setEditingGoal(null);
          }}
          title="Editar Meta de Ahorro"
          maxWidthClass="max-w-md"
          overflowClass="overflow-visible"
          formSpaceYClass="space-y-3 sm:space-y-4"
        >
          {editingGoal && (
            <>
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Nombre de la Meta *
                </label>
                <input
                  type="text"
                  value={editingGoal.nombre_meta}
                  onChange={(e) => setEditingGoal({ ...editingGoal, nombre_meta: e.target.value })}
                  placeholder="Ej: Vacaciones, Emergencia, etc."
                  className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white text-[13px] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block px-4 py-2.5 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
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
                  className="w-full bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-gray-900 dark:text-white text-[13px] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block px-4 py-2.5 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Fecha Límite (Opcional)
                </label>
                <AppleDatePicker
                  value={editingGoal.fecha_limite ? new Date(editingGoal.fecha_limite).toISOString().split('T')[0] : ''}
                  onChange={(date) => setEditingGoal({ ...editingGoal, fecha_limite: date || undefined })}
                  placeholder="Sin límite definido"
                />
              </div>

              <div className="flex space-x-3 pt-2">
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
                  className="flex-1 px-4 py-2.5 text-[13px] font-bold rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(232,121,249,0.5)] active:scale-[0.97] transition-all duration-300 ease-out flex items-center justify-center tracking-wide"
                >
                  Guardar Cambios
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingGoal(null);
                  }}
                  className="px-5 py-2.5 text-[13px] font-bold rounded-full bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 active:scale-[0.97] transition-all duration-300 ease-out tracking-wide"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </StandardModal>
      </div>
    </div>
  );
}
