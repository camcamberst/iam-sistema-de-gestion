'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { History, ArrowLeft, Calendar, DollarSign, Edit2, Save, X, AlertTriangle, CheckCircle, Info, Plus, Trash2 } from 'lucide-react';
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from '@/components/ui/PageHeader';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';
import GlassCard from '@/components/ui/GlassCard';

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

      if (data.success) {
        setAllPeriods(data.periods || []);
        setPeriods(data.periods || []);
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

        if (!data.success) { setError(data.error); return; }

        const loadedPeriods = data.periods || [];
        
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

  if (loading) return (
    <div className="min-h-screen relative w-full overflow-hidden flex justify-center items-center">
      <ModelAuroraBackground />
      <div className="text-center relative z-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-300">Cargando historial...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-6xl mx-auto max-sm:px-0 sm:px-6 lg:px-20 xl:px-32 pb-4 sm:pb-2 pt-6 sm:pt-2 relative z-10">
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

      {/* Filtros Independientes */}
      <div className="mb-6 sm:mb-8 px-4 sm:px-6 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
        <div className="flex-shrink-0">
          <label className="block text-[10px] sm:text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300 ml-1">Año</label>
          <AppleDropdown options={availableYears} value={selectedYear} onChange={setSelectedYear} placeholder="Año" className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm" />
        </div>
        <div className="flex-shrink-0">
          <label className="block text-[10px] sm:text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300 ml-1">Mes</label>
          <AppleDropdown options={availableMonths} value={selectedMonth} onChange={setSelectedMonth} placeholder="Mes" className="min-w-[110px] sm:min-w-[130px] text-xs sm:text-sm" />
        </div>
        <div className="flex-shrink-0">
          <label className="block text-[10px] sm:text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300 ml-1">Período</label>
          <AppleDropdown options={[{value:'1-15',label:'P1'},{value:'16-31',label:'P2'}]} value={selectedPeriodType} onChange={setSelectedPeriodType} placeholder="Período" className="min-w-[90px] sm:min-w-[110px] text-xs sm:text-sm" />
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4 text-center border border-red-100 dark:border-red-800">{error}</div>}
      
      {!error && filteredPeriods.length === 0 && (
        <div className="px-4 sm:px-0 flex justify-center">
          <div className="w-full max-w-xl">
            <GlassCard padding="lg" className="text-center border-dashed border-2 border-gray-300/50 dark:border-gray-700/50 bg-white/40 dark:bg-gray-800/20 shadow-none mx-auto">
              <History className="w-16 h-16 text-gray-400/80 dark:text-gray-500/80 mx-auto mb-4" strokeWidth={1.5} />
              <h3 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">No hay datos</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mt-1">Selecciona un período válido con los filtros.</p>
            </GlassCard>
          </div>
        </div>
      )}

      {!error && filteredPeriods.length > 0 && (
        <div className="space-y-6">
          {filteredPeriods.map((period) => {
            const periodKey = `${period.period_date}-${period.period_type}`;
            return (
            <div key={periodKey} className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-2xl rounded-3xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-900/5 dark:shadow-black/20 p-4 sm:p-6">
              {/* Header del período */}
              <div className="flex flex-col sm:flex-row sm:justify-between mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-white/[0.06] gap-3 sm:gap-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 rounded-xl flex items-center justify-center shadow-[0_0_16px_rgba(99,102,241,0.3)] flex-shrink-0"><Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-white truncate">{formatPeriodMonth(period.period_date, period.period_type)}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-400">{formatArchivedDate(period.archived_at)}</p>
                    {period.is_synthetic && (
                      <p className="text-[10px] sm:text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="truncate">{period.synthetic_note || 'Período reconstruido desde totales (sin desglose por plataforma)'}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="ml-0 sm:ml-4">
                  <div className="flex items-center justify-start sm:justify-end gap-1.5 sm:gap-2 mb-2">
                    <div className="text-[10px] sm:text-xs font-semibold uppercase text-gray-400 tracking-wider">RATES</div>
                    {isAdmin && editingRates !== periodKey && (
                      <button onClick={() => startEditRates(period)} className="text-[10px] sm:text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95 touch-manipulation transition-colors"><Edit2 className="w-3 h-3" />Editar</button>
                    )}
                  </div>
                  {editingRates === periodKey ? (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <input type="number" value={editRates.eur_usd} onChange={e=>setEditRates({...editRates, eur_usd:e.target.value})} placeholder="EUR" className="w-14 sm:w-16 text-[10px] sm:text-xs rounded-lg px-2 py-1 bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500" />
                      <input type="number" value={editRates.gbp_usd} onChange={e=>setEditRates({...editRates, gbp_usd:e.target.value})} placeholder="GBP" className="w-14 sm:w-16 text-[10px] sm:text-xs rounded-lg px-2 py-1 bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500" />
                      <input type="number" value={editRates.usd_cop} onChange={e=>setEditRates({...editRates, usd_cop:e.target.value})} placeholder="COP" className="w-14 sm:w-16 text-[10px] sm:text-xs rounded-lg px-2 py-1 bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500" />
                      <button onClick={() => saveRates(period)} className="text-green-400 hover:text-green-300 active:scale-95 touch-manipulation transition-colors"><Save className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                      <button onClick={cancelEdit} className="text-red-400 hover:text-red-300 active:scale-95 touch-manipulation transition-colors"><X className="w-3.5 h-3.5 sm:w-4 sm:h-4"/></button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                      <span className="bg-white/[0.06] backdrop-blur-sm px-2 sm:px-2.5 py-1 rounded-lg text-indigo-300 border border-indigo-500/20">EUR→USD: {period.rates?.eur_usd?.toFixed(4)}</span>
                      <span className="bg-white/[0.06] backdrop-blur-sm px-2 sm:px-2.5 py-1 rounded-lg text-indigo-300 border border-indigo-500/20">GBP→USD: {period.rates?.gbp_usd?.toFixed(4)}</span>
                      <span className="bg-white/[0.06] backdrop-blur-sm px-2 sm:px-2.5 py-1 rounded-lg text-indigo-300 border border-indigo-500/20">USD→COP: {period.rates?.usd_cop?.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                {period.is_synthetic ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 sm:p-4 text-center backdrop-blur-sm">
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm text-amber-300 font-medium">
                      Este período fue reconstruido desde totales consolidados
                    </p>
                    <p className="text-[10px] sm:text-xs text-amber-400/70 mt-1">
                      No hay desglose por plataforma disponible. Solo se muestran los totales.
                    </p>
                  </div>
                ) : (
                  <>
                  {/* Vista de Cards para Móvil */}
                  <div className="md:hidden space-y-2">
                    {period.platforms.filter(p=>p.value>0).map(p => (
                      <div key={p.platform_id} className="p-3 bg-white/[0.04] rounded-xl border border-white/[0.06] flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[14px] leading-none text-white uppercase tracking-wide">
                            {p.platform_name}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/5 text-gray-400 border border-white/10">
                              {p.platform_percentage}%
                            </span>
                            {isAdmin && (
                              <div className="flex-shrink-0">
                                {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? (
                                  <div className="flex gap-2">
                                    <button onClick={()=>savePlatformValue(periodKey, p.platform_id)} className="text-green-400 active:scale-95 touch-manipulation"><Save className="w-3.5 h-3.5"/></button>
                                    <button onClick={cancelEdit} className="text-red-400 active:scale-95 touch-manipulation"><X className="w-3.5 h-3.5"/></button>
                                  </div>
                                ) : (
                                  <button onClick={()=>startEditPlatform(periodKey, p.platform_id, p.value)} className="text-indigo-400 hover:text-indigo-300 active:scale-95 touch-manipulation"><Edit2 className="w-3.5 h-3.5"/></button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fila 2: Valores */}
                        <div className="flex items-center gap-2 justify-between">
                          {/* Input / Valor original */}
                          <div className="flex items-center">
                            {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? (
                              <div className="flex items-center gap-1.5">
                                <input type="number" value={editValue} onChange={e=>setEditValue(e.target.value)} className="w-[72px] px-2 py-1 text-[13px] font-bold tabular-nums rounded bg-white/[0.06] border border-white/[0.1] text-white focus:outline-none focus:border-indigo-500/50" />
                                <span className="text-[10px] text-gray-500 font-bold">{p.platform_currency}</span>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1">
                                <span className="text-[14px] font-bold tabular-nums text-gray-200">{formatNumberOnly(p.value)}</span>
                                <span className="text-[10px] font-bold text-gray-500">{p.platform_currency}</span>
                              </div>
                            )}
                          </div>

                          {/* Dólares y COP */}
                          <div className="flex items-center gap-2.5 sm:gap-3 text-right">
                            <div className="flex flex-col justify-center min-w-[65px]">
                              <span className="text-[8px] uppercase tracking-wider text-emerald-500/70 leading-none mb-0.5">USD Mod</span>
                              <span className="text-xs font-semibold tabular-nums tracking-tight text-emerald-400 leading-none">
                                {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id
                                  ? formatCurrency(computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80).usdModelo, 'USD')
                                  : formatCurrency(p.value_usd_modelo||0, 'USD')}
                              </span>
                            </div>
                            <div className="w-[1px] h-6 bg-white/10 shrink-0"></div>
                            <div className="flex flex-col justify-center min-w-[75px]">
                              <span className="text-[8px] uppercase tracking-wider text-purple-400/70 leading-none mb-0.5">COP Mod</span>
                              <span className="text-[13px] font-bold tabular-nums tracking-tight text-purple-400 leading-none">
                                {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id
                                  ? formatCurrency(computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80).copModelo, 'COP').replace(',00', '')
                                  : formatCurrency(p.value_cop_modelo||0, 'COP').replace(',00', '')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Vista de Tabla para Desktop */}
                  <div className="hidden md:block overflow-x-auto bg-white/[0.03] rounded-xl border border-white/[0.06] p-1">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f8f9fa] dark:bg-white/[0.03]">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider rounded-tl-xl w-[25%]">Plataformas</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider w-[25%]">Valores</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider w-[25%]">Dólares</th>
                          <th className="text-center py-3 px-4 font-semibold text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-wider rounded-tr-xl w-[25%]">COP Modelo</th>
                          {isAdmin && <th className="w-[40px]"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {period.platforms.filter(p=>p.value>0).map(p => (
                        <tr key={p.platform_id} className="border-b border-gray-200/50 dark:border-white/5 transition-all duration-300 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className="font-semibold tracking-tight text-[15px] text-gray-900 dark:text-white">{p.platform_name}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">Reparto: {p.platform_percentage}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-flex items-center justify-center w-[44px] h-[26px] text-gray-500 dark:text-gray-400 text-[11px] font-semibold tracking-wide bg-gray-50/50 dark:bg-white/5 rounded-lg border border-gray-200/60 dark:border-white/5 shrink-0">{p.platform_currency}</span>
                              {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? (
                                <input type="number" value={editValue} onChange={e=>setEditValue(e.target.value)} className="w-20 rounded-lg px-2 py-1 text-xs bg-white/[0.06] border border-white/[0.1] text-white" />
                              ) : (
                                <span className="w-[90px] text-left font-semibold text-[14px] tabular-nums text-gray-900 dark:text-white">{formatNumberOnly(p.value)}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-flex items-center justify-center w-[44px] h-[26px] text-gray-500 dark:text-gray-400 text-[11px] font-semibold tracking-wide bg-gray-50/50 dark:bg-white/5 rounded-lg border border-gray-200/60 dark:border-white/5 shrink-0">USD</span>
                              <span className="w-[90px] text-left font-semibold text-[14px] tabular-nums text-gray-900 dark:text-white">
                                {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id
                                  ? `$${computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80).usdModelo.toFixed(2)}`
                                  : `$${(p.value_usd_modelo||0).toFixed(2)}`}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-flex items-center justify-center w-[44px] h-[26px] text-gray-500 dark:text-gray-400 text-[11px] font-semibold tracking-wide bg-gray-50/50 dark:bg-white/5 rounded-lg border border-gray-200/60 dark:border-white/5 shrink-0">COP</span>
                              <span className="w-[110px] text-left font-semibold text-[14px] tabular-nums text-gray-900 dark:text-white">
                                {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id
                                  ? `$${computeUsdCopFromValue(Number(editValue) || 0, p.platform_id, p.platform_currency, period.rates || {}, p.platform_percentage ?? 80).copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                  : `$${(p.value_cop_modelo||0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                              </span>
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4">
                              {editingPlatform?.periodKey === periodKey && editingPlatform?.platformId === p.platform_id ? (
                                <div className="flex gap-1"><button onClick={()=>savePlatformValue(periodKey, p.platform_id)} className="text-green-400"><Save className="w-3 h-3"/></button><button onClick={cancelEdit} className="text-red-400"><X className="w-3 h-3"/></button></div>
                              ) : (
                                <button onClick={()=>startEditPlatform(periodKey, p.platform_id, p.value)} className="text-indigo-400 hover:text-indigo-300 transition-colors"><Edit2 className="w-3 h-3"/></button>
                              )}
                            </td>
                          )}
                        </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>

              {/* Totales / Resumen */}
              <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/[0.06]">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  {/* Card USD Modelo */}
                  <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 p-3 sm:p-4 rounded-xl border border-emerald-500/15 backdrop-blur-sm flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">USD Modelo</span>
                    <span className="text-xs sm:text-sm font-semibold text-emerald-400/90">{formatCurrency(displayTotalUsdModelo, 'USD').replace('US$', '$')}</span>
                  </div>

                  {/* Card COP + Anticipos + Neto */}
                  <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-3 sm:p-4 rounded-xl border border-indigo-500/15 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider font-medium">COP Generado</span>
                      <span className="text-xs sm:text-sm font-semibold text-gray-300">{formatCurrency(displayTotalCopModelo, 'COP')}</span>
                    </div>

                    {(period.total_anticipos || 0) > 0 && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-red-400 flex items-center gap-1"><span>(-)</span> Anticipos</span>
                        <span className="text-sm font-medium text-red-400">- {formatCurrency(period.total_anticipos || 0, 'COP')}</span>
                      </div>
                    )}

                    {(period.deducciones && period.deducciones.length > 0) || (isAdmin && addingDeductionFor === periodKey) ? (
                      <div className="mb-2 pb-2 border-b border-white/[0.06] border-dashed">
                        {period.deducciones?.map(d => (
                          <div key={d.id} className="flex justify-between items-center mb-1 group hover:bg-white/[0.04] p-1 rounded-lg transition-colors">
                            <div className="flex items-center gap-2">
                              {d.amount > 0 ? (
                                <span className="text-xs text-orange-400 flex items-center gap-1">
                                  <span>(-)</span> {d.concept}
                                </span>
                              ) : (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                  <span>(+)</span> {d.concept}
                                </span>
                              )}
                              
                              {isAdmin && (
                                <button onClick={() => handleDeleteDeduction(d.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity" title="Eliminar">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {d.amount > 0 ? (
                              <span className="text-sm font-medium text-orange-400">- {formatCurrency(d.amount, 'COP')}</span>
                            ) : (
                              <span className="text-sm font-medium text-green-400">+ {formatCurrency(Math.abs(d.amount), 'COP')}</span>
                            )}
                          </div>
                        ))}
                        
                        {isAdmin && addingDeductionFor === periodKey && (
                          <div className="mt-2 bg-white/[0.04] p-2.5 rounded-xl border border-orange-500/20">
                            <div className="text-xs font-medium text-gray-300 mb-1 flex justify-between items-center">
                              <span>Nueva entrada</span>
                              <select 
                                value={deductionType}
                                onChange={(e) => setDeductionType(e.target.value as 'deduction' | 'bonus')}
                                className="text-xs rounded-lg bg-white/[0.06] border border-white/[0.1] text-white px-2 py-0.5"
                              >
                                <option value="deduction">Deducción (-)</option>
                                <option value="bonus">Excedente (+)</option>
                              </select>
                            </div>
                            <div className="flex gap-2 mb-2">
                              <input 
                                type="text" 
                                placeholder={deductionType === 'deduction' ? "Concepto (ej: Multa)" : "Concepto (ej: Bono)"}
                                className="flex-1 text-xs rounded-lg px-2 py-1.5 bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500"
                                value={newDeduction.concept}
                                onChange={e => setNewDeduction({...newDeduction, concept: e.target.value})}
                              />
                              <input 
                                type="number" 
                                placeholder="Monto" 
                                className="w-24 text-xs rounded-lg px-2 py-1.5 bg-white/[0.06] border border-white/[0.1] text-white placeholder-gray-500"
                                value={newDeduction.amount}
                                onChange={e => setNewDeduction({...newDeduction, amount: e.target.value})}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setAddingDeductionFor(null); setDeductionType('deduction'); }} className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 transition-colors">Cancelar</button>
                              <button 
                                onClick={() => handleAddDeduction(period)} 
                                disabled={!newDeduction.concept || !newDeduction.amount}
                                className={`text-xs text-white px-3 py-1 rounded-lg disabled:opacity-50 font-medium transition-all ${deductionType === 'deduction' ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(251,146,60,0.3)]' : 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.3)]'}`}
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
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Agregar ajuste
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 mt-1 border-t border-white/[0.08]">
                      <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">Neto a Pagar</span>
                      <span className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(129,140,248,0.5)]">
                        {formatCurrency(displayNetoPagar, 'COP')}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Barra de objetivo */}
                <div className="bg-white/[0.04] p-3 sm:p-4 rounded-xl border border-white/[0.06] backdrop-blur-sm">
                   <div className="flex justify-between items-center mb-2.5">
                     <span className="text-sm font-medium text-gray-300">Objetivo <span className="text-gray-500">({formatCurrency(period.cuota_minima||0, 'USD')})</span></span>
                     <span className={`text-sm font-bold ${(period.porcentaje_alcanzado || 0) >= 100 ? 'text-emerald-400' : (period.porcentaje_alcanzado || 0) >= 70 ? 'text-blue-400' : 'text-pink-400'}`}>{period.porcentaje_alcanzado}%</span>
                   </div>
                   <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
                     <div 
                       className={`h-2.5 rounded-full transition-all duration-700 ease-out ${
                         (period.porcentaje_alcanzado || 0) >= 100 
                           ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]' 
                           : (period.porcentaje_alcanzado || 0) >= 70 
                             ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                             : 'bg-gradient-to-r from-pink-500 to-rose-400 shadow-[0_0_12px_rgba(244,114,182,0.4)]'
                       }`}  
                       style={{ width: `${Math.min(period.porcentaje_alcanzado||0, 100)}%` }}
                     ></div>
                   </div>
                </div>
                </>
                  );
                })()}
              </div>
            </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
