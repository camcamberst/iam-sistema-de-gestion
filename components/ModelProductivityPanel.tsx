'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ProductivityModel {
  modelId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  groupId: string | null;
  groupName: string | null;
  usdBruto: number;
  cuotaMinima: number;
  porcentaje: number;
  estaPorDebajo: boolean;
  lastUpdated: string | null;
  usdModelo?: number;
  usdSede?: number;
  copModelo?: number;
  copSede?: number;
  affiliateStudioId?: string | null;
  affiliateStudioName?: string | null;
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

const POLL_INTERVAL_MS = 2 * 60 * 1000;

const fmt  = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtCOP = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function pctColor(pct: number) {
  if (pct >= 150) return 'text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]';
  if (pct >= 100) return 'text-emerald-500 dark:text-emerald-400';
  if (pct >= 70)  return 'text-blue-500 dark:text-blue-400';
  return 'text-orange-500 dark:text-orange-400';
}

function barCls(pct: number) {
  if (pct >= 150) return 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]';
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70)  return 'bg-blue-500';
  return 'bg-orange-500';
}

function badge(pct: number) {
  if (pct >= 150) return { label: 'Superado',  cls: 'bg-purple-100  dark:bg-purple-900/40  text-purple-700  dark:text-purple-300 border border-purple-500/20 shadow-sm' };
  if (pct >= 100) return { label: 'Objetivo',  cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-sm' };
  if (pct >= 70)  return { label: 'En camino', cls: 'bg-blue-100     dark:bg-blue-900/40     text-blue-700     dark:text-blue-300 border border-blue-500/20 shadow-sm' };
  return            { label: 'Por debajo', cls: 'bg-orange-100   dark:bg-orange-900/40   text-orange-700   dark:text-orange-300 border border-orange-500/20 shadow-sm' };
}

export default function ModelProductivityPanel({ userId, userRole }: Props) {
  const [collapsed,      setCollapsed]      = useState(true);
  const [models,         setModels]         = useState<ProductivityModel[]>([]);
  const [zoomedImage,    setZoomedImage]    = useState<string | null>(null);
  const [isMounted,      setIsMounted]      = useState(false);
  const [summary,        setSummary]        = useState<ProductivitySummary | null>(null);
  // Estado para el modo privacidad / enfoque de una modelo específica
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null);

  // Historial de Modelos (magical slide-out)
  const [activeModelHistory, setActiveModelHistory] = useState<string | null>(null);
  const [modelHistoryData, setModelHistoryData] = useState<{
    avgUsdBruto: number;
    avgPorcentaje: number;
    sugGoal: number;
    hasHistory: boolean;
  } | null>(null);
  const [modelHistoryLoading, setModelHistoryLoading] = useState<boolean>(false);

  const toggleModelHistory = async (modelId: string) => {
    if (activeModelHistory === modelId) {
      setActiveModelHistory(null);
      setModelHistoryData(null);
      return;
    }
    setActiveModelHistory(modelId);
    setModelHistoryLoading(true);
    setModelHistoryData(null);
    try {
      const res = await fetch(`/api/admin/model-history?modelId=${modelId}`);
      const data = await res.json();
      if (data.success) {
        setModelHistoryData({
          avgUsdBruto: data.avgUsdBruto,
          avgPorcentaje: data.avgPorcentaje,
          sugGoal: data.sugGoal,
          hasHistory: data.hasHistory ?? true
        });
      }
    } catch (error) {
      console.error('Error al cargar historial del modelo:', error);
    } finally {
      setModelHistoryLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Manejador para cerrar la imagen ampliada con la tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomedImage) {
        setZoomedImage(null);
      }
    };
    
    if (zoomedImage) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomedImage]);
  const [periodLabel,    setPeriodLabel]    = useState('');
  const [loading,        setLoading]        = useState(false);
  const [lastRefresh,    setLastRefresh]    = useState<Date | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [expandedSedes,  setExpandedSedes]  = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  interface GroupData {
    groupId: string;
    groupName: string;
    models: ProductivityModel[];
    totalUsdBruto: number;
    groupAvg: number;
    aboveCount: number;
    totalModels: number;
  }

  interface SedeData {
    sedeId: string;
    sedeName: string;
    isAffiliate: boolean;
    groups: GroupData[];
    totalModels: number;
    totalUsdBruto: number;
    totalUsdModelo: number;
    totalUsdSede: number;
    totalCopModelo: number;
    totalCopSede: number;
    sedeAvg: number;
    aboveCount: number;
  }

  const loadData = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/productivity-realtime?adminId=${userId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al cargar productividad');
      setModels(data.models || []);
      setSummary(data.summary);
      setPeriodLabel(data.periodLabel || '');
      setLastRefresh(new Date());
      if (!silent) {
        setExpandedGroups(new Set());
        setExpandedSedes(new Set());
      }
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
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [collapsed, loadData]);

  const toggleSede = (sedeId: string) => {
    const newExpanded = new Set<string>();
    if (!expandedSedes.has(sedeId)) {
      newExpanded.add(sedeId);
    }
    setExpandedGroups(new Set());
    setExpandedSedes(newExpanded);
    setActiveModelHistory(null);
    setModelHistoryData(null);
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set<string>();
    if (!expandedGroups.has(groupId)) {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
    setActiveModelHistory(null);
    setModelHistoryData(null);
  };

  // Group models into Sede -> Group -> Model hierarchy
  const groupedSedes = models.reduce<Record<string, SedeData>>((acc, m) => {
    const isAff = !!m.affiliateStudioId;
    const sedeId = isAff ? m.affiliateStudioId! : 'agencia-innova';
    const sedeName = isAff ? (m.affiliateStudioName || 'Estudio Afiliado') : 'Agencia Innova';

    if (!acc[sedeId]) {
      acc[sedeId] = {
        sedeId,
        sedeName,
        isAffiliate: isAff,
        groups: [],
        totalModels: 0,
        totalUsdBruto: 0,
        totalUsdModelo: 0,
        totalUsdSede: 0,
        totalCopModelo: 0,
        totalCopSede: 0,
        sedeAvg: 0,
        aboveCount: 0
      };
    }

    const sede = acc[sedeId];
    
    sede.totalModels += 1;
    sede.totalUsdBruto += m.usdBruto || 0;
    sede.totalUsdModelo += m.usdModelo || 0;
    sede.totalUsdSede += m.usdSede || 0;
    sede.totalCopModelo += m.copModelo || 0;
    sede.totalCopSede += m.copSede || 0;
    if (!m.estaPorDebajo) {
      sede.aboveCount += 1;
    }

    const groupId = m.groupId || 'sin-grupo';
    const groupName = m.groupName || 'Sin Grupo';

    let group = sede.groups.find(g => g.groupId === groupId);
    if (!group) {
      group = {
        groupId,
        groupName,
        models: [],
        totalUsdBruto: 0,
        groupAvg: 0,
        aboveCount: 0,
        totalModels: 0
      };
      sede.groups.push(group);
    }

    group.models.push(m);
    group.totalModels += 1;
    group.totalUsdBruto += m.usdBruto || 0;
    if (!m.estaPorDebajo) {
      group.aboveCount += 1;
    }

    return acc;
  }, {});

  // Calculate averages and sort groups inside each Sede, and models inside each Group
  const processedSedes = Object.values(groupedSedes).map(sede => {
    const totalPercentage = sede.groups.reduce((s, g) => s + g.models.reduce((ps, m) => ps + m.porcentaje, 0), 0);
    sede.sedeAvg = sede.totalModels > 0 ? Math.round((totalPercentage / sede.totalModels) * 10) / 10 : 0;

    sede.groups = sede.groups.map(g => {
      const gPctTotal = g.models.reduce((ps, m) => ps + m.porcentaje, 0);
      g.groupAvg = g.totalModels > 0 ? Math.round((gPctTotal / g.totalModels) * 10) / 10 : 0;
      g.models.sort((a, b) => b.porcentaje - a.porcentaje);
      return g;
    });

    sede.groups.sort((a, b) => b.totalUsdBruto - a.totalUsdBruto);
    return sede;
  });

  processedSedes.sort((a, b) => {
    if (a.sedeId === 'agencia-innova') return -1;
    if (b.sedeId === 'agencia-innova') return 1;
    return b.totalUsdBruto - a.totalUsdBruto;
  });

  const timeAgo = lastRefresh
    ? (() => { const sec = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
        return sec < 60 ? `hace ${sec}s` : `hace ${Math.floor(sec / 60)}min`; })()
    : null;

  return (
    <div className="mb-4 sm:mb-8 flex flex-col gap-1.5 sm:gap-2 w-full">
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-start justify-between px-1 mb-1.5 sm:mb-2">
        <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
          <div className="flex items-center justify-center text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.95)] mt-0.5">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="flex items-baseline min-w-0">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              Productividad en Tiempo Real
            </h2>
            <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              {periodLabel || 'Monitoreo de transmisiones y métricas de desempeño'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-0.5">
          {!collapsed && (
            <button onClick={() => loadData()} disabled={loading}
              className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors duration-200 active:scale-90 disabled:opacity-30"
              title={loading ? 'Actualizando...' : 'Actualizar datos'}>
              <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          <button onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors duration-200 active:scale-90"
            title={collapsed ? 'Expandir' : 'Contraer'}>
            <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Contenido Flotante Premium ─── */}
      {!collapsed && (
        <div className="flex-1 flex flex-col gap-3 sm:gap-4 px-0 sm:px-2 md:px-4 mt-1 sm:mt-2">



          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50 rounded-xl text-sm text-red-700 dark:text-red-400 font-medium shadow-sm">{error}</div>
          )}

          {/* ─── Tarjetas resumen - Rediseño Premium ─── */}
          {summary && models.length > 0 && (
            <div className="rounded-[20px] sm:rounded-[30px] p-1 sm:p-1.5 backdrop-blur-3xl bg-white/40 dark:bg-[#1a1a1c]/40 border border-white/50 dark:border-white/10 overflow-hidden shadow-sm mb-1 sm:mb-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5">
                {[
                  { val: summary.totalModels,      label: 'Total modelos',      cls: 'text-gray-900 dark:text-white',       bg: 'bg-white/40 dark:bg-white/[0.03] border-white/50 dark:border-white/[0.08]' },
                  { val: summary.modelsPorEncima,  label: 'Sobre objetivo',     cls: 'text-green-600 dark:text-emerald-400',     bg: 'bg-green-50/40 dark:bg-emerald-500/5 border border-green-200/20 dark:border-emerald-500/10' },
                  { val: summary.modelsPorDebajo,  label: 'Por debajo',         cls: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50/40 dark:bg-red-500/5 border border-red-200/20 dark:border-red-500/10' },
                  { val: `${fmtD(summary.avgPorcentaje)}%`, label: 'Promedio alcanzado', cls: pctColor(summary.avgPorcentaje), bg: 'bg-blue-50/40 dark:bg-blue-500/5 border border-blue-200/20 dark:border-blue-500/10' },
                ].map(({ val, label, cls, bg }) => (
                  <div key={label} className={`rounded-2xl sm:rounded-3xl p-2 sm:p-4 hover:shadow-md transition-all duration-300 border ${bg}`}>
                    <div className="text-center min-w-0">
                      <div className={`text-base sm:text-xl font-bold mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis tabular-nums ${cls}`}>{val}</div>
                      <div className="inline-block bg-gray-100/80 dark:bg-white/5 text-gray-700 dark:text-zinc-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* ─── Sedes (Nivel 1 de la Jerarquía) ─── */}
          {!loading && models.length > 0 && (
            <div className="space-y-3 sm:space-y-4">
              {processedSedes.map((sede) => {
                const isSedeOpen = expandedSedes.has(sede.sedeId);

                return (
                  <div key={sede.sedeId} className="bg-white/50 dark:bg-[#1a1a1c]/60 backdrop-blur-sm rounded-[1.75rem] shadow-md border border-black/[0.04] dark:border-white/[0.05] overflow-hidden hover:shadow-lg transition-all duration-300">
                    {/* Header de Sede - Estructura Premium simétrica idéntica a BillingSummary */}
                    <div 
                      className="px-5 py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200"
                      onClick={() => toggleSede(sede.sedeId)}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
                        {/* Left: Chevron rotativo minimalista + Icono Sede Lúminoso Al Desnudo + Info + Badge */}
                        <div className="flex items-center space-x-4 min-w-0">
                          {/* Chevron minimalista en círculo translúcido */}
                          <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200">
                            <svg 
                              className={`w-4 h-4 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${isSedeOpen ? 'rotate-90' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          
                          {/* Icono de Sede al Desnudo - Lúminoso, minimalista sin píldora/fondo */}
                          <svg 
                            className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.7)] flex-shrink-0"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                          </svg>

                          <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                              {sede.sedeName.replace(/\s*-\s*Afiliado/i, '')}
                              {sede.isAffiliate && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-500/20 shadow-sm">
                                  Afiliado
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mt-0.5">
                              {sede.totalModels} modelo{sede.totalModels !== 1 ? 's' : ''} • {sede.groups.length} grupo{sede.groups.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Right: Consolidated values aligned in a custom 5-column grid for perfectly uniform visual spacing */}
                        <div className="grid grid-cols-5 lg:grid-cols-[84px_80px_64px_94px_94px] w-full lg:w-auto gap-x-2 sm:gap-x-4 gap-y-2 border-t lg:border-t-0 border-black/[0.03] dark:border-white/[0.05] pt-3 lg:pt-0 lg:mr-[36px] xl:mr-[36px]">
                          {/* Rendimiento Promedio */}
                          <div className="flex flex-col items-start min-w-0 tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">Rendimiento</span>
                            <div className="flex items-center gap-1.5 mt-0.5 lg:mt-0">
                              <div className={`h-1.5 w-6 rounded-full hidden sm:block ${barCls(sede.sedeAvg)} shadow-sm`} />
                              <span className={`text-xs sm:text-sm font-bold tabular-nums truncate ${pctColor(sede.sedeAvg)}`}>
                                {fmtD(sede.sedeAvg)}%
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-start min-w-0 tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">USD Modelo</span>
                            <span className="text-xs sm:text-sm font-bold text-green-600 dark:text-[#2dd4bf] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.15)] truncate">${fmt(sede.totalUsdModelo)}</span>
                          </div>
                          <div className="flex flex-col items-start min-w-0 tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">USD Sede</span>
                            <span className="text-xs sm:text-sm font-bold text-purple-600 dark:text-[#c488fc] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.15)] truncate">${fmt(sede.totalUsdSede)}</span>
                          </div>
                          <div className="flex flex-col items-start min-w-0 tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">COP Modelo</span>
                            <span className="text-xs sm:text-sm font-bold text-green-700 dark:text-[#2dd4bf] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.15)] truncate">{fmtCOP(sede.totalCopModelo)}</span>
                          </div>
                          <div className="flex flex-col items-start min-w-0 tabular-nums">
                            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">COP Sede</span>
                            <span className="text-xs sm:text-sm font-bold text-purple-700 dark:text-[#c488fc] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.15)] truncate">{fmtCOP(sede.totalCopSede)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grupos de la Sede (Nivel 2 de la Jerarquía) */}
                    {isSedeOpen && (
                      <div className="bg-black/[0.02] dark:bg-black/20 border-t border-black/[0.04] dark:border-white/[0.05]">
                        {/* Neon Glowing Line Separator (Productivity Purple Accent) */}
                        <div className="h-[1.5px] w-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.75),0_0_3px_rgba(168,85,247,0.85)] pointer-events-none opacity-70" />
                        <div className="p-4 space-y-3">
                        {sede.groups.map((group) => {
                          const isGroupOpen = expandedGroups.has(group.groupId);

                          // Calcular métricas consolidadas del grupo
                          const groupUsdModelo = group.models.reduce((s, m) => s + (m.usdModelo ?? 0), 0);
                          const groupUsdSede  = group.models.reduce((s, m) => s + (m.usdSede ?? 0), 0);

                          return (
                            <div key={group.groupId} className="bg-white/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05] rounded-2xl shadow-sm hover:shadow-md hover:bg-white/60 dark:hover:bg-white/[0.04] transition-all duration-300 overflow-hidden">
                              {/* Header de Grupo - Estructura Premium del segundo nivel idéntica a BillingSummary */}
                              <div 
                                className="px-[36px] sm:px-[40px] py-2.5 sm:py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200 active:scale-[0.98] touch-manipulation"
                                onClick={() => toggleGroup(group.groupId)}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                                  {/* Left: Mini trigger circular + Group Name */}
                                  <div className="flex items-center space-x-2 sm:space-x-4">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 dark:bg-white/5 rounded-md flex items-center justify-center flex-shrink-0">
                                      <svg 
                                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${isGroupOpen ? 'rotate-90' : ''}`}
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                                        {group.groupName}
                                      </h4>
                                      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-zinc-400">
                                        {group.totalModels} modelo{group.totalModels !== 1 ? 's' : ''} • {group.aboveCount}/{group.totalModels} sobre obj.
                                      </p>
                                    </div>
                                  </div>

                                  {/* Right: Rendimiento Grupo + Métricas del Grupo alineadas */}
                                  <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                    {/* Rendimiento Column */}
                                    <div className="flex flex-col items-start min-w-[80px]">
                                      <div className={`font-semibold text-xs sm:text-sm leading-tight ${pctColor(group.groupAvg)}`}>{fmtD(group.groupAvg)}%</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">Rendimiento</div>
                                    </div>
                                    
                                    {/* USD Bruto Column */}
                                    <div className="flex flex-col items-start min-w-[80px]">
                                      <div className="font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-sm leading-tight">${fmt(group.totalUsdBruto)}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                                    </div>
                                    
                                    {/* USD Modelos Column */}
                                    <div className="flex flex-col items-start min-w-[80px]">
                                      <div className="font-semibold text-green-600 dark:text-[#2dd4bf] text-xs sm:text-sm leading-tight">${fmt(groupUsdModelo)}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelos</div>
                                    </div>
                                    
                                    {/* USD Sede/Agencia Column */}
                                    <div className="flex flex-col items-start min-w-[80px]">
                                      <div className="font-semibold text-purple-600 dark:text-[#c488fc] text-xs sm:text-sm leading-tight">${fmt(groupUsdSede)}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                        {sede.isAffiliate ? `USD ${sede.sedeName.replace(/\s*-\s*Afiliado/i, '')}` : 'USD Agencia'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Modelos del Grupo (Nivel 3 de la Jerarquía) */}
                              {isGroupOpen && (
                                <div>
                                  {/* Neon Glowing Line Separator (Productivity Purple Accent) */}
                                  <div className="h-[1.5px] w-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.75),0_0_3px_rgba(168,85,247,0.85)] pointer-events-none opacity-70" />
                                  <div className="p-4 sm:p-5 bg-black/[0.01] dark:bg-black/15 space-y-3">
                                    {/* Column headers — mismos anchos fijos que las filas */}
                                    <div className="hidden sm:flex items-center px-4 py-2 bg-black/[0.02] dark:bg-black/10 border-b border-black/[0.03] dark:border-white/[0.05] gap-3 rounded-full mb-1">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider">Modelo</span>
                                      </div>
                                      <span className="inline-block w-[76px] flex-shrink-0 text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">Estado</span>
                                      <span className="inline-block w-[54px] flex-shrink-0 text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">%</span>
                                      <span className="inline-block w-[118px] flex-shrink-0 text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-zinc-400 tracking-wider text-center">USD Bruto</span>
                                    </div>

                                    <div className="space-y-3">
                                      {group.models.map((model) => {
                                        const pct = Math.min(model.porcentaje, 100);
                                        const b   = badge(model.porcentaje);
                                        const isAnyFocused = focusedModelId !== null;
                                        const isCurrentFocused = focusedModelId === model.modelId;
                                        return (
                                          <div 
                                            key={model.modelId} 
                                            onClick={() => setFocusedModelId(prev => prev === model.modelId ? null : model.modelId)}
                                            className={`p-3 sm:p-4 bg-white/40 dark:bg-[#1a1a1c]/40 rounded-xl transition-all duration-500 cursor-pointer select-none border ${
                                              isAnyFocused
                                                ? isCurrentFocused
                                                  ? 'border-purple-500/40 dark:border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.2)] dark:shadow-[0_0_25px_rgba(168,85,247,0.35)] scale-[1.01] z-10'
                                                  : 'border-black/[0.04] dark:border-white/[0.05] blur-[8px] opacity-[0.08] scale-[0.98] pointer-events-none'
                                                : 'border-black/[0.04] dark:border-white/[0.05] hover:shadow-md hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 shadow-sm'
                                            }`}
                                          >
                                            {/* Desktop row */}
                                            <div className="hidden sm:flex items-center gap-3 mb-2">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div 
                                                  className="w-6 h-6 rounded-full flex-shrink-0 relative overflow-hidden bg-[#121214] cursor-pointer hover:opacity-90 active:scale-95 transition-all ring-2 ring-transparent hover:ring-white/20"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setZoomedImage(model.avatarUrl || '/favicon.png');
                                                  }}
                                                  title="Ampliar foto"
                                                >
                                                  <img 
                                                    src={model.avatarUrl || '/favicon.png'} 
                                                    alt="" 
                                                    className="absolute inset-0 w-full h-full object-cover object-center rounded-full"
                                                  />
                                                  <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                                                </div>
                                                
                                                {/* Clickable name + sliding stats wrapper */}
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                  <span 
                                                    className="text-xs font-semibold text-gray-800 dark:text-white hover:text-purple-500 dark:hover:text-purple-400 cursor-pointer select-none transition-colors duration-200 flex-shrink-0"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleModelHistory(model.modelId);
                                                    }}
                                                    title="Ver promedio histórico"
                                                  >
                                                    {model.name}
                                                  </span>

                                                  <div 
                                                    className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center flex-shrink-0"
                                                    style={{ 
                                                      width: activeModelHistory === model.modelId ? (modelHistoryLoading ? '70px' : (modelHistoryData?.hasHistory ? '190px' : '96px')) : '0px', 
                                                      opacity: activeModelHistory === model.modelId ? 1 : 0,
                                                      marginLeft: activeModelHistory === model.modelId ? '8px' : '0px'
                                                    }}
                                                  >
                                                    {activeModelHistory === model.modelId && (
                                                      modelHistoryLoading ? (
                                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium whitespace-nowrap">Cargando...</span>
                                                      ) : modelHistoryData ? (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold shadow-sm select-none whitespace-nowrap">
                                                           {modelHistoryData.hasHistory ? (
                                                             <>
                                                               <span>Prom: ${fmt(modelHistoryData.avgUsdBruto)}</span>
                                                               <span className="opacity-40">•</span>
                                                               <span className={pctColor(modelHistoryData.avgPorcentaje)}>
                                                                 {fmtD(modelHistoryData.avgPorcentaje)}%
                                                               </span>
                                                             </>
                                                           ) : (
                                                             <span>Sin historial</span>
                                                           )}
                                                         </div>
                                                      ) : null
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="w-[76px] flex-shrink-0 flex items-center justify-center">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${b.cls}`}>
                                                  {b.label}
                                                </span>
                                              </div>
                                              <span className={`w-[54px] flex-shrink-0 text-xs font-bold tabular-nums text-center ${pctColor(model.porcentaje)}`}>
                                                {fmtD(model.porcentaje)}%
                                              </span>
                                              <span className="w-[118px] flex-shrink-0 text-xs font-semibold tabular-nums text-center text-gray-600 dark:text-zinc-200">
                                                ${fmt(model.usdBruto)}<span className="text-gray-400 dark:text-zinc-400 font-medium"> / ${fmt(model.cuotaMinima)}</span>
                                              </span>
                                            </div>

                                            {/* Mobile row */}
                                            <div className="flex items-center justify-between gap-2 mb-2 sm:hidden">
                                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                <div 
                                                  className="w-5 h-5 rounded-full flex-shrink-0 relative overflow-hidden bg-[#121214] cursor-pointer hover:opacity-90 active:scale-95 transition-all ring-2 ring-transparent hover:ring-white/20"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setZoomedImage(model.avatarUrl || '/favicon.png');
                                                  }}
                                                  title="Ampliar foto"
                                                >
                                                  <img 
                                                    src={model.avatarUrl || '/favicon.png'} 
                                                    alt="" 
                                                    className="absolute inset-0 w-full h-full object-cover object-center rounded-full"
                                                  />
                                                  <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"></div>
                                                </div>
                                                
                                                {/* Clickable name + sliding stats wrapper */}
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                  <span 
                                                    className="text-xs font-semibold text-gray-800 dark:text-white hover:text-purple-500 dark:hover:text-purple-400 cursor-pointer select-none transition-colors duration-200 flex-shrink-0"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleModelHistory(model.modelId);
                                                    }}
                                                    title="Ver promedio histórico"
                                                  >
                                                    {model.name}
                                                  </span>

                                                  <div 
                                                    className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center flex-shrink-0"
                                                    style={{ 
                                                      width: activeModelHistory === model.modelId ? (modelHistoryLoading ? '70px' : (modelHistoryData?.hasHistory ? '190px' : '96px')) : '0px', 
                                                      opacity: activeModelHistory === model.modelId ? 1 : 0,
                                                      marginLeft: activeModelHistory === model.modelId ? '8px' : '0px'
                                                    }}
                                                  >
                                                    {activeModelHistory === model.modelId && (
                                                      modelHistoryLoading ? (
                                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium whitespace-nowrap">Cargando...</span>
                                                      ) : modelHistoryData ? (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold shadow-sm select-none whitespace-nowrap">
                                                           {modelHistoryData.hasHistory ? (
                                                             <>
                                                               <span>Prom: ${fmt(modelHistoryData.avgUsdBruto)}</span>
                                                               <span className="opacity-40">•</span>
                                                               <span className={pctColor(modelHistoryData.avgPorcentaje)}>
                                                                 {fmtD(modelHistoryData.avgPorcentaje)}%
                                                               </span>
                                                             </>
                                                           ) : (
                                                             <span>Sin historial</span>
                                                           )}
                                                         </div>
                                                      ) : null
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                                                <span className={`text-xs font-bold tabular-nums ${pctColor(model.porcentaje)}`}>{fmtD(model.porcentaje)}%</span>
                                              </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="relative w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                              <div
                                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barCls(model.porcentaje)}`}
                                                style={{ width: `${pct}%` }}
                                              />
                                              <div className="absolute inset-y-0 w-px bg-black/10 dark:bg-white/10" style={{ left: '70%' }} />
                                            </div>

                                            {/* Mobile: amount */}
                                            <p className="sm:hidden text-[10px] text-gray-500 dark:text-zinc-400 mt-1 tabular-nums text-right font-medium">
                                              ${fmt(model.usdBruto)} / ${fmt(model.cuotaMinima)} USD
                                            </p>

                                            {/* Expandable smart suggestion card */}
                                            <div 
                                              className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                              style={{
                                                maxHeight: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '50px' : '0px',
                                                opacity: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? 1 : 0,
                                                marginTop: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '6px' : '0px'
                                              }}
                                            >
                                              {modelHistoryData && (
                                                <div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 border border-purple-500/10 dark:border-purple-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-2.5">
                                                  {/* Lightbulb glowing icon - AL DESNUDO, minimalista, sin fondo */}
                                                  <svg 
                                                    className="w-4 h-4 text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.7)] flex-shrink-0 animate-pulse ml-0.5"
                                                    fill="none" 
                                                    stroke="currentColor" 
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                  </svg>
                                                  {modelHistoryData.hasHistory ? (
                                                    <div className="min-w-0 flex-1 flex items-center justify-between sm:justify-start sm:gap-2.5 text-xs">
                                                      <span className="font-bold text-zinc-800 dark:text-purple-200 whitespace-nowrap">
                                                        El objetivo sugerido para <span className="text-purple-600 dark:text-purple-400">{model.name}</span> es: <span className="font-extrabold text-purple-700 dark:text-purple-300 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">${fmt(modelHistoryData.sugGoal)}</span>
                                                      </span>
                                                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap hidden sm:inline">
                                                        (Historial promedio: <span className="font-semibold text-blue-500 dark:text-blue-400">${fmt(modelHistoryData.avgUsdBruto)}</span> • <span className={"font-bold " + pctColor(modelHistoryData.avgPorcentaje)}>{fmtD(modelHistoryData.avgPorcentaje)}%</span>)
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <div className="min-w-0 flex-1 flex items-center justify-between sm:justify-start sm:gap-2.5 text-xs">
                                                      <span className="font-bold text-zinc-800 dark:text-purple-200 whitespace-nowrap">
                                                        No hay suficiente historial para sugerir un objetivo para <span className="text-purple-600 dark:text-purple-400">{model.name}</span>
                                                      </span>
                                                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap hidden sm:inline">
                                                        (Se recomienda mantener la cuota actual de <span className="font-bold text-purple-700 dark:text-purple-300">${fmt(model.cuotaMinima)}</span>)
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty */}
          {!loading && models.length === 0 && !error && (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500 bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-sm rounded-[1.75rem] border border-black/[0.04] dark:border-white/[0.05] shadow-sm">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-medium">No hay modelos asignadas para este período</p>
            </div>
          )}
        </div>
      )}
      {zoomedImage && isMounted && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 cursor-pointer animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
          style={{ zIndex: 100000 }}
        >
          <img 
            src={zoomedImage} 
            alt="Avatar Ampliado" 
            className="w-full max-w-[360px] h-auto max-h-[360px] rounded-2xl shadow-2xl object-cover border border-white/10 cursor-default animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors cursor-pointer"
            onClick={() => setZoomedImage(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
