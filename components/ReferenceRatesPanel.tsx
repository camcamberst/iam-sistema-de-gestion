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
    if (source.includes('TRM')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>;
    if (source.includes('SPOT')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
    if (source.includes('ExchangeRate')) return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>;
    return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
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
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
      {/* TITLE OUTSIDE THE BOX */}
      <div className="flex items-center justify-between px-1 h-[40px]">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-indigo-500 drop-shadow-[0_0_8px_rgba(79,70,229,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="relative flex items-center">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              Tasas de Referencia
            </h2>
          </div>
        </div>
        <button 
          onClick={loadReferenceRates}
          className="p-1.5 flex items-center justify-center text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors duration-200 disabled:opacity-50"
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
          <p className="text-red-600 dark:text-red-400 text-xs mb-3">{error}</p>
          <button 
            onClick={loadReferenceRates}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-lg hover:bg-red-100/80 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rates.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-300 text-sm font-medium mb-1">No hay tasas de referencia</p>
              <p className="text-gray-400 dark:text-gray-400 text-xs">Las tasas se cargarán automáticamente</p>
            </div>
          ) : (
            rates.map((rate, index) => (
              <div key={index} className="flex items-center justify-between px-3 py-2 bg-indigo-50/50 dark:bg-indigo-500/[0.08] backdrop-blur-sm rounded-lg border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center opacity-70 text-indigo-500 dark:text-indigo-400">
                    <span>{getSourceIcon(rate.source)}</span>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{getKindLabel(rate.kind)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 opacity-80">{rate.source}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{formatValue(rate.value, rate.kind)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 opacity-80">
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

      </div>
    </div>
  );
}
