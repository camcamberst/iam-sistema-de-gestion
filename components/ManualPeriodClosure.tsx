'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { isClosureDay, getPeriodToClose, getNewPeriodAfterClosure } from '@/utils/period-closure-dates';

const supabaseAuth = typeof window !== 'undefined' ? createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
) : null;

interface ManualPeriodClosureProps {
  userId: string;
  userRole: 'super_admin' | 'admin' | 'superadmin_aff' | 'admin_aff';
  groupId?: string;
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

export default function ManualPeriodClosure({ userId, userRole, groupId }: ManualPeriodClosureProps) {
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
          // Archivo ya existe, fue ejecutado por otro admin o en otra sesión
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
      const { data: { session } } = await supabaseAuth?.auth.getSession() ?? { data: { session: null } };
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
    <div className="mb-8">
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-lg overflow-hidden">
        {/* Header compacto desplegable */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                🔒 Cierre Manual de Período
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {isClosureDayActive ? (
                  <>Período: <span className="font-semibold">{periodToClose?.periodType}</span></>
                ) : (
                  <>Días 1 y 16 de cada mes</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {checking && (
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" title="Verificando..." />
            )}
            {!checking && archiveStatus?.archived && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" title="Archivado">✅</span>
            )}
            {!checking && (cleanupValidation?.stats?.total_records_in_values ?? 1) === 0 && archiveStatus?.archived && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" title="Completado">🎉</span>
            )}
            {!checking && cleanupValidation?.can_cleanup && (cleanupValidation?.stats?.total_records_in_values ?? 0) > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" title="Pendiente limpieza">⚠️</span>
            )}
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Contenido desplegable */}
        {expanded && (
          <div className="px-6 pb-6 pt-0 border-t border-indigo-200/50 dark:border-indigo-800/50">
        {/* Mensajes de error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-400">❌ {error}</p>
          </div>
        )}

        {/* Mensajes de resultado */}
        {archiveResult && !error && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400 font-semibold mb-2">
              ✅ Archivo histórico creado exitosamente por ti
            </p>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p>• Modelos archivadas: {archiveResult.models_archived}</p>
              <p>• Tiempo de ejecución: {(archiveResult.execution_time_ms / 1000).toFixed(2)}s</p>
              {archiveResult.partial && (
                <p className="text-yellow-700 dark:text-yellow-400 font-semibold">
                  ⚠️ {archiveResult.partial.models_failed} modelos fallaron. Revisa el log.
                </p>
              )}
            </div>
          </div>
        )}

        {!archiveResult && archiveStatus?.archived && archiveStatus?.last_log && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-400 font-semibold mb-2">
              ℹ️ Archivo histórico ya creado
            </p>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p>• Ejecutado por: {archiveStatus.last_log.user_email || 'Admin'}</p>
              <p>• Fecha: {new Date(archiveStatus.last_log.timestamp).toLocaleString('es-CO')}</p>
              {archiveStatus.last_log.models_affected && (
                <p>• Modelos archivadas: {archiveStatus.last_log.models_affected}</p>
              )}
            </div>
          </div>
        )}

        {cleanupResult && !error && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400 font-semibold mb-2">
              🎉 Limpieza completada por ti - Nuevo período iniciado
            </p>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p>• Registros archivados: {cleanupResult.records_archived}</p>
              <p>• Totales reseteados: {cleanupResult.totals_reset}</p>
              <p>• Calculadoras descongeladas: ✅</p>
            </div>
          </div>
        )}

        {forceResetResult && !error && userRole === 'super_admin' && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400 font-semibold mb-2">
              ✅ Reset forzado completado
            </p>
            <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
              <p>• Valores borrados (model_values): {forceResetResult.deleted_model_values}</p>
              <p>• Totales borrados (calculator_totals): {forceResetResult.deleted_calculator_totals}</p>
              <p>• Calculadoras descongeladas: ✔</p>
              <p>• Tiempo: {(forceResetResult.execution_time_ms / 1000).toFixed(2)}s</p>
            </div>
          </div>
        )}

        {avisoResult && !error && userRole === 'super_admin' && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400 font-semibold mb-2">
              ✅ Aviso enviado por Botty
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              Enviado a {avisoResult.sent} de {avisoResult.total} modelo(s).
            </p>
          </div>
        )}

        {!cleanupResult && (cleanupValidation?.stats?.total_records_in_values ?? 1) === 0 && archiveStatus?.archived && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-400 font-semibold mb-2">
              ℹ️ Período ya cerrado y limpiado
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              El proceso de cierre ya fue completado. Las calculadoras están listas para el nuevo período.
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Botón 1: Crear Archivo Histórico */}
          <button
            onClick={() => setShowArchiveModal(true)}
            disabled={!isClosureDayActive || archiveStatus?.archived || archiveStatus?.in_progress || archiving || checking}
            title={
              !isClosureDayActive 
                ? 'Este botón solo está disponible los días 1 y 16 de cada mes' 
                : archiveStatus?.archived 
                ? 'Archivo ya creado por ' + (archiveStatus?.last_log?.user_email || 'otro admin') 
                : ''
            }
            className={`relative group p-4 rounded-lg border-2 transition-all duration-200 ${
              !isClosureDayActive || archiveStatus?.archived
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 cursor-not-allowed opacity-60'
                : 'bg-white dark:bg-gray-900 border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 hover:shadow-lg cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                archiveStatus?.archived
                  ? 'bg-gray-300 dark:bg-gray-700'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              }`}>
                {archiveStatus?.archived ? (
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Paso 1: Crear Archivo
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {archiveStatus?.archived 
                    ? 'Completado ✅' 
                    : archiveStatus?.in_progress 
                    ? 'En progreso...' 
                    : 'Archivar datos del período'}
                </p>
              </div>
            </div>
          </button>

          {/* Botón 2: Limpiar y Resetear */}
          <button
            onClick={() => setShowCleanupModal(true)}
            disabled={!isClosureDayActive || !cleanupValidation?.can_cleanup || cleaning || checking || ((cleanupValidation?.stats?.total_records_in_values ?? 1) === 0)}
            title={
              !isClosureDayActive
                ? 'Este botón solo está disponible los días 1 y 16 de cada mes'
                : (cleanupValidation?.stats?.total_records_in_values ?? 1) === 0 
                ? 'Limpieza ya ejecutada' 
                : !cleanupValidation?.can_cleanup 
                ? 'Debes ejecutar el Paso 1 primero' 
                : ''
            }
            className={`relative group p-4 rounded-lg border-2 transition-all duration-200 ${
              !isClosureDayActive || !cleanupValidation?.can_cleanup || ((cleanupValidation?.stats?.total_records_in_values ?? 1) === 0)
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 cursor-not-allowed opacity-60'
                : 'bg-white dark:bg-gray-900 border-purple-300 dark:border-purple-700 hover:border-purple-500 hover:shadow-lg cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                cleanupResult
                  ? 'bg-gray-300 dark:bg-gray-700'
                  : cleanupValidation?.can_cleanup
                  ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                  : 'bg-gray-300 dark:bg-gray-700'
              }`}>
                {cleanupResult ? (
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Paso 2: Limpiar
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {(cleanupValidation?.stats?.total_records_in_values ?? 1) === 0 
                    ? 'Completado ✅' 
                    : cleanupValidation?.can_cleanup 
                    ? 'Resetear y descongelar' 
                    : 'Requiere paso 1'}
                </p>
              </div>
            </div>
          </button>

          {/* Botón 3: Restaurar (Emergencia) */}
          <button
            onClick={() => setShowRestoreModal(true)}
            disabled={!archiveStatus?.archived || restoring}
            className="relative group p-4 rounded-lg border-2 border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 hover:border-red-500 hover:shadow-lg transition-all duration-200 disabled:bg-gray-100 disabled:border-gray-300 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-600">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  🚨 Restaurar
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Solo emergencias
                </p>
              </div>
            </div>
          </button>

          {/* Botón 4: Reset forzado (solo super_admin) */}
          {userRole === 'super_admin' && (
            <button
              type="button"
              onClick={handleForceResetAll}
              disabled={forceResetLoading}
              title="Borra todos los valores en Mi Calculadora y todos los totales. Descongela todas las calculadoras. No se puede deshacer."
              className="relative group p-4 rounded-lg border-2 border-red-300 dark:border-red-700 bg-white dark:bg-gray-900 hover:border-red-500 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-red-600 to-orange-700">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    🔥 Reset forzado
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {forceResetLoading ? 'Ejecutando...' : 'Todas las calculadoras'}
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Botón 5: Enviar aviso a modelos (solo super_admin) */}
          {userRole === 'super_admin' && (
            <button
              type="button"
              onClick={handleEnviarAvisoModelos}
              disabled={avisoLoading}
              title="Envía por Botty un mensaje a todas las modelos: Mi Calculadora restaurada, pueden ingresar valores y consultar facturación en Mi Historial."
              className="relative group p-4 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-900 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a2.002 2.002 0 00-2-2h-1M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h2.5M9 17h.01M12 17h.01M15 13h.01M12 13h.01M9 13h.01M7 13h.01" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    📢 Aviso a modelos
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {avisoLoading ? 'Enviando...' : 'Mi Calculadora restaurada'}
                  </p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Validación de limpieza */}
        {cleanupValidation && !cleanupValidation.can_cleanup && cleanupValidation.validation_errors.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
              ⚠️ No se puede ejecutar la limpieza:
            </p>
            <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside">
              {cleanupValidation.validation_errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}
          </div>
        )}
      </div>

      {/* Modal: Confirmar Archivado */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              📦 Confirmar Creación de Archivo Histórico
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Se creará el archivo histórico del período <strong>{periodToClose?.periodType}</strong>.
              Este proceso puede tardar varios minutos.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">
              ⚠️ Una vez iniciado, no se puede cancelar. Asegúrate de que todas las modelos hayan terminado de ingresar sus valores.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={archiving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {archiving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              🧹 Confirmar Limpieza y Reseteo
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Se realizarán las siguientes acciones:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-6 list-disc list-inside">
              <li>Los datos se moverán a la tabla de archivo</li>
              <li>Las calculadoras se resetearán a 0.00</li>
              <li>Se descongelarán todas las calculadoras</li>
              <li>Se iniciará el período <strong>{getNewPeriodAfterClosure().periodType}</strong></li>
            </ul>
            <p className="text-xs text-red-600 dark:text-red-400 mb-6 font-semibold">
              ⚠️ Esta acción es irreversible. Asegúrate de que el archivado se completó correctamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCleanupModal(false)}
                disabled={cleaning}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cleaning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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

      {/* Modal: Restaurar (Para implementar) */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">
              🚨 Restaurar Período (Emergencia)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Esta función está reservada para situaciones de emergencia. 
              Contacta al desarrollador para implementar la restauración.
            </p>
            <button
              onClick={() => setShowRestoreModal(false)}
              className="w-full px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
