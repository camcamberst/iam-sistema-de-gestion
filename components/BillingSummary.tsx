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
}

export default function BillingSummary({ userRole, userId }: BillingSummaryProps) {
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
      console.log('🔍 [BILLING-SUMMARY] Iniciando carga de datos:', { userId, userRole, selectedDate, selectedSede });
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        adminId: userId,
        periodDate: selectedDate
      });

      if (selectedSede) {
        params.append('sedeId', selectedSede);
      }

      console.log('🔍 [BILLING-SUMMARY] Parámetros:', params.toString());
      const response = await fetch(`/api/admin/billing-summary?${params}`);
      const data = await response.json();
      console.log('🔍 [BILLING-SUMMARY] Respuesta API:', data);

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar datos');
      }

      setBillingData(data.data || []);
      setGroupedData(data.groupedData || []);
      setSummary(data.summary || null);

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
    <div className="mb-10">
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">Resumen de Facturación</h2>
            </div>
            <div className="flex items-center space-x-3">
              {/* Selector de fecha */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/80 backdrop-blur-sm text-sm"
              />
              
              {/* Selector de sede (solo para super_admin) */}
              {userRole === 'super_admin' && (
                <select
                  value={selectedSede}
                  onChange={(e) => setSelectedSede(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white/80 backdrop-blur-sm text-sm"
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

        <div className="p-6">
          {/* Resumen general */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.totalModels}</div>
                <div className="text-sm text-gray-600">Modelos</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-gray-700">${formatCurrency(summary.totalUsdBruto)}</div>
                <div className="text-sm text-gray-600">USD Bruto</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">${formatCurrency(summary.totalUsdModelo)}</div>
                <div className="text-sm text-gray-600">USD Modelo</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">${formatCurrency(summary.totalUsdSede)}</div>
                <div className="text-sm text-gray-600">USD Sede</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{formatCurrency(summary.totalCopModelo, 'COP')}</div>
                <div className="text-sm text-gray-600">COP Modelo</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">{formatCurrency(summary.totalCopSede, 'COP')}</div>
                <div className="text-sm text-gray-600">COP Sede</div>
              </div>
            </div>
          )}

          {/* Vista jerárquica para Super Admin o tabla simple para Admin */}
          {userRole === 'super_admin' && groupedData.length > 0 ? (
            <div className="space-y-4">
              {groupedData.map((sede) => (
                <div key={sede.sedeId} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Header de Sede */}
                  <div 
                    className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleSedeExpansion(sede.sedeId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <svg 
                          className={`w-4 h-4 text-gray-500 transition-transform ${expandedSedes.has(sede.sedeId) ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div>
                          <h3 className="font-semibold text-gray-900">{sede.sedeName}</h3>
                          <p className="text-sm text-gray-600">{sede.totalModels} modelos • {sede.groups.length} grupos</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="text-right">
                          <div className="font-medium text-gray-900">${formatCurrency(sede.totalUsdBruto)}</div>
                          <div className="text-gray-600">USD Bruto</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">${formatCurrency(sede.totalUsdModelo)}</div>
                          <div className="text-gray-600">USD Modelo</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-orange-600">${formatCurrency(sede.totalUsdSede)}</div>
                          <div className="text-gray-600">USD Sede</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Grupos de la Sede */}
                  {expandedSedes.has(sede.sedeId) && (
                    <div className="bg-white">
                      {sede.groups.map((group) => (
                        <div key={group.groupId} className="border-b border-gray-100 last:border-b-0">
                          {/* Header de Grupo */}
                          <div 
                            className="px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleGroupExpansion(group.groupId)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <svg 
                                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedGroups.has(group.groupId) ? 'rotate-90' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div>
                                  <h4 className="font-medium text-gray-800">{group.groupName}</h4>
                                  <p className="text-sm text-gray-600">{group.totalModels} modelos</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-4 text-sm">
                                <div className="text-right">
                                  <div className="font-medium text-gray-700">${formatCurrency(group.totalUsdBruto)}</div>
                                  <div className="text-gray-500">USD Bruto</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-green-600">${formatCurrency(group.totalUsdModelo)}</div>
                                  <div className="text-gray-500">USD Modelo</div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-orange-600">${formatCurrency(group.totalUsdSede)}</div>
                                  <div className="text-gray-500">USD Sede</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Modelos del Grupo */}
                          {expandedGroups.has(group.groupId) && (
                            <div className="bg-gray-50/50">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-2 px-4 font-medium text-gray-600">Email</th>
                                      <th className="text-right py-2 px-4 font-medium text-gray-600">USD Bruto</th>
                                      <th className="text-right py-2 px-4 font-medium text-gray-600">USD Modelo</th>
                                      <th className="text-right py-2 px-4 font-medium text-gray-600">USD Sede</th>
                                      <th className="text-right py-2 px-4 font-medium text-gray-600">COP Modelo</th>
                                      <th className="text-right py-2 px-4 font-medium text-gray-600">COP Sede</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.models.map((model) => (
                                      <tr key={model.modelId} className="border-b border-gray-100 hover:bg-white/50">
                                        <td className="py-2 px-4 font-medium text-gray-800">{model.email}</td>
                                        <td className="py-2 px-4 text-right text-gray-700">${formatCurrency(model.usdBruto)}</td>
                                        <td className="py-2 px-4 text-right text-green-600 font-medium">${formatCurrency(model.usdModelo)}</td>
                                        <td className="py-2 px-4 text-right text-orange-600 font-medium">${formatCurrency(model.usdSede)}</td>
                                        <td className="py-2 px-4 text-right text-purple-600 font-medium">{formatCurrency(model.copModelo, 'COP')}</td>
                                        <td className="py-2 px-4 text-right text-red-600 font-medium">{formatCurrency(model.copSede, 'COP')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-700">Email</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-700">USD Bruto</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-700">USD Modelo</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-700">USD Sede (40%)</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-700">COP Modelo</th>
                    <th className="text-right py-3 px-2 font-medium text-gray-700">COP Sede</th>
                  </tr>
                </thead>
                <tbody>
                  {billingData.map((model) => (
                    <tr key={model.modelId} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="py-3 px-2 font-medium text-gray-900">{model.email}</td>
                      <td className="py-3 px-2 text-right text-gray-700">${formatCurrency(model.usdBruto)}</td>
                      <td className="py-3 px-2 text-right text-green-600 font-medium">${formatCurrency(model.usdModelo)}</td>
                      <td className="py-3 px-2 text-right text-orange-600 font-medium">${formatCurrency(model.usdSede)}</td>
                      <td className="py-3 px-2 text-right text-purple-600 font-medium">{formatCurrency(model.copModelo, 'COP')}</td>
                      <td className="py-3 px-2 text-right text-red-600 font-medium">{formatCurrency(model.copSede, 'COP')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <div className="font-medium">No hay datos disponibles</div>
              <div className="text-sm">No se encontraron modelos con datos para el período seleccionado</div>
            </div>
          )}

          {/* Información adicional */}
          <div className="mt-4 text-xs text-gray-500 bg-gray-50/50 rounded-lg p-3">
            <div className="font-medium mb-1">ℹ️ Información:</div>
            <ul className="space-y-1">
              <li>• Los datos se actualizan en tiempo real cuando las modelos guardan valores en "Mi Calculadora"</li>
              <li>• USD Sede = USD Bruto - USD Modelo</li>
              <li>• Los totales incluyen solo modelos activos con datos en el período seleccionado</li>
              {userRole === 'admin' && <li>• Solo puedes ver los datos de tu sede asignada</li>}
              {userRole === 'super_admin' && <li>• Puedes filtrar por sede específica o ver todas las sedes</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
