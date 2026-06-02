'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { isClosureDay, getPeriodToClose, getNewPeriodAfterClosure } from '@/utils/period-closure-dates';

interface ManualPeriodClosureProps {
  userId: string;
  userRole: 'super_admin' | 'admin' | 'superadmin_aff' | 'admin_aff';
  groupId?: string;
  onValidationChange?: (validation: any) => void;
}

interface ArchiveStatus {
  archived: boolean;
  in_progress: boolean;
  lock?: any;
  last_log?: any;
}

interface CleanupValidation {
  can_cleanup: boolean;
  validation_errors: string[];
  stats?: {
    models_in_history: number;
    models_with_values: number;
    total_records_in_history: number;
    total_records_in_values: number;
  };
}

export default function ManualPeriodClosure({ userId, userRole, groupId, onValidationChange }: ManualPeriodClosureProps) {
  const [isClosureDayActive, setIsClosureDayActive] = useState(false);
  const [periodToClose, setPeriodToClose] = useState<any>(null);
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatus | null>(null);
  const [cleanupValidation, setCleanupValidation] = useState<CleanupValidation | null>(null);
  
  // Modals
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  
  // Loading states
  const [archiving, setArchiving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [checking, setChecking] = useState(false);
  
  // Results
  const [archiveResult, setArchiveResult] = useState<any>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Módulo desplegable (compacto por defecto)
  const [expanded, setExpanded] = useState(false);

  // Aviso a modelos (Mi Calculadora restaurada) — solo super_admin
  const [avisoLoading, setAvisoLoading] = useState(false);
  const [avisoResult, setAvisoResult] = useState<{ sent: number; total: number } | null>(null);

  // Reset forzado global (solo super_admin)
  const [forceResetLoading, setForceResetLoading] = useState(false);
  const [forceResetResult, setForceResetResult] = useState<{
    deleted_model_values: number;
    deleted_calculator_totals: number;
    calculators_unfrozen: boolean;
    execution_time_ms: number;
  } | null>(null);

  useEffect(() => {
    checkClosureDay();
    loadArchiveStatus();
    loadCleanupValidation();
    const interval = setInterval(() => {
      loadArchiveStatus();
      loadCleanupValidation();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(cleanupValidation);
    }
  }, [cleanupValidation, onValidationChange]);

  const checkClosureDay = () => {
    const isToday = isClosureDay();
    setIsClosureDayActive(isToday);
    if (isToday) {
      setPeriodToClose(getPeriodToClose());
    }
  };

  const loadArchiveStatus = async () => {
    try {
      setChecking(true);
      const period = getPeriodToClose();
      const res = await fetch(`/api/calculator/period-closure/archive-period?periodDate=${period.periodDate}`);
      const data = await res.json();
      if (data.success) {
        setArchiveStatus(data);
        
        // Si está archivado, resetear el resultado local para mostrar el estado global
        if (data.archived && !archiveResult) {
          console.log('Archivo histórico ya existe (ejecutado por otro admin)');
        }
      }
    } catch (err: any) {
      console.error('Error loading archive status:', err);
    } finally {
      setChecking(false);
    }
  };

  const loadCleanupValidation = async () => {
    try {
      setChecking(true);
      const res = await fetch(`/api/calculator/period-closure/cleanup-period?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setCleanupValidation(data);
        
        // Si ya no hay datos para limpiar, significa que ya se limpió
        if (data.stats && data.stats.total_records_in_values === 0) {
          console.log('Limpieza ya ejecutada (por este u otro admin)');
        }
      }
    } catch (err: any) {
      console.error('Error loading cleanup validation:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    setError(null);
    setArchiveResult(null);

    try {
      const res = await fetch('/api/calculator/period-closure/archive-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, groupId })
      });

      const data = await res.json().catch(() => ({}));
      const errorMsg = data?.error || (res.ok ? null : `Error ${res.status}: ${res.statusText}`) || 'Error desconocido';
      
      if (!data.success || !res.ok) {
        throw new Error(errorMsg);
      }

      setArchiveResult(data);
      setShowArchiveModal(false);
      
      // Recargar estados
      await loadArchiveStatus();
      await loadCleanupValidation();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    setError(null);
    setCleanupResult(null);

    try {
      const isP2Enero = periodToClose?.periodDate === '2026-01-16' && periodToClose?.periodType === '16-31';
      const body: { userId: string; groupId?: string; force?: string } = { userId, groupId };
      if (isP2Enero) body.force = '2026-01-16';

      const res = await fetch('/api/calculator/period-closure/cleanup-period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error desconocido');
      }

      setCleanupResult(data);
      setShowCleanupModal(false);
      
      // Recargar estados
      await loadArchiveStatus();
      await loadCleanupValidation();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setCleaning(false);
    }
  };

  const handleEnviarAvisoModelos = async () => {
    if (!confirm('¿Enviar aviso por Botty a todas las modelos? El mensaje indica que Mi Calculadora fue restaurada y que pueden consultar su facturación en Mi Historial.')) return;
    setAvisoLoading(true);
    setError(null);
    setAvisoResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession() ?? { data: { session: null } };
      if (!session?.access_token) throw new Error('Sesión no disponible');
      const res = await fetch('/api/chat/notify-calculadora-restored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || 'Error al enviar aviso');
      setAvisoResult({ sent: data.sent ?? 0, total: data.total ?? 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAvisoLoading(false);
    }
  };

  const handleForceResetAll = async () => {
    if (!confirm('¿Reset forzado de TODAS las calculadoras del sistema? Se borrarán todos los valores en Mi Calculadora y todos los totales. Las calculadoras quedarán descongeladas. Esta acción no se puede deshacer.')) return;
    setForceResetLoading(true);
    setError(null);
    setForceResetResult(null);
    try {
      const res = await fetch('/api/calculator/force-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || 'Error en reset forzado');
      setForceResetResult({
        deleted_model_values: data.deleted_model_values ?? 0,
        deleted_calculator_totals: data.deleted_calculator_totals ?? 0,
        calculators_unfrozen: data.calculators_unfrozen ?? true,
        execution_time_ms: data.execution_time_ms ?? 0
      });
      await loadCleanupValidation();
      await loadArchiveStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setForceResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sleek, Low-profile Database Metrics Row (Matches the clean style of other hubs) */}
      <div>

        {cleanupValidation?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border border-white/50 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col items-center justify-center select-none shadow-sm relative overflow-hidden group">
              <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Historial</span>
              <span className="text-xl font-black text-rose-500 dark:text-rose-400 mt-1">
                {cleanupValidation.stats.models_in_history}
              </span>
              <span className="block text-[9px] text-gray-400 dark:text-zinc-500 mt-0.5">modelos archivados</span>
            </div>
            <div className="bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border border-white/50 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col items-center justify-center select-none shadow-sm relative overflow-hidden group">
              <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Activos</span>
              <span className="text-xl font-black text-purple-500 dark:text-purple-400 mt-1">
                {cleanupValidation.stats.models_with_values}
              </span>
              <span className="block text-[9px] text-gray-400 dark:text-zinc-500 mt-0.5">modelos con datos</span>
            </div>
            <div className="bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border border-white/50 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col items-center justify-center select-none shadow-sm relative overflow-hidden group">
              <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Reg. Historial</span>
              <span className="text-xl font-black text-gray-700 dark:text-zinc-300 mt-1">
                {cleanupValidation.stats.total_records_in_history}
              </span>
              <span className="block text-[9px] text-gray-400 dark:text-zinc-500 mt-0.5">filas totales</span>
            </div>
            <div className="bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border border-white/50 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col items-center justify-center select-none shadow-sm relative overflow-hidden group">
              <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Reg. Activos</span>
              <span className="text-xl font-black text-amber-500 dark:text-amber-400 mt-1">
                {cleanupValidation.stats.total_records_in_values}
              </span>
              <span className="block text-[9px] text-gray-400 dark:text-zinc-500 mt-0.5">filas en curso</span>
            </div>
          </div>
        )}
      </div>

      {/* Banners de error y de resultados */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3">
            <span className="text-red-500 text-base mt-0.5">❌</span>
            <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        {archiveResult && !error && (
          <div className="p-5 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0 shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black">
                Copia histórica creada con éxito
              </p>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 mt-1">
                <p>• Modelos archivadas: <span className="font-bold text-gray-700 dark:text-white">{archiveResult.models_archived}</span></p>
                <p>• Tiempo de ejecución: <span className="font-semibold text-gray-600 dark:text-zinc-300">{(archiveResult.execution_time_ms / 1000).toFixed(2)}s</span></p>
                {archiveResult.partial && (
                  <p className="text-amber-600 dark:text-amber-400 font-bold mt-1">
                    ⚠️ {archiveResult.partial.models_failed} modelos fallaron. Revisa el log detallado.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!archiveResult && archiveStatus?.archived && archiveStatus?.last_log && (
          <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0 shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-black">
                Archivo histórico ya completado
              </p>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 mt-1">
                <p>• Ejecutado por: <span className="font-bold text-gray-700 dark:text-white">{archiveStatus.last_log.user_email || 'Admin'}</span></p>
                <p>• Fecha de ejecución: <span className="font-semibold text-gray-600 dark:text-zinc-300">{new Date(archiveStatus.last_log.timestamp).toLocaleString('es-CO')}</span></p>
                {archiveStatus.last_log.models_affected && (
                  <p>• Modelos archivadas: <span className="font-bold text-gray-700 dark:text-white">{archiveStatus.last_log.models_affected}</span></p>
                )}
              </div>
            </div>
          </div>
        )}

        {cleanupResult && !error && (
          <div className="p-5 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0 shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black">
                Limpieza y reinicio completado con éxito
              </p>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 mt-1">
                <p>• Registros archivados: <span className="font-bold text-gray-700 dark:text-white">{cleanupResult.records_archived}</span></p>
                <p>• Totales reseteados: <span className="font-bold text-gray-700 dark:text-white">{cleanupResult.totals_reset}</span></p>
                <p>• Calculadoras descongeladas: <span className="text-emerald-500 font-bold">✓ Completado</span></p>
              </div>
            </div>
          </div>
        )}

        {forceResetResult && !error && userRole === 'super_admin' && (
          <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0 shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-amber-600 dark:text-amber-500 font-black">
                Reset forzado global completado
              </p>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5 mt-1">
                <p>• Valores borrados (model_values): <span className="font-bold text-gray-700 dark:text-white">{forceResetResult.deleted_model_values}</span></p>
                <p>• Totales borrados (calculator_totals): <span className="font-bold text-gray-700 dark:text-white">{forceResetResult.deleted_calculator_totals}</span></p>
                <p>• Calculadoras descongeladas: <span className="text-emerald-500 font-bold">✓ Completado</span></p>
                <p>• Tiempo de ejecución: <span className="font-semibold text-gray-600 dark:text-zinc-300">{(forceResetResult.execution_time_ms / 1000).toFixed(2)}s</span></p>
              </div>
            </div>
          </div>
        )}

        {avisoResult && !error && userRole === 'super_admin' && (
          <div className="p-5 bg-emerald-500/5 border border-emerald-500/25 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 flex-shrink-0 shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a2.002 2.002 0 00-2-2h-1M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h2.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black">
                Aviso a modelos enviado con éxito
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Mensaje de notificación enviado vía Botty a <span className="font-bold text-gray-700 dark:text-white">{avisoResult.sent}</span> de <span className="font-semibold text-gray-600 dark:text-zinc-300">{avisoResult.total}</span> modelo(s).
              </p>
            </div>
          </div>
        )}

        {!cleanupResult && (cleanupValidation?.stats?.total_records_in_values ?? 1) === 0 && archiveStatus?.archived && (
          <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl backdrop-blur-md animate-in fade-in duration-300 flex items-start gap-3.5 select-none">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0 shadow-md">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-black">
                Período ya cerrado y limpiado
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                El proceso de cierre ya fue completado. Las calculadoras están listas para el nuevo período.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Flujo Oficial de Cierre (Paso 1 y Paso 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 px-1.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
              Flujo de Cierre Obligatorio
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Paso 1: Crear archivo */}
            <button
              onClick={() => setShowArchiveModal(true)}
              disabled={!isClosureDayActive || archiveStatus?.archived || archiveStatus?.in_progress || archiving || checking}
              className={`w-full p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-300 relative overflow-hidden group select-none ${
                !isClosureDayActive || archiveStatus?.archived
                  ? 'bg-[#1a1a1c]/20 dark:bg-[#1a1a1c]/10 border-rose-500/30 dark:border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)] opacity-70 cursor-not-allowed'
                  : 'bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border-rose-500/50 dark:border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:border-rose-500/80 dark:hover:border-rose-500/90 hover:shadow-[0_0_35px_rgba(244,63,94,0.32)] hover:scale-[1.01] active:scale-[0.98] cursor-pointer'
              }`}
            >
              {/* Clean minimalist raw SVG icon (No bubble wrapper, direct SVG with intense glow) */}
              <div className={`transition-transform duration-300 group-hover:scale-110 flex-shrink-0 mt-0.5 ${
                archiveStatus?.archived
                  ? 'text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : !isClosureDayActive
                  ? 'text-gray-400 dark:text-zinc-650'
                  : 'text-rose-500 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
              }`}>
                {archiveStatus?.archived ? (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.0}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-black tracking-wider text-rose-500 dark:text-rose-400/80 uppercase">
                  Paso 1
                </span>
                <h4 className="text-base font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight">
                  Crear archivo
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">
                  Copia histórica de todos los valores registrados por las modelos antes de limpiar.
                </p>
              </div>
            </button>

            {/* Paso 2: Limpieza & reinicio */}
            <button
              onClick={() => setShowCleanupModal(true)}
              disabled={!isClosureDayActive || !cleanupValidation?.can_cleanup || cleaning || checking || ((cleanupValidation?.stats?.total_records_in_values ?? 1) === 0)}
              className={`w-full p-5 rounded-2xl border text-left flex items-start gap-4 transition-all duration-300 relative overflow-hidden group select-none ${
                !isClosureDayActive || !cleanupValidation?.can_cleanup || ((cleanupValidation?.stats?.total_records_in_values ?? 1) === 0)
                  ? 'bg-[#1a1a1c]/20 dark:bg-[#1a1a1c]/10 border-rose-500/30 dark:border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.1)] opacity-70 cursor-not-allowed'
                  : 'bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border-rose-500/50 dark:border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:border-rose-500/80 dark:hover:border-rose-500/90 hover:shadow-[0_0_35px_rgba(244,63,94,0.32)] hover:scale-[1.01] active:scale-[0.98] cursor-pointer'
              }`}
            >
              {/* Clean minimalist raw SVG icon (No bubble wrapper, direct SVG with intense glow) */}
              <div className={`transition-transform duration-300 group-hover:scale-110 flex-shrink-0 mt-0.5 ${
                (cleanupValidation?.stats?.total_records_in_values ?? 1) === 0
                  ? 'text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : !isClosureDayActive || !cleanupValidation?.can_cleanup
                  ? 'text-gray-400 dark:text-zinc-650'
                  : 'text-rose-500 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
              }`}>
                {(cleanupValidation?.stats?.total_records_in_values ?? 1) === 0 ? (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.0}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[10px] font-black tracking-wider text-rose-500 dark:text-rose-400/80 uppercase">
                  Paso 2
                </span>
                <h4 className="text-base font-extrabold text-gray-900 dark:text-white mt-0.5 leading-tight">
                  Limpieza & reinicio
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">
                  Borra y reinicia los totales a 0.00 en Mi Calculadora para iniciar el nuevo período.
                </p>
              </div>
            </button>
          </div>

        </div>

        {/* Columna Derecha: Operaciones Especiales */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white tracking-tight">
              Operaciones Especiales
            </h4>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {/* Aviso a Modelos (📢) */}
            {userRole === 'super_admin' && (
              <button
                type="button"
                onClick={handleEnviarAvisoModelos}
                disabled={avisoLoading}
                title="Envía por Botty un mensaje a todas las modelos indicando que la calculadora se ha restablecido."
                className="w-full pl-6 pr-5 py-3.5 rounded-full border bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border-rose-500/40 dark:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:border-rose-500/70 dark:hover:border-rose-500/80 hover:shadow-[0_0_25px_rgba(244,63,94,0.22)] transition-all duration-300 active:scale-98 flex items-center gap-3.5 group cursor-pointer disabled:opacity-50 disabled:border-rose-500/20 disabled:shadow-none disabled:cursor-not-allowed select-none"
              >
                {/* Minimalist Raw Icon, No Bubble wrapper, illuminated emerald neon */}
                <div className="text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.0}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h5 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                    Aviso a modelos
                  </h5>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {avisoLoading ? 'Enviando notificación...' : 'Calculadora restaurada'}
                  </p>
                </div>
              </button>
            )}

            {/* Reset Forzado (🔥) */}
            {userRole === 'super_admin' && (
              <button
                type="button"
                onClick={handleForceResetAll}
                disabled={forceResetLoading}
                title="Acción administrativa para borrar todos los valores activos sin verificar fecha de cierre."
                className="w-full pl-6 pr-5 py-3.5 rounded-full border bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border-rose-500/40 dark:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:border-rose-500/70 dark:hover:border-rose-500/80 hover:shadow-[0_0_25px_rgba(244,63,94,0.22)] transition-all duration-300 active:scale-98 flex items-center gap-3.5 group cursor-pointer disabled:opacity-50 disabled:border-rose-500/20 disabled:shadow-none disabled:cursor-not-allowed select-none"
              >
                {/* Minimalist Raw Icon, No Bubble wrapper, illuminated orange neon */}
                <div className="text-orange-500 dark:text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.0}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                  </svg>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h5 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                    Reset forzado
                  </h5>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {forceResetLoading ? 'Ejecutando limpieza...' : 'Todas las calculadoras'}
                  </p>
                </div>
              </button>
            )}

            {/* Restaurar (🚨) */}
            <button
              onClick={() => setShowRestoreModal(true)}
              disabled={!archiveStatus?.archived || restoring}
              className="w-full pl-6 pr-5 py-3.5 rounded-full border bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-md border-rose-500/40 dark:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:border-rose-500/70 dark:hover:border-rose-500/80 hover:shadow-[0_0_25px_rgba(244,63,94,0.22)] transition-all duration-300 active:scale-98 flex items-center gap-3.5 group cursor-pointer disabled:opacity-50 disabled:border-rose-500/20 disabled:shadow-none disabled:cursor-not-allowed select-none"
            >
              {/* Minimalist Raw Icon, No Bubble wrapper, illuminated rose/red neon */}
              <div className="text-rose-500 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.0}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 text-left min-w-0">
                <h5 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                  Restaurar datos
                </h5>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  Solo emergencias
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Glowing Status Banner (Moved here to act as a unified card status footer bar) */}
      <div className="mt-6 sm:-mx-6 sm:-mb-6 border-t border-black/[0.06] dark:border-white/[0.08] pt-3.5 pb-3.5 px-1.5 sm:px-6 flex items-center justify-between gap-3 select-none text-[11px] font-bold text-gray-500 dark:text-zinc-400 sm:bg-black/[0.03] sm:dark:bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
          </span>
          <span>
            {isClosureDayActive ? (
              <>Período activo para archivar: <span className="text-rose-500 dark:text-rose-400 font-extrabold drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]">{periodToClose?.label || periodToClose?.periodType}</span></>
            ) : (
              <>Próximo cierre de período: <span className="text-rose-500 dark:text-rose-400 font-extrabold drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]">Días 1 y 16 de cada mes</span></>
            )}
          </span>
        </div>
        
        {checking && (
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-400 flex-shrink-0">
            <span className="w-2.5 h-2.5 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
            Sincronizando
          </span>
        )}
      </div>

      {/* Modal: Confirmar Archivado */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-modal max-w-md w-full p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📦</span> Confirmar creación de archivo histórico
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              Se creará el archivo histórico del período <strong className="text-gray-900 dark:text-white">{periodToClose?.periodType}</strong>.
              Este proceso puede tardar varios minutos.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mb-6 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 leading-relaxed font-semibold">
              ⚠️ Una vez iniciado, no se puede cancelar. Asegúrate de que todas las modelos hayan terminado de ingresar sus valores.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={archiving}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-full text-xs font-bold hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {archiving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Archivando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Limpieza */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-modal max-w-md w-full p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🧹</span> Confirmar limpieza y reseteo
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              Se realizarán las siguientes acciones en el sistema:
            </p>
            <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-2 mb-6 list-disc list-inside bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-xl border border-black/[0.05] dark:border-white/[0.05]">
              <li>Los datos se moverán a la tabla de archivo histórico.</li>
              <li>Las calculadoras de modelos se resetearán a <strong className="text-gray-900 dark:text-white">0.00</strong>.</li>
              <li>Se descongelarán todas las calculadoras congeladas.</li>
              <li>Se iniciará el nuevo período <strong className="text-gray-900 dark:text-white">{getNewPeriodAfterClosure().periodType}</strong>.</li>
            </ul>
            <p className="text-xs text-red-600 dark:text-red-400 mb-6 bg-red-500/5 p-3 rounded-xl border border-red-500/10 leading-relaxed font-semibold">
              ⚠️ Esta acción es irreversible. Asegúrate de que el archivado del Paso 1 se completó correctamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCleanupModal(false)}
                disabled={cleaning}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-all active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-full text-xs font-bold hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {cleaning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Limpiando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Restaurar */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-modal max-w-md w-full p-6 bg-white dark:bg-zinc-800 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl text-center">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center justify-center gap-2">
              <span>🚨</span> Restaurar período (Emergencia)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              Esta función está reservada estrictamente para situaciones de contingencia y requiere asistencia técnica directa.
            </p>
            <button
              onClick={() => setShowRestoreModal(false)}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-700 text-xs font-bold text-gray-700 dark:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-650 transition-all active:scale-95 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
