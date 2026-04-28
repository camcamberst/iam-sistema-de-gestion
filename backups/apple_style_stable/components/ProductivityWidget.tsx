'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── tipos ──────────────────────────────────────────────────────────────────
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
interface TopPlatformEntry {
  platformId: string;
  name: string;
  totalUsd: number;
  modelCount: number;
  rank: number;
}
interface SedeTopPlatforms {
  sedeId: string;
  sedeName: string;
  top3: TopPlatformEntry[];
}

interface Props {
  userId: string;
  userRole: 'admin' | 'super_admin' | 'superadmin_aff';
}

// ── helpers ────────────────────────────────────────────────────────────────
const POLL_MS    = 2 * 60 * 1000;
const ROTATE_MS  = 10 * 1000;

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
  if (diff < 60)    return `hace ${diff}s`;
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

const RANK_COLORS = [
  'bg-yellow-400 text-yellow-900',  // 🥇
  'bg-gray-300  text-gray-700',     // 🥈
  'bg-amber-600 text-amber-100',    // 🥉
];

// ── componente ─────────────────────────────────────────────────────────────
export default function ProductivityWidget({ userId, userRole }: Props) {
  const [slide,        setSlide]        = useState(0);       // 0 = productividad, 1 = plataformas
  const [paused,       setPaused]       = useState(false);   // pausa manual (navegación por dots)
  const [hovered,      setHovered]      = useState(false);   // pausa por hover

  // Slide 0 — productividad
  const [models,       setModels]       = useState<ProductivityModel[]>([]);
  const [summary,      setSummary]      = useState<ProductivitySummary | null>(null);
  const [periodLabel0, setPeriodLabel0] = useState('');
  const [loading0,     setLoading0]     = useState(true);
  const [error0,       setError0]       = useState<string | null>(null);

  // Slide 1 — plataformas
  const [globalTop3,   setGlobalTop3]   = useState<TopPlatformEntry[]>([]);
  const [bySede,       setBySede]       = useState<SedeTopPlatforms[]>([]);
  const [periodLabel1, setPeriodLabel1] = useState('');
  const [loading1,     setLoading1]     = useState(true);
  const [error1,       setError1]       = useState<string | null>(null);

  const rotateRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef   = useRef<NodeJS.Timeout | null>(null);

  // ── carga productividad ──────────────────────────────────────────────────
  const loadProductivity = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading0(true);
    setError0(null);
    try {
      const res  = await fetch(`/api/admin/productivity-realtime?adminId=${userId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setModels(data.models || []);
      setSummary(data.summary);
      setPeriodLabel0((data.periodLabel || '').split(' (')[0]);
    } catch (e: any) { setError0(e.message); }
    finally { if (!silent) setLoading0(false); }
  }, [userId]);

  // ── carga plataformas ────────────────────────────────────────────────────
  const loadPlatforms = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading1(true);
    setError1(null);
    try {
      const res  = await fetch(`/api/admin/top-platforms?adminId=${userId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error');
      setGlobalTop3(data.global || []);
      setBySede(data.bySede || []);
      setPeriodLabel1(data.periodLabel || '');
    } catch (e: any) { setError1(e.message); }
    finally { if (!silent) setLoading1(false); }
  }, [userId]);

  // ── montaje: carga inicial + polling ────────────────────────────────────
  useEffect(() => {
    loadProductivity();
    loadPlatforms();
    pollRef.current = setInterval(() => {
      loadProductivity(true);
      loadPlatforms(true);
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadProductivity, loadPlatforms]);

  // ── rotación automática (se detiene si el cursor está encima o si se navegó manualmente) ──
  useEffect(() => {
    if (paused || hovered) {
      if (rotateRef.current) clearInterval(rotateRef.current);
      return;
    }
    rotateRef.current = setInterval(() => setSlide(s => (s + 1) % 2), ROTATE_MS);
    return () => { if (rotateRef.current) clearInterval(rotateRef.current); };
  }, [paused, hovered]);

  const goTo = (idx: number) => {
    setSlide(idx);
    setPaused(true);
    // Reanuda rotación automática después de 30s de inactividad
    setTimeout(() => setPaused(false), 30_000);
  };

  // ── 3 modelos más recientes ──────────────────────────────────────────────
  const recent = [...models]
    .filter(m => m.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated!).getTime() - new Date(a.lastUpdated!).getTime())
    .slice(0, 3);

  const periodLabel = slide === 0 ? periodLabel0 : periodLabel1;
  const loading     = slide === 0 ? loading0     : loading1;

  return (
    <div
      className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md dark:shadow-lg dark:shadow-emerald-900/10 dark:ring-0.5 dark:ring-emerald-500/15 border border-white/20 dark:border-gray-600/20 p-4 hover:shadow-xl hover:bg-white/95 dark:hover:bg-gray-600/80 transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {slide === 0 ? 'Productividad en Tiempo Real' : 'Top Plataformas'}
            </h3>
            {periodLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-300">{periodLabel}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => { loadProductivity(); loadPlatforms(); }}
            disabled={loading}
            className="flex items-center justify-center w-6 h-6 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Área de slides: grid superpuesto — ambos siempre en el DOM para altura estable ── */}
      <div className="grid">

        {/* ── Slide 0: Productividad ── */}
        <div
          className="col-start-1 row-start-1 transition-opacity duration-300"
          style={{ opacity: slide === 0 ? 1 : 0, pointerEvents: slide === 0 ? 'auto' : 'none' }}
        >
          {/* Summary cards */}
          {summary && !loading0 && (
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

          {loading0 && (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-300">Cargando...</span>
            </div>
          )}
          {error0 && !loading0 && <p className="text-xs text-red-600 text-center py-4">{error0}</p>}

          {!loading0 && !error0 && (
            <div className="border-t border-gray-200/50 dark:border-gray-600/40 pt-3">
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">Últimas actualizaciones</div>
              {recent.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-300 text-center py-3">Sin datos para este período</p>
              ) : (
                <div className="space-y-1.5">
                  {recent.map(m => {
                    const pct = Math.min(m.porcentaje, 100);
                    return (
                      <div key={m.modelId} className="py-1.5 px-2 bg-gray-50 dark:bg-white/[0.06] rounded-md">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate block">{m.name}</span>
                              {m.groupName && <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-none">{m.groupName}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className={`text-xs font-semibold tabular-nums ${pctColor(m.porcentaje)}`}>{fmtD(m.porcentaje)}%</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{timeAgoLabel(m.lastUpdated)}</span>
                          </div>
                        </div>
                        <div className="relative w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${barCls(m.porcentaje)}`} style={{ width: `${pct}%` }} />
                          <div className="absolute inset-y-0 w-px bg-white/60" style={{ left: '70%' }} />
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                          ${fmt(m.usdBruto)} <span className="text-gray-300 dark:text-gray-600">/ ${fmt(m.cuotaMinima)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Slide 1: Top Plataformas ── */}
        <div
          className="col-start-1 row-start-1 transition-opacity duration-300"
          style={{ opacity: slide === 1 ? 1 : 0, pointerEvents: slide === 1 ? 'auto' : 'none' }}
        >
          {loading1 && (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-300">Cargando...</span>
            </div>
          )}
          {error1 && !loading1 && <p className="text-xs text-red-600 text-center py-4">{error1}</p>}

          {!loading1 && !error1 && (
            <div className="space-y-3">
              {/* Global */}
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">Toda la agencia</div>
                {globalTop3.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-300 text-center py-2">Sin datos</p>
                ) : (
                  <div className="space-y-1">
                    {globalTop3.map(p => (
                      <div key={p.platformId} className="flex items-center gap-2 py-1 px-2 bg-gray-50 dark:bg-white/[0.06] rounded-md">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${RANK_COLORS[p.rank - 1]}`}>
                          {p.rank}
                        </span>
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{p.name}</span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">${fmt(p.totalUsd)}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">{p.modelCount}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Por sede */}
              {bySede.length > 0 && (
                <div className="border-t border-gray-200/50 dark:border-gray-600/40 pt-2.5">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">Por sede</div>
                  <div className="max-h-36 overflow-y-auto space-y-2 pr-0.5">
                    {bySede.map(sede => (
                      <div key={sede.sedeId}>
                        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{sede.sedeName}</div>
                        <div className="space-y-0.5">
                          {sede.top3.map(p => (
                            <div key={p.platformId} className="flex items-center gap-1.5 py-0.5 px-1.5 bg-gray-50/70 dark:bg-white/[0.04] rounded">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${RANK_COLORS[p.rank - 1]}`}>
                                {p.rank}
                              </span>
                              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{p.name}</span>
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums flex-shrink-0">${fmt(p.totalUsd)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>{/* fin área de slides */}

      {/* ── Footer: dots + ver completo ── */}
      <div className="mt-3 pt-2.5 border-t border-gray-200/50 dark:border-gray-600/40 flex items-center justify-between">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1].map(i => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${slide === i ? 'w-4 h-1.5 bg-emerald-500' : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-500 hover:bg-gray-400'}`}
              title={i === 0 ? 'Productividad' : 'Top Plataformas'}
            />
          ))}
          {/* Barra de progreso de rotación */}
          {!paused && !hovered && (
            <span className="ml-1 text-[9px] text-gray-300 dark:text-gray-600">auto</span>
          )}
        </div>
        <a href="/admin/sedes/dashboard"
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
          Ver panel completo →
        </a>
      </div>
    </div>
  );
}
