'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ProductivityModel {
  modelId: string;
  name: string;
  email: string;
  groupId: string | null;
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
  userGroups?: string[];
}

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function statusColor(pct: number) {
  if (pct >= 100) return 'text-green-600 dark:text-green-400';
  if (pct >= 70) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function barColor(pct: number) {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 70) return 'bg-yellow-400';
  return 'bg-red-500';
}

function statusBadge(pct: number) {
  if (pct >= 100) return { label: 'Objetivo', cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' };
  if (pct >= 70) return { label: 'En camino', cls: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' };
  return { label: 'Por debajo', cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' };
}

export default function ModelProductivityPanel({ userId, userRole }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [models, setModels] = useState<ProductivityModel[]>([]);
  const [summary, setSummary] = useState<ProductivitySummary | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/productivity-realtime?adminId=${userId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar productividad');
      setModels(data.models || []);
      setSummary(data.summary);
      setPeriodLabel(data.periodLabel || '');
      setLastRefresh(new Date());
      // Expandir todos los grupos por defecto
      const groups = new Set<string>(
        (data.models || []).map((m: ProductivityModel) => m.groupId || 'sin-grupo')
      );
      setExpandedGroups(groups);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!collapsed) {
      loadData();
      intervalRef.current = setInterval(() => loadData(true), POLL_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [collapsed, loadData]);

  // Agrupar modelos por sede
  const grouped = models.reduce<Record<string, { groupName: string; models: ProductivityModel[] }>>((acc, m) => {
    const key = m.groupId || 'sin-grupo';
    if (!acc[key]) acc[key] = { groupName: m.groupName || 'Sin Sede', models: [] };
    acc[key].models.push(m);
    return acc;
  }, {});

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const timeAgo = lastRefresh
    ? (() => {
        const sec = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
        if (sec < 60) return `hace ${sec}s`;
        return `hace ${Math.floor(sec / 60)}min`;
      })()
    : null;

  return (
    <div className="mb-4 sm:mb-8">
      <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 overflow-hidden">

        {/* ── Header ── */}
        <div className={`flex items-center justify-between p-3 sm:p-6 ${!collapsed ? 'border-b border-gray-100/60 dark:border-gray-600/40' : ''}`}>
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                Productividad en Tiempo Real
              </h2>
              {!collapsed && periodLabel && (
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 hidden sm:block mt-0.5">
                  {periodLabel}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Indicador live */}
            {!collapsed && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {timeAgo ? `Actualizado ${timeAgo}` : 'En vivo'}
                </span>
              </div>
            )}
            {/* Refresh */}
            {!collapsed && (
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation disabled:opacity-50"
                title="Actualizar"
              >
                <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            {/* Chevron */}
            <button
              onClick={() => setCollapsed(c => !c)}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-300 rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
              title={collapsed ? 'Expandir' : 'Contraer'}
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {!collapsed && (
          <div className="px-3 sm:px-6 pb-4 sm:pb-6">

            {/* Loading inicial */}
            {loading && models.length === 0 && (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-500" />
                <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Cargando productividad...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="my-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Summary cards */}
            {summary && models.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4 mb-4 sm:mb-6">
                <div className="bg-gray-50/80 dark:bg-gray-800/40 rounded-xl p-2.5 sm:p-3 text-center border border-gray-200/50 dark:border-gray-600/50">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.totalModels}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total modelos</p>
                </div>
                <div className="bg-green-50/80 dark:bg-green-900/20 rounded-xl p-2.5 sm:p-3 text-center border border-green-200/50 dark:border-green-700/50">
                  <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{summary.modelsPorEncima}</p>
                  <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-500 mt-0.5">En / sobre objetivo</p>
                </div>
                <div className="bg-red-50/80 dark:bg-red-900/20 rounded-xl p-2.5 sm:p-3 text-center border border-red-200/50 dark:border-red-700/50">
                  <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{summary.modelsPorDebajo}</p>
                  <p className="text-[10px] sm:text-xs text-red-600 dark:text-red-500 mt-0.5">Por debajo</p>
                </div>
                <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-xl p-2.5 sm:p-3 text-center border border-blue-200/50 dark:border-blue-700/50">
                  <p className={`text-lg sm:text-2xl font-bold ${statusColor(summary.avgPorcentaje)}`}>
                    {fmtDec(summary.avgPorcentaje)}%
                  </p>
                  <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-500 mt-0.5">Promedio alcanzado</p>
                </div>
              </div>
            )}

            {/* Leyenda */}
            {models.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> ≥ 100%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> 70–99%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> &lt; 70%</span>
              </div>
            )}

            {/* Modelos agrupados por sede */}
            {!loading && models.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                {Object.entries(grouped).map(([key, { groupName, models: groupModels }]) => {
                  const isOpen = expandedGroups.has(key);
                  const groupAvg = groupModels.reduce((s, m) => s + m.porcentaje, 0) / groupModels.length;
                  const groupAbove = groupModels.filter(m => !m.estaPorDebajo).length;

                  return (
                    <div key={key} className="rounded-xl border border-gray-200/60 dark:border-gray-600/40 overflow-hidden">
                      {/* Group header */}
                      <button
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50/80 dark:bg-gray-800/50 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 transition-colors text-left"
                        onClick={() => toggleGroup(key)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                            </svg>
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{groupName}</span>
                          <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {groupModels.length} modelo{groupModels.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                          <span className={`hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColor(groupAvg)} bg-gray-100 dark:bg-gray-700`}>
                            {fmtDec(groupAvg)}% prom.
                          </span>
                          <span className="text-[10px] text-green-600 dark:text-green-400 hidden sm:inline">
                            {groupAbove}/{groupModels.length} sobre obj.
                          </span>
                          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Model rows */}
                      {isOpen && (
                        <div className="divide-y divide-gray-100/60 dark:divide-gray-700/40">
                          {groupModels.map(model => {
                            const pct = Math.min(model.porcentaje, 100);
                            const badge = statusBadge(model.porcentaje);
                            return (
                              <div key={model.modelId} className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white/60 dark:bg-gray-700/20 hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  {/* Name */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white">
                                      {model.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{model.name}</span>
                                  </div>
                                  {/* Right side */}
                                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                                    <span className={`text-xs sm:text-sm font-bold tabular-nums ${statusColor(model.porcentaje)}`}>
                                      {fmtDec(model.porcentaje)}%
                                    </span>
                                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 tabular-nums hidden sm:inline">
                                      ${fmt(model.usdBruto)} / ${fmt(model.cuotaMinima)}
                                    </span>
                                  </div>
                                </div>
                                {/* Progress bar */}
                                <div className="relative w-full h-2 sm:h-2.5 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                                  <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor(model.porcentaje)}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                  {/* Marker 70% */}
                                  <div className="absolute top-0 h-full w-px bg-yellow-300/50 dark:bg-yellow-500/40" style={{ left: '70%' }} />
                                </div>
                                {/* Mobile amounts */}
                                <p className="sm:hidden text-[10px] text-gray-400 dark:text-gray-500 mt-1 tabular-nums">
                                  ${fmt(model.usdBruto)} de ${fmt(model.cuotaMinima)} USD
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty */}
            {!loading && models.length === 0 && !error && (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm">No hay modelos asignadas para este período</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
