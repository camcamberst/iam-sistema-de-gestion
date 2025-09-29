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
}

export default function ActiveRatesPanel({ compact = false, showTitle = true }: ActiveRatesPanelProps) {
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

      // Filtrar solo tasas activas y agrupar por tipo
      const now = new Date();
      const activeRates = data.data
        .filter((rate: any) => {
          const validTo = rate.valid_to ? new Date(rate.valid_to) : null;
          return !validTo || validTo > now;
        })
        .sort((a: any, b: any) => {
          if (a.kind !== b.kind) {
            return a.kind.localeCompare(b.kind);
          }
          return new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime();
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
            <h3 className="text-sm font-medium text-gray-900">Tasas Activas</h3>
            {loading && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
          </div>
        )}
        
        {error ? (
          <p className="text-red-600 text-xs">{error}</p>
        ) : (
          <div className="space-y-2">
            {rates.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-2">No hay tasas activas</p>
            ) : (
              rates.slice(0, 3).map((rate) => (
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
            {rates.length > 3 && (
              <p className="text-xs text-gray-500 text-center">+{rates.length - 3} más</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="apple-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium">Tasas Activas para Calculadora</h2>
        <button 
          onClick={loadActiveRates}
          className="text-xs text-blue-600 hover:text-blue-800"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error ? (
        <div className="text-center py-6">
          <p className="text-red-600 text-sm">{error}</p>
          <button 
            onClick={loadActiveRates}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rates.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-gray-400 text-xl">📊</span>
              </div>
              <p className="text-gray-500 text-sm">No hay tasas activas</p>
              <p className="text-gray-400 text-xs mt-1">Las tasas se cargarán automáticamente</p>
            </div>
          ) : (
            rates.map((rate) => (
              <div key={rate.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getSourceIcon(rate.source)}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{getKindLabel(rate.kind)}</div>
                    <div className="text-xs text-gray-500">{getScopeLabel(rate.scope)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{rate.value_effective}</div>
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
