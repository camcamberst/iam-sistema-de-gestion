'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { InfoCardGrid } from '@/components/ui/InfoCard';

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
  avatarUrl?: string | null;
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
  forceSlide?: number;
}

// ── helpers ────────────────────────────────────────────────────────────────
const POLL_MS    = 2 * 60 * 1000;
const ROTATE_MS  = 10 * 1000;

const fmt  = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function pctColor(p: number) {
  if (p >= 150) return 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]';
  if (p >= 100) return 'text-emerald-500';
  if (p >= 70) return 'text-purple-500';
  return 'text-blue-500';
}
function barCls(p: number) {
  if (p >= 150) return 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]';
  if (p >= 100) return 'bg-emerald-500';
  if (p >= 70) return 'bg-purple-500';
  return 'bg-blue-500';
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
  'bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]',  // 1 (Oro)
  'bg-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.8)]',   // 2 (Plata)
  'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]',  // 3 (Bronce)
];

// ── caché global ─────────────────────────────────────────────────────────────
const globalProdCache = new Map<string, {
  models: ProductivityModel[],
  summary: ProductivitySummary | null,
  periodLabel0: string,
  time: number
}>();

const globalPlatCache = new Map<string, {
  globalTop3: TopPlatformEntry[],
  bySede: SedeTopPlatforms[],
  periodLabel1: string,
  time: number
}>();

// ── componente ─────────────────────────────────────────────────────────────
export default function ProductivityWidget({ userId, userRole, forceSlide }: Props) {
  const cacheKey = `${userId}-${userRole}`;
  const initProd = globalProdCache.get(cacheKey);
  const initPlat = globalPlatCache.get(cacheKey);

  const [slide,        setSlide]        = useState(0);       // 0 = productividad, 1 = plataformas
  const [paused,       setPaused]       = useState(false);   // pausa manual (navegación por dots)
  const [hovered,      setHovered]      = useState(false);   // pausa por hover
  const [isMobile,     setIsMobile]     = useState(false);   // detectar móvil para detener auto-rotación

  // Slide 0 — productividad
  const [models,       setModels]       = useState<ProductivityModel[]>(initProd?.models || []);
  const [summary,      setSummary]      = useState<ProductivitySummary | null>(initProd?.summary || null);
  const [periodLabel0, setPeriodLabel0] = useState(initProd?.periodLabel0 || '');
  const [loading0,     setLoading0]     = useState(!initProd);
  const [error0,       setError0]       = useState<string | null>(null);

  // Slide 1 — plataformas
  const [globalTop3,   setGlobalTop3]   = useState<TopPlatformEntry[]>(initPlat?.globalTop3 || []);
  const [bySede,       setBySede]       = useState<SedeTopPlatforms[]>(initPlat?.bySede || []);
  const [periodLabel1, setPeriodLabel1] = useState(initPlat?.periodLabel1 || '');
  const [loading1,     setLoading1]     = useState(!initPlat);
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
      const label0 = (data.periodLabel || '').split(' (')[0];
      setPeriodLabel0(label0);
      globalProdCache.set(cacheKey, {
        models: data.models || [],
        summary: data.summary,
        periodLabel0: label0,
        time: Date.now()
      });
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
      const label1 = data.periodLabel || '';
      setPeriodLabel1(label1);
      globalPlatCache.set(cacheKey, {
        globalTop3: data.global || [],
        bySede: data.bySede || [],
        periodLabel1: label1,
        time: Date.now()
      });
    } catch (e: any) { setError1(e.message); }
    finally { if (!silent) setLoading1(false); }
  }, [userId]);

  // ── montaje: carga inicial + polling ────────────────────────────────────
  useEffect(() => {
    loadProductivity(!!initProd);
    loadPlatforms(!!initPlat);
    pollRef.current = setInterval(() => {
      loadProductivity(true);
      loadPlatforms(true);
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadProductivity, loadPlatforms]);

  // ── detección de móvil ───────────────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── rotación automática (se detiene en móvil, o si el cursor está encima, o navegación manual, o si forceSlide está activo) ──
  useEffect(() => {
    if (paused || hovered || isMobile || forceSlide !== undefined) {
      if (rotateRef.current) clearInterval(rotateRef.current);
      return;
    }
    rotateRef.current = setInterval(() => setSlide(s => (s + 1) % 2), ROTATE_MS);
    return () => { if (rotateRef.current) clearInterval(rotateRef.current); };
  }, [paused, hovered, isMobile, forceSlide]);

  // Si se fuerza un slide por props, anular el estado local
  const currentSlide = forceSlide !== undefined ? forceSlide : slide;

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

  const periodLabel = currentSlide === 0 ? periodLabel0 : periodLabel1;
  const loading     = currentSlide === 0 ? loading0     : loading1;

  const renderFooter = () => (
    <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center px-1 shrink-0">
      <div className="flex items-center gap-1.5">
        {forceSlide === undefined && [0, 1].map(i => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${currentSlide === i ? 'w-4 h-1.5 bg-emerald-500' : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-500 hover:bg-gray-400'}`}
            title={i === 0 ? 'Productividad' : 'Top Plataformas'}
          />
        ))}
        {forceSlide === undefined && !paused && !hovered && !isMobile && (
          <span className="ml-1 text-[9px] text-gray-300 dark:text-gray-600">auto</span>
        )}
      </div>
      <a href="/admin/sedes/dashboard"
        className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
        Ver panel completo →
      </a>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-center justify-between px-1 h-[40px]">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="relative flex items-center">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              {currentSlide === 0 ? 'Productividad en Tiempo Real' : 'Top Plataformas'}
            </h2>
          </div>
        </div>

      </div>

      <div
        className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-h-0"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* ── Área de slides ── */}
        <div className="grid flex-1 min-h-0 relative">

          {/* ── Slide 0: Productividad ── */}
          <div
            className="col-start-1 row-start-1 transition-opacity duration-300 flex flex-col min-h-0 gap-1.5 sm:gap-2"
            style={{ opacity: currentSlide === 0 ? 1 : 0, pointerEvents: currentSlide === 0 ? 'auto' : 'none' }}
          >
            {/* Top Card: Summary cards (Ajustadas según Regla Cards) */}
            {summary && !loading0 && (
              <div className="glass-card bg-black/[0.08] dark:bg-white/[0.08] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:dark:border-white/8 max-sm:p-1.5 sm:p-2 !rounded-[1.25rem] sm:!rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] relative flex-none">
                <InfoCardGrid
                  columns={3}
                  cards={[
                    {
                      value: summary.totalModels.toString(),
                      label: 'Total',
                      color: 'blue',
                      size: 'sm'
                    },
                    {
                      value: summary.modelsPorEncima.toString(),
                      label: 'Sobre obj.',
                      color: 'green',
                      size: 'sm'
                    },
                    {
                      value: summary.modelsPorDebajo.toString(),
                      label: 'Por debajo',
                      color: 'blue',
                      size: 'sm'
                    }
                  ]}
                />
              </div>
            )}

            {/* Bottom Card: Lista y Footer */}
            <div className="glass-card p-3 sm:p-4 hover:shadow-xl transition-all duration-300 relative flex-1 flex flex-col min-h-0">

          {loading0 && (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-300">Cargando...</span>
            </div>
          )}
          {error0 && !loading0 && <p className="text-xs text-red-600 text-center py-4">{error0}</p>}

          {!loading0 && !error0 && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2 shrink-0">Últimas actualizaciones</div>
              {recent.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-300 text-center py-3">Sin datos para este período</p>
              ) : (
                <div className="flex-1 overflow-y-auto apple-scroll pb-2 max-h-[14rem] lg:max-h-[15.5rem] 2xl:max-h-[18rem]">
                  <div className="space-y-1.5 pr-1.5">
                    {recent.map(m => {
                      const pct = Math.min(m.porcentaje, 100);
                      return (
                        <div key={m.modelId} className="p-2 bg-gray-50/80 dark:bg-white/[0.04] rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white overflow-hidden">
                                {m.avatarUrl ? (
                                  <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                                ) : (
                                  m.name.charAt(0).toUpperCase()
                                )}
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
                </div>
              )}
            </div>
          )}
          {renderFooter()}
        </div>
      </div>

        {/* ── Slide 1: Top Plataformas ── */}
        <div
          className="absolute inset-0 transition-opacity duration-300 flex flex-col min-h-0"
          style={{ opacity: currentSlide === 1 ? 1 : 0, pointerEvents: currentSlide === 1 ? 'auto' : 'none' }}
        >
          <div className="glass-card p-3 sm:p-4 hover:shadow-xl transition-all duration-300 relative flex-1 flex flex-col min-h-0">
            {loading1 && (
              <div className="flex items-center justify-center py-6">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-300">Cargando...</span>
              </div>
            )}
          {error1 && !loading1 && <p className="text-xs text-red-600 text-center py-4">{error1}</p>}

          {!loading1 && !error1 && (
            <div className="space-y-3 flex flex-col flex-1 min-h-0">
              {/* Global */}
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">Toda la agencia</div>
                {globalTop3.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-300 text-center py-2">Sin datos</p>
                ) : (
                  <div className="space-y-1">
                    {globalTop3.map(p => (
                      <div key={p.platformId} className="flex items-center gap-2.5 px-3 py-1.5 bg-gray-50/80 dark:bg-white/[0.03] rounded-full border border-transparent dark:border-white/[0.02] shadow-sm dark:shadow-none transition-all hover:bg-gray-100 dark:hover:bg-white/[0.06]">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${RANK_COLORS[p.rank - 1]}`} />
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{p.name}</span>
                        <span className="text-xs font-semibold text-blue-400 dark:text-[#5caaf5] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(92,170,245,0.7)] tabular-nums flex-shrink-0">${fmt(p.totalUsd)}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 hidden sm:inline">{p.modelCount}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Por sede */}
              {bySede.length > 0 && (
                <div className="border-t border-gray-200/50 dark:border-gray-600/40 pt-2.5 flex flex-col flex-1 min-h-0">
                  <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">Por sede</div>
                  <div className="flex-1 min-h-0 overflow-y-auto apple-scroll pb-2 max-h-[14rem] lg:max-h-[15.5rem] 2xl:max-h-[18rem]">
                    <div className="space-y-2 pr-1.5">
                      {bySede.map(sede => (
                        <div key={sede.sedeId}>
                          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{sede.sedeName}</div>
                          <div className="space-y-0.5">
                            {sede.top3.map(p => (
                              <div key={p.platformId} className="flex items-center gap-2 px-2.5 py-1 bg-gray-50/80 dark:bg-white/[0.02] rounded-full border border-transparent dark:border-white/[0.01] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-all">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RANK_COLORS[p.rank - 1]}`} />
                                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{p.name}</span>
                                <span className="text-[11px] font-semibold text-blue-400 dark:text-[#5caaf5] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(92,170,245,0.7)] tabular-nums flex-shrink-0">${fmt(p.totalUsd)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {renderFooter()}
          </div>
        </div>

      </div>{/* fin área de slides */}
    </div>
  </div>
  );
}
