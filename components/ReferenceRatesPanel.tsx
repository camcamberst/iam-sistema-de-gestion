"use client";

import { useEffect, useState } from "react";

interface ReferenceRate {
  kind: string;
  source: string;
  value: number;
  url: string;
  lastUpdated: string;
  description: string;
}

export default function ReferenceRatesPanel() {
  const [rates, setRates] = useState<ReferenceRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReferenceRates() {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/rates/reference");
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || "Error al cargar tasas de referencia");
      }

      setRates(data.data);
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferenceRates();
  }, []);

  const getKindLabel = (kind: string) => {
    switch (kind) {
      case 'USD_COP': return 'USD → COP';
      case 'EUR_USD': return 'EUR → USD';
      case 'GBP_USD': return 'GBP → USD';
      default: return kind;
    }
  };

  const getSourceIcon = (source: string) => {
    if (source.includes('TRM')) return '🏛️';
    if (source.includes('SPOT')) return '📊';
    if (source.includes('ExchangeRate')) return '🌐';
    return '📋';
  };

  const formatValue = (value: number, kind: string) => {
    if (kind === 'USD_COP') {
      return value.toLocaleString('es-CO', { 
        style: 'currency', 
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }
    return value.toFixed(4);
  };

  return (
    <div className="apple-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium">Tasas de Referencia</h2>
          <p className="text-xs text-gray-500">Valores del día desde fuentes externas</p>
        </div>
        <button 
          onClick={loadReferenceRates}
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
            onClick={loadReferenceRates}
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
                <span className="text-gray-400 text-sm">🌐</span>
              </div>
              <p className="text-gray-500 text-xs">No hay tasas de referencia</p>
              <p className="text-gray-400 text-xs mt-1">Las tasas se cargarán automáticamente</p>
            </div>
          ) : (
            rates.map((rate, index) => (
              <div key={index} className="flex items-center justify-between p-2.5 bg-blue-50 rounded-md border border-blue-200">
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{getSourceIcon(rate.source)}</span>
                  <div>
                    <div className="text-xs font-medium text-gray-900">{getKindLabel(rate.kind)}</div>
                    <div className="text-xs text-gray-500">{rate.source}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-blue-900">{formatValue(rate.value, rate.kind)}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(rate.lastUpdated).toLocaleDateString('es-ES', {
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

      {rates.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            💡 Usa estos valores como referencia para personalizar tus tasas
          </p>
        </div>
      )}
    </div>
  );
}
