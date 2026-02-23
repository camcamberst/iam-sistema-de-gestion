'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ProductivityModel {
  modelId: string;
  name: string;
  groupName: string | null;
  usdBruto: number;
  cuotaMinima: number;
  porcentaje: number;
  estaPorDebajo: boolean;
  lastUpdated: string | null;
}

interface ProductivitySummary {
  totalModels: number;
  modelsPorEncima: number;
  modelsPorDebajo: number;
  avgPorcentaje: number;
}

interface Props {
  userId: string;
  userRole: 'admin' | 'super_admin' | 'superadmin_aff';
}

const POLL_MS = 2 * 60 * 1000;

const fmt  = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function pctColor(p: number) {
  if (p >= 100) return 'text-green-600';
  if (p >= 70)  return 'text-yellow-500';
  return 'text-red-500';
}
function barCls(p: number) {
  if (p >= 100) return 'bg-green-500';
  if (p >= 70)  return 'bg-yellow-400';
  return 'bg-red-500';
}

function timeAgoLabel(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export default function ProductivityWidget({ userId, userRole }: Props) {
  const [models,      setModels]      = useState<ProductivityModel[]>([]);
  const [summary,     setSummary]     = useState<ProductivitySummary | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/productivity-realtime?adminId=${userId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setModels(data.models || []);
      setSummary(data.summary);
      setPeriodLabel(data.periodLabel || '');
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  // 3 modelos con actualización más reciente
  const recent = [...models]
    .filter(m => m.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
    .slice(0, 3);

  return (
    <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md dark:shadow-lg dark:shadow-emerald-900/10 dark:ring-0.5 dark:ring-emerald-500/15 border border-white/20 dark:border-gray-600/20 p-4 hover:shadow-xl hover:bg-white/95 dark:hover:bg-gray-600/80 hover:scale-[1.02] transition-all duration-300">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Productividad en Tiempo Real</h3>
            {periodLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-300">{periodLabel}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center justify-center w-6 h-6 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors disabled:opacity-50"
          title="Actualizar"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-300">Cargando...</span>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <p className="text-xs text-red-600 dark:text-red-400 text-center py-4">{error}</p>
      )}

      {/* ── Summary cards ── */}
      {summary && !loading && (
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <div className="text-center p-1.5 rounded-lg bg-gray-50/80 dark:bg-gray-600/40">
            <div className="text-sm font-bold text-gray-800 dark:text-gray-100">{summary.totalModels}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-green-50/80 dark:bg-green-900/20">
            <div className="text-sm font-bold text-green-600">{summary.modelsPorEncima}</div>
            <div className="text-[10px] text-green-700 dark:text-green-400">Sobre obj.</div>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-red-50/80 dark:bg-red-900/20">
            <div className="text-sm font-bold text-red-500">{summary.modelsPorDebajo}</div>
            <div className="text-[10px] text-red-600 dark:text-red-400">Por debajo</div>
          </div>
          <div className="text-center p-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-900/20">
            <div className={`text-sm font-bold ${pctColor(summary.avgPorcentaje)}`}>{fmtD(summary.avgPorcentaje)}%</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400">Promedio</div>
          </div>
        </div>
      )}

      {/* ── Últimas actualizaciones ── */}
      {!loading && !error && recent.length > 0 && (
        <div className="border-t border-gray-200/50 dark:border-gray-600/40 pt-3">
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">
            Últimas actualizaciones
          </div>
          <div className="space-y-1.5">
            {recent.map(m => {
              const pct = Math.min(m.porcentaje, 100);
              return (
                <div key={m.modelId} className="py-1.5 px-2 bg-gray-50 dark:bg-white/[0.06] rounded-md">
                  {/* Nombre + % + tiempo */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate block">{m.name}</span>
                        {m.groupName && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none">{m.groupName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-xs font-semibold tabular-nums ${pctColor(m.porcentaje)}`}>
                        {fmtD(m.porcentaje)}%
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {timeAgoLabel(m.lastUpdated)}
                      </span>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barCls(m.porcentaje)}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: '70%' }} />
                  </div>
                  {/* Amount */}
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                    ${fmt(m.usdBruto)} <span className="text-gray-300 dark:text-gray-600">/ ${fmt(m.cuotaMinima)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && recent.length === 0 && (
        <div className="border-t border-gray-200/50 dark:border-gray-600/40 pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-300 text-center py-3">Sin datos para este período</p>
        </div>
      )}

      {/* ── Footer ── */}
      {models.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-gray-200/50 dark:border-gray-600/40 text-center">
          <a href="/admin/sedes/dashboard"
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
            Ver panel completo →
          </a>
        </div>
      )}
    </div>
  );
}
