'use client';

import { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import AppleDropdown from '@/components/ui/AppleDropdown';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo';
  groups: string[];
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

interface HistoricalValue {
  id: string;
  platform_id: string;
  value: number;
  period_date: string;
  period_type: '1-15' | '16-31';
  archived_at: string;
  original_updated_at: string;
}

interface HistoricalPeriod {
  period_date: string;
  period_type: '1-15' | '16-31';
  values: HistoricalValue[];
  total_value: number;
}


export default function CalculatorHistory() {
  const [user, setUser] = useState<User | null>(null);
  const [historicalPeriods, setHistoricalPeriods] = useState<HistoricalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado local para funcionalidades mejoradas
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Estado para coordinación de dropdowns (principio estético) - removido temporalmente
  // const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // Load current user
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setUser(null);
          setLoading(false);
          return;
        }
        
        const { data: userRow } = await supabase
          .from('users')
          .select('id,name,email,role')
          .eq('id', uid)
          .single();
        
        let groups: string[] = [];
        if (userRow && userRow.role !== 'super_admin') {
          const { data: ug } = await supabase
            .from('user_groups')
            .select('groups(name)')
            .eq('user_id', uid);
          groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
        }
        
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'modelo',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        
        setUser(current);
        
        // Load historical data
        await loadHistoricalData(uid);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, []);

  const loadHistoricalData = async (userId: string) => {
    try {
      const { data: history, error } = await supabase
        .from('calculator_history')
        .select('*')
        .eq('model_id', userId)
        .order('period_date', { ascending: false })
        .order('archived_at', { ascending: false });
      
      if (error) {
        console.error('Error loading history:', error);
        setError('Error cargando historial');
        return;
      }
      
      // Agrupar por período
      const groupedData = new Map<string, HistoricalPeriod>();
      
      history?.forEach((item: any) => {
        const key = `${item.period_date}-${item.period_type}`;
        
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            period_date: item.period_date,
            period_type: item.period_type,
            values: [],
            total_value: 0
          });
        }
        
        const period = groupedData.get(key)!;
        period.values.push({
          id: item.id,
          platform_id: item.platform_id,
          value: item.value,
          period_date: item.period_date,
          period_type: item.period_type,
          archived_at: item.archived_at,
          original_updated_at: item.original_updated_at
        });
        period.total_value += item.value;
      });
      
      setHistoricalPeriods(Array.from(groupedData.values()));
      
    } catch (error) {
      console.error('Error loading historical data:', error);
      setError('Error cargando datos históricos');
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calcular estadísticas específicas solicitadas
  const totalPeriodsSaved = historicalPeriods.length; // Períodos archivados
  
  // Obtener valor real del período actual desde model_values
  const [currentPeriodUSD, setCurrentPeriodUSD] = useState(0);
  
  // Obtener valor en tiempo real de USD Modelo desde Mi Calculadora
  useEffect(() => {
    const loadCurrentPeriodValue = async () => {
      if (!user) return;
      
      try {
        // Llamar al endpoint que calcula el valor real de USD Modelo
        const response = await fetch(`/api/calculator/mi-calculadora-real?modelId=${user.id}`);
        const data = await response.json();
        
        if (data.success && data.data?.usdModelo !== undefined) {
          setCurrentPeriodUSD(data.data.usdModelo);
        } else {
          console.error('Error loading USD Modelo value:', data.error);
        }
      } catch (error) {
        console.error('Error loading current period value:', error);
      }
    };
    
    loadCurrentPeriodValue();
  }, [user]);
  
  // Promedios solo de períodos archivados (historial)
  const averageUSDPerPeriod = historicalPeriods.length > 0 ? 
    historicalPeriods.reduce((sum, period) => sum + period.total_value, 0) / historicalPeriods.length : 0;
  
  // Calcular promedio COP real de períodos archivados
  const averageCOPerPeriod = historicalPeriods.length > 0 ? 
    historicalPeriods.reduce((sum, period) => {
      // Buscar valores COP en el período
      const copValues = period.values.filter(value => 
        value.platform_id.toLowerCase().includes('cop') || 
        value.platform_id.toLowerCase().includes('pesos')
      );
      const copTotal = copValues.reduce((total, value) => total + value.value, 0);
      return sum + copTotal;
    }, 0) / historicalPeriods.length : 0;

  // Filtrar períodos según selección
  const filteredPeriods = historicalPeriods.filter(period => {
    const periodDate = new Date(period.period_date);
    const periodYear = periodDate.getFullYear().toString();
    const periodMonth = (periodDate.getMonth() + 1).toString().padStart(2, '0');
    
    const yearMatch = selectedYear === 'all' || periodYear === selectedYear;
    const monthMatch = selectedMonth === 'all' || periodMonth === selectedMonth;
    const typeMatch = selectedType === 'all' || period.period_type === selectedType;
    
    return yearMatch && monthMatch && typeMatch;
  });

  // Obtener años únicos para filtro
  const availableYears = Array.from(new Set(historicalPeriods.map(period => 
    new Date(period.period_date).getFullYear().toString()
  ))).sort((a, b) => b.localeCompare(a));

  // Obtener meses únicos para filtro
  const availableMonths = Array.from(new Set(historicalPeriods.map(period => {
    const month = new Date(period.period_date).getMonth() + 1;
    return month.toString().padStart(2, '0');
  }))).sort((a, b) => a.localeCompare(b));

  // Nombres de meses en español
  const monthNames = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  // Coordinación de dropdowns (principio estético) - removido temporalmente
  // const handleFilterFocus = (filterId: string) => {
  //   setActiveDropdown(filterId); // Cerrar otros dropdowns
  // };

  // Preparar opciones para AppleDropdown
  const yearOptions = [
    { value: 'all', label: 'Todos los años' },
    ...availableYears.map(year => ({ value: year, label: year }))
  ];

  const monthOptions = [
    { value: 'all', label: 'Todos los meses' },
    ...availableMonths.map(month => ({ 
      value: month, 
      label: monthNames[month as keyof typeof monthNames] 
    }))
  ];

  const typeOptions = [
    { value: 'all', label: 'Todos los tipos' },
    { value: '1-15', label: 'Período 1 (1-15)' },
    { value: '16-31', label: 'Período 2 (16-31)' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'modelo') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">Solo las modelos pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">Mi Historial de Calculadora</h1>
              <p className="text-gray-500 text-sm">
                Período actual en progreso y valores archivados
              </p>
            </div>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              Regresar
            </button>
          </div>
        </div>


        {/* Resumen con InfoCardGrid - Cuadros específicos solicitados */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de Rendimiento</h3>
          <InfoCardGrid 
            cards={[
              {
                value: totalPeriodsSaved,
                label: "Total Períodos",
                color: "blue"
              },
              {
                value: `$${currentPeriodUSD.toFixed(2)} USD`,
                label: "USD Período Actual",
                color: "green"
              },
              {
                value: `$${averageUSDPerPeriod.toFixed(2)} USD`,
                label: "USD Promedio",
                color: "purple"
              },
              {
                value: `$${Math.round(averageCOPerPeriod).toLocaleString('es-CO')} COP`,
                label: "COP Promedio",
                color: "orange"
              }
            ]}
            columns={4}
            className="mb-6"
          />
        </div>

        {/* Filtros con AppleDropdown (principio estético) */}
        {historicalPeriods.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtrar Períodos Archivados</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por año
                </label>
                <AppleDropdown
                  options={yearOptions}
                  value={selectedYear}
                  onChange={setSelectedYear}
                  placeholder="Seleccionar año"
                  className="w-full"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por mes
                </label>
                <AppleDropdown
                  options={monthOptions}
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  placeholder="Seleccionar mes"
                  className="w-full"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por tipo
                </label>
                <AppleDropdown
                  options={typeOptions}
                  value={selectedType}
                  onChange={setSelectedType}
                  placeholder="Seleccionar tipo"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Historical Periods */}
        {filteredPeriods.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {historicalPeriods.length === 0 ? 'No hay períodos archivados' : 'No hay períodos que coincidan con los filtros'}
            </h3>
            <p className="text-gray-500 text-sm">
              {historicalPeriods.length === 0 
                ? 'Los valores se archivan automáticamente al final de cada período'
                : 'Ajustar filtros para ver más períodos'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Períodos Archivados</h3>
            {filteredPeriods.map((period, index) => {
              const periodKey = `${period.period_date}-${period.period_type}`;
              const isExpanded = expandedPeriod === periodKey;
              
              return (
                <div key={periodKey} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  {/* Header del período con InfoCard clickeable */}
                  <div className="mb-4">
                    <InfoCard
                      value={formatCurrency(period.total_value)}
                      label={`Período ${period.period_type === '1-15' ? '1' : '2'} - ${formatDate(period.period_date)}`}
                      color="blue"
                      clickable={true}
                      onClick={() => setExpandedPeriod(isExpanded ? null : periodKey)}
                      className="cursor-pointer hover:scale-105 transition-transform duration-200"
                    />
                    <div className="mt-2 text-sm text-gray-500 text-center">
                      {period.values.length} plataforma{period.values.length !== 1 ? 's' : ''} registrada{period.values.length !== 1 ? 's' : ''}
                      {isExpanded ? ' - Hacer clic para contraer' : ' - Hacer clic para ver detalles'}
                    </div>
                  </div>
                  
                  {/* Detalles expandibles con InfoCardGrid */}
                  {isExpanded && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Detalles por plataforma:</h4>
                      <InfoCardGrid 
                        cards={period.values.map(value => ({
                          value: formatCurrency(value.value),
                          label: value.platform_id.replace('_', ' '),
                          color: "green"
                        }))}
                        columns={3}
                        className="mb-4"
                      />
                      
                      {/* Información adicional */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Fecha de archivado:</span>
                            <span className="ml-2 text-gray-600">
                              {new Date(period.values[0]?.archived_at || '').toLocaleDateString('es-CO')}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Última actualización:</span>
                            <span className="ml-2 text-gray-600">
                              {new Date(period.values[0]?.original_updated_at || '').toLocaleDateString('es-CO')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
