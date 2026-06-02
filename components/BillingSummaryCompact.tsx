'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useBillingPolling } from '@/hooks/useBillingPolling';
import { getColombiaDate } from '@/utils/calculator-dates';
import { InfoCardGrid } from '@/components/ui/InfoCard';

interface BillingSummaryCompactProps {
  userRole: 'admin' | 'super_admin' | 'superadmin_aff';
  userId: string;
  userGroups?: string[];
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
  totalCopModelo?: number;
  totalCopSede?: number;
  isAffiliate?: boolean;
  affiliate_studio_id?: string;
}

// Caché global para evitar parpadeos de carga en el carrusel infinito
const globalCache = new Map<string, { summary: Summary, groupedData: SedeData[], time: number }>();

export default function BillingSummaryCompact({ userRole, userId, userGroups = [] }: BillingSummaryCompactProps) {
  const cacheKey = `${userId}-${userRole}-${userGroups.join(',')}`;
  const initialCache = globalCache.get(cacheKey);

  const [summary, setSummary] = useState<Summary | null>(initialCache?.summary || null);
  const [groupedData, setGroupedData] = useState<SedeData[]>(initialCache?.groupedData || []);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [affiliateStudioName, setAffiliateStudioName] = useState<string | null>(null);

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

  const loadBillingData = async (silent = false) => {
    try {
      // Solo mostrar loading si no es una actualización silenciosa
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      // Calcular fecha basada en período seleccionado (usar hora Colombia)
      const today = getColombiaDate();
      let targetDate = today;
      if (selectedPeriod === 'period-1') {
        // Período 1: día 15 del mes actual (usar fecha Colombia)
        const [year, month] = today.split('-');
        targetDate = `${year}-${month}-15`;
      } else if (selectedPeriod === 'period-2') {
        // Período 2: último día del mes actual (usar fecha Colombia)
        const [year, month] = today.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1); // Mes es 0-based
        const lastDay = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
        targetDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      }

      const params = new URLSearchParams({
        adminId: userId,
        userRole,
        periodDate: targetDate,
      });

      const response = await fetch(`/api/admin/billing-summary?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar los datos');
      }

      // Capturar nombre del estudio afiliado si está disponible
      if (data.affiliateStudioName) {
        setAffiliateStudioName(data.affiliateStudioName);
      }

      const sortGroupedData = (data: SedeData[]) => {
        data.forEach(sede => {
          sede.groups.sort((a, b) => b.totalUsdBruto - a.totalUsdBruto);
        });
        return data.sort((a, b) => {
          const isAInnova = a.sedeName === 'Agencia Innova';
          const isBInnova = b.sedeName === 'Agencia Innova';
          if (isAInnova && !isBInnova) return -1;
          if (!isAInnova && isBInnova) return 1;
          return b.totalUsdBruto - a.totalUsdBruto;
        });
      };

      // Si la API retorna groupedData (para super_admin), usarlo directamente
      if (data.groupedData && Array.isArray(data.groupedData) && data.groupedData.length > 0) {
        // Usar datos agrupados de la API (ya incluye separación de afiliados)
        const summaryData: Summary = data.summary || {
          totalModels: data.groupedData.reduce((sum: number, sede: SedeData) => sum + sede.totalModels, 0),
          totalUsdBruto: data.groupedData.reduce((sum: number, sede: SedeData) => sum + sede.totalUsdBruto, 0),
          totalUsdModelo: data.groupedData.reduce((sum: number, sede: SedeData) => sum + (sede.totalUsdModelo || 0), 0),
          totalUsdSede: data.groupedData.reduce((sum: number, sede: SedeData) => sum + sede.totalUsdSede, 0),
          totalCopModelo: data.groupedData.reduce((sum: number, sede: SedeData) => sum + (sede.totalCopModelo || 0), 0),
          totalCopSede: data.groupedData.reduce((sum: number, sede: SedeData) => sum + (sede.totalCopSede || 0), 0),
        };
        
        const finalGroupedData = sortGroupedData([...data.groupedData]);
        setSummary(summaryData);
        setGroupedData(finalGroupedData);
        globalCache.set(cacheKey, { summary: summaryData, groupedData: finalGroupedData, time: Date.now() });
      } else {
        // Fallback: procesar datos individuales (para admin o superadmin_aff)
        let billingData: BillingData[] = data.data || [];
        
        // Si es admin, filtrar solo por sus grupos
        if (userRole === 'admin' && userGroups.length > 0) {
          billingData = billingData.filter(model => 
            userGroups.includes(model.groupName)
          );
        }
        
        // Calcular resumen
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
            // Para superadmin_aff, usar el nombre del estudio afiliado
            const sedeName = userRole === 'superadmin_aff' && data.affiliateStudioName 
              ? data.affiliateStudioName 
              : 'Agencia Innova';
            
            sedeMap.set(sedeId, {
              sedeId,
              sedeName,
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
        
        const finalGroupedData = sortGroupedData(Array.from(sedeMap.values()));
        setSummary(summaryData);
        setGroupedData(finalGroupedData);
        globalCache.set(cacheKey, { summary: summaryData, groupedData: finalGroupedData, time: Date.now() });
      }
    } catch (error: any) {
      console.error('Error loading billing data:', error);
      setError(error.message || 'Error al cargar los datos');
    } finally {
      // Solo ocultar loading si no es una actualización silenciosa
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // 🔄 ACTUALIZACIÓN AUTOMÁTICA: Usar polling estable cada 15 segundos para mejor sincronización
  const { isPolling, isSilentUpdating } = useBillingPolling(
    loadBillingData,
    [userId, userRole, userGroups],
    {
      refreshInterval: 15000, // 15 segundos (reducido de 30s para mejor sincronización)
      enabled: true,
      silentUpdate: true, // Actualizaciones silenciosas sin parpadeos
      onRefresh: () => {
        console.log('🔄 [BILLING-SUMMARY-COMPACT] Datos actualizados automáticamente');
      }
    }
  );

  useEffect(() => {
    if (userId && userRole) {
      loadBillingData(!!initialCache);
    }
  }, [userId, userRole, userGroups, selectedPeriod]);

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 h-full">
      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-center justify-between px-1 h-[40px]">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)] -mr-1.5 sm:-mr-2">
            <svg className="w-5 h-5 sm:w-[1.375rem] sm:h-[1.375rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div className="relative flex items-center">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] whitespace-nowrap">
              Resumen de Facturación
            </h2>
          </div>
        </div>
      </div>

      <>
        {loading ? (
          <div className="glass-card p-3 sm:p-4 flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500"></div>
          </div>
        ) : error ? (
          <div className="glass-card p-3 sm:p-4 flex-1 flex flex-col items-center justify-center">
            <div className="text-sm text-red-600 mb-2">{error}</div>
            <button
              onClick={() => loadBillingData()}
              className="p-2 min-h-[36px] text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Reintentar
            </button>
          </div>
        ) : summary && (
          <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-h-0">
            {/* Primera Caja: Tarjetas de Resumen (Ajustada según Regla Cards) */}
            <InfoCardGrid
              columns={3}
              compactContainer={true}
              cards={[
                {
                  value: `$${formatCurrency(summary.totalUsdBruto)}`,
                  label: 'Gross',
                  color: 'blue',
                  size: 'sm'
                },
                {
                  value: `$${formatCurrency(summary.totalUsdModelo)}`,
                  label: 'Team Cut',
                  color: 'green',
                  size: 'sm'
                },
                {
                  value: `$${formatCurrency(summary.totalUsdSede)}`,
                  label: userRole === 'superadmin_aff' && affiliateStudioName 
                    ? affiliateStudioName 
                    : 'Profit',
                  color: 'purple',
                  size: 'sm'
                }
              ]}
            />

            {/* Segunda Caja: Lista y Footer (Expansiva) */}
            <div className="glass-card p-3 sm:p-4 hover:shadow-xl transition-all duration-300 relative flex-1 flex flex-col min-h-0">
              {groupedData.length > 0 && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="text-xs font-medium text-gray-900 dark:text-white mb-2 shrink-0">
                    {summary.totalModels} modelos • {userRole === 'super_admin' ? 'Todas las sedes' : 'Tu sede'}
                  </div>
                  <div className="flex-1 overflow-y-auto apple-scroll pb-2 max-h-[14rem] lg:max-h-[15.5rem] 2xl:max-h-[18rem]">
                    <div className="space-y-2 pr-1.5">
                      {groupedData.map((sede, sIndex) => (
                        <div key={`${sede.sedeId}-${sIndex}`} className="bg-white dark:bg-white/[0.06] rounded-xl p-3">
                          {/* Header de Sede */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">

                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{sede.sedeName.replace(/\s*-\s*Afiliado/i, '')}</div>
                                {!sede.isAffiliate && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{sede.totalModels} modelos • {sede.groups.length} grupos</div>
                                )}
                              </div>
                            </div>
                            {sede.isAffiliate && (
                              <div className="flex-shrink-0 ml-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                                  Afiliado
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Grupos de la Sede */}
                          {sede.groups.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {sede.groups.map((group, gIndex) => (
                                <div key={`${group.groupId}-${gIndex}`} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50/80 dark:bg-white/[0.04] rounded-lg">
                                  <div className="flex items-center space-x-1.5">

                                    <div>
                                      <div className="text-xs font-medium text-gray-900 dark:text-gray-200">{group.groupName}</div>
                                      <div className="text-xs text-gray-600 dark:text-gray-400">{group.totalModels} modelos</div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end min-w-[70px]">
                                    <div className="text-xs font-semibold text-blue-400 dark:text-[#5caaf5] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(92,170,245,0.7)] leading-tight">${formatCurrency(group.totalUsdBruto)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight mt-0.5">Gross</div>
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

              {/* Footer del widget */}
              <div className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center px-1">
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Período actual
                </span>
                <Link 
                  href="/admin/sedes/dashboard" 
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  Ver panel completo →
                </Link>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
