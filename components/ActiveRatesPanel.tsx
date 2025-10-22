"use client";

import { useEffect, useState } from "react";

interface ActiveRate {
  id: string;
  kind: string;
  scope: string;
  value: number;
  source: string;
  valid_from: string;
}

interface ActiveRatesPanelProps {
  compact?: boolean;
  showTitle?: boolean;
  refreshTrigger?: number; // Para forzar actualización desde el componente padre
}

export default function ActiveRatesPanel({ compact = false, showTitle = true, refreshTrigger }: ActiveRatesPanelProps) {
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
          return (!validTo || validTo > now) && calculatorRates.includes(rate.kind);
        })
        .sort((a: any, b: any) => {
          // Ordenar por fecha de creación (más reciente primero)
          return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
        })
        .reduce((acc: any[], rate: any) => {
          // Solo mantener la primera (más reciente) de cada tipo
          if (!acc.find(r => r.kind === rate.kind)) {
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
      case 'manual': return '✏️';
      case 'ECB': return '🏛️';
      case 'system': return '🤖';
      case 'OXR': return '📊';
      default: return '📋';
    }
  };

  if (compact) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300 cursor-pointer">
        {showTitle && (
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Tasas de Calculadora</h3>
              <p className="text-xs text-gray-500">Solo manuales</p>
            </div>
            {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-auto"></div>}
          </div>
        )}
        
        {error ? (
          <p className="text-red-600 text-xs">{error}</p>
        ) : (
          <div className="space-y-2">
            {rates.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-2">No hay tasas de calculadora</p>
            ) : (
              rates.map((rate) => (
                <div key={rate.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-md">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">{getSourceIcon(rate.source)}</span>
                    <span className="text-xs font-medium">{getKindLabel(rate.kind)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-gray-900">{rate.value}</div>
                    <div className="text-xs text-gray-500">{getScopeLabel(rate.scope)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Tasas de Calculadora</h2>
            <p className="text-xs text-gray-600">Solo tasas manuales</p>
          </div>
        </div>
        <button 
          onClick={loadActiveRates}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-lg hover:bg-blue-100/80 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

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
        <div className="space-y-3">
          {rates.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1">No hay tasas de calculadora</p>
              <p className="text-gray-400 text-xs">Configura las tasas manualmente</p>
            </div>
          ) : (
            rates.map((rate) => (
              <div key={rate.id} className="flex items-center justify-between p-3 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200/30 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                    <span className="text-sm">{getSourceIcon(rate.source)}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{getKindLabel(rate.kind)}</div>
                    <div className="text-xs text-gray-500">{getScopeLabel(rate.scope)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-gray-900">{rate.value}</div>
                  <div className="text-xs text-gray-500">
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
  );
}
