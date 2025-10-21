'use client';

import { useState, useEffect } from 'react';
import { getColombiaDate } from '@/utils/calculator-dates';

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
  userRole: 'admin' | 'super_admin';
  userId: string;
  userGroups?: string[];
}

export default function BillingSummary({ userRole, userId, userGroups = [] }: BillingSummaryProps) {
  console.log('🔍 [BILLING-SUMMARY] Componente renderizado:', { userRole, userId });
  
  const [billingData, setBillingData] = useState<BillingData[]>([]);
  const [groupedData, setGroupedData] = useState<SedeData[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getColombiaDate());
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [availableSedes, setAvailableSedes] = useState<Array<{id: string, name: string}>>([]);
  const [expandedSedes, setExpandedSedes] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllModels, setShowAllModels] = useState<boolean>(false);

  // Cargar sedes disponibles (solo para super_admin)
  useEffect(() => {
    if (userRole === 'super_admin') {
      loadAvailableSedes();
    }
  }, [userRole]);

  // Cargar datos de facturación
  useEffect(() => {
    loadBillingData();
  }, [selectedDate, selectedSede, userId]);

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

  const loadBillingData = async () => {
    try {
      console.log('🔍 [BILLING-SUMMARY] Iniciando carga de datos:', { userId, userRole, selectedDate, selectedSede, userGroups });
      setLoading(true);
      setError(null);

      // Limpiar datos anteriores para evitar cache
      setBillingData([]);
      setGroupedData([]);
      setSummary(null);

      const params = new URLSearchParams({
        adminId: userId,
        periodDate: selectedDate
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
        userGroups
      });

      // Aplicar filtros de jerarquía para admins
      let filteredData = data.data || [];
      let filteredGroupedData = data.groupedData || [];
      let filteredSummary = data.summary || null;

      if (userRole === 'admin' && userGroups && userGroups.length > 0) {
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
          filteredSummary = {
            totalModels: filteredData.length,
            totalUsdBruto: filteredData.reduce((sum: number, item: BillingData) => sum + item.usdBruto, 0),
            totalUsdModelo: filteredData.reduce((sum: number, item: BillingData) => sum + item.usdModelo, 0),
            totalUsdSede: filteredData.reduce((sum: number, item: BillingData) => sum + item.usdSede, 0),
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
      setLoading(false);
    }
  };

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
        <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando resumen de facturación...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-10">
        <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <div className="text-center py-8">
            <div className="text-red-500 text-lg mb-2">⚠️</div>
            <div className="text-red-600 font-medium">Error al cargar datos</div>
            <div className="text-gray-600 text-sm mt-1">{error}</div>
            <button 
              onClick={loadBillingData}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-white/30 shadow-sm">
        {/* Header minimalista */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-800">Resumen de Facturación</h2>
            </div>
            <div className="flex items-center space-x-3">
              {/* Selector de fecha */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border-0 bg-gray-50/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-sm text-gray-700 placeholder-gray-400"
              />
              
              {/* Selector de sede (solo para super_admin) */}
              {userRole === 'super_admin' && (
                <select
                  value={selectedSede}
                  onChange={(e) => setSelectedSede(e.target.value)}
                  className="px-3 py-2 border-0 bg-gray-50/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-sm text-gray-700"
                >
                  <option value="">Todas las sedes</option>
                  {availableSedes.map((sede) => (
                    <option key={sede.id} value={sede.id}>
                      {sede.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Resumen general - Estilo Apple minimalista */}
          {summary && (
            <div className="grid grid-cols-3 gap-5 mb-8">
              <div className="bg-gradient-to-br from-gray-50/90 to-gray-100/70 rounded-2xl p-6 border border-gray-200/50">
                <div className="text-3xl font-semibold text-gray-800 mb-2">${formatCurrency(summary.totalUsdBruto)}</div>
                <div className="text-sm font-medium text-gray-500">USD Bruto</div>
              </div>
              <div className="bg-gradient-to-br from-green-50/90 to-emerald-100/70 rounded-2xl p-6 border border-green-200/50">
                <div className="text-3xl font-semibold text-green-700 mb-2">${formatCurrency(summary.totalUsdModelo)}</div>
                <div className="text-sm font-medium text-green-600">USD Modelo</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50/90 to-amber-100/70 rounded-2xl p-6 border border-orange-200/50">
                <div className="text-3xl font-semibold text-orange-700 mb-2">${formatCurrency(summary.totalUsdSede)}</div>
                <div className="text-sm font-medium text-orange-600">USD Sede</div>
              </div>
            </div>
          )}

          {/* Vista jerárquica para Super Admin - Estilo Apple */}
          {userRole === 'super_admin' && groupedData && groupedData.length > 0 ? (
            <div className="space-y-3">
              {groupedData.map((sede) => (
                <div key={sede.sedeId} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 overflow-hidden">
                  {/* Header de Sede */}
                  <div 
                    className="px-6 py-4 cursor-pointer hover:bg-gray-50/50 transition-all duration-200"
                    onClick={() => toggleSedeExpansion(sede.sedeId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl flex items-center justify-center">
                          <svg 
                            className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{sede.sedeName}</h3>
                          <p className="text-sm text-gray-500">{sede.totalModels} modelos • {sede.groups?.length || 0} grupos</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grupos de la Sede */}
                  {expandedSedes.has(sede.sedeId) && (
                    <div className="bg-gray-50/30 border-t border-gray-200/50">
                      {sede.groups?.map((group) => (
                        <div key={group.groupId} className="border-b border-gray-200/30 last:border-b-0">
                          {/* Header de Grupo */}
                          <div 
                            className="px-6 py-4 cursor-pointer hover:bg-white/50 transition-all duration-200"
                            onClick={() => toggleGroupExpansion(group.groupId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="w-6 h-6 bg-gradient-to-br from-gray-400/20 to-gray-500/20 rounded-lg flex items-center justify-center">
                                  <svg 
                                    className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${expandedGroups.has(group.groupId) ? 'rotate-90' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-700">{group.groupName}</h4>
                                  <p className="text-sm text-gray-500">{group.totalModels} modelos</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-6 text-sm">
                                <div className="text-right">
                                  <div className="font-semibold text-gray-700">${formatCurrency(group.totalUsdBruto)}</div>
                                  <div className="text-xs text-gray-500">USD Bruto</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-green-600">${formatCurrency(group.totalUsdModelo)}</div>
                                  <div className="text-xs text-gray-500">USD Modelo</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold text-orange-600">${formatCurrency(group.totalUsdSede)}</div>
                                  <div className="text-xs text-gray-500">USD Sede</div>
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
                                    <div key={model.modelId} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-gray-200/40 hover:bg-white/80 transition-all duration-200">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center">
                                          <span className="text-xs font-semibold text-blue-600">
                                            {model.email.charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="font-medium text-gray-800">{model.email}</div>
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-6 text-sm">
                                        <div className="text-right">
                                          <div className="font-semibold text-gray-700">${formatCurrency(model.usdBruto)}</div>
                                          <div className="text-xs text-gray-500">USD Bruto</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold text-green-600">${formatCurrency(model.usdModelo)}</div>
                                          <div className="text-xs text-gray-500">USD Modelo</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold text-orange-600">${formatCurrency(model.usdSede)}</div>
                                          <div className="text-xs text-gray-500">USD Sede</div>
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
                  )}
                </div>
              ))}
            </div>
          ) : billingData.length > 0 ? (
            <div className="space-y-3">
              {/* Vista unificada: Sedes individuales para todos los usuarios */}
              {/* Forzar renderizado de sedes individuales cuando hay groupedData */}
              {groupedData && groupedData.length > 0 ? (
                <div className="space-y-3">
                  {groupedData.map((sede) => (
                    <div key={sede.sedeId} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/50 overflow-hidden">
                      {/* Header de Sede */}
                      <div 
                        className="px-6 py-4 cursor-pointer hover:bg-gray-50/50 transition-all duration-200"
                        onClick={() => toggleSedeExpansion(sede.sedeId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl flex items-center justify-center">
                              <svg 
                                className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-800">{sede.sedeName}</h3>
                              <p className="text-sm text-gray-500">{sede.totalModels} modelos • {sede.groups?.length || 0} grupos</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6 text-sm">
                            <div className="text-right">
                              <div className="font-semibold text-gray-700">${formatCurrency(sede.totalUsdBruto)}</div>
                              <div className="text-xs text-gray-500">USD Bruto</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-600">${formatCurrency(sede.totalUsdModelo)}</div>
                              <div className="text-xs text-gray-500">USD Modelo</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-orange-600">${formatCurrency(sede.totalUsdSede)}</div>
                              <div className="text-xs text-gray-500">USD Sede</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Modelos de la Sede (expandible) */}
                      {expandedSedes.has(sede.sedeId) && (
                        <div className="bg-gray-50/30 border-t border-gray-200/50">
                          <div className="space-y-2 p-4">
                            {sede.models.map((model) => (
                              <div key={model.modelId} className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-gray-200/40 hover:bg-white/80 transition-all duration-200">
                                <div className="flex items-center space-x-3">
                                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center">
                                    <span className="text-xs font-semibold text-blue-600">
                                      {model.email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-800 text-sm">{model.email}</div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4 text-xs">
                                  <div className="text-right">
                                    <div className="font-semibold text-gray-700">${formatCurrency(model.usdBruto)}</div>
                                    <div className="text-xs text-gray-500">USD Bruto</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-green-600">${formatCurrency(model.usdModelo)}</div>
                                    <div className="text-xs text-gray-500">USD Modelo</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-orange-600">${formatCurrency(model.usdSede)}</div>
                                    <div className="text-xs text-gray-500">USD Sede</div>
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white/70 rounded-xl border border-gray-200/50">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowAllModels(!showAllModels)}
                        className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center hover:bg-blue-500/20 transition-all duration-200"
                      >
                        <svg 
                          className={`w-4 h-4 text-blue-600 transition-transform duration-200 ${showAllModels ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div>
                        <div className="font-medium text-gray-800">
                          {userRole === 'admin' ? `Mis Modelos (${billingData.length})` : `Todos los Modelos (${billingData.length})`}
                        </div>
                        <div className="text-sm text-gray-500">Haz clic para {showAllModels ? 'ocultar' : 'mostrar'} detalles</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="text-right">
                        <div className="font-semibold text-gray-700">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdBruto, 0))}</div>
                        <div className="text-xs text-gray-500">USD Bruto</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdModelo, 0))}</div>
                        <div className="text-xs text-gray-500">USD Modelo</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-orange-600">${formatCurrency(billingData.reduce((sum, model) => sum + model.usdSede, 0))}</div>
                        <div className="text-xs text-gray-500">USD Sede</div>
                      </div>
                    </div>
                  </div>

                  {/* Lista de modelos (expandible) */}
                  {showAllModels && (
                    <div className="space-y-2">
                      {billingData.map((model) => (
                        <div key={model.modelId} className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-gray-200/40 hover:bg-white/80 transition-all duration-200">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600">
                                {model.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{model.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-6 text-sm">
                            <div className="text-right">
                              <div className="font-semibold text-gray-700">${formatCurrency(model.usdBruto)}</div>
                              <div className="text-xs text-gray-500">USD Bruto</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-600">${formatCurrency(model.usdModelo)}</div>
                              <div className="text-xs text-gray-500">USD Modelo</div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-orange-600">${formatCurrency(model.usdSede)}</div>
                              <div className="text-xs text-gray-500">USD Sede</div>
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
            <div className="text-center py-12 text-gray-400">
              <div className="w-16 h-16 bg-gray-100/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="font-medium text-gray-600 mb-1">No hay datos disponibles</div>
              <div className="text-sm text-gray-500">No se encontraron modelos con datos para el período seleccionado</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
