'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BillingSummaryCompactProps {
  userRole: 'admin' | 'super_admin';
  userId: string;
}

interface BillingData {
  modelId: string;
  email: string;
  name: string;
  organizationId: string;
  groupId: string;
  groupName: string;
  usdBruto: number;
  usdModelo: number;
  usdSede: number;
  copModelo: number;
  copSede: number;
}

interface Summary {
  totalModels: number;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
  totalCopModelo: number;
  totalCopSede: number;
}

interface GroupData {
  groupId: string;
  groupName: string;
  totalModels: number;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
}

interface SedeData {
  sedeId: string;
  sedeName: string;
  totalModels: number;
  groups: GroupData[];
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
}

export default function BillingSummaryCompact({ userRole, userId }: BillingSummaryCompactProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groupedData, setGroupedData] = useState<SedeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'COP') {
      return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        adminId: userId,
        userRole,
        periodDate: today,
      });

      const response = await fetch(`/api/admin/billing-summary?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar los datos');
      }

      // Calcular resumen
      const billingData: BillingData[] = data.data || [];
      const summaryData: Summary = {
        totalModels: billingData.length,
        totalUsdBruto: billingData.reduce((sum, model) => sum + model.usdBruto, 0),
        totalUsdModelo: billingData.reduce((sum, model) => sum + model.usdModelo, 0),
        totalUsdSede: billingData.reduce((sum, model) => sum + model.usdSede, 0),
        totalCopModelo: billingData.reduce((sum, model) => sum + model.copModelo, 0),
        totalCopSede: billingData.reduce((sum, model) => sum + model.copSede, 0),
      };

      // Procesar datos agrupados por sede y grupo
      const sedeMap = new Map<string, SedeData>();
      
      billingData.forEach(model => {
        const sedeId = model.organizationId || 'unknown';
        const groupId = model.groupId || 'unknown';
        
        // Inicializar sede si no existe
        if (!sedeMap.has(sedeId)) {
          sedeMap.set(sedeId, {
            sedeId,
            sedeName: model.organizationId ? 'Agencia Innova' : 'Sede Desconocida',
            totalModels: 0,
            groups: [],
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            totalUsdSede: 0,
          });
        }
        
        const sede = sedeMap.get(sedeId)!;
        sede.totalModels++;
        sede.totalUsdBruto += model.usdBruto;
        sede.totalUsdModelo += model.usdModelo;
        sede.totalUsdSede += model.usdSede;
        
        // Buscar o crear grupo
        let group = sede.groups.find(g => g.groupId === groupId);
        if (!group) {
          group = {
            groupId,
            groupName: model.groupName || 'Grupo Desconocido',
            totalModels: 0,
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            totalUsdSede: 0,
          };
          sede.groups.push(group);
        }
        
        group.totalModels++;
        group.totalUsdBruto += model.usdBruto;
        group.totalUsdModelo += model.usdModelo;
        group.totalUsdSede += model.usdSede;
      });

      setSummary(summaryData);
      setGroupedData(Array.from(sedeMap.values()));
    } catch (error: any) {
      console.error('Error loading billing data:', error);
      setError(error.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && userRole) {
      loadBillingData();
    }
  }, [userId, userRole]);

  if (loading) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Resumen de Facturación</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Resumen de Facturación</h3>
        </div>
        <div className="text-center py-4">
          <div className="text-sm text-red-600 mb-2">{error}</div>
          <button
            onClick={loadBillingData}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Resumen de Facturación</h3>
        </div>
        <Link 
          href="/admin/sedes/dashboard" 
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Ver completo →
        </Link>
      </div>

      {summary && (
        <div className="space-y-4">
          {/* Resumen compacto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-gray-50/80">
              <div className="text-lg font-bold text-gray-800">${formatCurrency(summary.totalUsdBruto)}</div>
              <div className="text-xs text-gray-600">USD Bruto</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50/80">
              <div className="text-lg font-bold text-green-600">${formatCurrency(summary.totalUsdModelo)}</div>
              <div className="text-xs text-gray-600">USD Modelo</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-50/80">
              <div className="text-lg font-bold text-orange-600">${formatCurrency(summary.totalUsdSede)}</div>
              <div className="text-xs text-gray-600">USD Sede</div>
            </div>
          </div>

          {/* Listado de sedes y grupos con scrollbar */}
          {groupedData.length > 0 && (
            <div className="border-t border-gray-200/50 pt-4">
              <div className="text-xs font-medium text-gray-600 mb-3">
                {summary.totalModels} modelos • {userRole === 'super_admin' ? 'Todas las sedes' : 'Tu sede'}
              </div>
              <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="space-y-3 pr-2">
                  {groupedData.map((sede) => (
                    <div key={sede.sedeId} className="bg-white/60 rounded-xl border border-gray-200/40 p-3">
                      {/* Header de Sede */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-lg flex items-center justify-center">
                            <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{sede.sedeName}</div>
                            <div className="text-xs text-gray-500">{sede.totalModels} modelos • {sede.groups.length} grupos</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-700">${formatCurrency(sede.totalUsdBruto)}</div>
                          <div className="text-xs text-gray-500">USD Bruto</div>
                        </div>
                      </div>

                      {/* Grupos de la Sede */}
                      {sede.groups.length > 0 && (
                        <div className="ml-7 space-y-2">
                          {sede.groups.map((group) => (
                            <div key={group.groupId} className="flex items-center justify-between p-2 bg-gray-50/60 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 bg-gradient-to-br from-gray-400/20 to-gray-500/20 rounded flex items-center justify-center">
                                  <svg className="w-2 h-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-gray-700">{group.groupName}</div>
                                  <div className="text-xs text-gray-500">{group.totalModels} modelos</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-semibold text-gray-600">${formatCurrency(group.totalUsdBruto)}</div>
                                <div className="text-xs text-gray-500">USD Bruto</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
