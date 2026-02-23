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
  if (p >= 100) return 'text-green-600 dark:text-green-400';
  if (p >= 70)  return 'text-yellow-500 dark:text-yellow-400';
  return 'text-red-500 dark:text-red-400';
}
function barCls(p: number) {
  if (p >= 100) return 'bg-green-500';
  if (p >= 70)  return 'bg-yellow-400';
  return 'bg-red-500';
}

function timeAgoLabel(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export default function ProductivityWidget({ userId, userRole }: Props) {
  const [models,      setModels]      = useState<ProductivityModel[]>([]);
  const [summary,     setSummary]     = useState<ProductivitySummary | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
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
      setLastRefresh(new Date());
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

  // Las 3 modelos actualizadas más recientemente
  const recent = [...models]
    .filter(m => m.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
    .slice(0, 3);

  const timeAgo = lastRefresh
    ? (() => { const s = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
        return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min`; })()
    : null;

  return (
    <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-blue-900/10 overflow-hidden">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/60 dark:border-gray-600/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              Productividad en Tiempo Real
            </h3>
            {periodLabel && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5 hidden sm:block">{periodLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {timeAgo && (
            <div className="hidden sm:flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500">hace {timeAgo}</span>
            </div>
          )}
          <button onClick={() => load()} disabled={loading}
            className="flex items-center justify-center w-7 h-7 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
            title="Actualizar">
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Mini stats ─── */}
      {summary && !loading && (
        <div className="grid grid-cols-4 divide-x divide-gray-100/60 dark:divide-gray-600/40 border-b border-gray-100/60 dark:border-gray-600/40">
          {[
            { val: summary.totalModels,                            lbl: 'Total',        cls: 'text-gray-800 dark:text-gray-200' },
            { val: summary.modelsPorEncima,                        lbl: 'Sobre obj.',   cls: 'text-green-600 dark:text-green-400' },
            { val: summary.modelsPorDebajo,                        lbl: 'Por debajo',   cls: 'text-red-500 dark:text-red-400' },
            { val: `${fmtD(summary.avgPorcentaje)}%`,              lbl: 'Promedio',     cls: pctColor(summary.avgPorcentaje) },
          ].map(({ val, lbl, cls }) => (
            <div key={lbl} className="flex flex-col items-center justify-center py-2.5 px-1">
              <span className={`text-base sm:text-lg font-bold tabular-nums leading-none ${cls}`}>{val}</span>
              <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 text-center leading-tight">{lbl}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500" />
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">Cargando...</span>
        </div>
      )}

      {/* ─── Error ─── */}
      {error && !loading && (
        <div className="m-3 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ─── Últimas 3 actualizaciones ─── */}
      {!loading && !error && (
        <div>
          {/* Sub-header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Últimas actualizaciones
            </span>
          </div>

          {recent.length === 0 ? (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-5">Sin datos para este período</p>
          ) : (
            <div className="divide-y divide-gray-100/60 dark:divide-gray-700/40">
              {recent.map(m => {
                const pct = Math.min(m.porcentaje, 100);
                return (
                  <div key={m.modelId} className="px-4 py-2.5 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition-colors">
                    {/* Row: avatar + name + sede | % + time */}
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-500 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate block">{m.name}</span>
                        {m.groupName && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">{m.groupName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold tabular-nums ${pctColor(m.porcentaje)}`}>
                          {fmtD(m.porcentaje)}%
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums hidden sm:inline">
                          {timeAgoLabel(m.lastUpdated)}
                        </span>
                      </div>
                    </div>
                    {/* Mini bar */}
                    <div className="relative w-full h-1.5 bg-gray-100 dark:bg-gray-600/70 rounded-full overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barCls(m.porcentaje)}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="absolute inset-y-0 w-px bg-white/50 dark:bg-white/20" style={{ left: '70%' }} />
                    </div>
                    {/* Amount */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                        ${fmt(m.usdBruto)} <span className="text-gray-300 dark:text-gray-600">/ ${fmt(m.cuotaMinima)}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 sm:hidden tabular-nums">
                        {timeAgoLabel(m.lastUpdated)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer — ver panel completo */}
          {models.length > 3 && (
            <div className="px-4 py-2.5 border-t border-gray-100/60 dark:border-gray-600/40">
              <a href="/admin/sedes/dashboard"
                className="flex items-center justify-center gap-1.5 w-full text-[11px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                Ver panel completo
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
