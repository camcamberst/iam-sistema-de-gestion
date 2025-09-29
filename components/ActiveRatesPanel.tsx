"use client";

import { useEffect, useState } from "react";

interface ActiveRate {
  id: string;
  kind: string;
  scope: string;
  value_effective: number;
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
      const calculatorRates = ['USD_COP', 'EUR_USD', 'GBP_USD'];
      
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
          // Ordenar por prioridad: USD_COP, EUR_USD, GBP_USD
          const order = { 'USD_COP': 1, 'EUR_USD': 2, 'GBP_USD': 3 };
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
      case 'USD_COP': return 'USD → COP';
      case 'EUR_USD': return 'EUR → USD';
      case 'GBP_USD': return 'GBP → USD';
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
      <div className="apple-card">
        {showTitle && (
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Tasas de Calculadora</h3>
              <p className="text-xs text-gray-500">Solo manuales</p>
            </div>
            {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
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
                    <div className="text-xs font-semibold text-gray-900">{rate.value_effective}</div>
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
    <div className="apple-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium">Tasas de Calculadora</h2>
          <p className="text-xs text-gray-500">Solo tasas manuales</p>
        </div>
        <button 
          onClick={loadActiveRates}
          className="text-xs text-blue-600 hover:text-blue-800"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error ? (
        <div className="text-center py-4">
          <p className="text-red-600 text-xs">{error}</p>
          <button 
            onClick={loadActiveRates}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rates.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-gray-400 text-sm">📊</span>
              </div>
              <p className="text-gray-500 text-xs">No hay tasas de calculadora</p>
              <p className="text-gray-400 text-xs mt-1">Configura las tasas manualmente</p>
            </div>
          ) : (
            rates.map((rate) => (
              <div key={rate.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md border border-gray-200">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{getSourceIcon(rate.source)}</span>
                  <div>
                    <div className="text-xs font-medium text-gray-900">{getKindLabel(rate.kind)}</div>
                    <div className="text-xs text-gray-500">{getScopeLabel(rate.scope)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{rate.value_effective}</div>
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
