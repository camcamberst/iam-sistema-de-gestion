'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { History, ArrowLeft, Calendar, DollarSign, Edit2, Save, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import AppleDropdown from '@/components/ui/AppleDropdown';

interface Alert {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read_at: string | null;
  data?: any;
}

interface Period {
  period_date: string;
  period_type: string;
  archived_at: string;
  platforms: Array<{
    platform_id: string;
    platform_name: string;
    platform_currency: string;
    value: number;
    value_usd_bruto?: number;
    value_usd_modelo?: number;
    value_cop_modelo?: number;
    platform_percentage?: number | null;
    rates?: {
      eur_usd?: number | null;
      gbp_usd?: number | null;
      usd_cop?: number | null;
    };
  }>;
  total_value: number;
  total_usd_bruto?: number;
  total_usd_modelo?: number;
  total_cop_modelo?: number;
  rates?: {
    eur_usd?: number | null;
    gbp_usd?: number | null;
    usd_cop?: number | null;
  };
  alerts?: Alert[];
  cuota_minima?: number;
  porcentaje_alcanzado?: number;
  esta_por_debajo?: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function CalculatorHistorialPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('modelo'); // Rol del usuario para verificar permisos de edición
  const [targetModelId, setTargetModelId] = useState<string | null>(null); // ID del modelo cuyo historial se está viendo
  const [periods, setPeriods] = useState<Period[]>([]);
  const [allPeriods, setAllPeriods] = useState<Period[]>([]); // Todos los períodos sin filtrar
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedPeriodType, setSelectedPeriodType] = useState<string>(''); // '1-15' o '16-31'
  const [availableYears, setAvailableYears] = useState<Array<{value: string, label: string}>>([]);
  const [availableMonths, setAvailableMonths] = useState<Array<{value: string, label: string}>>([]);
  const [editingPlatform, setEditingPlatform] = useState<{periodKey: string, platformId: string} | null>(null);
  const [editingRates, setEditingRates] = useState<string | null>(null); // periodKey
  const [editValue, setEditValue] = useState<string>('');
  const [editRates, setEditRates] = useState<{eur_usd: string, gbp_usd: string, usd_cop: string}>({eur_usd: '', gbp_usd: '', usd_cop: ''});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener usuario autenticado
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        
        if (!uid) {
          setError('No hay usuario autenticado');
          setLoading(false);
          return;
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', uid)
          .single();

        if (!userRow) {
          setError('Usuario no encontrado');
          setLoading(false);
          return;
        }

        // Guardar rol del usuario para verificar permisos de edición
        setUserRole(userRow.role || 'modelo');

        // 🔒 VERIFICACIÓN DE SEGURIDAD: Solo permitir que el usuario vea sus propios datos
        // Verificar que el usuario autenticado coincide con el usuario de la base de datos
        if (uid !== userRow.id) {
          console.error('🚫 [CALCULATOR-HISTORIAL] Intento de acceso no autorizado detectado en frontend');
          setError('No autorizado: Solo puedes consultar tu propio historial');
          setLoading(false);
          return;
        }

        setUser({
          id: userRow.id,
          name: userRow.name || userRow.email?.split('@')[0] || 'Usuario',
          email: userRow.email || ''
        });

        // Obtener historial de calculadora con token de autorización
        // 🔒 GARANTIZAR: Siempre usar el ID del usuario autenticado, nunca uno diferente
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          setError('Sesión no válida. Por favor, inicia sesión nuevamente.');
          setLoading(false);
          return;
        }
        
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`
        };
        
        // 🔒 DETERMINAR modelId: 
        // - Si es admin/super_admin y hay modelId en URL, usar ese (para ver historial de otros)
        // - Si no, usar el ID del usuario autenticado (para que modelos vean solo su historial)
        const searchParams = new URLSearchParams(window.location.search);
        const modelIdFromUrl = searchParams.get('modelId');
        let targetModelId = userRow.id;
        
        // Solo admins pueden ver historial de otros modelos
        if (modelIdFromUrl && (userRow.role === 'admin' || userRow.role === 'super_admin')) {
          targetModelId = modelIdFromUrl;
        } else if (modelIdFromUrl && userRow.role !== 'admin' && userRow.role !== 'super_admin') {
          // Modelos no pueden ver historial de otros
          setError('No autorizado: Solo puedes consultar tu propio historial');
          setLoading(false);
          return;
        }
        
        // Guardar el targetModelId para usarlo en las funciones de edición
        setTargetModelId(targetModelId);
        
        const response = await fetch(`/api/model/calculator/historial?modelId=${targetModelId}`, {
          headers
        });
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Error al cargar historial');
          return;
        }

        const loadedPeriods = data.periods || [];
        setAllPeriods(loadedPeriods);
        setPeriods(loadedPeriods);

        // Generar años y meses disponibles basados en los períodos
        const uniqueYears = new Set<number>();
        const uniqueMonths = new Set<number>();
        
        loadedPeriods.forEach((period: Period) => {
          const date = new Date(period.period_date);
          uniqueYears.add(date.getFullYear());
          uniqueMonths.add(date.getMonth() + 1); // Mes 1-12
        });
        
        const yearsOptions = Array.from(uniqueYears)
          .sort((a, b) => b - a) // Más reciente primero
          .map(year => ({ value: year.toString(), label: year.toString() }));
        
        const monthsOptions = [
          { value: '1', label: 'Enero' },
          { value: '2', label: 'Febrero' },
          { value: '3', label: 'Marzo' },
          { value: '4', label: 'Abril' },
          { value: '5', label: 'Mayo' },
          { value: '6', label: 'Junio' },
          { value: '7', label: 'Julio' },
          { value: '8', label: 'Agosto' },
          { value: '9', label: 'Septiembre' },
          { value: '10', label: 'Octubre' },
          { value: '11', label: 'Noviembre' },
          { value: '12', label: 'Diciembre' }
        ];
        
        setAvailableYears(yearsOptions);
        setAvailableMonths(monthsOptions);

      } catch (err: any) {
        console.error('Error cargando historial:', err);
        setError(err.message || 'Error al cargar historial');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Formatear mes y período (ej: "Octubre - 2da Quincena")
  const formatPeriodMonth = (dateStr: string, periodType: string) => {
    const date = new Date(dateStr);
    const monthName = date.toLocaleDateString('es-CO', { month: 'long' });
    // Capitalizar primera letra
    const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const periodLabel = periodType === '1-15' ? '1ra Quincena' : '2da Quincena';
    return `${monthCapitalized} - ${periodLabel}`;
  };

  // Formatear fecha de archivado con hora (ej: "1 de noviembre de 2025 (14:30)")
  const formatArchivedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const datePart = date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timePart = date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${datePart} (${timePart})`;
  };

  const formatPeriodType = (periodType: string) => {
    return periodType === '1-15' ? '1ra Quincena' : '2da Quincena';
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : currency === 'EUR' ? 'EUR' : currency === 'GBP' ? 'GBP' : 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Formatear solo el número sin símbolo de divisa
  const formatNumberOnly = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Filtrar períodos según año, mes y período seleccionados
  const filteredPeriods = useMemo(() => {
    // No mostrar nada hasta que se seleccione un período completo (año, mes y período)
    if (!selectedYear || !selectedMonth || !selectedPeriodType) {
      return [];
    }
    
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    
    return allPeriods.filter(period => {
      const date = new Date(period.period_date);
      const periodYear = date.getFullYear();
      const periodMonth = date.getMonth() + 1; // Mes 1-12
      
      return periodYear === year && 
             periodMonth === month && 
             period.period_type === selectedPeriodType;
    });
  }, [allPeriods, selectedYear, selectedMonth, selectedPeriodType]);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  const startEditPlatform = (periodKey: string, platformId: string, currentValue: number) => {
    setEditingPlatform({ periodKey, platformId });
    setEditValue(currentValue.toString());
  };

  const startEditRates = (period: Period) => {
    const periodKey = `${period.period_date}-${period.period_type}`;
    setEditingRates(periodKey);
    setEditRates({
      eur_usd: period.rates?.eur_usd?.toString() || '',
      gbp_usd: period.rates?.gbp_usd?.toString() || '',
      usd_cop: period.rates?.usd_cop?.toString() || ''
    });
  };

  const cancelEdit = () => {
    setEditingPlatform(null);
    setEditingRates(null);
    setEditValue('');
    setEditRates({ eur_usd: '', gbp_usd: '', usd_cop: '' });
  };

  const savePlatformValue = async (periodKey: string, platformId: string) => {
    if (!isAdmin) return;

    try {
      setSaving(true);
      
      // Encontrar el registro en el historial
      const period = allPeriods.find(p => `${p.period_date}-${p.period_type}` === periodKey);
      if (!period) {
        throw new Error('Período no encontrado');
      }

      const platform = period.platforms.find(p => p.platform_id === platformId);
      if (!platform) {
        throw new Error('Plataforma no encontrada');
      }

      // Obtener el ID del registro desde la base de datos
      // Necesitamos hacer una consulta para obtener el historyId
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Sesión no válida');
      }

      // Primero obtener el historyId desde el API de historial o hacer una consulta directa
      // Por ahora, vamos a asumir que necesitamos obtenerlo del backend
      // En una implementación real, necesitaríamos almacenar el historyId en el frontend
      
      // Por simplicidad, vamos a crear un endpoint que busque por period_date, period_type, model_id y platform_id
      // O podemos modificar el API para aceptar estos parámetros en lugar de historyId

      // Actualizar usando period_date, period_type, model_id, platform_id
      const response = await fetch('/api/model/calculator/historial/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period_date: period.period_date,
          period_type: period.period_type,
          model_id: targetModelId || user?.id, // Usar targetModelId si está disponible (admin viendo otro modelo)
          platform_id: platformId,
          value: Number(editValue)
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al actualizar valor');
      }

      // Recargar datos
      window.location.reload(); // Por ahora recargar, después podemos actualizar el estado local
    } catch (error: any) {
      console.error('Error guardando valor:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveRates = async (period: Period) => {
    if (!isAdmin) return;

    try {
      setSaving(true);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Sesión no válida');
      }

      // Obtener nombre del admin que está editando
      const adminName = user?.name || 'Administrador';

      // Usar el endpoint global de "Editar RATES de cierre" que afecta a todas las modelos del período
      const response = await fetch('/api/admin/calculator-history/update-period-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period_date: period.period_date,
          period_type: period.period_type,
          rates: {
            eur_usd: editRates.eur_usd ? Number(editRates.eur_usd) : null,
            gbp_usd: editRates.gbp_usd ? Number(editRates.gbp_usd) : null,
            usd_cop: editRates.usd_cop ? Number(editRates.usd_cop) : null
          },
          admin_id: user?.id,
          admin_name: adminName
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al actualizar tasas');
      }

      // Recargar datos
      window.location.reload(); // Por ahora recargar, después podemos actualizar el estado local

    } catch (error: any) {
      console.error('Error guardando tasas:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando historial...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Volver</span>
          </button>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-1 whitespace-nowrap truncate">
              Mi Historial
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
              Historial de períodos archivados de Mi Calculadora
            </p>
          </div>
          
          {/* Dropdowns para filtrar por Año, Mes y Período */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Dropdown Año */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Año</label>
              <AppleDropdown
                options={availableYears}
                value={selectedYear}
                onChange={(value) => setSelectedYear(value)}
                placeholder="Seleccionar año"
                className="min-w-[120px] text-sm"
                maxHeight="max-h-48"
              />
            </div>
            
            {/* Dropdown Mes */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mes</label>
              <AppleDropdown
                options={availableMonths}
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value)}
                placeholder="Seleccionar mes"
                className="min-w-[140px] text-sm"
                maxHeight="max-h-48"
              />
            </div>
            
            {/* Dropdown Período */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Período</label>
              <AppleDropdown
                options={[
                  { value: '1-15', label: 'P1 (1-15)' },
                  { value: '16-31', label: 'P2 (16-31)' }
                ]}
                value={selectedPeriodType}
                onChange={(value) => setSelectedPeriodType(value)}
                placeholder="Seleccionar período"
                className="min-w-[140px] text-sm"
                maxHeight="max-h-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-red-200 dark:border-red-600/20 p-6 mb-4">
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Error</h4>
            <p className="text-gray-500 dark:text-gray-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!error && filteredPeriods.length === 0 && (
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-12 mb-4">
          <div className="text-center">
            <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {!selectedYear || !selectedMonth || !selectedPeriodType
                ? 'Selecciona un período para consultar'
                : 'No hay datos para el período seleccionado'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {!selectedYear || !selectedMonth || !selectedPeriodType
                ? 'Usa los filtros de arriba para seleccionar Año, Mes y Período (P1 o P2)'
                : `No se encontraron datos para ${selectedMonth && availableMonths.find(m => m.value === selectedMonth)?.label} ${selectedYear} - ${selectedPeriodType === '1-15' ? 'P1' : 'P2'}`}
            </p>
          </div>
        </div>
      )}

      {/* Periods List */}
      {!error && filteredPeriods.length > 0 && (
        <div className="space-y-4">
          {filteredPeriods.map((period, index) => (
            <div
              key={`${period.period_date}-${period.period_type}`}
              className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 hover:shadow-md transition-all duration-300"
            >
              {/* Period Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {formatPeriodMonth(period.period_date, period.period_type)}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Archivado: {formatArchivedDate(period.archived_at)}
                    </p>
                  </div>
                </div>
                
                {/* RATES de cierre - En la parte superior del período */}
                <div className="ml-4">
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      RATES de cierre
                    </div>
                    {isAdmin && period.rates && editingRates !== `${period.period_date}-${period.period_type}` && (
                      <button
                        onClick={() => startEditRates(period)}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        title="Editar tasas del período (editable desde Consulta Histórica)"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>
                  
                  {editingRates === `${period.period_date}-${period.period_type}` ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number"
                        step="0.0001"
                        value={editRates.eur_usd}
                        onChange={(e) => setEditRates({...editRates, eur_usd: e.target.value})}
                        placeholder="EUR→USD"
                        className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 w-24 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        value={editRates.gbp_usd}
                        onChange={(e) => setEditRates({...editRates, gbp_usd: e.target.value})}
                        placeholder="GBP→USD"
                        className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 w-24 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="number"
                        step="1"
                        value={editRates.usd_cop}
                        onChange={(e) => setEditRates({...editRates, usd_cop: e.target.value})}
                        placeholder="USD→COP"
                        className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 w-24 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={() => saveRates(period)}
                        disabled={saving}
                        className="px-2 py-1.5 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded transition-colors flex items-center gap-1"
                        title="Guardar"
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors flex items-center gap-1"
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : period.rates && (period.rates.eur_usd || period.rates.gbp_usd || period.rates.usd_cop) ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {period.rates.eur_usd && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1.5">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-0.5">EUR→USD</div>
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {period.rates.eur_usd.toFixed(4)}
                          </div>
                        </div>
                      )}
                      {period.rates.gbp_usd && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1.5">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-0.5">GBP→USD</div>
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {period.rates.gbp_usd.toFixed(4)}
                          </div>
                        </div>
                      )}
                      {period.rates.usd_cop && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-2 py-1.5">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-0.5">USD→COP</div>
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {period.rates.usd_cop.toFixed(0)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 dark:text-gray-500 italic">No disponibles</div>
                  )}
                </div>
              </div>

              {/* Platforms Table - Estilo similar a Mi Calculadora pero compacto */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Plataformas ({period.platforms.filter(p => p.value > 0).length})
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200/50 dark:border-gray-600/50 bg-gray-50/50 dark:bg-gray-600/50 backdrop-blur-sm">
                        <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">PLATAFORMAS</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">VALORES</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">DÓLARES</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide">COP MODELO</th>
                        {isAdmin && (
                          <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-white text-xs uppercase tracking-wide w-12"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {period.platforms
                        .filter(p => p.value > 0) // Solo mostrar plataformas con valores
                        .map((platform) => {
                          const periodKey = `${period.period_date}-${period.period_type}`;
                          const isEditing = editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === platform.platform_id;
                          const percentage = platform.platform_percentage || null;

                          return (
                            <tr key={platform.platform_id} className="border-b border-gray-100 dark:border-gray-600">
                              <td className="py-2 px-3">
                                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{platform.platform_name}</div>
                                {percentage && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Reparto: {percentage}%
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1">
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full max-w-24 h-7 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                                        {formatNumberOnly(platform.value)}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-gray-700 dark:text-gray-200 text-xs font-semibold bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-700 px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-500 shadow-sm min-w-[50px] text-center">
                                    {platform.platform_currency}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                                  {platform.value_usd_modelo !== undefined && platform.value_usd_modelo > 0
                                    ? formatCurrency(platform.value_usd_modelo, 'USD')
                                    : '$0.00 USD'}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                                  {platform.value_cop_modelo !== undefined && platform.value_cop_modelo > 0
                                    ? formatCurrency(platform.value_cop_modelo, 'COP')
                                    : '$0 COP'}
                                </div>
                              </td>
                              {isAdmin && (
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-1">
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={() => savePlatformValue(periodKey, platform.platform_id)}
                                          disabled={saving}
                                          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                                          title="Guardar"
                                        >
                                          <Save className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={cancelEdit}
                                          className="p-1 text-red-600 hover:text-red-700"
                                          title="Cancelar"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => startEditPlatform(periodKey, platform.platform_id, platform.value)}
                                        className="p-1 text-blue-600 hover:text-blue-700"
                                        title="Editar valor"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                
                {/* Totales y alertas del período cerrado - Debajo de la tabla */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                  {/* Totales computados */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">USD Modelo</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(period.total_usd_modelo || 0, 'USD')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">COP Modelo</div>
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(period.total_cop_modelo || 0, 'COP')}
                      </div>
                    </div>
                  </div>

                  {/* Barra de objetivo - Porcentaje alcanzado - Mejora visual */}
                  {period.cuota_minima !== undefined && (
                    <div className="mb-4">
                      {(() => {
                        const porcentajeAlcanzado = period.porcentaje_alcanzado || 0;
                        const progressPct = Math.max(0, Math.min(100, porcentajeAlcanzado));
                        
                        // Paleta: Rojo -> Púrpura -> Esmeralda (sin amarillos)
                        const RED = { r: 229, g: 57, b: 53 };     // #E53935
                        const PURPLE = { r: 142, g: 36, b: 170 }; // #8E24AA
                        const EMERALD = { r: 46, g: 125, b: 50 };  // #2E7D32

                        const mix = (a: {r: number, g: number, b: number}, b: {r: number, g: number, b: number}, t: number) => ({
                          r: Math.round(a.r + (b.r - a.r) * t),
                          g: Math.round(a.g + (b.g - a.g) * t),
                          b: Math.round(a.b + (b.b - a.b) * t)
                        });
                        
                        const rgbToHex = (c: {r: number, g: number, b: number}) => 
                          `#${[c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
                        const shade = (c: {r: number, g: number, b: number}, t: number) => mix(c, { r: 0, g: 0, b: 0 }, t);

                        const t = progressPct / 100;
                        // 0–60% rojo→púrpura, 60–100% púrpura→esmeralda
                        const base = t <= 0.6
                          ? mix(RED, PURPLE, t / 0.6)
                          : mix(PURPLE, EMERALD, (t - 0.6) / 0.4);

                        const progressStart = rgbToHex(shade(base, 0.05));
                        const progressEnd = rgbToHex(shade(base, 0.15));

                        return (
                          <div className="bg-gradient-to-br from-gray-50/80 to-gray-100/80 dark:from-gray-700/50 dark:to-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
                            {/* Header con icono y porcentaje */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                                  style={{
                                    background: `linear-gradient(135deg, ${rgbToHex(shade(base, 0.0))}, ${rgbToHex(shade(base, 0.2))})`
                                  }}
                                >
                                  <svg 
                                    className="w-4 h-4 text-white" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Objetivo del período
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Meta: {formatCurrency(period.cuota_minima || 0, 'USD')}
                                  </div>
                                </div>
                              </div>
                              <div 
                                className="text-lg font-bold px-3 py-1 rounded-lg shadow-sm text-white"
                                style={{
                                  background: `linear-gradient(135deg, ${rgbToHex(shade(base, 0.0))}, ${rgbToHex(shade(base, 0.1))})`,
                                  border: `1px solid ${rgbToHex(shade(base, 0.3))}`,
                                  boxShadow: `0 2px 8px ${rgbToHex(shade(base, 0.2))}40`
                                }}
                              >
                                {porcentajeAlcanzado.toFixed(1)}%
                              </div>
                            </div>

                            {/* Barra de progreso mejorada */}
                            <div className="mb-3">
                              <div className="w-full bg-gray-200/80 dark:bg-gray-700/80 rounded-full h-4 overflow-hidden shadow-inner">
                                <div
                                  className="h-full rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden"
                                  style={{
                                    width: `${Math.min(progressPct, 100)}%`,
                                    background: `linear-gradient(90deg, ${progressStart}, ${progressEnd})`
                                  }}
                                >
                                  {/* Efecto de brillo sutil */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                </div>
                              </div>
                            </div>

                            {/* Información de progreso */}
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/50 dark:border-gray-600/30">
                              <div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                  Alcanzado
                                </div>
                                <div 
                                  className="text-sm font-bold"
                                  style={{ 
                                    color: rgbToHex(shade(base, 0.2)),
                                    textShadow: `0 1px 2px ${rgbToHex(shade(base, 0.4))}30`
                                  }}
                                >
                                  {formatCurrency(period.total_usd_bruto || 0, 'USD')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                  Faltante
                                </div>
                                <div className={`text-sm font-semibold ${
                                  period.esta_por_debajo 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {formatCurrency(Math.max(0, (period.cuota_minima || 0) - (period.total_usd_bruto || 0)), 'USD')}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Alertas del período cerrado */}
                  {period.alerts && period.alerts.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                        Alertas del período
                      </div>
                      <div className="space-y-2">
                        {period.alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`flex items-start gap-2 text-xs p-3 rounded-lg ${
                              alert.type === 'periodo_cerrado' || alert.type === 'period_closed'
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                                : alert.type === 'calculator_cleared'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
                                : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                            }`}
                          >
                            {alert.type === 'periodo_cerrado' || alert.type === 'period_closed' ? (
                              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                            ) : alert.type === 'calculator_cleared' ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium ${
                                alert.type === 'periodo_cerrado' || alert.type === 'period_closed'
                                  ? 'text-green-800 dark:text-green-300'
                                  : alert.type === 'calculator_cleared'
                                  ? 'text-yellow-800 dark:text-yellow-300'
                                  : 'text-blue-800 dark:text-blue-300'
                              }`}>
                                {alert.message}
                              </p>
                              {alert.created_at && (
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                  {new Date(alert.created_at).toLocaleString('es-CO', {
                                    dateStyle: 'short',
                                    timeStyle: 'short'
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

