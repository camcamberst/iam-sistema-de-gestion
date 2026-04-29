"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import AppleDropdown from '@/components/ui/AppleDropdown';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import PageHeader from '@/components/ui/PageHeader';
import GlassCard from '@/components/ui/GlassCard';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Anticipo {
  id: string;
  monto_solicitado: number;
  porcentaje_solicitado: number;
  medio_pago: string;
  estado: 'realizado' | 'confirmado';
  comentarios_admin?: string;
  created_at: string;
  realized_at: string;
  // Datos de transferencia
  nombre_beneficiario?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  cedula_titular?: string;
  model: {
    id: string;
    name: string;
    email: string;
  };
  period: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

export default function MiHistorialPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [allAnticipos, setAllAnticipos] = useState<Anticipo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalRealizado, setTotalRealizado] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [availablePeriods, setAvailablePeriods] = useState<Array<{key: string, label: string}>>([]);
  // AppleDropdown maneja automáticamente el estado de apertura

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  // AppleDropdown maneja automáticamente el click-outside

  const loadUser = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (!userData || userData.role !== 'modelo') {
        router.push('/login');
        return;
      }

      setUser(userData);
      await loadAnticipos(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadAnticipos = async (userId: string) => {
    try {
      // Cargar realizados y confirmados para historial
      const response = await fetch(`/api/anticipos?modelId=${userId}&estado=realizado,confirmado`);
      const data = await response.json();
      
      if (data.success) {
        const anticiposRealizados = data.data || [];
        setAllAnticipos(anticiposRealizados);
        
        // Generar períodos disponibles
        const periods = generateAvailablePeriods(anticiposRealizados);
        setAvailablePeriods(periods);
        
        // Seleccionar el primer período real (más reciente)
        if (periods.length > 0) {
          const firstPeriod = periods[0];
          setSelectedPeriod(firstPeriod.key);
          filterAnticiposByPeriod(anticiposRealizados, firstPeriod.key);
        } else {
          setAnticipos([]);
          setTotalRealizado(0);
        }
      } else {
        setError(data.error || 'Error al cargar historial');
      }
    } catch (error) {
      console.error('Error loading anticipos:', error);
      setError('Error al cargar historial');
    }
  };

  const generateAvailablePeriods = (anticiposData: Anticipo[]) => {
    const periodMap = new Map<string, { label: string, count: number }>();
    
    // NO agregar período actual - solo períodos con anticipos reales
    anticiposData.forEach(anticipo => {
      if (anticipo.period?.start_date) {
        // Corregir parseo de fecha histórica
        const correctedDate = new Date(anticipo.period.start_date + 'T00:00:00-05:00');
        const year = correctedDate.getFullYear();
        const month = correctedDate.getMonth();
        const day = correctedDate.getDate();
        
        // Generar período real basado en fecha corregida
        const periodNumber = day <= 15 ? '1' : '2';
        const monthAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthName = monthAbbr[month];
        
        // Crear clave única basada en año-mes-período
        const periodKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${periodNumber}`;
        const periodLabel = `${monthName} ${year} - P${periodNumber}`;
        
        console.log('🔍 [GENERAR PERÍODOS] Anticipo corregido:', {
          id: anticipo.id,
          periodKey,
        });
        
        // Agrupar por período corregido
        if (periodMap.has(periodKey)) {
          periodMap.get(periodKey)!.count++;
        } else {
          periodMap.set(periodKey, { label: periodLabel, count: 1 });
        }
      }
    });
    

    
    // Convertir a array y ordenar por fecha (más reciente primero)
    const periods = Array.from(periodMap.entries())
      .map(([key, data]) => ({ 
        key, 
        label: `${data.label} (${data.count} anticipo${data.count !== 1 ? 's' : ''})` 
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
    

    return periods;
  };

  const formatPeriodLabel = (startDate: string, endDate: string) => {
    // Parsear fechas en timezone de Colombia para evitar desfases
    const start = new Date(startDate + 'T00:00:00-05:00');
    const end = new Date(endDate + 'T00:00:00-05:00');
    
    // Abreviaciones de meses
    const monthAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    if (start.getMonth() === end.getMonth()) {
      const monthName = start.toLocaleDateString('es-CO', { month: 'long' });
      const year = start.getFullYear();
      const period = start.getDate() <= 15 ? '1' : '2';
      return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year} - Período ${period}`;
    }
    return `${start.toLocaleDateString('es-CO', { month: 'short' })} - ${end.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`;
  };

  // Función auxiliar para generar clave de período consistente
  const generatePeriodKey = (dateString: string): string => {
    try {
      // Usar timezone de Colombia para consistencia
      const date = new Date(dateString + 'T12:00:00-05:00'); // Mediodía Colombia para evitar problemas de timezone
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // getMonth() es 0-based
      const day = date.getDate();
      
      const periodNumber = day <= 15 ? '1' : '2';
      return `${year}-${month.toString().padStart(2, '0')}-${periodNumber}`;
    } catch (error) {
      console.error('Error generando clave de período:', error, dateString);
      return '';
    }
  };

  const filterAnticiposByPeriod = (anticiposData: Anticipo[], periodKey: string) => {
    console.log('🔍 [FILTRO PERÍODOS] Filtrando por período específico:', periodKey);
    console.log('🔍 [FILTRO PERÍODOS] Total anticipos disponibles:', anticiposData.length);
    
    const filteredAnticipos = anticiposData.filter(anticipo => {
      if (!anticipo.period?.start_date) return false;
      const anticipoPeriodKey = generatePeriodKey(anticipo.period.start_date);
      return anticipoPeriodKey === periodKey;
    });
    setAnticipos(filteredAnticipos);
    
    // Calcular total realizado
    const total = filteredAnticipos.reduce((sum: number, anticipo: Anticipo) => 
      sum + anticipo.monto_solicitado, 0
    );
    setTotalRealizado(total);
  };

  const handlePeriodChange = (periodKey: string) => {
    setSelectedPeriod(periodKey);
    filterAnticiposByPeriod(allAnticipos, periodKey);
    // AppleDropdown maneja automáticamente el cierre
  };

  const getSelectedPeriodLabel = () => {
    const period = availablePeriods.find(p => p.key === selectedPeriod);
    return period ? period.label : 'Sin períodos disponibles';
  };

  // Agrupar anticipos por período corregido y ordenarlos desc
  const groupedByPeriod = useMemo(() => {
    if (!anticipos || anticipos.length === 0) {
      console.log('🔍 [AGRUPAR PERÍODOS] No hay anticipos para agrupar');
      return [];
    }
    
    const groups: Record<string, Anticipo[]> = {};
    anticipos.forEach(a => {
      if (!a.period?.start_date) return;
      
      try {
        const correctedDate = new Date(a.period.start_date + 'T00:00:00-05:00');
        const year = correctedDate.getFullYear();
        const month = correctedDate.getMonth();
        const day = correctedDate.getDate();
        const periodNumber = day <= 15 ? '1' : '2';
        const correctedPeriodKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${periodNumber}`;
        
        if (!groups[correctedPeriodKey]) groups[correctedPeriodKey] = [];
        groups[correctedPeriodKey].push(a);
      } catch (error) {
        console.error('[AGRUPAR PERÍODOS] Error procesando anticipo:', a.id, error);
      }
    });
    
    const ordered = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((k) => [k, groups[k]] as [string, Anticipo[]]);
    
    return ordered;
  }, [anticipos]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPeriod = (startDate: string, endDate: string) => {
    try {
      const start = new Date(startDate + 'T00:00:00-05:00');
      const end = new Date(endDate + 'T00:00:00-05:00');
      
      if (start.getMonth() === end.getMonth()) {
        const periodNumber = start.getDate() <= 15 ? '1' : '2';
        const monthName = start.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        return `${monthName} - Período ${periodNumber}`;
      }
      
      return `${start.toLocaleDateString('es-CO', { month: 'short' })} - ${end.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`;
    } catch (error) {
      return 'Período no disponible';
    }
  };

  if (loading) {
    return (
      <div className="aim-page-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="aim-page-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aim-page-bg">
      <div className="max-w-screen-2xl mx-auto max-sm:px-0 px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header — Migrado a PageHeader */}
        <PageHeader
          title="Mi Historial"
          subtitle="Anticipos realizados y pagados"
          glow="model"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          actions={
            <div className="w-full md:w-auto">
              <AppleDropdown
                options={availablePeriods.map(period => ({
                  value: period.key,
                  label: period.label
                }))}
                value={selectedPeriod}
                onChange={handlePeriodChange}
                placeholder="Selecciona período"
                className="w-full md:min-w-[200px] text-sm"
                maxHeight="max-h-48"
              />
            </div>
          }
        />

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 dark:text-red-400 font-medium">Error</span>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Resumen */}
        <div className="relative z-0 mb-4 sm:mb-6">
          {/* Móvil: 2 columnas, Escritorio: 3 columnas */}
          <InfoCardGrid
            columns={3}
            cards={[
              {
                value: `$${totalRealizado.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                label: "Total Realizado",
                color: "green",
                size: "sm"
              },
              {
                value: anticipos.length.toString(),
                label: "Anticipos Pagados",
                color: "blue",
                size: "sm"
              },
              {
                value: anticipos.length > 0 ? (totalRealizado / anticipos.length).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0',
                label: "Promedio por Anticipo",
                color: "purple",
                size: "sm"
              }
            ]}
          />
        </div>

        {/* Lista de Anticipos por Período (Realizados y Confirmados) */}
        <div className="relative z-0">
        {anticipos.length === 0 ? (
          <div className="relative z-0 bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600/20 text-center py-6 sm:py-8 px-4 sm:px-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay anticipos realizados</h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Aún no tienes anticipos que hayan sido pagados</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {groupedByPeriod.map(([periodKey, items]) => (
              <div key={periodKey} className="bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600/20 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 dark:border-gray-600/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                    {items.length > 0 && items[0].period ? 
                      formatPeriod(items[0].period.start_date, items[0].period.end_date) : 
                      'Período no disponible'
                    }
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    {items.length} {items.length === 1 ? 'solicitud' : 'solicitudes'}
                  </div>
                </div>
                <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  {items.map((anticipo) => (
                    <div key={anticipo.id} className="bg-gray-50 dark:bg-gray-600/80 rounded-lg border border-gray-200 dark:border-gray-500/50 p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Primera línea: Monto y Estado */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                              ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                            </h3>
                            {anticipo.estado === 'confirmado' ? (
                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 w-fit">Confirmado</span>
                            ) : (
                              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 w-fit">Realizado</span>
                            )}
                          </div>
                          
                          {/* Información - Layout vertical en móvil para mejor legibilidad */}
                          <div className="space-y-1.5 sm:space-y-1">
                            {anticipo.nombre_beneficiario && (
                              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Beneficiario:</span> {anticipo.nombre_beneficiario}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                              <span>
                                <span className="font-medium">Medio:</span> {anticipo.medio_pago.toUpperCase()}
                              </span>
                              {anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata' ? (
                                anticipo.numero_telefono && (
                                  <span>
                                    <span className="font-medium">Tel:</span> {anticipo.numero_telefono}
                                  </span>
                                )
                              ) : (
                                <>
                                  {anticipo.banco && (
                                    <span>
                                      <span className="font-medium">Banco:</span> {anticipo.banco}
                                    </span>
                                  )}
                                  {anticipo.numero_cuenta && (
                                    <span>
                                      <span className="font-medium">Cuenta:</span> {anticipo.numero_cuenta}
                                    </span>
                                  )}
                                </>
                              )}
                              <span className="text-gray-500 dark:text-gray-400">
                                {new Date(anticipo.realized_at || anticipo.created_at).toLocaleDateString('es-CO', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: '2-digit' 
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Comentarios del admin - solo si existen */}
                          {anticipo.comentarios_admin && (
                            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
                              <p className="text-xs sm:text-sm text-green-800 dark:text-green-300">
                                <span className="font-semibold">Admin:</span> {anticipo.comentarios_admin}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Icono de realizado compacto */}
                        <div className="flex items-center justify-end sm:justify-start sm:ml-2">
                          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botones de navegación */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-center gap-3 sm:space-x-3 sm:space-y-0">
          <button
            onClick={() => router.push('/admin/model/anticipos/solicitudes')}
            className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all duration-200 text-sm sm:text-base font-medium touch-manipulation"
          >
            Mis Solicitudes
          </button>
          <button
            onClick={() => router.push('/admin/model/anticipos/solicitar')}
            className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all duration-200 text-sm sm:text-base font-medium shadow-md hover:shadow-lg touch-manipulation"
          >
            Nueva Solicitud
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
