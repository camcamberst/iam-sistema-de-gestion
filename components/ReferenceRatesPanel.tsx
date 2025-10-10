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
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Tasas de Referencia</h2>
            <p className="text-xs text-gray-600">Valores del día desde fuentes externas</p>
          </div>
        </div>
        <button 
          onClick={loadReferenceRates}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50/80 backdrop-blur-sm border border-indigo-200/50 rounded-lg hover:bg-indigo-100/80 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
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
            onClick={loadReferenceRates}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-lg hover:bg-red-100/80 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rates.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1">No hay tasas de referencia</p>
              <p className="text-gray-400 text-xs">Las tasas se cargarán automáticamente</p>
            </div>
          ) : (
            rates.map((rate, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-indigo-50/60 backdrop-blur-sm rounded-lg border border-indigo-200/30 shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">{getSourceIcon(rate.source)}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{getKindLabel(rate.kind)}</div>
                    <div className="text-xs text-gray-500">{rate.source}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-indigo-900">{formatValue(rate.value, rate.kind)}</div>
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
        <div className="mt-4 pt-4 border-t border-gray-200/50">
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>Usa estos valores como referencia para personalizar tus tasas</span>
          </div>
        </div>
      )}
    </div>
  );
}
