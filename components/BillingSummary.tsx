'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getColombiaDate } from '@/utils/calculator-dates';
import { useBillingPolling } from '@/hooks/useBillingPolling';

interface BillingData {
  modelId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  organizationId?: string;
  groupId?: string;
  groupName?: string;
  usdBruto: number;
  usdModelo: number;
  usdSede: number;
  copModelo: number;
  copSede: number;
}

interface GroupData {
  groupId: string;
  groupName: string;
  models: BillingData[];
  totalModels: number;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
  totalCopModelo: number;
  totalCopSede: number;
}

interface SedeData {
  sedeId: string;
  sedeName: string;
  groups: GroupData[];
  models: BillingData[];
  totalModels: number;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
  totalCopModelo: number;
  totalCopSede: number;
  isAffiliate?: boolean;
  commission_percentage?: number;
  sedes_count?: number;
  // Campos específicos para afiliados (perspectiva Agencia Innova)
  totalUsdAfiliado?: number; // 90% del bruto (diferencia entre bruto y comisión Innova)
  totalCopAfiliado?: number; // 90% del bruto en COP
}

interface BillingSummary {
  totalModels: number;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
  totalCopModelo: number;
  totalCopSede: number;
}

interface BillingSummaryProps {
  userRole: 'admin' | 'super_admin' | 'superadmin_aff';
  userId: string;
  userGroups?: string[];
  selectedDate?: string;
  selectedPeriod?: string;
}

export default function BillingSummary({ userRole, userId, userGroups = [], selectedDate: propSelectedDate, selectedPeriod: propSelectedPeriod }: BillingSummaryProps) {
  console.log('🔍 [BILLING-SUMMARY] Componente renderizado:', { userRole, userId, propSelectedDate, propSelectedPeriod });
  
  const [billingData, setBillingData] = useState<BillingData[]>([]);
  const [groupedData, setGroupedData] = useState<SedeData[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affiliateStudioName, setAffiliateStudioName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(propSelectedDate || getColombiaDate());
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(propSelectedPeriod || 'current'); // 'current', 'period-1', 'period-2'
  const [availableSedes, setAvailableSedes] = useState<Array<{id: string, name: string}>>([]);
  const [expandedSedes, setExpandedSedes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllModels, setShowAllModels] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showStatusText, setShowStatusText] = useState(false);
  // Estado para el modo privacidad / enfoque de una modelo específica (Tema Ámbar)
  const [focusedModelId, setFocusedModelId] = useState<string | null>(null);

  // Historial de Modelos (magical slide-out in amber theme)
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

  // Actualizar estado cuando cambien las props
  useEffect(() => {
    if (propSelectedDate) {
      setSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  useEffect(() => {
    if (propSelectedPeriod) {
      setSelectedPeriod(propSelectedPeriod);
    }
  }, [propSelectedPeriod]);

  // Cargar sedes disponibles (solo para super_admin)
  useEffect(() => {
    if (userRole === 'super_admin') {
      loadAvailableSedes();
    }
  }, [userRole]);

  // Cargar datos de facturación
  useEffect(() => {
    loadBillingData();
  }, [selectedDate, selectedSede, selectedPeriod, userId]);

  const loadAvailableSedes = async () => {
    try {
      const response = await fetch('/api/groups');
      const data = await response.json();
      if (data.success) {
        setAvailableSedes(data.data || []);
      }
    } catch (error) {
      console.error('Error al cargar sedes:', error);
    }
  };

  const loadBillingData = async (silent = false) => {
    try {
      console.log('🔍 [BILLING-SUMMARY] Iniciando carga de datos:', { userId, userRole, selectedDate, selectedSede, selectedPeriod, userGroups, silent });
      
      // Solo mostrar loading si no es una actualización silenciosa
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Solo limpiar datos si no es una actualización silenciosa
      if (!silent) {
        setBillingData([]);
        setGroupedData([]);
        setSummary(null);
      }

      // Calcular fecha basada en período seleccionado
      let targetDate = selectedDate;
      if (selectedPeriod === 'period-1') {
        // Período 1: día 15 del mes seleccionado
        const date = new Date(selectedDate);
        targetDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-15`;
      } else if (selectedPeriod === 'period-2') {
        // Período 2: último día del mes seleccionado
        const date = new Date(selectedDate);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        targetDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }

      const params = new URLSearchParams({
        adminId: userId,
        periodDate: targetDate
      });

      if (selectedSede) {
        params.append('sedeId', selectedSede);
      }

      console.log('🔍 [BILLING-SUMMARY] Parámetros:', params.toString());
      
      // Agregar timestamp para evitar cache del navegador
      const url = `/api/admin/billing-summary?${params}&_t=${Date.now()}`;
      console.log('🔍 [BILLING-SUMMARY] URL completa:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const data = await response.json();
      console.log('🔍 [BILLING-SUMMARY] Respuesta API:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar datos');
      }

      console.log('🔍 [BILLING-SUMMARY] Estableciendo nuevos datos:', {
        billingDataLength: data.data?.length || 0,
        summary: data.summary,
        groupedDataLength: data.groupedData?.length || 0,
        groupedData: data.groupedData,
        userGroups,
        affiliateStudioName: data.affiliateStudioName
      });

      // Guardar nombre del estudio afiliado si está disponible
      if (data.affiliateStudioName) {
        setAffiliateStudioName(data.affiliateStudioName);
      }

      // El API ya está filtrando los datos correctamente, no necesitamos filtrar en el frontend
      let filteredData = data.data || [];
      let filteredGroupedData = data.groupedData || [];
      let filteredSummary = data.summary || null;

      // No aplicar filtros adicionales, el API ya lo hace
      if (false && userRole === 'admin' && userGroups && userGroups.length > 0) {
        // Filtrar datos de facturación por grupos del admin
        filteredData = filteredData.filter((item: BillingData) => 
          item.groupId && userGroups.includes(item.groupId)
        );

        // Filtrar datos agrupados por grupos del admin
        filteredGroupedData = filteredGroupedData.filter((sede: SedeData) => 
          sede.groups.some((group: GroupData) => userGroups.includes(group.groupId))
        ).map((sede: SedeData) => ({
          ...sede,
          groups: sede.groups.filter((group: GroupData) => userGroups.includes(group.groupId))
        }));

        // Recalcular resumen con datos filtrados
        if (filteredData.length > 0) {
          const totalBruto = filteredData.reduce((sum: number, item: BillingData) => sum + item.usdBruto, 0);
          const totalModelo = filteredData.reduce((sum: number, item: BillingData) => sum + item.usdModelo, 0);
          filteredSummary = {
            totalModels: filteredData.length,
            totalUsdBruto: totalBruto,
            totalUsdModelo: totalModelo,
            totalUsdSede: totalBruto - totalModelo, // USD Agencia = USD Bruto - USD Modelo
            totalCopModelo: filteredData.reduce((sum: number, item: BillingData) => sum + item.copModelo, 0),
            totalCopSede: filteredData.reduce((sum: number, item: BillingData) => sum + item.copSede, 0)
          };
        }
      }

      // Ordenar las agencias, sus grupos y sus modelos al interior por orden de facturación (de mayor a menor)
      const sortedGroupedData = (filteredGroupedData || []).map((sede: SedeData) => {
        const sortedSede = { ...sede };
        if (sede.groups && sede.groups.length > 0) {
          sortedSede.groups = [...sede.groups]
            .map((g: GroupData) => ({
              ...g,
              models: [...g.models].sort((a, b) => b.usdBruto - a.usdBruto)
            }))
            .sort((a, b) => b.totalUsdBruto - a.totalUsdBruto);
        }
        if (sede.models && sede.models.length > 0) {
          sortedSede.models = [...sede.models].sort((a, b) => b.usdBruto - a.usdBruto);
        }
        return sortedSede;
      });

      setBillingData(filteredData);
      setGroupedData(sortedGroupedData);
      setSummary(filteredSummary);

    } catch (error: any) {
      console.error('Error al cargar resumen de facturación:', error);
      setError(error.message || 'Error al cargar datos');
    } finally {
      // Solo ocultar loading si no es una actualización silenciosa
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // 🔄 ACTUALIZACIÓN AUTOMÁTICA: Usar polling estable cada 15 segundos para mejor sincronización
  const { isPolling, isSilentUpdating, manualRefresh } = useBillingPolling(
    loadBillingData,
    [selectedDate, selectedSede, userId],
    {
      refreshInterval: 15000, // 15 segundos (reducido de 30s para mejor sincronización)
      enabled: true,
      silentUpdate: true, // Actualizaciones silenciosas sin parpadeos
      onRefresh: () => {
        console.log('🔄 [BILLING-SUMMARY] Datos actualizados automáticamente');
      }
    }
  );

  const formatCurrency = (amount: number, currency: 'USD' | 'COP' = 'USD') => {
    if (currency === 'COP') {
      return amount.toLocaleString('es-CO', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      });
    }
    return amount.toLocaleString('es-CO', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const toggleSedeExpansion = (sedeId: string) => {
    const newExpanded = new Set<string>();
    if (!expandedSedes.has(sedeId)) {
      newExpanded.add(sedeId);
    }
    // Al cambiar de sede o cerrar la actual, reseteamos el estado de grupos expandidos
    setExpandedGroups(new Set());
    setExpandedSedes(newExpanded);
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set<string>();
    if (!expandedGroups.has(groupId)) {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // No se muestra estado de carga explícito — el shell del componente se renderiza
  // inmediatamente y las secciones dependientes de datos tienen guards condicionales.

  if (error) {
    return (
      <div className="mb-10">
        <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <div className="text-center py-8">
            <div className="text-red-500 text-lg mb-2">⚠️</div>
            <div className="text-red-600 dark:text-red-400 font-medium">Error al cargar datos</div>
            <div className="text-gray-600 dark:text-gray-600 dark:text-gray-500 dark:text-gray-600 dark:text-gray-500 text-sm mt-1">{error}</div>
            <button 
              onClick={() => loadBillingData()}
              className="mt-4 btn-apple-primary"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Detectar si es una consulta histórica
  const isHistorical = propSelectedDate && propSelectedPeriod && propSelectedPeriod !== 'current';

  return (
    <div className={`mb-4 sm:mb-6 flex flex-col gap-1.5 sm:gap-2 h-full ${isHistorical ? 'px-3 sm:px-0' : ''}`}>
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-start justify-between px-1">
        <div className="flex items-start space-x-1.5 sm:space-x-2 min-w-0">
          <div className="flex items-center justify-center text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] mt-0.5">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex items-baseline min-w-0">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              Resumen de Facturación
            </h2>
            <span className="ml-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
              {userRole === 'super_admin' 
                ? 'Vista consolidada de todas las sedes' 
                : userRole === 'superadmin_aff'
                ? 'Vista de las sedes de tu estudio'
                : 'Vista de tus sedes asignadas'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-0.5">
          {/* Botón de actualizar — solo icono, sin píldora */}
          <button
            onClick={() => {
              manualRefresh();
            }}
            disabled={loading}
            className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200 active:scale-90 disabled:opacity-30"
            title={loading ? 'Actualizando...' : 'Actualizar datos'}
          >
            <svg 
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {/* Botón expandir/contraer — solo icono, sin píldora */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center justify-center text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors duration-200 active:scale-90"
            title={collapsed ? 'Expandir' : 'Contraer'}
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card Body - Contenedores flotantes separados al estilo de la Calculadora de Ingresos */}
      {!collapsed && (
        <div className={`flex-1 flex flex-col gap-3 sm:gap-4 ${isHistorical ? 'px-2 sm:px-4' : ''}`}>
          {/* Resumen general - Versión compacta */}
          {summary && (
            <div className={`rounded-[20px] sm:rounded-[30px] p-1 sm:p-1.5 backdrop-blur-3xl bg-white/40 dark:bg-[#1a1a1c]/40 border border-white/50 dark:border-white/10 overflow-hidden shadow-sm ${isHistorical ? 'mb-3 sm:mb-5 mt-3 sm:mt-5' : 'mb-4 sm:mb-6 mt-4 sm:mt-6'}`}>
              <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                <div className="bg-white/40 dark:bg-white/[0.03] border-white/50 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl p-2 sm:p-4 hover:shadow-md transition-all duration-300">
                  <div className="text-center min-w-0">
                    <div className="text-xs sm:text-xl font-bold text-blue-600 dark:text-blue-400 mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${formatCurrency(summary.totalUsdBruto)}</div>
                    <div className="inline-block bg-blue-100/80 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">Gross</div>
                  </div>
                </div>
                <div className="bg-white/40 dark:bg-white/[0.03] border-white/50 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl p-2 sm:p-4 hover:shadow-md transition-all duration-300">
                  <div className="text-center min-w-0">
                    <div className="text-xs sm:text-xl font-bold text-green-600 dark:text-emerald-400 mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${formatCurrency(summary.totalUsdModelo)}</div>
                    <div className="inline-block bg-green-100/80 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs whitespace-nowrap">Team Cut</div>
                  </div>
                </div>
                <div className="bg-white/40 dark:bg-white/[0.03] border-white/50 dark:border-white/[0.08] rounded-2xl sm:rounded-3xl p-2 sm:p-4 hover:shadow-md transition-all duration-300">
                  <div className="text-center min-w-0">
                    <div className="text-xs sm:text-xl font-bold text-purple-600 dark:text-purple-400 mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${formatCurrency(summary.totalUsdSede)}</div>
                    <div className="inline-block bg-purple-100/80 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">
                      {userRole === 'superadmin_aff' && affiliateStudioName ? affiliateStudioName : 'Profit'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vista jerárquica para Super Admin - Aplicando políticas estéticas */}
          {userRole === 'super_admin' && groupedData && groupedData.length > 0 ? (
            <div className={`space-y-3 sm:space-y-4 ${isHistorical ? 'space-y-2 sm:space-y-3' : ''}`}>
              {groupedData.map((sede) => (
                <div key={sede.sedeId} className="bg-white/50 dark:bg-[#1a1a1c]/60 backdrop-blur-sm rounded-[1.75rem] shadow-md border border-black/[0.04] dark:border-white/[0.05] overflow-hidden hover:shadow-lg transition-all duration-300">
                  {/* Header de Sede - Aplicando políticas estéticas */}
                  <div 
                    className="px-5 py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200"
                    onClick={() => toggleSedeExpansion(sede.sedeId)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
                      {/* Left: Expand/Sede info */}
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200">
                          <svg 
                            className={`w-4 h-4 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
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
                            {sede.isAffiliate 
                              ? `${sede.totalModels} modelos • ${sede.sedes_count || 0} sedes • ${sede.commission_percentage || 10}% comisión`
                              : `${sede.totalModels} modelos • ${sede.groups?.length || 0} grupos`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Right: Consolidated values aligned to the right in a fixed-width grid for perfect vertical symmetry */}
                      <div className="grid grid-cols-4 w-full lg:w-[420px] xl:w-[460px] gap-x-2 sm:gap-x-4 gap-y-2 border-t lg:border-t-0 border-black/[0.03] dark:border-white/[0.05] pt-3 lg:pt-0 lg:mr-[36px] xl:mr-[36px]">
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">USD Modelo</span>
                          <span className="text-xs sm:text-sm font-bold text-green-600 dark:text-[#2dd4bf] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.15)] truncate">${formatCurrency(sede.totalUsdModelo)}</span>
                        </div>
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">USD Sede</span>
                          <span className="text-xs sm:text-sm font-bold text-purple-600 dark:text-[#c488fc] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.15)] truncate">${formatCurrency(sede.totalUsdSede)}</span>
                        </div>
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">COP Modelo</span>
                          <span className="text-xs sm:text-sm font-bold text-green-700 dark:text-[#2dd4bf] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.15)] truncate">{formatCurrency(sede.totalCopModelo ?? 0, 'COP')}</span>
                        </div>
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">COP Sede</span>
                          <span className="text-xs sm:text-sm font-bold text-purple-700 dark:text-[#c488fc] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.15)] truncate">{formatCurrency(sede.totalCopSede ?? 0, 'COP')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grupos de la Sede o Resumen de Afiliado */}
                  {expandedSedes.has(sede.sedeId) && (
                    <div className="bg-black/[0.02] dark:bg-black/20 border-t border-black/[0.04] dark:border-white/[0.05]">
                      {/* Neon Glowing Line Separator (Matches the Ambient Dock Circle Wave) */}
                      <div className="h-[1.5px] w-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.75),0_0_3px_rgba(245,158,11,0.85)] pointer-events-none opacity-70" />
                      {sede.isAffiliate ? (
                        // Vista para afiliados: mostrar resumen de comisión y luego grupos
                        <div>
                          {/* Resumen de comisión del afiliado */}
                          <div className="px-6 py-4 border-b border-black/[0.03] dark:border-white/[0.05]">
                            <div className="bg-white/50 dark:bg-[#1a1a1c]/60 rounded-xl shadow-sm border border-black/[0.04] dark:border-white/[0.05] p-4">
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">${formatCurrency(sede.totalUsdBruto)}</div>
                                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">USD Bruto Total</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-600 dark:text-emerald-400">${formatCurrency(sede.totalUsdAfiliado ?? sede.totalUsdModelo)}</div>
                                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">USD Afiliado</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">${formatCurrency(sede.totalUsdSede)}</div>
                                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">USD Comisión Innova</div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-zinc-400 text-center pt-3 border-t border-black/[0.03] dark:border-white/[0.05]">
                                Comisión: {sede.commission_percentage || 10}% • Total COP: ${formatCurrency(sede.totalCopSede, 'COP')}
                              </div>
                            </div>
                          </div>
                          {/* Grupos del afiliado */}
                          <div className="p-4 space-y-3">
                            {sede.groups?.map((group) => (
                              <div key={group.groupId} className="bg-white/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05] rounded-2xl shadow-sm hover:shadow-md hover:bg-white/60 dark:hover:bg-white/[0.04] transition-all duration-300 overflow-hidden">
                                {/* Header de Grupo - Aplicando políticas estéticas */}
                                <div 
                                  className="px-[36px] sm:px-[40px] py-2.5 sm:py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200 active:scale-[0.98] touch-manipulation"
                                  onClick={() => toggleGroupExpansion(group.groupId)}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                                    <div className="flex items-center space-x-2 sm:space-x-4">
                                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 dark:bg-white/5 rounded-md flex items-center justify-center flex-shrink-0">
                                        <svg 
                                          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${expandedGroups.has(group.groupId) ? 'rotate-90' : ''}`}
                                          fill="none" 
                                          stroke="currentColor" 
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">{group.groupName}</h4>
                                        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-zinc-400">{group.totalModels} modelos</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                      <div className="flex flex-col items-end min-w-[80px]">
                                        <div className="font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdBruto)}</div>
                                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                                      </div>
                                      <div className="flex flex-col items-end min-w-[80px]">
                                        <div className="font-semibold text-green-600 dark:text-emerald-400 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdModelo)}</div>
                                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelos</div>
                                      </div>
                                      <div className="flex flex-col items-end min-w-[80px]">
                                        <div className="font-semibold text-purple-600 dark:text-purple-400 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdSede)}</div>
                                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                          {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : 'USD Agencia'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Modelos del Grupo */}
                                {expandedGroups.has(group.groupId) && (
                                  <div className="bg-black/[0.01] dark:bg-black/10">
                                    <div className="h-[1.5px] w-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.75),0_0_3px_rgba(245,158,11,0.85)] pointer-events-none opacity-70" />
                                    <div className="px-6 py-4">
                                      <div className="space-y-3">
                                        {group.models.map((model) => (
                                          <div 
                                            key={model.modelId} 
                                            onClick={() => setFocusedModelId(prev => prev === model.modelId ? null : model.modelId)}
                                            className={`flex flex-col p-3 sm:p-4 bg-white/40 dark:bg-[#1a1a1c]/40 rounded-xl transition-all duration-500 cursor-pointer select-none border gap-2 ${
                                              focusedModelId !== null
                                                ? focusedModelId === model.modelId
                                                  ? 'border-amber-500/40 dark:border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] dark:shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.01] z-10'
                                                  : 'border-black/[0.04] dark:border-white/[0.05] blur-[8px] opacity-[0.08] scale-[0.98] pointer-events-none'
                                                : 'border-black/[0.04] dark:border-white/[0.05] hover:shadow-md hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 shadow-sm'
                                            }`}
                                          >
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 w-full">
                                              <div className="flex items-center space-x-2 sm:space-x-3">
                                                <div 
                                                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 relative overflow-hidden bg-[#121214] cursor-pointer hover:opacity-90 active:scale-95 transition-all ring-2 ring-transparent hover:ring-white/20"
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
                                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                                  <span 
                                                    className="font-semibold text-gray-800 dark:text-white text-xs sm:text-sm truncate hover:text-amber-500 dark:hover:text-amber-400 cursor-pointer select-none transition-colors duration-200"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleModelHistory(model.modelId);
                                                    }}
                                                    title="Ver promedio histórico"
                                                  >
                                                    {model.name || model.email}
                                                  </span>

                                                  {/* Sliding horizontal average pill */}
                                                  <div 
                                                    className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center flex-shrink-0"
                                                    style={{ 
                                                      width: activeModelHistory === model.modelId ? (modelHistoryLoading ? '60px' : (modelHistoryData?.hasHistory ? '170px' : '86px')) : '0px', 
                                                      opacity: activeModelHistory === model.modelId ? 1 : 0,
                                                      marginLeft: activeModelHistory === model.modelId ? '6px' : '0px'
                                                    }}
                                                  >
                                                    {activeModelHistory === model.modelId && (
                                                      modelHistoryLoading ? (
                                                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium whitespace-nowrap">Cargando...</span>
                                                      ) : modelHistoryData ? (
                                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold shadow-sm select-none whitespace-nowrap">
                                                           {modelHistoryData.hasHistory ? (
                                                             <>
                                                               <span>Prom: ${formatCurrency(modelHistoryData.avgUsdBruto)}</span>
                                                               <span className="opacity-40">•</span>
                                                               <span className="text-emerald-500">
                                                                 {modelHistoryData.avgPorcentaje.toFixed(1)}%
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
                                              <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                                <div className="flex flex-col items-end min-w-[80px]">
                                                  <div className="font-medium text-blue-600/80 dark:text-blue-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdBruto)}</div>
                                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                                                </div>
                                                <div className="flex flex-col items-end min-w-[80px]">
                                                  <div className="font-medium text-green-600/80 dark:text-emerald-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdModelo)}</div>
                                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelo</div>
                                                </div>
                                                <div className="flex flex-col items-end min-w-[80px]">
                                                  <div className="font-medium text-purple-600/80 dark:text-purple-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdSede)}</div>
                                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                                    {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : 'USD Agencia'}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Expandable smart suggestion card */}
                                            <div 
                                              className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                              style={{
                                                maxHeight: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '44px' : '0px',
                                                opacity: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? 1 : 0,
                                                marginTop: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '6px' : '0px'
                                              }}
                                            >
                                              {modelHistoryData && (
                                                <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/5 to-yellow-500/5 dark:from-amber-500/10 dark:to-yellow-500/10 border border-amber-500/10 dark:border-amber-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-2">
                                                  <svg 
                                                    className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)] flex-shrink-0 animate-pulse"
                                                    fill="none" 
                                                    stroke="currentColor" 
                                                    viewBox="0 0 24 24"
                                                  >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                  </svg>
                                                  {modelHistoryData.hasHistory ? (
                                                    <div className="min-w-0 flex-1 flex items-center justify-between text-[10px]">
                                                      <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                                        El objetivo sugerido para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span> es: <span className="font-extrabold text-amber-700 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">${formatCurrency(modelHistoryData.sugGoal)}</span>
                                                      </span>
                                                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums ml-2 flex-shrink-0">
                                                        (Historial promedio: ${formatCurrency(modelHistoryData.avgUsdBruto)} • {modelHistoryData.avgPorcentaje.toFixed(1)}%)
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <div className="min-w-0 flex-1 text-[10px]">
                                                      <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                                        No hay suficiente historial para sugerir un objetivo para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span>.
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        // Vista normal: solo grupos
                        <div className="p-4 space-y-3">
                          {sede.groups?.map((group) => (
                            <div key={group.groupId} className="bg-white/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.05] rounded-2xl shadow-sm hover:shadow-md hover:bg-white/60 dark:hover:bg-white/[0.04] transition-all duration-300 overflow-hidden">
                              {/* Header de Grupo - Aplicando políticas estéticas */}
                              <div 
                                className="px-[36px] sm:px-[40px] py-2.5 sm:py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200 active:scale-[0.98] touch-manipulation"
                                onClick={() => toggleGroupExpansion(group.groupId)}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                                  <div className="flex items-center space-x-2 sm:space-x-4">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 dark:bg-white/5 rounded-md flex items-center justify-center flex-shrink-0">
                                      <svg 
                                        className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${expandedGroups.has(group.groupId) ? 'rotate-90' : ''}`}
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">{group.groupName}</h4>
                                      <p className="text-[10px] sm:text-xs text-gray-600 dark:text-zinc-400">{group.totalModels} modelos</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                    <div className="flex flex-col items-end min-w-[80px]">
                                      <div className="font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdBruto)}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[80px]">
                                      <div className="font-semibold text-green-600 dark:text-emerald-400 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdModelo)}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelos</div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[80px]">
                                      <div className="font-semibold text-purple-600 dark:text-purple-400 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdSede)}</div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                        {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : `USD ${group.groupName}`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Modelos del Grupo */}
                              {expandedGroups.has(group.groupId) && (
                                <div className="bg-black/[0.01] dark:bg-black/10">
                                  {/* Neon Glowing Line Separator (Matches the Ambient Dock Circle Wave) */}
                                  <div className="h-[1.5px] w-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.75),0_0_3px_rgba(245,158,11,0.85)] pointer-events-none opacity-70" />
                                  <div className="px-6 py-4">
                                    <div className="space-y-3">
                                      {group.models.map((model) => (
                                        <div 
                                          key={model.modelId} 
                                          onClick={() => setFocusedModelId(prev => prev === model.modelId ? null : model.modelId)}
                                          className={`flex flex-col p-3 sm:p-4 bg-white/40 dark:bg-[#1a1a1c]/40 rounded-xl transition-all duration-500 cursor-pointer select-none border gap-2 ${
                                            focusedModelId !== null
                                              ? focusedModelId === model.modelId
                                                ? 'border-amber-500/40 dark:border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] dark:shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.01] z-10'
                                                : 'border-black/[0.04] dark:border-white/[0.05] blur-[8px] opacity-[0.08] scale-[0.98] pointer-events-none'
                                              : 'border-black/[0.04] dark:border-white/[0.05] hover:shadow-md hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 shadow-sm'
                                          }`}
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 w-full">
                                            <div className="flex items-center space-x-2 sm:space-x-3">
                                              <div 
                                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 relative overflow-hidden bg-[#121214] cursor-pointer hover:opacity-90 active:scale-95 transition-all ring-2 ring-transparent hover:ring-white/20"
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
                                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                                <span 
                                                  className="font-semibold text-gray-800 dark:text-white text-xs sm:text-sm truncate hover:text-amber-500 dark:hover:text-amber-400 cursor-pointer select-none transition-colors duration-200"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleModelHistory(model.modelId);
                                                  }}
                                                  title="Ver promedio histórico"
                                                >
                                                  {model.name || model.email}
                                                </span>

                                                {/* Sliding horizontal average pill */}
                                                <div 
                                                  className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center flex-shrink-0"
                                                  style={{ 
                                                    width: activeModelHistory === model.modelId ? (modelHistoryLoading ? '60px' : (modelHistoryData?.hasHistory ? '170px' : '86px')) : '0px', 
                                                    opacity: activeModelHistory === model.modelId ? 1 : 0,
                                                    marginLeft: activeModelHistory === model.modelId ? '6px' : '0px'
                                                  }}
                                                >
                                                  {activeModelHistory === model.modelId && (
                                                    modelHistoryLoading ? (
                                                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium whitespace-nowrap">Cargando...</span>
                                                    ) : modelHistoryData ? (
                                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold shadow-sm select-none whitespace-nowrap">
                                                         {modelHistoryData.hasHistory ? (
                                                           <>
                                                             <span>Prom: ${formatCurrency(modelHistoryData.avgUsdBruto)}</span>
                                                             <span className="opacity-40">•</span>
                                                             <span className="text-emerald-500">
                                                               {modelHistoryData.avgPorcentaje.toFixed(1)}%
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
                                            <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                              <div className="flex flex-col items-end min-w-[80px]">
                                                <div className="font-medium text-blue-600/80 dark:text-blue-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdBruto)}</div>
                                                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                                              </div>
                                              <div className="flex flex-col items-end min-w-[80px]">
                                                <div className="font-medium text-green-600/80 dark:text-emerald-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdModelo)}</div>
                                                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelo</div>
                                              </div>
                                              <div className="flex flex-col items-end min-w-[80px]">
                                                <div className="font-medium text-purple-600/80 dark:text-purple-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdSede)}</div>
                                                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                                  {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : model.groupName ? `USD ${model.groupName}` : 'USD Agencia'}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Expandable smart suggestion card */}
                                          <div 
                                            className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                            style={{
                                              maxHeight: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '44px' : '0px',
                                              opacity: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? 1 : 0,
                                              marginTop: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '6px' : '0px'
                                            }}
                                          >
                                            {modelHistoryData && (
                                              <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/5 to-yellow-500/5 dark:from-amber-500/10 dark:to-yellow-500/10 border border-amber-500/10 dark:border-amber-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-2">
                                                <svg 
                                                  className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)] flex-shrink-0 animate-pulse"
                                                  fill="none" 
                                                  stroke="currentColor" 
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                </svg>
                                                {modelHistoryData.hasHistory ? (
                                                  <div className="min-w-0 flex-1 flex items-center justify-between text-[10px]">
                                                    <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                                      El objetivo sugerido para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span> es: <span className="font-extrabold text-amber-700 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">${formatCurrency(modelHistoryData.sugGoal)}</span>
                                                    </span>
                                                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums ml-2 flex-shrink-0">
                                                      (Historial promedio: ${formatCurrency(modelHistoryData.avgUsdBruto)} • {modelHistoryData.avgPorcentaje.toFixed(1)}%)
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div className="min-w-0 flex-1 text-[10px]">
                                                    <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                                      No hay suficiente historial para sugerir un objetivo para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span>.
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : billingData.length > 0 ? (
            <div className={`space-y-2 sm:space-y-3 ${isHistorical ? 'space-y-2' : ''}`}>
              {/* Vista unificada: Sedes individuales para todos los usuarios */}
              {/* Forzar renderizado de sedes individuales cuando hay groupedData */}
              {groupedData && groupedData.length > 0 ? (
                <div className="space-y-3">
                  {groupedData.map((sede) => (
                    <div key={sede.sedeId} className="bg-white/50 dark:bg-[#1a1a1c]/60 backdrop-blur-sm rounded-[1.75rem] shadow-md border border-black/[0.04] dark:border-white/[0.05] overflow-hidden hover:shadow-lg transition-all duration-300">
                  {/* Header de Sede - Aplicando políticas estéticas */}
                  <div 
                    className="px-5 py-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200 active:scale-[0.98] touch-manipulation"
                    onClick={() => toggleSedeExpansion(sede.sedeId)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
                      {/* Left: Expand/Sede info */}
                      <div className="flex items-center space-x-4 min-w-0">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200">
                          <svg 
                            className={`w-4 h-4 text-gray-600 dark:text-zinc-400 transition-transform duration-200 ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
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
                            {sede.totalModels} modelos • {sede.groups?.length || 0} grupos
                          </p>
                        </div>
                      </div>

                      {/* Right: Consolidated values aligned to the right in a fixed-width grid for perfect vertical symmetry */}
                      <div className="grid grid-cols-3 w-full lg:w-[315px] xl:w-[345px] gap-x-2 sm:gap-x-4 gap-y-2 border-t lg:border-t-0 border-black/[0.03] dark:border-white/[0.05] pt-3 lg:pt-0 lg:mr-[8px] xl:mr-[8px]">
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">USD Bruto</span>
                          <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 truncate">${formatCurrency(sede.totalUsdBruto)}</span>
                        </div>
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">USD Modelos</span>
                          <span className="text-xs sm:text-sm font-bold text-green-600 dark:text-emerald-400 truncate">${formatCurrency(sede.totalUsdModelo)}</span>
                        </div>
                        <div className="flex flex-col items-start lg:items-end min-w-0 tabular-nums">
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                            {sede.isAffiliate ? 'USD Comisión' : userRole === 'superadmin_aff' && affiliateStudioName ? affiliateStudioName : 'USD Sede'}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-purple-600 dark:text-purple-400 truncate">${formatCurrency(sede.totalUsdSede)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                      {/* Modelos de la Sede (expandible) */}
                      {expandedSedes.has(sede.sedeId) && (
                        <div className="bg-black/[0.01] dark:bg-black/10">
                          {/* Neon Glowing Line Separator (Matches the Ambient Dock Circle Wave) */}
                          <div className="h-[1.5px] w-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.75),0_0_3px_rgba(245,158,11,0.85)] pointer-events-none opacity-70" />
                          <div className="space-y-2 p-4">
                            {sede.models.map((model) => (
                              <div 
                                key={model.modelId} 
                                onClick={() => setFocusedModelId(prev => prev === model.modelId ? null : model.modelId)}
                                className={`flex flex-col p-3 bg-white/40 dark:bg-[#1a1a1c]/40 rounded-lg transition-all duration-500 cursor-pointer select-none border gap-2 ${
                                  focusedModelId !== null
                                    ? focusedModelId === model.modelId
                                      ? 'border-amber-500/40 dark:border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] dark:shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.01] z-10'
                                      : 'border-black/[0.02] dark:border-white/[0.02] blur-[8px] opacity-[0.08] scale-[0.98] pointer-events-none'
                                    : 'border-black/[0.02] dark:border-white/[0.02] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center space-x-3">
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
                                    <div className="flex items-center gap-2">
                                      <span 
                                        className="font-semibold text-gray-800 dark:text-white text-sm hover:text-amber-500 dark:hover:text-amber-400 cursor-pointer select-none transition-colors duration-200"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleModelHistory(model.modelId);
                                        }}
                                        title="Ver promedio histórico"
                                      >
                                        {model.name || model.email}
                                      </span>

                                      {/* Sliding horizontal average pill */}
                                      <div 
                                        className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center flex-shrink-0"
                                        style={{ 
                                          width: activeModelHistory === model.modelId ? (modelHistoryLoading ? '60px' : (modelHistoryData?.hasHistory ? '170px' : '86px')) : '0px', 
                                          opacity: activeModelHistory === model.modelId ? 1 : 0,
                                          marginLeft: activeModelHistory === model.modelId ? '6px' : '0px'
                                        }}
                                      >
                                        {activeModelHistory === model.modelId && (
                                          modelHistoryLoading ? (
                                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium whitespace-nowrap">Cargando...</span>
                                          ) : modelHistoryData ? (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold shadow-sm select-none whitespace-nowrap">
                                               {modelHistoryData.hasHistory ? (
                                                 <>
                                                   <span>Prom: ${formatCurrency(modelHistoryData.avgUsdBruto)}</span>
                                                   <span className="opacity-40">•</span>
                                                   <span className="text-emerald-500">
                                                     {modelHistoryData.avgPorcentaje.toFixed(1)}%
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
                                  <div className="flex items-center space-x-4 text-xs">
                                    <div className="flex flex-col items-end min-w-[80px]">
                                      <div className="font-medium text-blue-600/80 dark:text-blue-400/75 leading-tight">${formatCurrency(model.usdBruto)}</div>
                                      <div className="text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[80px]">
                                      <div className="font-medium text-green-600/80 dark:text-emerald-400/75 leading-tight">${formatCurrency(model.usdModelo)}</div>
                                      <div className="text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelo</div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[80px]">
                                      <div className="font-medium text-purple-600/80 dark:text-purple-400/75 leading-tight">${formatCurrency(model.usdSede)}</div>
                                      <div className="text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                        {userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : model.groupName ? `USD ${model.groupName}` : 'USD Agencia'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Expandable smart suggestion card */}
                                <div 
                                  className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                  style={{
                                    maxHeight: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '44px' : '0px',
                                    opacity: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? 1 : 0,
                                    marginTop: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '6px' : '0px'
                                  }}
                                >
                                  {modelHistoryData && (
                                    <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/5 to-yellow-500/5 dark:from-amber-500/10 dark:to-yellow-500/10 border border-amber-500/10 dark:border-amber-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-2">
                                      <svg 
                                        className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)] flex-shrink-0 animate-pulse"
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                      </svg>
                                      {modelHistoryData.hasHistory ? (
                                        <div className="min-w-0 flex-1 flex items-center justify-between text-[10px]">
                                          <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                            El objetivo sugerido para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span> es: <span className="font-extrabold text-amber-700 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">${formatCurrency(modelHistoryData.sugGoal)}</span>
                                          </span>
                                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums ml-2 flex-shrink-0">
                                            (Historial promedio: ${formatCurrency(modelHistoryData.avgUsdBruto)} • {modelHistoryData.avgPorcentaje.toFixed(1)}%)
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="min-w-0 flex-1 text-[10px]">
                                          <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                            No hay suficiente historial para sugerir un objetivo para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span>.
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback: Vista de modelos individuales si no hay groupedData */
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 sm:p-4 bg-white/50 dark:bg-[#1a1a1c]/60 rounded-xl border border-black/[0.04] dark:border-white/[0.05]">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <button
                        onClick={() => setShowAllModels(!showAllModels)}
                        className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-lg flex items-center justify-center hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0"
                      >
                        <svg 
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 transition-transform duration-200 ${showAllModels ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">
                          {userRole === 'admin' ? `Mis Modelos (${billingData.length})` : `Todos los Modelos (${billingData.length})`}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400">Haz clic para {showAllModels ? 'ocultar' : 'mostrar'} detalles</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                      <div className="flex flex-col items-end min-w-[80px]">
                        <div className="font-semibold text-blue-600 dark:text-blue-400 text-xs sm:text-sm leading-tight">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdBruto, 0))}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                      </div>
                      <div className="flex flex-col items-end min-w-[80px]">
                        <div className="font-semibold text-green-600 dark:text-emerald-400 text-xs sm:text-sm leading-tight">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdModelo, 0))}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelo</div>
                      </div>
                      <div className="flex flex-col items-end min-w-[80px]">
                        <div className="font-semibold text-purple-600 dark:text-purple-400 text-xs sm:text-sm leading-tight">${formatCurrency(
                          billingData.reduce((sum, model) => sum + model.usdSede, 0)
                        )}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                          {(() => {
                            // Si todos los modelos tienen el mismo grupo, mostrar ese nombre
                            if (billingData.length > 0) {
                              const firstGroupName = billingData[0].groupName;
                              const allSameGroup = billingData.every(model => model.groupName === firstGroupName);
                              if (allSameGroup && firstGroupName) {
                                  return `USD ${firstGroupName}`;
                              }
                            }
                            // Si hay múltiples grupos o no hay grupo, usar nombre del estudio o fallback
                            return userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : 'USD Agencia';
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lista de modelos (expandible) */}
                  {showAllModels && (
                    <div className="space-y-2">
                      {billingData.map((model) => (
                        <div 
                          key={model.modelId} 
                          onClick={() => setFocusedModelId(prev => prev === model.modelId ? null : model.modelId)}
                          className={`flex flex-col p-3 sm:p-4 bg-white/40 dark:bg-[#1a1a1c]/40 rounded-xl transition-all duration-500 cursor-pointer select-none border gap-2 ${
                            focusedModelId !== null
                              ? focusedModelId === model.modelId
                                ? 'border-amber-500/40 dark:border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] dark:shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.01] z-10'
                                : 'border-black/[0.02] dark:border-white/[0.02] blur-[8px] opacity-[0.08] scale-[0.98] pointer-events-none'
                              : 'border-black/[0.02] dark:border-white/[0.02] hover:bg-white/60 dark:hover:bg-[#1a1a1c]/60 hover:shadow-md'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 w-full">
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <div 
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 relative overflow-hidden bg-[#121214] cursor-pointer hover:opacity-90 active:scale-95 transition-all ring-2 ring-transparent hover:ring-white/20"
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
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <span 
                                  className="font-semibold text-gray-800 dark:text-white text-xs sm:text-sm truncate hover:text-amber-500 dark:hover:text-amber-400 cursor-pointer select-none transition-colors duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleModelHistory(model.modelId);
                                  }}
                                  title="Ver promedio histórico"
                                >
                                  {model.name || model.email}
                                </span>

                                {/* Sliding horizontal average pill */}
                                <div 
                                  className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex items-center flex-shrink-0"
                                  style={{ 
                                    width: activeModelHistory === model.modelId ? (modelHistoryLoading ? '60px' : (modelHistoryData?.hasHistory ? '170px' : '86px')) : '0px', 
                                    opacity: activeModelHistory === model.modelId ? 1 : 0,
                                    marginLeft: activeModelHistory === model.modelId ? '6px' : '0px'
                                  }}
                                >
                                  {activeModelHistory === model.modelId && (
                                    modelHistoryLoading ? (
                                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium whitespace-nowrap">Cargando...</span>
                                    ) : modelHistoryData ? (
                                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-bold shadow-sm select-none whitespace-nowrap">
                                         {modelHistoryData.hasHistory ? (
                                           <>
                                             <span>Prom: ${formatCurrency(modelHistoryData.avgUsdBruto)}</span>
                                             <span className="opacity-40">•</span>
                                             <span className="text-emerald-500">
                                               {modelHistoryData.avgPorcentaje.toFixed(1)}%
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
                            <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                              <div className="font-medium text-blue-600/80 dark:text-blue-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdBruto)}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Bruto</div>
                            </div>
                            <div className="flex flex-col items-end min-w-[80px]">
                              <div className="font-medium text-green-600/80 dark:text-emerald-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdModelo)}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">USD Modelo</div>
                            </div>
                            <div className="flex flex-col items-end min-w-[80px]">
                              <div className="font-medium text-purple-600/80 dark:text-purple-400/75 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdSede)}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400 leading-tight mt-0.5">
                                {model.groupName ? `USD ${model.groupName}` : userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : 'USD Sede'}
                              </div>
                            </div>
                          </div>

                          {/* Expandable smart suggestion card */}
                          <div 
                            className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{
                              maxHeight: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '44px' : '0px',
                              opacity: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? 1 : 0,
                              marginTop: activeModelHistory === model.modelId && !modelHistoryLoading && modelHistoryData ? '6px' : '0px'
                            }}
                          >
                            {modelHistoryData && (
                              <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/5 to-yellow-500/5 dark:from-amber-500/10 dark:to-yellow-500/10 border border-amber-500/10 dark:border-amber-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center gap-2">
                                <svg 
                                  className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)] flex-shrink-0 animate-pulse"
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                {modelHistoryData.hasHistory ? (
                                  <div className="min-w-0 flex-1 flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                      El objetivo sugerido para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span> es: <span className="font-extrabold text-amber-700 dark:text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]">${formatCurrency(modelHistoryData.sugGoal)}</span>
                                    </span>
                                    <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium tabular-nums ml-2 flex-shrink-0">
                                      (Historial promedio: ${formatCurrency(modelHistoryData.avgUsdBruto)} • {modelHistoryData.avgPorcentaje.toFixed(1)}%)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="min-w-0 flex-1 text-[10px]">
                                    <span className="font-bold text-zinc-800 dark:text-amber-200 truncate">
                                      No hay suficiente historial para sugerir un objetivo para <span className="text-amber-600 dark:text-amber-400">{model.name || model.email.split('@')[0]}</span>.
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-zinc-400">
              <div className="w-16 h-16 bg-gray-100/60 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="font-medium text-gray-600 dark:text-zinc-200 mb-1">No hay datos disponibles</div>
              <div className="text-sm text-gray-500 dark:text-zinc-400">No se encontraron modelos con datos para el período seleccionado</div>
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
