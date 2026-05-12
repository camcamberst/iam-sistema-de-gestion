"use client";

import { useEffect, useState } from "react";

interface ActiveRate {
  id: string;
  kind: string;
  scope: string;
  value: number;
  source: string;
  valid_from: string;
  author?: { name: string } | null;
}

interface ActiveRatesPanelProps {
  compact?: boolean;
  showTitle?: boolean;
  refreshTrigger?: number; // Para forzar actualización desde el componente padre
  userRole?: 'admin' | 'super_admin' | 'superadmin_aff' | string; // Rol del usuario para ocultar información según corresponda
}

export default function ActiveRatesPanel({ compact = false, showTitle = true, refreshTrigger, userRole }: ActiveRatesPanelProps) {
  const [rates, setRates] = useState<ActiveRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadActiveRates() {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/rates?activeOnly=true");
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Error al cargar tasas");
      }

      // Filtrar solo tasas activas de las 3 divisas específicas para la calculadora
      const now = new Date();
      const calculatorRates = ['USD→COP', 'EUR→USD', 'GBP→USD'];
      
      // Filtrar solo tasas activas y obtener la más reciente de cada tipo
      const activeRates = data.data
        .filter((rate: any) => {
          const validTo = rate.valid_to ? new Date(rate.valid_to) : null;
          const normalizedKind = String(rate.kind).replace(/[^A-Za-z]/g, '').toUpperCase();
          return (!validTo || validTo > now) && ['USDCOP', 'EURUSD', 'GBPUSD'].includes(normalizedKind);
        })
        .sort((a: any, b: any) => {
          // Ordenar por fecha de creación (más reciente primero)
          return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
        })
        .reduce((acc: any[], rate: any) => {
          // Extraer solo las letras (ej: USDCOP) para identificar inequívocamente el par
          const normalizedRateKind = String(rate.kind).replace(/[^A-Za-z]/g, '').toUpperCase();
          
          // Solo mantener la primera (más reciente) de cada tipo
          if (!acc.find(r => {
            const normalizedRKind = String(r.kind).replace(/[^A-Za-z]/g, '').toUpperCase();
            return normalizedRKind === normalizedRateKind;
          })) {
            // Restaurar a un nombre limpio
            if (normalizedRateKind === 'USDCOP') rate.kind = 'USD→COP';
            else if (normalizedRateKind === 'EURUSD') rate.kind = 'EUR→USD';
            else if (normalizedRateKind === 'GBPUSD') rate.kind = 'GBP→USD';
            acc.push(rate);
          }
          return acc;
        }, [])
        .sort((a: any, b: any) => {
          // Ordenar por prioridad: USD→COP, EUR→USD, GBP→USD
          const order = { 'USD→COP': 1, 'EUR→USD': 2, 'GBP→USD': 3 };
          return (order[a.kind as keyof typeof order] || 4) - (order[b.kind as keyof typeof order] || 4);
        });

      setRates(activeRates);
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActiveRates();
  }, []);

  // Actualizar cuando cambie el refreshTrigger
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadActiveRates();
    }
  }, [refreshTrigger]);

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case 'USD→COP': return 'USD → COP';
      case 'EUR→USD': return 'EUR → USD';
      case 'GBP→USD': return 'GBP → USD';
      default: return kind;
    }
  };

  const getScopeLabel = (scope: string) => {
    if (scope === 'global') return 'Global';
    if (scope.startsWith('group:')) return `Grupo: ${scope.replace('group:', '')}`;
    return scope;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'manual': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
      case 'ECB': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>;
      case 'system': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
      case 'OXR': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
      default: return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
        {showTitle && (
          <div className="flex items-center justify-between px-1 h-[40px]">
            <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
              <div className="flex items-center justify-center text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
                <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="relative flex items-center">
                <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  Tasas Actuales
                </h2>
              </div>
            </div>
            {loading && <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
          </div>
        )}
        
        <div className="glass-card p-3 sm:p-4 flex-1 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative flex flex-col">
          {error ? (
            <p className="text-red-600 text-xs">{error}</p>
          ) : (
          <div className="space-y-1 mb-4 flex-1">
            {rates.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-300 text-xs text-center py-2">No hay tasas actuales</p>
            ) : (
              rates.map((rate) => (
                <div key={rate.id} className="flex items-center justify-between py-1 px-2 bg-gray-50 dark:bg-white/[0.06] rounded-md">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center justify-center opacity-70">
                      <span>{getSourceIcon(rate.source)}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{getKindLabel(rate.kind)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{rate.value}</div>
                    {userRole !== 'superadmin_aff' && (
                      <div className="text-xs text-gray-800 dark:text-gray-400 opacity-70">
                        {rate.author?.name || 'Sistema'}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

          {/* Footer del widget */}
          <div className="mt-auto pt-2 border-t border-gray-200/50 dark:border-gray-600/40 flex justify-between items-center px-1">
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
              Tasas activas
            </span>
            <a 
              href="/admin/rates" 
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Ver panel completo →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-center justify-between px-1 h-[40px]">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="relative flex items-center">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              Tasas Actuales
            </h2>
          </div>
        </div>
        <button 
          onClick={loadActiveRates}
          className="p-1.5 flex items-center justify-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200 disabled:opacity-50"
          disabled={loading}
          title="Actualizar"
        >
          <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="glass-card p-3 sm:p-4 flex-1 flex flex-col">
        {error ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600 text-xs mb-3">{error}</p>
          <button 
            onClick={loadActiveRates}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-lg hover:bg-red-100/80 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rates.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-300 text-sm font-medium mb-1">No hay tasas actuales</p>
              <p className="text-gray-400 dark:text-gray-400 text-xs">Configura las tasas manualmente</p>
            </div>
          ) : (
            rates.map((rate) => (
              <div key={rate.id} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-white/[0.06] backdrop-blur-sm rounded-lg border border-gray-200/30 dark:border-gray-600/40 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center opacity-70">
                    <span>{getSourceIcon(rate.source)}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{getKindLabel(rate.kind)}</div>
                    {userRole !== 'superadmin_aff' && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 opacity-80">
                        {rate.author?.name || 'Sistema'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{rate.value}</div>
                  <div className="text-xs text-gray-800 dark:text-gray-400">
                    {new Date(rate.valid_from).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
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
