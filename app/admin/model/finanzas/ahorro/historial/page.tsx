"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import AppleDropdown from '@/components/ui/AppleDropdown';

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
                  <Link
                    href="/admin/model/finanzas/ahorro"
                    className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </Link>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Historial de Ahorros
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Consulta todos tus movimientos de ahorro
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex space-x-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('ahorros')}
            className={`px-6 py-3 font-medium text-sm transition-all ${
              activeTab === 'ahorros'
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Ahorros
          </button>
          <button
            onClick={() => setActiveTab('retiros')}
            className={`px-6 py-3 font-medium text-sm transition-all ${
              activeTab === 'retiros'
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Retiros
          </button>
          <button
            onClick={() => setActiveTab('ajustes')}
            className={`px-6 py-3 font-medium text-sm transition-all ${
              activeTab === 'ajustes'
                ? 'border-b-2 border-green-600 text-green-600 dark:text-green-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Ajustes
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex items-center space-x-4">
          <AppleDropdown
            options={[
              { value: 'todos', label: 'Todos los estados' },
              { value: 'aprobado', label: 'Aprobados' },
              { value: 'pendiente', label: 'Pendientes' },
              { value: 'rechazado', label: 'Rechazados' },
              { value: 'cancelado', label: 'Cancelados' },
              ...(activeTab === 'retiros' ? [{ value: 'realizado', label: 'Realizados' }] : [])
            ]}
            value={estadoFiltro}
            onChange={(value) => setEstadoFiltro(value)}
          />
        </div>

        {/* Contenido según tab */}
        {activeTab === 'ahorros' && (
          <div className="space-y-4">
            {savings.length === 0 ? (
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-12 border border-white/20 dark:border-gray-600/20 shadow-md text-center">
                <p className="text-gray-500 dark:text-gray-400">No hay registros de ahorro</p>
              </div>
            ) : (
              savings.map((saving) => (
                <div
                  key={saving.id}
                  className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          saving.estado === 'aprobado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          saving.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          saving.estado === 'rechazado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {saving.estado === 'aprobado' ? 'Aprobado' :
                           saving.estado === 'pendiente' ? 'Pendiente' :
                           saving.estado === 'rechazado' ? 'Rechazado' :
                           'Cancelado'}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {new Date(saving.period_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} ({saving.period_type === '1-15' ? 'P1' : 'P2'})
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monto Solicitado</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(saving.monto_ahorrado)}</p>
                        </div>
                        {saving.monto_ajustado && saving.monto_ajustado !== saving.monto_ahorrado && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monto Ajustado</p>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(saving.monto_ajustado)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Porcentaje</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{saving.porcentaje_ahorrado.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(saving.created_at)}</p>
                        </div>
                      </div>
                      {saving.comentarios_admin && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Comentarios: {saving.comentarios_admin}</p>
                      )}
                      {saving.comentarios_rechazo && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">Motivo rechazo: {saving.comentarios_rechazo}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'retiros' && (
          <div className="space-y-4">
            {withdrawals.length === 0 ? (
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-12 border border-white/20 dark:border-gray-600/20 shadow-md text-center">
                <p className="text-gray-500 dark:text-gray-400">No hay registros de retiros</p>
              </div>
            ) : (
              withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          withdrawal.estado === 'realizado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          withdrawal.estado === 'aprobado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          withdrawal.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          withdrawal.estado === 'rechazado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}>
                          {withdrawal.estado === 'realizado' ? 'Realizado' :
                           withdrawal.estado === 'aprobado' ? 'Aprobado' :
                           withdrawal.estado === 'pendiente' ? 'Pendiente' :
                           withdrawal.estado === 'rechazado' ? 'Rechazado' :
                           'Cancelado'}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(withdrawal.monto_solicitado)}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Medio de Pago</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{withdrawal.medio_pago}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha Solicitud</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(withdrawal.created_at)}</p>
                        </div>
                        {withdrawal.approved_at && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha Aprobación</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(withdrawal.approved_at)}</p>
                          </div>
                        )}
                        {withdrawal.realized_at && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha Realización</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatDate(withdrawal.realized_at)}</p>
                          </div>
                        )}
                      </div>
                      {withdrawal.comentarios_admin && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Comentarios: {withdrawal.comentarios_admin}</p>
                      )}
                      {withdrawal.comentarios_rechazo && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">Motivo rechazo: {withdrawal.comentarios_rechazo}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'ajustes' && (
          <div className="space-y-4">
            {adjustments.length === 0 ? (
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-12 border border-white/20 dark:border-gray-600/20 shadow-md text-center">
                <p className="text-gray-500 dark:text-gray-400">No hay ajustes registrados</p>
              </div>
            ) : (
              adjustments.map((adjustment) => (
                <div
                  key={adjustment.id}
                  className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          adjustment.monto > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {adjustment.monto > 0 ? 'Suma' : 'Resta'}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {adjustment.concepto}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monto</p>
                          <p className={`text-sm font-semibold ${adjustment.monto > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {adjustment.monto > 0 ? '+' : ''}{formatCurrency(adjustment.monto)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tipo</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{adjustment.tipo_ajuste}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Realizado por</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{adjustment.admin?.name ?? 'Admin'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatDate(adjustment.created_at)}</p>
                        </div>
                      </div>
                      {adjustment.comentarios && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Comentarios: {adjustment.comentarios}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
