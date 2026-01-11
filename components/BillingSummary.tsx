'use client';

import { useState, useEffect } from 'react';
import { getColombiaDate } from '@/utils/calculator-dates';
import { useBillingPolling } from '@/hooks/useBillingPolling';

interface BillingData {
  modelId: string;
  email: string;
  name: string;
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

      setBillingData(filteredData);
      setGroupedData(filteredGroupedData);
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
    const newExpanded = new Set(expandedSedes);
    if (newExpanded.has(sedeId)) {
      newExpanded.delete(sedeId);
    } else {
      newExpanded.add(sedeId);
    }
    setExpandedSedes(newExpanded);
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  if (loading) {
    return (
      <div className="mb-10">
        <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-600 dark:text-gray-500 dark:text-gray-300">Cargando resumen de facturación...</span>
          </div>
        </div>
      </div>
    );
  }

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
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
    <div className={`mb-4 sm:mb-6 ${isHistorical ? 'px-3 sm:px-0' : ''}`}>
      {/* Card Header - Versión compacta */}
      <div className={`bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20 ${isHistorical ? 'mb-3 sm:mb-6' : 'mb-4 sm:mb-8'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">Resumen de Facturación</h1>
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-white hidden sm:block">
                {userRole === 'super_admin' 
                  ? 'Vista consolidada de todas las sedes' 
                  : userRole === 'superadmin_aff'
                  ? 'Vista de las sedes de tu estudio'
                  : 'Vista de tus sedes asignadas'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end space-x-2">
            {/* Botón de refresh manual con estado de polling */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {/* Indicador de polling */}
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isPolling ? 'bg-green-500' : 'bg-gray-400'
                } ${isSilentUpdating ? 'animate-pulse' : ''}`}></div>
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-white hidden sm:inline">
                  {isSilentUpdating ? 'Actualizando...' : 
                   isPolling ? 'Actualización automática' : 'Manual'}
                </span>
              </div>
              
              <button
                onClick={manualRefresh}
                disabled={loading}
                className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
                title={loading ? 'Actualizando...' : 'Actualizar'}
              >
                <svg 
                  className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className={`px-2 sm:px-4 pb-3 sm:pb-4 ${isHistorical ? 'px-2 sm:px-4' : ''}`}>
          {/* Resumen general - Versión compacta */}
          {summary && (
            <div className={`grid grid-cols-3 gap-2 sm:gap-4 ${isHistorical ? 'mb-3 sm:mb-5 mt-3 sm:mt-5' : 'mb-4 sm:mb-6 mt-4 sm:mt-6'}`}>
              <div className="bg-blue-50/80 dark:bg-blue-50/90 backdrop-blur-sm rounded-lg p-2 sm:p-4 hover:shadow-md transition-all duration-300 border border-blue-200/50 dark:border-blue-200/50">
                <div className="text-center min-w-0">
                  <div className="text-xs sm:text-xl font-bold text-blue-600 dark:text-blue-600 mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${formatCurrency(summary.totalUsdBruto)}</div>
                  <div className="inline-block bg-blue-100/80 dark:bg-blue-200/80 text-blue-700 dark:text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">USD Bruto</div>
                </div>
              </div>
              <div className="bg-green-50/80 dark:bg-green-50/90 backdrop-blur-sm rounded-lg p-2 sm:p-4 hover:shadow-md transition-all duration-300 border border-green-200/50 dark:border-green-200/50">
                <div className="text-center min-w-0">
                  <div className="text-xs sm:text-xl font-bold text-green-600 dark:text-green-600 mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${formatCurrency(summary.totalUsdModelo)}</div>
                  <div className="inline-block bg-green-100/80 dark:bg-green-200/80 text-green-700 dark:text-green-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs whitespace-nowrap">USD Modelos</div>
                </div>
              </div>
              <div className="bg-purple-50/80 dark:bg-purple-50/90 backdrop-blur-sm rounded-lg p-2 sm:p-4 hover:shadow-md transition-all duration-300 border border-purple-200/50 dark:border-purple-200/50">
                <div className="text-center min-w-0">
                  <div className="text-xs sm:text-xl font-bold text-purple-600 dark:text-purple-600 mb-1 sm:mb-2.5 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">${formatCurrency(summary.totalUsdSede)}</div>
                  <div className="inline-block bg-purple-100/80 dark:bg-purple-200/80 text-purple-700 dark:text-purple-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">
                    {userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : 'USD Agencia'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vista jerárquica para Super Admin - Aplicando políticas estéticas */}
          {userRole === 'super_admin' && groupedData && groupedData.length > 0 ? (
            <div className={`space-y-3 sm:space-y-4 ${isHistorical ? 'space-y-2 sm:space-y-3' : ''}`}>
              {groupedData.map((sede) => (
                <div key={sede.sedeId} className="bg-white/70 dark:bg-white backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-200/50 overflow-hidden hover:shadow-lg transition-all duration-300">
                  {/* Header de Sede - Aplicando políticas estéticas */}
                  <div 
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-600/50 transition-all duration-200"
                    onClick={() => toggleSedeExpansion(sede.sedeId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <svg 
                            className={`w-4 h-4 text-gray-600 dark:text-gray-600 dark:text-gray-500 transition-transform duration-200 ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-900">
                            {sede.sedeName}
                            {sede.isAffiliate && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                Afiliado
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500">
                            {sede.isAffiliate 
                              ? `${sede.totalModels} modelos • ${sede.sedes_count || 0} sedes • ${sede.commission_percentage || 10}% comisión`
                              : `${sede.totalModels} modelos • ${sede.groups?.length || 0} grupos`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grupos de la Sede o Resumen de Afiliado */}
                  {expandedSedes.has(sede.sedeId) && (
                    <div className="bg-gray-50/30 dark:bg-gray-600/30 border-t border-gray-200/50 dark:border-gray-500/50">
                      {sede.isAffiliate ? (
                        // Vista para afiliados: mostrar resumen de comisión y luego grupos
                        <div>
                          {/* Resumen de comisión del afiliado */}
                          <div className="px-6 py-4 border-b border-gray-200/50">
                            <div className="bg-white/70 rounded-xl shadow-sm border border-white/20 p-4">
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600 dark:text-blue-600">${formatCurrency(sede.totalUsdBruto)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">USD Bruto Total</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-600 dark:text-green-600">${formatCurrency(sede.totalUsdAfiliado ?? sede.totalUsdModelo)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">USD Afiliado</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-purple-600 dark:text-purple-600">${formatCurrency(sede.totalUsdSede)}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">USD Comisión Innova</div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-500 text-center pt-3 border-t border-gray-200/50">
                                Comisión: {sede.commission_percentage || 10}% • Total COP: ${formatCurrency(sede.totalCopSede, 'COP')}
                              </div>
                            </div>
                          </div>
                          {/* Grupos del afiliado */}
                          {sede.groups?.map((group) => (
                        <div key={group.groupId} className="border-b border-gray-200/30 last:border-b-0">
                          {/* Header de Grupo - Aplicando políticas estéticas */}
                          <div 
                            className="px-3 sm:px-6 py-2.5 sm:py-4 cursor-pointer hover:bg-white/50 transition-all duration-200 active:scale-[0.98] touch-manipulation"
                            onClick={() => toggleGroupExpansion(group.groupId)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                              <div className="flex items-center space-x-2 sm:space-x-4">
                                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                                  <svg 
                                    className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600 dark:text-gray-600 dark:text-gray-500 transition-transform duration-200 ${expandedGroups.has(group.groupId) ? 'rotate-90' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-900 truncate">{group.groupName}</h4>
                                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-600 dark:text-gray-500">{group.totalModels} modelos</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                <div className="flex flex-col items-end min-w-[80px]">
                                  <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdBruto)}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                                </div>
                                <div className="flex flex-col items-end min-w-[80px]">
                                  <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdModelo)}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Modelos</div>
                                </div>
                                <div className="flex flex-col items-end min-w-[80px]">
                                  <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdSede)}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">
                                    {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : 'USD Agencia'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Modelos del Grupo */}
                          {expandedGroups.has(group.groupId) && (
                            <div className="bg-white/40 border-t border-gray-200/30">
                              <div className="px-6 py-4">
                                <div className="space-y-3">
                                  {group.models.map((model) => (
                                    <div key={model.modelId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 sm:p-4 bg-white/70 rounded-xl shadow-sm border border-white/20 hover:shadow-md hover:bg-white/80 transition-all duration-300">
                                      <div className="flex items-center space-x-2 sm:space-x-3">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-600 dark:text-gray-500">
                                            {model.email.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium text-gray-800 dark:text-gray-800 text-xs sm:text-sm truncate">{model.email}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                        <div className="flex flex-col items-end min-w-[80px]">
                                          <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdBruto)}</div>
                                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                                        </div>
                                        <div className="flex flex-col items-end min-w-[80px]">
                                          <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdModelo)}</div>
                                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Modelo</div>
                                        </div>
                                        <div className="flex flex-col items-end min-w-[80px]">
                                          <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdSede)}</div>
                                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">
                                            {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : 'USD Agencia'}
                                          </div>
                                        </div>
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
                      ) : (
                        // Vista normal: solo grupos
                        sede.groups?.map((group) => (
                        <div key={group.groupId} className="border-b border-gray-200/30 last:border-b-0">
                          {/* Header de Grupo - Aplicando políticas estéticas */}
                          <div 
                            className="px-3 sm:px-6 py-2.5 sm:py-4 cursor-pointer hover:bg-white/50 transition-all duration-200 active:scale-[0.98] touch-manipulation"
                            onClick={() => toggleGroupExpansion(group.groupId)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                              <div className="flex items-center space-x-2 sm:space-x-4">
                                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                                  <svg 
                                    className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-600 dark:text-gray-600 dark:text-gray-500 transition-transform duration-200 ${expandedGroups.has(group.groupId) ? 'rotate-90' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-900 truncate">{group.groupName}</h4>
                                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-600 dark:text-gray-500">{group.totalModels} modelos</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                <div className="flex flex-col items-end min-w-[80px]">
                                  <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdBruto)}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                                </div>
                                <div className="flex flex-col items-end min-w-[80px]">
                                  <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdModelo)}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Modelos</div>
                                </div>
                                <div className="flex flex-col items-end min-w-[80px]">
                                  <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(group.totalUsdSede)}</div>
                                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">
                                    {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : `USD ${group.groupName}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Modelos del Grupo */}
                          {expandedGroups.has(group.groupId) && (
                            <div className="bg-white/40 border-t border-gray-200/30">
                              <div className="px-6 py-4">
                                <div className="space-y-3">
                                  {group.models.map((model) => (
                                    <div key={model.modelId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 sm:p-4 bg-white/70 rounded-xl shadow-sm border border-white/20 hover:shadow-md hover:bg-white/80 transition-all duration-300">
                                      <div className="flex items-center space-x-2 sm:space-x-3">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                          <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-600 dark:text-gray-500">
                                            {model.email.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium text-gray-800 dark:text-gray-800 text-xs sm:text-sm truncate">{model.email}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                                        <div className="flex flex-col items-end min-w-[80px]">
                                          <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdBruto)}</div>
                                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                                        </div>
                                        <div className="flex flex-col items-end min-w-[80px]">
                                          <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdModelo)}</div>
                                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Modelo</div>
                                        </div>
                                        <div className="flex flex-col items-end min-w-[80px]">
                                          <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdSede)}</div>
                                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">
                                            {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : model.groupName ? `USD ${model.groupName}` : 'USD Agencia'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        ))
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
                    <div key={sede.sedeId} className="bg-white/70 dark:bg-white backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-200/50 overflow-hidden hover:shadow-lg transition-all duration-300">
                  {/* Header de Sede - Aplicando políticas estéticas */}
                  <div 
                    className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-600/50 transition-all duration-200 active:scale-[0.98] touch-manipulation"
                    onClick={() => toggleSedeExpansion(sede.sedeId)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <div className="flex items-center space-x-2 sm:space-x-4">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg 
                            className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-600 dark:text-gray-500 transition-transform duration-200 ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-900 truncate">{sede.sedeName}</h3>
                          <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-600 dark:text-gray-500">{sede.totalModels} modelos • {sede.groups?.length || 0} grupos</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                        <div className="flex flex-col items-end min-w-[80px]">
                          <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(sede.totalUsdBruto)}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                        </div>
                        <div className="flex flex-col items-end min-w-[80px]">
                          <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(sede.totalUsdModelo)}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Modelos</div>
                        </div>
                        <div className="flex flex-col items-end min-w-[80px]">
                          <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(sede.totalUsdSede)}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">
                            {sede.isAffiliate ? `USD ${sede.sedeName.replace(' - Afiliado', '')}` : userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : `USD ${sede.sedeName}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                      {/* Modelos de la Sede (expandible) */}
                      {expandedSedes.has(sede.sedeId) && (
                        <div className="bg-gray-50/30 dark:bg-gray-600/30 border-t border-gray-200/50 dark:border-gray-500/50">
                          <div className="space-y-2 p-4">
                            {sede.models.map((model) => (
                              <div key={model.modelId} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-gray-200/40 hover:bg-white/80 transition-all duration-200">
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center">
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-600">
                                      {model.email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-800 dark:text-gray-800 text-sm">{model.email}</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4 text-xs">
                                  <div className="flex flex-col items-end min-w-[80px]">
                                    <div className="font-semibold text-blue-600 dark:text-blue-600 leading-tight">${formatCurrency(model.usdBruto)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                                  </div>
                                  <div className="flex flex-col items-end min-w-[80px]">
                                    <div className="font-semibold text-green-600 dark:text-green-600 leading-tight">${formatCurrency(model.usdModelo)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">USD Modelo</div>
                                  </div>
                                  <div className="flex flex-col items-end min-w-[80px]">
                                    <div className="font-semibold text-purple-600 dark:text-purple-600 leading-tight">${formatCurrency(model.usdSede)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-600 dark:text-gray-500 leading-tight mt-0.5">
                                      {userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : model.groupName ? `USD ${model.groupName}` : 'USD Agencia'}
                                    </div>
                                  </div>
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 sm:p-4 bg-white/70 rounded-xl border border-gray-200/50">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <button
                        onClick={() => setShowAllModels(!showAllModels)}
                        className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-blue-500/20 transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0"
                      >
                        <svg 
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-600 transition-transform duration-200 ${showAllModels ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-800 dark:text-gray-800 text-sm sm:text-base">
                          {userRole === 'admin' ? `Mis Modelos (${billingData.length})` : `Todos los Modelos (${billingData.length})`}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-600 dark:text-gray-500">Haz clic para {showAllModels ? 'ocultar' : 'mostrar'} detalles</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                      <div className="flex flex-col items-end min-w-[80px]">
                        <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdBruto, 0))}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                      </div>
                      <div className="flex flex-col items-end min-w-[80px]">
                        <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdModelo, 0))}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-tight mt-0.5">USD Modelo</div>
                      </div>
                      <div className="flex flex-col items-end min-w-[80px]">
                        <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(
                          billingData.reduce((sum, model) => sum + model.usdSede, 0)
                        )}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
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
                        <div key={model.modelId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 p-3 sm:p-4 bg-white/60 rounded-xl border border-gray-200/40 hover:bg-white/80 transition-all duration-200">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-blue-600 dark:text-blue-600">
                                {model.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-800 dark:text-gray-800 text-xs sm:text-sm truncate">{model.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-6 text-xs sm:text-sm">
                            <div className="flex flex-col items-end min-w-[80px]">
                              <div className="font-semibold text-blue-600 dark:text-blue-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdBruto)}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-tight mt-0.5">USD Bruto</div>
                            </div>
                            <div className="flex flex-col items-end min-w-[80px]">
                              <div className="font-semibold text-green-600 dark:text-green-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdModelo)}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-tight mt-0.5">USD Modelo</div>
                            </div>
                            <div className="flex flex-col items-end min-w-[80px]">
                              <div className="font-semibold text-purple-600 dark:text-purple-600 text-xs sm:text-sm leading-tight">${formatCurrency(model.usdSede)}</div>
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
                                {model.groupName ? `USD ${model.groupName}` : userRole === 'superadmin_aff' && affiliateStudioName ? `USD ${affiliateStudioName}` : 'USD Sede'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <div className="w-16 h-16 bg-gray-100/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="font-medium text-gray-600 dark:text-gray-600 dark:text-gray-500 mb-1">No hay datos disponibles</div>
              <div className="text-sm text-gray-500 dark:text-gray-600 dark:text-gray-500">No se encontraron modelos con datos para el período seleccionado</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
