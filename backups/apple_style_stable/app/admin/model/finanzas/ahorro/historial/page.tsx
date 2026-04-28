"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from '@/components/ui/PageHeader';
import PillTabs from '@/components/ui/PillTabs';
import GlassCard from '@/components/ui/GlassCard';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';
import { History, ArrowLeft, PiggyBank, Clock, CheckCircle, XCircle } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SavingsHistory {
  id: string;
  period_date: string;
  period_type: '1-15' | '16-31';
  monto_ahorrado: number;
  monto_ajustado?: number;
  porcentaje_ahorrado: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  comentarios_admin?: string;
  comentarios_rechazo?: string;
}

interface WithdrawalHistory {
  id: string;
  monto_solicitado: number;
  medio_pago: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'realizado' | 'cancelado';
  created_at: string;
  approved_at?: string;
  realized_at?: string;
  comentarios_admin?: string;
  comentarios_rechazo?: string;
}

interface AdjustmentHistory {
  id: string;
  tipo_ajuste: string;
  concepto: string;
  monto: number;
  created_at: string;
  admin?: {
    id: string;
    name: string;
  } | null;
  comentarios?: string;
}

export default function HistorialAhorrosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savings, setSavings] = useState<SavingsHistory[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalHistory[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'ahorros' | 'retiros' | 'ajustes'>('ahorros');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos');
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab, estadoFiltro]);

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
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      if (activeTab === 'ahorros') {
        const response = await fetch(`/api/model/savings?modelId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          let filtered = data.savings || [];
          if (estadoFiltro !== 'todos') {
            filtered = filtered.filter((s: SavingsHistory) => s.estado === estadoFiltro);
          }
          setSavings(filtered);
        }
      } else if (activeTab === 'retiros') {
        const response = await fetch(`/api/model/savings/withdrawals?modelId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          let filtered = data.withdrawals || [];
          if (estadoFiltro !== 'todos') {
            filtered = filtered.filter((w: WithdrawalHistory) => w.estado === estadoFiltro);
          }
          setWithdrawals(filtered);
        }
      } else if (activeTab === 'ajustes') {
        const response = await fetch(`/api/admin/savings/adjustments?modelId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
          setAdjustments((data.adjustments || []) as AdjustmentHistory[]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error al cargar datos');
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-6xl mx-auto max-sm:px-0 sm:px-6 lg:px-8 pb-4 sm:pb-2 pt-6 sm:pt-2 relative z-10">
        {/* Header */}
        <PageHeader
          title="Historial de Ahorros"
          glow="model"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />


        {/* Tabs */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <PillTabs
            tabs={[
              { id: 'ahorros', label: 'Ahorros' },
              { id: 'retiros', label: 'Retiros' },
              { id: 'ajustes', label: 'Ajustes' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab: string) => setActiveTab(tab as any)}
          />
        </div>

        {/* Filtros */}
        <div className="mb-4 sm:mb-6 relative z-20">
          <GlassCard padding="none" className="rounded-xl p-3 sm:p-4 overflow-visible">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Filtrar por estado:</span>
              <div className="flex-1 sm:flex-initial sm:min-w-[160px] flex items-center gap-2">
                <AppleDropdown
                  options={
                    activeTab === 'retiros' 
                    ? [
                        { value: 'aprobado', label: 'Aprobados' },
                        { value: 'pendiente', label: 'Pendientes' },
                        { value: 'rechazado', label: 'Rechazados' },
                        { value: 'cancelado', label: 'Cancelados' },
                        { value: 'realizado', label: 'Realizados' }
                      ]
                    : [
                        { value: 'aprobado', label: 'Aprobados' },
                        { value: 'pendiente', label: 'Pendientes' },
                        { value: 'rechazado', label: 'Rechazados' },
                        { value: 'cancelado', label: 'Cancelados' }
                      ]
                  }
                  value={estadoFiltro}
                  onChange={(value) => setEstadoFiltro(value)}
                  placeholder="Todos"
                  className="w-full"
                />
                {estadoFiltro !== 'todos' && (
                  <button
                    onClick={() => setEstadoFiltro('todos')}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Limpiar filtro"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Contenido según tab */}
        {activeTab === 'ahorros' && (
          <GlassCard padding="none" className="rounded-xl overflow-hidden">
            {savings.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay registros de ahorro</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">No tienes ahorros registrados en este estado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {savings.map((saving) => (
                  <div key={saving.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-600/20 transition-colors">
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                          saving.estado === 'aprobado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          saving.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          saving.estado === 'rechazado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {saving.estado.charAt(0).toUpperCase() + saving.estado.slice(1)}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {new Date(saving.period_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} ({saving.period_type === '1-15' ? 'P1' : 'P2'})
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Monto Ahorrado</p>
                          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(saving.monto_ahorrado)}</p>
                        </div>
                        {saving.monto_ajustado && saving.monto_ajustado !== saving.monto_ahorrado && (
                          <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-3 sm:p-4 border border-blue-100 dark:border-blue-900/50">
                            <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mb-1">Monto Ajustado</p>
                            <p className="text-base sm:text-lg font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(saving.monto_ajustado)}</p>
                          </div>
                        )}
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Porcentaje</p>
                          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{saving.porcentaje_ahorrado.toFixed(2)}%</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{formatDate(saving.created_at)}</p>
                        </div>
                      </div>
                      {saving.comentarios_admin && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300"><strong>Comentarios:</strong> {saving.comentarios_admin}</p>
                        </div>
                      )}
                      {saving.comentarios_rechazo && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-red-700 dark:text-red-300"><strong>Motivo rechazo:</strong> {saving.comentarios_rechazo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === 'retiros' && (
          <GlassCard padding="none" className="rounded-xl overflow-hidden mt-6">
            {withdrawals.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay registros de retiros</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">No tienes retiros registrados en este estado.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-600/20 transition-colors">
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                          withdrawal.estado === 'realizado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          withdrawal.estado === 'aprobado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          withdrawal.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          withdrawal.estado === 'rechazado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {withdrawal.estado.charAt(0).toUpperCase() + withdrawal.estado.slice(1)}
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(withdrawal.monto_solicitado)}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Medio de Pago</p>
                          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">{withdrawal.medio_pago}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Fecha Solicitud</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{formatDate(withdrawal.created_at)}</p>
                        </div>
                        {withdrawal.approved_at && (
                          <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Fecha Aprobación</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{formatDate(withdrawal.approved_at)}</p>
                          </div>
                        )}
                        {withdrawal.realized_at && (
                          <div className="bg-green-50/50 dark:bg-green-900/10 rounded-lg p-3 sm:p-4 border border-green-100 dark:border-green-900/50">
                            <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mb-1">Fecha Realización</p>
                            <p className="text-sm font-medium text-green-700 dark:text-green-300 mt-1">{formatDate(withdrawal.realized_at)}</p>
                          </div>
                        )}
                      </div>
                      {withdrawal.comentarios_admin && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300"><strong>Comentarios:</strong> {withdrawal.comentarios_admin}</p>
                        </div>
                      )}
                      {withdrawal.comentarios_rechazo && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-red-700 dark:text-red-300"><strong>Motivo rechazo:</strong> {withdrawal.comentarios_rechazo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}

        {activeTab === 'ajustes' && (
          <GlassCard padding="none" className="rounded-xl overflow-hidden mt-6">
            {adjustments.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay ajustes registrados</h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">No tienes ajustes manuales en tu cuenta.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {adjustments.map((adjustment) => (
                  <div key={adjustment.id} className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-600/20 transition-colors">
                    <div className="flex flex-col gap-3 sm:gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium w-fit ${
                          adjustment.monto > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {adjustment.monto > 0 ? 'Suma' : 'Resta'}
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {adjustment.concepto}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <div className={`rounded-lg p-3 sm:p-4 ${adjustment.monto > 0 ? 'bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/50' : 'bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/50'}`}>
                          <p className={`text-xs sm:text-sm mb-1 ${adjustment.monto > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>Monto</p>
                          <p className={`text-base sm:text-lg font-semibold ${adjustment.monto > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                            {adjustment.monto > 0 ? '+' : ''}{formatCurrency(adjustment.monto)}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Tipo</p>
                          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">{adjustment.tipo_ajuste}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Realizado por</p>
                          <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{adjustment.admin?.name ?? 'Admin'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-600/20 rounded-lg p-3 sm:p-4">
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{formatDate(adjustment.created_at)}</p>
                        </div>
                      </div>
                      {adjustment.comentarios && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-600/20 border border-gray-200 dark:border-gray-700/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300"><strong>Comentarios:</strong> {adjustment.comentarios}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        )}
        <div className="mt-8 flex justify-center w-full relative z-20">
          <button
            onClick={() => router.push('/admin/model/finanzas/ahorro')}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-300 group"
          >
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform duration-300 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="relative">Volver a Ahorros
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-400 dark:bg-white transition-all duration-300 group-hover:w-full"></span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
