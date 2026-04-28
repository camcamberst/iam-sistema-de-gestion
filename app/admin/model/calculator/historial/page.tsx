'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { History, ArrowLeft, Calendar, DollarSign, Edit2, Save, X, AlertTriangle, CheckCircle, Info, Plus, Trash2 } from 'lucide-react';
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from '@/components/ui/PageHeader';
import GlassCard from '@/components/ui/GlassCard';
import ObjectiveBorealCard from '@/components/ui/ObjectiveBorealCard';

interface Alert {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read_at: string | null;
  data?: any;
}

interface Deduction {
  id: string;
  concept: string;
  amount: number;
  created_at: string;
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
  total_anticipos?: number; 
  total_deducciones?: number; // 🔧 NUEVO
  deducciones?: Deduction[];  // 🔧 NUEVO
  neto_pagar?: number;      
  rates?: {
    eur_usd?: number | null;
    gbp_usd?: number | null;
    usd_cop?: number | null;
  };
  alerts?: Alert[];
  cuota_minima?: number;
  porcentaje_alcanzado?: number;
  esta_por_debajo?: boolean;
  is_synthetic?: boolean; // 🔧 NUEVO: Indica si es período reconstruido desde totales
  synthetic_note?: string; // 🔧 NUEVO: Nota explicativa
  pending_savings?: any[]; // 🔧 NUEVO: Solicitudes de ahorro pendientes asociadas a este periodo
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function CalculatorHistorialPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('modelo'); 
  const [targetModelId, setTargetModelId] = useState<string | null>(null); 
  const [periods, setPeriods] = useState<Period[]>([]);
  const [allPeriods, setAllPeriods] = useState<Period[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedPeriodType, setSelectedPeriodType] = useState<string>(''); 
  const [availableYears, setAvailableYears] = useState<Array<{value: string, label: string}>>([]);
  const [availableMonths, setAvailableMonths] = useState<Array<{value: string, label: string}>>([]);
  
  // Estados para edición
  const [editingPlatform, setEditingPlatform] = useState<{periodKey: string, platformId: string} | null>(null);
  const [editingRates, setEditingRates] = useState<string | null>(null); 
  const [editValue, setEditValue] = useState<string>('');
  const [editRates, setEditRates] = useState<{eur_usd: string, gbp_usd: string, usd_cop: string}>({eur_usd: '', gbp_usd: '', usd_cop: ''});
  
  // Estados para deducciones
  const [addingDeductionFor, setAddingDeductionFor] = useState<string | null>(null); // periodKey
  const [newDeduction, setNewDeduction] = useState<{concept: string, amount: string}>({concept: '', amount: ''});
  const [deductionType, setDeductionType] = useState<'deduction' | 'bonus'>('deduction'); // 🔧 NUEVO
  
  // 🌟 ESTADO DE CARRUSEL MÓVIL
  const [mobileCarouselSide, setMobileCarouselSide] = useState<'cop' | 'usd'>('cop');

  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const showBackButton = from === 'historial-modelo';

  // Función para recargar datos
  const loadData = async () => {
    // ... (Misma lógica de carga)
    try {
      if (!targetModelId) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const response = await fetch(`/api/model/calculator/historial?modelId=${targetModelId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      const savingsRes = await fetch(`/api/model/savings?modelId=${targetModelId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const savingsData = await savingsRes.json();
      const allSavings = savingsData.success ? (savingsData.savings || []) : [];

      if (data.success) {
        const enrichedPeriods = (data.periods || []).map((p: Period) => {
          p.pending_savings = allSavings.filter(s => s.period_date === p.period_date && s.period_type === p.period_type && s.estado === 'pendiente');
          return p;
        });
        setAllPeriods(enrichedPeriods);
        setPeriods(enrichedPeriods);
      }
    } catch (e) {
      console.error("Error reloading data", e);
    }
  };

  useEffect(() => {
    // ... (Misma lógica de inicialización)
    const initLoad = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) { setError('No hay usuario'); setLoading(false); return; }

        const { data: userRow } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', uid)
          .single();

        if (!userRow) { setError('Usuario no encontrado'); setLoading(false); return; }

        setUserRole(userRow.role || 'modelo');
        setUser({ id: userRow.id, name: userRow.name || 'Usuario', email: userRow.email || '' });

        const searchParams = new URLSearchParams(window.location.search);
        const modelIdFromUrl = searchParams.get('modelId');
        let targetId = userRow.id;
        
        if (modelIdFromUrl && (userRow.role === 'admin' || userRow.role === 'super_admin' || userRow.role === 'superadmin_aff')) {
          targetId = modelIdFromUrl;
        }
        setTargetModelId(targetId);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const response = await fetch(`/api/model/calculator/historial?modelId=${targetId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const savingsRes = await fetch(`/api/model/savings?modelId=${targetId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const savingsData = await savingsRes.json();
        const allSavings = savingsData.success ? (savingsData.savings || []) : [];

        if (!data.success) { setError(data.error); return; }

        const loadedPeriods = (data.periods || []).map((p: Period) => {
          p.pending_savings = allSavings.filter(s => s.period_date === p.period_date && s.period_type === p.period_type && s.estado === 'pendiente');
          return p;
        });
        
        // 🔧 FILTRAR P1 ENERO 2026 (solo consolidados, genera confusión)
        const filteredPeriods = loadedPeriods.filter((p: Period) => {
          // Ocultar enero P1 2026 que solo tiene registros consolidados
          if (p.period_date === '2026-01-01' && p.period_type === '1-15') {
            return false;
          }
          return true;
        });
        
        setAllPeriods(filteredPeriods);
        setPeriods(filteredPeriods);

        // Auto-seleccionar el período más reciente si no hay nada seleccionado
        if (filteredPeriods.length > 0) {
          const mostRecent = filteredPeriods[0];
          if (mostRecent.period_date) {
            const [y, m] = mostRecent.period_date.split('-');
            setSelectedYear(y);
            setSelectedMonth(parseInt(m).toString());
            setSelectedPeriodType(mostRecent.period_type);
          }
        }

        const uniqueYears = new Set<number>();
        loadedPeriods.forEach((p: Period) => {
          if (p.period_date) {
            const year = parseInt(p.period_date.split('-')[0]);
            if (!isNaN(year)) uniqueYears.add(year);
          }
        });
        
        // Asegurar que siempre haya al menos el año actual
        const currentYear = new Date().getFullYear();
        uniqueYears.add(currentYear);
        
        setAvailableYears(Array.from(uniqueYears).sort((a, b) => b - a).map(y => ({ value: y.toString(), label: y.toString() })));
        setAvailableMonths([
          { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
          { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
          { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
          { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
        ]);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    initLoad();
  }, []);

  // ALINEACIÓN PERFECTA MÓVIL: Usar ancho fijo en lugar de script DOM
  // syncCopWidths removido para evitar reflows y mejorar el rendimiento

  // ⚠️ IMPORTANTE: `new Date('YYYY-MM-DD')` se interpreta como UTC y en Colombia
  // puede correrse al día/mes anterior (ej. 2026-03-01 -> 29 febrero local).
  // Para evitar que Marzo P1 se muestre como Febrero P1, parseamos YYYY-MM-DD
  // construyendo un Date local (año, mes-1, día).
  const parseLocalYmd = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const formatDate = (dateStr: string) =>
    parseLocalYmd(dateStr).toLocaleDateString('es-CO');

  const formatPeriodMonth = (dateStr: string, periodType: string) => {
    const date = parseLocalYmd(dateStr);
    const m = date.toLocaleDateString('es-CO', { month: 'long' });
    return `${m.charAt(0).toUpperCase() + m.slice(1)} - ${
      periodType === '1-15' ? '1ra Quincena' : '2da Quincena'
    }`;
  };
  const formatArchivedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('es-CO')} (${d.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', hour12:false})})`;
  };
  const formatCurrency = (v: number, c: string = 'USD') => new Intl.NumberFormat('es-CO', { style: 'currency', currency: c, minimumFractionDigits: c === 'COP' ? 0 : 2, maximumFractionDigits: c === 'COP' ? 0 : 2 }).format(v);

  // Recalcular USD modelo y COP desde VALOR (misma lógica que el backend) para vista previa al editar
  const computeUsdCopFromValue = (
    value: number,
    platformId: string,
    currency: string,
    rates: { eur_usd?: number | null; gbp_usd?: number | null; usd_cop?: number | null },
    platformPercentage: number
  ): { usdModelo: number; copModelo: number } => {
    if (Number.isNaN(value) || value === 0) return { usdModelo: 0, copModelo: 0 };
    const eur = rates.eur_usd ?? 1.01;
    const gbp = rates.gbp_usd ?? 1.2;
    const cop = rates.usd_cop ?? 3900;
    const n = String(platformId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let usdBruto: number;
    if (currency === 'EUR') {
      if (n === 'big7') usdBruto = value * eur * 0.84;
      else if (n === 'mondo') usdBruto = value * eur * 0.78;
      else usdBruto = value * eur;
    } else if (currency === 'GBP') {
      if (n === 'aw') usdBruto = value * gbp * 0.677;
      else usdBruto = value * gbp;
    } else {
      if (n === 'cmd' || n === 'camlust' || n === 'skypvt') usdBruto = value * 0.75;
      else if (n === 'chaturbate' || n === 'myfreecams' || n === 'stripchat') usdBruto = value * 0.05;
      else if (n === 'dxlive') usdBruto = value * 0.6;
      else if (n === 'secretfriends') usdBruto = value * 0.5;
      else usdBruto = value;
    }
    const pct = (platformPercentage ?? 80) / 100;
    const usdModelo = parseFloat((usdBruto * pct).toFixed(2));
    const copModelo = parseFloat((usdModelo * cop).toFixed(2));
    return { usdModelo, copModelo };
  };
  const formatNumberOnly = (v: number) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(v);

  const filteredPeriods = useMemo(() => {
    if (!selectedYear || !selectedMonth || !selectedPeriodType) return [];
    const y = parseInt(selectedYear);
    const m = parseInt(selectedMonth);
    return allPeriods.filter(p => {
      if (!p.period_date) return false;
      const [py, pm] = p.period_date.split('-').map(Number);
      return py === y && pm === m && p.period_type === selectedPeriodType;
    });
  }, [allPeriods, selectedYear, selectedMonth, selectedPeriodType]);

  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // ... (Funciones de edición plataforma/rates sin cambios)
  const startEditPlatform = (periodKey: string, platformId: string, val: number) => { setEditingPlatform({ periodKey, platformId }); setEditValue(val.toString()); };
  const startEditRates = (p: Period) => {
    const k = `${p.period_date}-${p.period_type}`;
    setEditingRates(k);
    setEditRates({
      eur_usd: p.rates?.eur_usd?.toString() || '',
      gbp_usd: p.rates?.gbp_usd?.toString() || '',
      usd_cop: p.rates?.usd_cop?.toString() || ''
    });
  };
  const cancelEdit = () => { setEditingPlatform(null); setEditingRates(null); setEditValue(''); setAddingDeductionFor(null); setDeductionType('deduction'); };

  const savePlatformValue = async (periodKey: string, platformId: string) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const period = allPeriods.find(p => `${p.period_date}-${p.period_type}` === periodKey);
      if (!period) throw new Error('Período no encontrado');
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sesión no válida');

      const response = await fetch('/api/model/calculator/historial/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          period_date: period.period_date,
          period_type: period.period_type,
          model_id: targetModelId || user?.id,
          platform_id: platformId,
          value: Number(editValue)
        })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.detail ? `${data.error}: ${data.detail}` : data.error);
      
      setEditingPlatform(null);
      await loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const saveRates = async (period: Period) => {
    if (!isAdmin) return;
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sesión no válida');

      const response = await fetch('/api/admin/calculator-history/update-period-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          period_date: period.period_date,
          period_type: period.period_type,
          rates: {
            eur_usd: editRates.eur_usd ? Number(editRates.eur_usd) : null,
            gbp_usd: editRates.gbp_usd ? Number(editRates.gbp_usd) : null,
            usd_cop: editRates.usd_cop ? Number(editRates.usd_cop) : null
          },
          admin_id: user?.id,
          admin_name: user?.name || 'Admin'
        })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      setEditingRates(null);
      await loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  // 🔧 NUEVAS FUNCIONES PARA DEDUCCIONES (CON TIPO)
  const handleAddDeduction = async (period: Period) => {
    if (!newDeduction.concept || !newDeduction.amount) return;
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const rawAmount = Number(newDeduction.amount);
      // Si es "deduction", enviamos positivo (el backend resta). Si es "bonus", enviamos negativo (el backend resta negativo = suma)
      // Lógica ajustada: El backend hace: Neto = ... - total_deducciones
      // total_deducciones = sum(amounts).
      // Si quiero RESTAR 50k: envio 50000. Neto - 50000. Correcto.
      // Si quiero SUMAR 50k: envio -50000. Neto - (-50000) = Neto + 50000. Correcto.
      
      const finalAmount = deductionType === 'deduction' ? rawAmount : -rawAmount;

      const response = await fetch('/api/model/calculator/historial/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          model_id: targetModelId,
          period_date: period.period_date,
          period_type: period.period_type,
          concept: newDeduction.concept,
          amount: finalAmount
        })
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      setAddingDeductionFor(null);
      setNewDeduction({ concept: '', amount: '' });
      setDeductionType('deduction');
      await loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const handleDeleteDeduction = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este ítem?')) return;
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch(`/api/model/calculator/historial/deductions?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      
      await loadData();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  // 🔧 NUEVAS FUNCIONES PARA SOLICITUDES DE AHORRO
  const handleApproveSaving = async (savingId: string, periodKey: string) => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No autorizado');

      const response = await fetch(`/api/model/savings/${savingId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        const updateMutator = (prev: Period[]) => prev.map(p => {
          if (`${p.period_date}-${p.period_type}` === periodKey) {
            const savingMatch = p.pending_savings?.find((s: any) => s.id === savingId);
            if (savingMatch) {
              const amount = parseFloat(savingMatch.monto_ahorrado);
              const newDeductions = [...(p.deducciones || []), {
                id: 'temp-' + Date.now(),
                concept: 'Ahorro Período',
                amount: amount,
                created_at: new Date().toISOString()
              }];
              return {
                ...p,
                pending_savings: p.pending_savings?.filter((s:any) => s.id !== savingId),
                deducciones: newDeductions,
                total_deducciones: (p.total_deducciones || 0) + amount,
              }
            }
          }
          return p;
        });
        setPeriods(updateMutator);
        setAllPeriods(updateMutator);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e: any) {
      alert('Error de red aprobando ahorro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRejectSaving = async (savingId: string, periodKey: string) => {
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No autorizado');

      const response = await fetch(`/api/model/savings/${savingId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        const updateMutator = (prev: Period[]) => prev.map(p => {
          if (`${p.period_date}-${p.period_type}` === periodKey) {
            return {
              ...p,
              pending_savings: p.pending_savings?.filter((s:any) => s.id !== savingId),
            };
          }
          return p;
        });
        setPeriods(updateMutator);
        setAllPeriods(updateMutator);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e: any) {
      alert('Error de red rechazando ahorro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pt-16">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando historial...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto max-sm:px-0 px-4 sm:px-6 lg:px-20 xl:px-32 py-8 pt-6 sm:pt-8 relative z-10">
      {showBackButton && (
        <div className="mb-4 sm:mb-6">
          <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg hover:bg-blue-50/80 dark:hover:bg-gray-700/80 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a filtros
          </button>
          </div>
        </div>
      )}

      {/* Header — Migrado a PageHeader */}
      <PageHeader
        title="Mi Historial"
        subtitle="Historial de períodos archivados"
        glow="model"
        icon={<History className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
      />

      {/* Controles de Filtado (Año, Mes, Período) - Centrados debajo del header */}
      <div className="flex justify-center items-center gap-3 sm:gap-5 flex-wrap mt-10 sm:mt-10 md:mt-12 mb-8">
        <AppleDropdown options={availableYears} value={selectedYear} onChange={setSelectedYear} placeholder="Año" className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold shadow-sm" />
        <AppleDropdown options={availableMonths} value={selectedMonth} onChange={setSelectedMonth} placeholder="Mes" className="min-w-[110px] sm:min-w-[130px] text-xs sm:text-sm font-semibold shadow-sm" />
        <AppleDropdown options={[{value:'1-15',label:'P1'},{value:'16-31',label:'P2'}]} value={selectedPeriodType} onChange={setSelectedPeriodType} placeholder="Período" className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm font-semibold shadow-sm" />
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4 text-center border border-red-100 dark:border-red-800">{error}</div>}
      
      {!error && filteredPeriods.length === 0 && (
        <div className="p-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-center">
          <History className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No hay datos</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Selecciona un período válido con los filtros.</p>
        </div>
      )}

      {!error && filteredPeriods.length > 0 && (
        <div className="space-y-4">
          {filteredPeriods.map((period) => {
            const periodKey = `${period.period_date}-${period.period_type}`;
            return (
            <div key={periodKey} className="mb-10 relative">
              {/* Encabezado del Período (Fuera de la caja) */}
              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-end mb-4 px-1 sm:px-2 gap-5 sm:gap-0">
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] truncate">
                    <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400 mr-2.5 shrink-0" />
                    {formatPeriodMonth(period.period_date, period.period_type)}
                  </h3>
                    {period.is_synthetic && (
                      <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="truncate">{period.synthetic_note || 'Período reconstruido desde totales'}</span>
                      </p>
                    )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 ml-0 sm:ml-4 w-full sm:w-auto mt-1 sm:mt-0">
                  <div className="flex items-center justify-start sm:justify-end gap-1.5 sm:gap-2 mb-0 sm:mb-2 shrink-0">
                    <div className="text-[10px] sm:text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-widest mt-0.5 sm:mt-0">RATES</div>
                    {isAdmin && editingRates !== periodKey && (
                      <button onClick={() => startEditRates(period)} className="text-[10px] sm:text-xs text-blue-600 flex items-center gap-1 active:scale-95 touch-manipulation"><Edit2 className="w-3 h-3" />Editar</button>
                    )}
                  </div>
                  {editingRates === periodKey ? (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <input type="number" value={editRates.eur_usd} onChange={e=>setEditRates({...editRates, eur_usd:e.target.value})} placeholder="EUR" className="w-14 sm:w-16 text-[10px] sm:text-xs border rounded px-1" />
                      <input type="number" value={editRates.gbp_usd} onChange={e=>setEditRates({...editRates, gbp_usd:e.target.value})} placeholder="GBP" className="w-14 sm:w-16 text-[10px] sm:text-xs border rounded px-1" />
                      <input type="number" value={editRates.usd_cop} onChange={e=>setEditRates({...editRates, usd_cop:e.target.value})} placeholder="COP" className="w-14 sm:w-16 text-[10px] sm:text-xs border rounded px-1" />
                      <button onClick={() => saveRates(period)} className="text-green-600 active:scale-95 touch-manipulation"><Save className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                      <button onClick={cancelEdit} className="text-red-600 active:scale-95 touch-manipulation"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-start sm:justify-end gap-1 sm:gap-2 text-[10px] sm:text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] text-[9.5px] sm:text-[10.5px] font-bold text-blue-600 dark:text-[#5caaf5] tracking-wide drop-shadow-sm dark:drop-shadow-none">GBP→USD: <span className="font-bold text-gray-800 dark:text-gray-100 ml-0.5">{period.rates?.gbp_usd?.toFixed(4)}</span></span>
                      <span className="px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] text-[9.5px] sm:text-[10.5px] font-bold text-[rgba(74,188,150,0.9)] dark:text-[#2dd4bf] tracking-wide drop-shadow-sm dark:drop-shadow-none">EUR→USD: <span className="font-bold text-gray-800 dark:text-gray-100 ml-0.5">{period.rates?.eur_usd?.toFixed(4)}</span></span>
                      <span className="px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] text-[9.5px] sm:text-[10.5px] font-bold text-purple-600 dark:text-[#c488fc] tracking-wide drop-shadow-sm dark:drop-shadow-none">USD→COP: <span className="font-bold text-gray-800 dark:text-gray-100 ml-0.5">{period.rates?.usd_cop?.toFixed(0)}</span></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contenedor Principal (GlassCard) */}
              <GlassCard className="p-4 sm:p-6 mb-0">

              <div className="mb-4">
                {period.is_synthetic ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4 text-center">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-medium">
                      Este período fue reconstruido desde totales consolidados
                    </p>
                    <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1">
                      No hay desglose por plataforma disponible. Solo se muestran los totales.
                    </p>
                  </div>
                ) : (
                  <>
                  {/* Layout Unificado (Desktop & Mobile) idéntico a Calculadora */}
                  <div className="space-y-2 mt-4 sm:mt-6">
                    {period.platforms.filter(p=>p.value>0).map(p => {
                      const isTokens = ['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes((p.platform_id || '').toLowerCase() || p.platform_name.toLowerCase());
                      const displayCurrency = isTokens ? 'TKN' : (p.platform_currency || 'USD');
                      const displayValue = isTokens ? Math.round(p.value).toString() : `$ ${formatNumberOnly(p.value)}`;
                      const computedRates = computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80);
                      const displayUsdModelo = editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? computedRates.usdModelo : (p.value_usd_modelo||0);
                      const displayCopModelo = editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? computedRates.copModelo : (p.value_cop_modelo||0);

                      return (
                    <div key={p.platform_id} className="relative bg-black/[0.04] dark:bg-[#0a0a0c]/60 backdrop-blur-2xl border border-white/30 dark:border-white/[0.06] rounded-[0.85rem] p-2.5 sm:p-3 shadow-sm shadow-black/5 dark:shadow-none transition-all hover:bg-black/[0.06] dark:hover:bg-[#0a0a0c]/80">
                      <div className="flex items-end justify-between gap-2 sm:gap-4 w-full">
                        
                        {/* Izquierda: Nombre e insignias */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                          {/* 1. Porcentaje (SOLO ESCRITORIO) */}
                          <div className="hidden sm:flex text-[8.5px] uppercase font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.02] px-1.5 py-[2px] rounded tracking-wider items-center justify-center shrink-0">
                            {p.platform_id === 'superfoon' ? '100%' : `${p.platform_percentage}%`}
                          </div>
                          
                          {/* 2. Divisa (Unificado para Móvil y Escritorio) */}
                          <span className={`flex text-[8.5px] uppercase font-bold px-1.5 py-[2px] rounded items-center justify-center shrink-0 ${
                            p.platform_currency === 'EUR' ? 'bg-emerald-100/60 dark:bg-[#2dd4bf]/15 text-emerald-700 dark:text-[#2dd4bf]' :
                            p.platform_currency === 'GBP' ? 'bg-blue-100/60 dark:bg-[#5caaf5]/15 text-blue-700 dark:text-[#5caaf5]' :
                            'bg-purple-100/60 dark:bg-[#c488fc]/15 text-purple-700 dark:text-[#c488fc]'
                          }`}>
                            {displayCurrency}
                          </span>

                          <span className="font-bold text-[13.5px] sm:text-[14px] text-gray-800 dark:text-gray-300 uppercase tracking-wide truncate">
                            {p.platform_name}
                          </span>
                        </div>

                        {/* Derecha: Input y Resultados */}
                        <div className="flex items-end justify-end gap-3 sm:gap-[40px] shrink-0">
                          {/* 1. Valor Original Edit/Read */}
                          <div className="flex items-end sm:translate-y-[2px]">
                            <div className="flex flex-col items-start justify-end min-w-[66px] sm:min-w-[70px] pr-2 border-r border-gray-200 dark:border-white/10">
                              <span className="hidden sm:block whitespace-nowrap text-[8px] sm:text-[9.5px] font-bold opacity-0 mb-[1px] sm:mb-[2px] select-none" aria-hidden="true">-</span>
                              {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? (
                                  <input type="number" value={editValue} onChange={e=>setEditValue(e.target.value)} className="w-[66px] h-[26px] sm:h-[28px] bg-white dark:bg-gray-800 border border-black/[0.1] dark:border-white/20 rounded-md px-1.5 text-[12px] sm:text-[13px] font-bold text-gray-900 dark:text-gray-100 text-left sm:mb-0 tabular-nums" />
                              ) : (
                                  <div className="flex items-center justify-start gap-[3px] text-[13px] sm:text-[13px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:mb-0 tabular-nums">
                                    <span className={isTokens ? "opacity-0 select-none" : "font-normal"}>$</span>
                                    <span>{isTokens ? Math.round(p.value).toString() : formatNumberOnly(p.value)}</span>
                                  </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Resultados (USD Mod y COP Mod agrupados) */}
                          <div 
                            className="flex items-end cursor-pointer sm:cursor-default"
                            onClick={() => {
                              if (window.innerWidth < 640) {
                                setMobileCarouselSide(prev => prev === 'cop' ? 'usd' : 'cop');
                              }
                            }}
                          >
                            {/* --- VISTA DESKTOP --- */}
                            <div className="hidden sm:flex items-end">
                              {/* USD Mod */}
                              <div className="flex flex-col items-start w-[100px] flex-shrink-0 pr-3 border-r border-gray-200 dark:border-white/10">
                                <span className="whitespace-nowrap text-[9.5px] uppercase font-bold text-emerald-600 dark:text-[#2dd4bf] opacity-80 tracking-widest mb-[2px]">USD MOD</span>
                                <div className="flex items-center justify-start gap-[3px] text-[13px] tracking-tight text-emerald-600 dark:text-[#2dd4bf] font-semibold tabular-nums">
                                  <span className="font-normal">$</span>
                                  <span>{formatNumberOnly(displayUsdModelo)}</span>
                                </div>
                              </div>
                              {/* COP Mod */}
                              <div className="flex flex-col items-start w-[100px] flex-shrink-0 pl-3">
                                <span className="block whitespace-nowrap text-[9.5px] uppercase font-bold text-purple-600 dark:text-[#c488fc] opacity-80 tracking-widest mb-[2px]">GANANCIAS</span>
                                <div className="flex items-center justify-start gap-[3px] text-[13px] tracking-tight text-purple-700 dark:text-[#c488fc] font-semibold tabular-nums">
                                  <span className="font-normal">$</span>
                                  <span>{displayCopModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                </div>
                              </div>
                            </div>

                            {/* --- VISTA MÓVIL (CARRUSEL) --- */}
                            <div className="sm:hidden relative overflow-hidden min-w-[74px] w-[74px] h-[34px] flex-shrink-0">
                              <div className={`absolute top-0 left-0 w-full flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${mobileCarouselSide === 'usd' ? '-translate-y-1/2' : 'translate-y-0'}`}>
                                {/* Slide 1: COP Mod */}
                                <div className="h-[34px] flex flex-col items-start justify-end">
                                  <span className="block whitespace-nowrap text-[8px] uppercase font-bold text-purple-600 dark:text-[#c488fc] opacity-80 tracking-widest mb-[1px]">GANANCIAS</span>
                                  <div className="flex items-center justify-start gap-[3px] text-[12.5px] tracking-tight text-purple-700 dark:text-[#c488fc] font-semibold tabular-nums">
                                    <span className="font-normal">$</span>
                                    <span>{displayCopModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                  </div>
                                </div>
                                {/* Slide 2: USD Mod */}
                                <div className="h-[34px] flex flex-col items-start justify-end">
                                  <span className="block whitespace-nowrap text-[8px] uppercase font-bold text-emerald-600 dark:text-[#2dd4bf] opacity-80 tracking-widest mb-[1px]">USD MOD</span>
                                  <div className="flex items-center justify-start gap-[3px] text-[12.5px] tracking-tight text-emerald-600 dark:text-[#2dd4bf] font-semibold tabular-nums">
                                    <span className="font-normal">$</span>
                                    <span>{formatNumberOnly(displayUsdModelo)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {isAdmin && (
                            <div className="flex items-center gap-2 pl-2">
                              {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? (
                                <>
                                  <button onClick={()=>savePlatformValue(periodKey, p.platform_id)} className="text-green-600 hover:scale-110 transition-transform"><Save className="w-4 h-4"/></button>
                                  <button onClick={cancelEdit} className="text-red-500 hover:scale-110 transition-transform"><X className="w-4 h-4"/></button>
                                </>
                              ) : (
                                <button onClick={()=>startEditPlatform(periodKey, p.platform_id, p.value)} className="text-blue-500 opacity-60 hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4"/></button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                      );
                    })}
                  </div>
                  </>
                )}
              </div>

              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                {(() => {
                  const isEditingThisPeriod = editingPlatform?.periodKey === periodKey;
                  const displayTotalUsdModelo = isEditingThisPeriod && editingPlatform
                    ? period.platforms.reduce((acc, p) => acc + (p.platform_id === editingPlatform.platformId
                        ? computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80).usdModelo
                        : (p.value_usd_modelo || 0)), 0)
                    : (period.total_usd_modelo || 0);
                  const displayTotalCopModelo = isEditingThisPeriod && editingPlatform
                    ? period.platforms.reduce((acc, p) => acc + (p.platform_id === editingPlatform.platformId
                        ? computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80).copModelo
                        : (p.value_cop_modelo || 0)), 0)
                    : (period.total_cop_modelo || 0);
                  const displayNetoPagar = period.neto_pagar !== undefined
                    ? period.neto_pagar - (period.total_cop_modelo || 0) + displayTotalCopModelo
                    : displayTotalCopModelo;
                  return (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">USD Modelo</div>
                    <div className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(displayTotalUsdModelo, 'USD')}</div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/40 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-blue-100 dark:border-blue-800/50">
                    {((period.total_anticipos || 0) > 0 || (period.deducciones && period.deducciones.length > 0) || (isAdmin && addingDeductionFor === periodKey)) && (
                      <div className="flex justify-between items-center mb-0.5 sm:mb-1">
                        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Sin Deducciones</span>
                        <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(displayTotalCopModelo, 'COP')}</span>
                      </div>
                    )}

                    {(period.total_anticipos || 0) > 0 && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1"><span>(-)</span> Anticipos</span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">- {formatCurrency(period.total_anticipos || 0, 'COP')}</span>
                      </div>
                    )}

                    {(period.deducciones && period.deducciones.length > 0) || (isAdmin && addingDeductionFor === periodKey) ? (
                      <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 border-dashed">
                        {period.deducciones?.map(d => (
                          <div key={d.id} className="flex justify-between items-center mb-1 group hover:bg-white/50 dark:hover:bg-gray-700/30 p-1 rounded">
                            <div className="flex items-center gap-2">
                              {/* 🔧 LÓGICA DE VISUALIZACIÓN DEDUCCIÓN vs EXCEDENTE */}
                              {d.amount > 0 ? (
                                <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  <span>(-)</span> {d.concept}
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                  <span>(+)</span> {d.concept}
                                </span>
                              )}
                              
                              {isAdmin && (
                                <button onClick={() => handleDeleteDeduction(d.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity" title="Eliminar">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {/* Si es positivo es deducción (Rojo/Naranja). Si es negativo es excedente (Verde) */}
                            {d.amount > 0 ? (
                              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">- {formatCurrency(d.amount, 'COP')}</span>
                            ) : (
                              <span className="text-sm font-medium text-green-600 dark:text-green-400">+ {formatCurrency(Math.abs(d.amount), 'COP')}</span>
                            )}
                          </div>
                        ))}
                        
                        {isAdmin && addingDeductionFor === periodKey && (
                          <div className="mt-2 bg-white dark:bg-gray-700 p-2 rounded border border-orange-200 dark:border-orange-500/30 shadow-sm">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex justify-between items-center">
                              <span>Nueva entrada</span>
                              {/* 🔧 DROPDOWN TIPO DE AJUSTE */}
                              <select 
                                value={deductionType}
                                onChange={(e) => setDeductionType(e.target.value as 'deduction' | 'bonus')}
                                className="text-xs border rounded bg-gray-50 dark:bg-gray-800 dark:text-white border-gray-300 dark:border-gray-600 px-1 py-0.5"
                              >
                                <option value="deduction">Deducción (-)</option>
                                <option value="bonus">Excedente (+)</option>
                              </select>
                            </div>
                            <div className="flex gap-2 mb-2">
                              <input 
                                type="text" 
                                placeholder={deductionType === 'deduction' ? "Concepto (ej: Multa)" : "Concepto (ej: Bono)"}
                                className="flex-1 text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
                                value={newDeduction.concept}
                                onChange={e => setNewDeduction({...newDeduction, concept: e.target.value})}
                              />
                              <input 
                                type="number" 
                                placeholder="Monto" 
                                className="w-24 text-xs border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
                                value={newDeduction.amount}
                                onChange={e => setNewDeduction({...newDeduction, amount: e.target.value})}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setAddingDeductionFor(null); setDeductionType('deduction'); }} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1">Cancelar</button>
                              <button 
                                onClick={() => handleAddDeduction(period)} 
                                disabled={!newDeduction.concept || !newDeduction.amount}
                                className={`text-xs text-white px-2 py-1 rounded disabled:opacity-50 ${deductionType === 'deduction' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {isAdmin && addingDeductionFor !== periodKey && (
                      <div className="mb-2 text-right">
                        <button 
                          onClick={() => { setAddingDeductionFor(periodKey); setNewDeduction({concept: '', amount: ''}); setDeductionType('deduction'); }}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Agregar ajuste
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-white/[0.08]">
                      <span className="text-sm sm:text-base font-bold text-blue-900 dark:text-white uppercase tracking-wider">En tu sobre</span>
                      <span className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(129,140,248,0.5)]">
                        {formatCurrency(displayNetoPagar, 'COP')}
                      </span>
                    </div>
                  </div>

                  {/* Solicitudes de Ahorro Pendientes (Admin y Modelo ven el card, pero solo Admin acciona) */}
                  {period.pending_savings && period.pending_savings.length > 0 && (
                    <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-fuchsia-500/10 p-4 rounded-xl border border-indigo-400/20 backdrop-blur-md mt-3 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse"></div>
                        <span className="text-xs sm:text-sm font-bold text-fuchsia-400 uppercase tracking-widest">SOLICITUD DE AHORRO</span>
                      </div>
                      
                      {period.pending_savings.map((saving: any) => (
                        <div key={saving.id} className="bg-black/20 dark:bg-black/30 rounded-lg p-3 sm:p-4 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-200">Monto Ahorro Solicitado:</span>
                            <span className="text-lg font-black bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">
                              {formatCurrency(parseFloat(saving.monto_ahorrado), 'COP')}
                            </span>
                            <span className="text-xs text-gray-400 mt-1">({parseFloat(saving.porcentaje_ahorrado).toFixed(2)}% del Neto A Pagar)</span>
                          </div>
                          
                          {isAdmin ? (
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button 
                                onClick={() => handleRejectSaving(saving.id, periodKey)}
                                disabled={saving}
                                className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-600 transition-colors"
                              >
                                Declinar
                              </button>
                              <button 
                                onClick={() => handleApproveSaving(saving.id, periodKey)}
                                disabled={saving}
                                className="relative overflow-hidden flex-1 sm:flex-none px-6 py-2 text-xs font-bold rounded-lg text-white group bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 shadow-lg shadow-fuchsia-500/20 active:scale-95 transition-all duration-300"
                              >
                                <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                                  background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                                  backgroundSize: '200% 100%',
                                  animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
                                }}></div>
                                <span className="relative z-10">Aprobar Ahorro</span>
                              </button>
                            </div>
                          ) : (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-lg">
                              <span className="text-xs font-semibold text-yellow-400 animate-pulse">Pendiente de Aprobación</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Componente ObjectiveBorealCard (Esencia de Mi Calculadora) */}
                <div className="mt-4">
                  <ObjectiveBorealCard 
                    totalUsdBruto={period.total_usd_bruto || 0}
                    cuotaMinima={period.cuota_minima || 0}
                    periodGoal={null} 
                    netoDisponibleCop={displayNetoPagar}
                    isHistorical={true}
                  />
                </div>
                </>
                  );
                })()}
              </div>
            </GlassCard>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
