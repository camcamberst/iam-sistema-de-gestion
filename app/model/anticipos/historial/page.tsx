"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => {
    loadUser();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (isPeriodDropdownOpen && !target.closest('.period-dropdown')) {
        setIsPeriodDropdownOpen(false);
      }
    };

    if (isPeriodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPeriodDropdownOpen]);

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
          original_start_date: anticipo.period.start_date,
          corrected_date: correctedDate.toISOString().split('T')[0],
          year,
          month: month + 1,
          day,
          periodKey,
          periodLabel
        });
        
        // Agrupar por período corregido
        if (periodMap.has(periodKey)) {
          periodMap.get(periodKey)!.count++;
        } else {
          periodMap.set(periodKey, { label: periodLabel, count: 1 });
        }
      }
    });
    
    console.log('🔍 [GENERAR PERÍODOS] Períodos consolidados:', Array.from(periodMap.entries()));
    
    // Convertir a array y ordenar por fecha (más reciente primero)
    const periods = Array.from(periodMap.entries())
      .map(([key, data]) => ({ 
        key, 
        label: `${data.label} (${data.count} anticipo${data.count !== 1 ? 's' : ''})` 
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
    
    console.log('🔍 [GENERAR PERÍODOS] Períodos finales:', periods);
    return periods;
  };

  const formatPeriodLabel = (startDate: string, endDate: string) => {
    // Parsear fechas en timezone de Colombia para evitar desfases
    const start = new Date(startDate + 'T00:00:00-05:00');
    const end = new Date(endDate + 'T00:00:00-05:00');
    
    // Abreviaciones de meses
    const monthAbbr = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    console.log('🔍 [FORMAT PERIOD LABEL] Input:', { startDate, endDate });
    console.log('🔍 [FORMAT PERIOD LABEL] Parsed dates:', { 
      startMonth: start.getMonth(), 
      startYear: start.getFullYear(), 
      startDay: start.getDate(),
      endMonth: end.getMonth(), 
      endYear: end.getFullYear(), 
      endDay: end.getDate()
    });
    
    if (start.getMonth() === end.getMonth()) {
      const monthName = monthAbbr[start.getMonth()];
      const year = start.getFullYear();
      const period = start.getDate() <= 15 ? '1' : '2';
      const label = `${monthName} ${year} - P${period}`;
      console.log('🔍 [FORMAT PERIOD LABEL] Generated label:', label);
      return label;
    }
    
    const label = `${monthAbbr[start.getMonth()]} - ${monthAbbr[end.getMonth()]} ${end.getFullYear()}`;
    console.log('🔍 [FORMAT PERIOD LABEL] Generated cross-month label:', label);
    return label;
  };

  const filterAnticiposByPeriod = (anticiposData: Anticipo[], periodKey: string) => {
    console.log('🔍 [FILTRO PERÍODOS] Filtrando por período específico:', periodKey);
    console.log('🔍 [FILTRO PERÍODOS] Total anticipos disponibles:', anticiposData.length);
    
    const filteredAnticipos = anticiposData.filter(anticipo => {
      if (!anticipo.period?.start_date) return false;
      
      // Corregir parseo de fecha histórica
      const correctedDate = new Date(anticipo.period.start_date + 'T00:00:00-05:00');
      const year = correctedDate.getFullYear();
      const month = correctedDate.getMonth();
      const day = correctedDate.getDate();
      
      // Generar clave de período corregida
      const periodNumber = day <= 15 ? '1' : '2';
      const correctedPeriodKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${periodNumber}`;
      
      const matches = correctedPeriodKey === periodKey;
      console.log('🔍 [FILTRO PERÍODOS] Anticipo corregido:', {
        id: anticipo.id,
        original_start_date: anticipo.period.start_date,
        corrected_date: correctedDate.toISOString().split('T')[0],
        correctedPeriodKey,
        periodKey,
        matches
      });
      return matches;
    });
    
    console.log('🔍 [FILTRO PERÍODOS] Anticipos filtrados:', filteredAnticipos.length);
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
    setIsPeriodDropdownOpen(false);
  };

  const getSelectedPeriodLabel = () => {
    const period = availablePeriods.find(p => p.key === selectedPeriod);
    return period ? period.label : 'Sin períodos disponibles';
  };

  // Agrupar anticipos por período corregido y ordenarlos desc
  const groupedByPeriod = useMemo(() => {
    const groups: Record<string, Anticipo[]> = {};
    anticipos.forEach(a => {
      if (!a.period?.start_date) return;
      
      // Aplicar la misma corrección de parseo que en el filtrado
      const correctedDate = new Date(a.period.start_date + 'T00:00:00-05:00');
      const year = correctedDate.getFullYear();
      const month = correctedDate.getMonth();
      const day = correctedDate.getDate();
      
      // Generar clave de período corregida
      const periodNumber = day <= 15 ? '1' : '2';
      const correctedPeriodKey = `${year}-${(month + 1).toString().padStart(2, '0')}-${periodNumber}`;
      
      console.log('🔍 [AGRUPAR PERÍODOS] Anticipo corregido:', {
        id: a.id,
        original_start_date: a.period.start_date,
        corrected_date: correctedDate.toISOString().split('T')[0],
        correctedPeriodKey
      });
      
      if (!groups[correctedPeriodKey]) groups[correctedPeriodKey] = [];
      groups[correctedPeriodKey].push(a);
    });
    
    const ordered = Object.keys(groups)
      .sort((a, b) => b.localeCompare(a)) // Ordenar por clave corregida
      .map((k) => [k, groups[k]] as [string, Anticipo[]]);
    
    console.log('🔍 [AGRUPAR PERÍODOS] Grupos finales:', ordered);
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
    // Aplicar corrección de timezone para parseo correcto
    const start = new Date(startDate + 'T00:00:00-05:00');
    const end = new Date(endDate + 'T00:00:00-05:00');
    
    console.log('🔍 [FORMAT PERIOD] Fechas corregidas:', {
      original_start: startDate,
      original_end: endDate,
      corrected_start: start.toISOString().split('T')[0],
      corrected_end: end.toISOString().split('T')[0],
      start_month: start.getMonth(),
      start_year: start.getFullYear(),
      start_day: start.getDate()
    });
    
    if (start.getMonth() === end.getMonth()) {
      const periodNumber = start.getDate() <= 15 ? '1' : '2';
      const monthName = start.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      return `${monthName} - Período ${periodNumber}`;
    }
    
    return `${start.toLocaleDateString('es-CO', { month: 'short' })} - ${end.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Mi Historial</h1>
              <p className="text-gray-600">Anticipos realizados y pagados</p>
            </div>
            
            {/* Filtro por Período - Apple Style */}
            <div className="relative period-dropdown">
              <button
                type="button"
                onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 transition-all duration-200 text-left flex items-center justify-between min-w-[200px] shadow-sm"
              >
                <span className="text-gray-900 font-medium">
                  {getSelectedPeriodLabel()}
                </span>
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${isPeriodDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isPeriodDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                  <div className="py-1">
                    {availablePeriods.map((period) => (
                      <button
                        key={period.key}
                        type="button"
                        onClick={() => handlePeriodChange(period.key)}
                        className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150 ${
                          selectedPeriod === period.key 
                            ? 'bg-blue-50 text-blue-700 font-medium' 
                            : 'text-gray-900'
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Resumen */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">
                ${totalRealizado.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm text-gray-600">Total Realizado</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {anticipos.length}
              </div>
              <div className="text-sm text-gray-600">Anticipos Pagados</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {anticipos.length > 0 ? (totalRealizado / anticipos.length).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 0}
              </div>
              <div className="text-sm text-gray-600">Promedio por Anticipo</div>
            </div>
          </div>
        </div>

        {/* Lista de Anticipos por Período (Realizados y Confirmados) */}
        {anticipos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-8 px-6">
            <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay anticipos realizados</h3>
            <p className="text-gray-500">Aún no tienes anticipos que hayan sido pagados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByPeriod.map(([periodKey, items]) => (
              <div key={periodKey} className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    {formatPeriod(periodKey, periodKey)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {items.length} {items.length === 1 ? 'solicitud' : 'solicitudes'}
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  {items.map((anticipo) => (
                    <div key={anticipo.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {/* Primera línea: Monto y Estado */}
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="text-base font-semibold text-gray-900">
                              ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                            </h3>
                            {anticipo.estado === 'confirmado' ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Confirmado</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Realizado</span>
                            )}
                          </div>
                          
                          {/* Segunda línea: Información ultra compacta en una sola línea */}
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <div className="flex items-center space-x-2 overflow-hidden">
                              {anticipo.nombre_beneficiario && (
                                <span className="whitespace-nowrap truncate max-w-[120px]">
                                  <span className="font-medium">Beneficiario:</span> {anticipo.nombre_beneficiario}
                                </span>
                              )}
                              <span className="whitespace-nowrap">
                                <span className="font-medium">Medio:</span> {anticipo.medio_pago.toUpperCase()}
                              </span>
                              {anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata' ? (
                                anticipo.numero_telefono && (
                                  <span className="whitespace-nowrap">
                                    <span className="font-medium">Tel:</span> {anticipo.numero_telefono}
                                  </span>
                                )
                              ) : (
                                anticipo.banco && anticipo.numero_cuenta && (
                                  <>
                                    <span className="whitespace-nowrap truncate max-w-[80px]">
                                      <span className="font-medium">Banco:</span> {anticipo.banco}
                                    </span>
                                    <span className="whitespace-nowrap truncate max-w-[100px]">
                                      <span className="font-medium">Cuenta:</span> {anticipo.numero_cuenta}
                                    </span>
                                  </>
                                )
                              )}
                            </div>
                            <span className="text-gray-500 whitespace-nowrap text-xs">
                              {new Date(anticipo.realized_at || anticipo.created_at).toLocaleDateString('es-CO', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: '2-digit' 
                              })}
                            </span>
                          </div>

                          {/* Comentarios del admin - solo si existen */}
                          {anticipo.comentarios_admin && (
                            <div className="mt-1 p-1 bg-green-50 rounded text-xs text-green-800">
                              <span className="font-medium">Admin:</span> {anticipo.comentarios_admin}
                            </div>
                          )}
                        </div>

                        {/* Icono de realizado compacto */}
                        <div className="ml-2 flex items-center">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
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
        <div className="mt-6 flex justify-center space-x-3">
          <button
            onClick={() => router.push('/model/anticipos/solicitudes')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 text-sm font-medium"
          >
            Mis Solicitudes
          </button>
          <button
            onClick={() => router.push('/model/anticipos/solicitar')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium"
          >
            Nueva Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}