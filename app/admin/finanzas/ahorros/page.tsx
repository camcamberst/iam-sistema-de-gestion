"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from "@/components/ui/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import AppleSearchBar from '@/components/AppleSearchBar';
import AppleDatePicker from '@/components/ui/AppleDatePicker';
import StandardModal from '@/components/ui/StandardModal';
import { 
  Search, 
  Calendar, 
  DollarSign, 
  PiggyBank, 
  Percent, 
  Check, 
  X, 
  XCircle, 
  User, 
  SlidersHorizontal,
  Coins,
  TrendingUp
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Savings {
  id: string;
  period_date: string;
  period_type: '1-15' | '16-31';
  neto_pagar_base: number;
  monto_ahorrado: number;
  monto_ajustado?: number;
  porcentaje_ahorrado: number;
  tipo_solicitud: 'monto' | 'porcentaje';
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'cancelado';
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  model: {
    id: string;
    name: string;
    email: string;
    user_groups?: Array<{
      group_id: string;
      groups: {
        id: string;
        name: string;
      };
    }>;
  };
}

export default function GestionAhorrosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'rechazado'>('pendiente');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [grupos, setGrupos] = useState<Array<{id: string, name: string}>>([]);
  const [filteredSavings, setFilteredSavings] = useState<Savings[]>([]);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [periodoFiltro, setPeriodoFiltro] = useState<string>('todos');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const handleDropdownStateChange = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen);
  };

  const handleSearch = (query: string, filters: Record<string, string>) => {
    setSearchQuery(query);
    setGrupoFiltro(filters.group || 'todos');
    setPeriodoFiltro(filters.period || 'todos');
    setEstadoFiltro((filters.status as any) || 'pendiente');
  };

  const searchFiltersConfig = [
    ...(user?.role === 'super_admin' && grupos.length > 0 ? [{
      id: 'group',
      label: 'Grupo',
      value: grupoFiltro,
      options: [
        { value: 'todos', label: 'Todos los grupos' },
        ...grupos.map(g => ({ value: g.id, label: g.name }))
      ]
    }] : []),
    {
      id: 'period',
      label: 'Período',
      value: periodoFiltro,
      options: [
        { value: 'todos', label: 'Todos los períodos' },
        { value: '1-15', label: 'P1 (1-15)' },
        { value: '16-31', label: 'P2 (16-31)' }
      ]
    },
    {
      id: 'status',
      label: 'Estado',
      value: estadoFiltro,
      options: [
        { value: 'pendiente', label: 'Pendientes' },
        { value: 'aprobado', label: 'Aprobadas' },
        { value: 'rechazado', label: 'Rechazadas' },
        { value: 'todos', label: 'Todas' }
      ]
    }
  ];

  // Estados para aprobación/rechazo
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState<Savings | null>(null);
  const [montoAjustado, setMontoAjustado] = useState<string>('');
  const [comentarios, setComentarios] = useState<string>('');

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [modelsList, setModelsList] = useState<Array<{ id: string, name: string, email: string }>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustData, setAdjustData] = useState({
    model_id: '',
    tipo_ajuste: 'correccion' as 'correccion' | 'bono' | 'deduccion' | 'otro',
    concepto: '',
    monto: '',
    comentarios: ''
  });

  // Estados para meta activa en el modal de Ajuste Manual
  const [activeGoal, setActiveGoal] = useState<any | null>(null);
  const [loadingGoal, setLoadingGoal] = useState(false);
  const [cancelingGoal, setCancelingGoal] = useState(false);

  const loadActiveGoal = async (modelId: string) => {
    if (!modelId) {
      setActiveGoal(null);
      return;
    }

    try {
      setLoadingGoal(true);
      
      // 1. Fetch active goal
      const { data: goalData, error: fetchError } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('model_id', modelId)
        .eq('estado', 'activa')
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching savings goal:', fetchError);
        setActiveGoal(null);
        return;
      }

      if (!goalData) {
        setActiveGoal(null);
        return;
      }

      // 2. Calculate balance dynamically
      const { data: savingsData } = await supabase
        .from('model_savings')
        .select('monto_ahorrado, monto_ajustado')
        .eq('model_id', modelId)
        .eq('estado', 'aprobado');

      const totalAhorrado = (savingsData || []).reduce((sum: number, s: any) => {
        return sum + parseFloat(String(s.monto_ajustado || s.monto_ahorrado || 0));
      }, 0);

      const { data: adjustments } = await supabase
        .from('savings_adjustments')
        .select('monto')
        .eq('model_id', modelId);

      const totalAjustes = (adjustments || []).reduce((sum: number, a: any) => {
        return sum + parseFloat(String(a.monto || 0));
      }, 0);

      const { data: withdrawals } = await supabase
        .from('savings_withdrawals')
        .select('monto_solicitado')
        .eq('model_id', modelId)
        .eq('estado', 'realizado');

      const totalRetirado = (withdrawals || []).reduce((sum: number, w: any) => {
        return sum + parseFloat(String(w.monto_solicitado || 0));
      }, 0);

      const saldoActual = Math.max(0, totalAhorrado + totalAjustes - totalRetirado);

      setActiveGoal({
        ...goalData,
        saldoActual
      });

    } catch (err) {
      console.error('Error loading active goal:', err);
      setActiveGoal(null);
    } finally {
      setLoadingGoal(false);
    }
  };

  const handleCancelActiveGoal = async (goalId: string, goalName: string) => {
    if (!goalId) return;

    if (!confirm(`¿Estás seguro de que deseas cancelar la meta activa "${goalName}"? Esta acción liberará de forma inmediata todo el saldo comprometido de la modelo.`)) {
      return;
    }

    try {
      setCancelingGoal(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch(`/api/admin/savings/goals/${goalId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Ahorro programado "${goalName}" cancelado y fondos liberados exitosamente`);
        setActiveGoal(null);
        await loadSavings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al cancelar el ahorro programado');
      }
    } catch (err: any) {
      console.error('Error canceling goal:', err);
      setError(err.message || 'Error de conexión');
    } finally {
      setCancelingGoal(false);
    }
  };

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  const loadModels = async () => {
    try {
      setLoadingModels(true);
      const { data, error: modelsError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'modelo')
        .order('name');

      if (!modelsError && data) {
        setModelsList(data);
      }
    } catch (err) {
      console.error('Error loading models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleCreateAdjustment = async () => {
    if (!adjustData.model_id || !adjustData.concepto || !adjustData.monto) {
      setError('Por favor completa todos los campos obligatorios del ajuste');
      return;
    }

    setAdjusting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const rawMonto = parseFloat(adjustData.monto.replace(/[^\d-]/g, ''));
      if (isNaN(rawMonto) || rawMonto === 0) {
        setError('El monto del ajuste debe ser diferente de 0');
        return;
      }

      const response = await fetch('/api/admin/savings/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model_id: adjustData.model_id,
          tipo_ajuste: adjustData.tipo_ajuste,
          concepto: adjustData.concepto,
          monto: rawMonto,
          comentarios: adjustData.comentarios,
          admin_id: user?.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Ajuste de saldo manual creado y notificado con éxito');
        setShowAdjustModal(false);
        setAdjustData({
          model_id: '',
          tipo_ajuste: 'correccion',
          concepto: '',
          monto: '',
          comentarios: ''
        });
        await loadSavings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al crear el ajuste manual');
      }
    } catch (err: any) {
      console.error('Error creating adjustment:', err);
      setError(err.message || 'Error de conexión');
    } finally {
      setAdjusting(false);
    }
  };

  const renderEstadoPill = (estado: Savings['estado']) => {
    // Definimos estilos glassmorphism premium de la Biblia
    const basePillClass = "h-[22px] px-2.5 rounded-full inline-flex items-center justify-center select-none shadow-sm backdrop-blur-sm text-[10px] sm:text-[11px] font-bold tracking-wide uppercase border";
    
    if (estado === 'pendiente') {
      return (
        <span className={`${basePillClass} bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 gap-1.5`}>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
          </span>
          Pendiente
        </span>
      );
    }
    
    if (estado === 'aprobado') {
      return (
        <span className={`${basePillClass} bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1`}>
          <Check className="w-3 h-3 shrink-0" />
          Aprobado
        </span>
      );
    }
    
    if (estado === 'rechazado') {
      return (
        <span className={`${basePillClass} bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 gap-1`}>
          <X className="w-3 h-3 shrink-0" />
          Rechazado
        </span>
      );
    }

    // fallback / cancelado
    return (
      <span className={`${basePillClass} bg-gray-500/10 border-gray-500/20 text-gray-600 dark:text-gray-400 gap-1`}>
        <XCircle className="w-3 h-3 shrink-0" />
        Cancelado
      </span>
    );
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadSavings();
      loadGroups();
      loadModels();
    }
  }, [user, estadoFiltro]);

  useEffect(() => {
    if (savings.length > 0 || searchQuery || grupoFiltro !== 'todos' || fechaDesde || fechaHasta || periodoFiltro !== 'todos') {
      applyFilters(savings, searchQuery, grupoFiltro, fechaDesde, fechaHasta, periodoFiltro);
    } else {
      setFilteredSavings(savings);
    }
  }, [searchQuery, grupoFiltro, savings, fechaDesde, fechaHasta, periodoFiltro]);

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

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        router.push('/login');
        return;
      }

      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadSavings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const estadoParam = estadoFiltro === 'todos' ? '' : estadoFiltro;
      const response = await fetch(`/api/admin/savings?estado=${estadoParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        const savingsData = data.savings || [];
        setSavings(savingsData);
        applyFilters(savingsData, searchQuery, grupoFiltro, fechaDesde, fechaHasta, periodoFiltro);
      } else {
        setError(data.error || 'Error al cargar solicitudes');
      }
    } catch (error) {
      console.error('Error loading savings:', error);
      setError('Error de conexión');
    }
  };

  const loadGroups = async () => {
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');

      if (!groupsError && groupsData) {
        setGrupos(groupsData);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const applyFilters = (
    savingsList: Savings[], 
    query: string, 
    grupo: string, 
    desde: string, 
    hasta: string, 
    periodo: string
  ) => {
    let filtered = [...savingsList];

    // Filtro por búsqueda de texto (nombre o email de modelo)
    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      filtered = filtered.filter(s => 
        s.model.name.toLowerCase().includes(searchTerm) ||
        s.model.email.toLowerCase().includes(searchTerm)
      );
    }

    // Filtro por grupo
    if (grupo !== 'todos') {
      filtered = filtered.filter(s => {
        const modelGroups = s.model.user_groups || [];
        return modelGroups.some(ug => ug.groups?.id === grupo);
      });
    }

    // Filtro por fecha desde
    if (desde) {
      const desdeDate = new Date(desde);
      filtered = filtered.filter(s => {
        const createdDate = new Date(s.created_at);
        return createdDate >= desdeDate;
      });
    }

    // Filtro por fecha hasta
    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setHours(23, 59, 59, 999); // Incluir todo el día
      filtered = filtered.filter(s => {
        const createdDate = new Date(s.created_at);
        return createdDate <= hastaDate;
      });
    }

    // Filtro por período
    if (periodo !== 'todos') {
      filtered = filtered.filter(s => s.period_type === periodo);
    }

    setFilteredSavings(filtered);
  };

  const handleApprove = async () => {
    if (!selectedSavings || !user) {
      setError('No hay solicitud seleccionada');
      return;
    }

    setProcessing(selectedSavings.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const montoAjustadoNum = montoAjustado ? parseFloat(montoAjustado.replace(/[^\d]/g, '')) : undefined;

      const response = await fetch(`/api/admin/savings/${selectedSavings.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: 'aprobado',
          comentarios_admin: comentarios,
          monto_ajustado: montoAjustadoNum,
          admin_id: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Solicitud de ahorro aprobada exitosamente');
        setShowApproveModal(false);
        setSelectedSavings(null);
        setMontoAjustado('');
        setComentarios('');
        await loadSavings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al aprobar solicitud');
      }
    } catch (error: any) {
      console.error('Error approving:', error);
      setError(error.message || 'Error de conexión');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (saving: Savings) => {
    if (!user) return;

    const motivo = prompt('Ingresa el motivo del rechazo:');
    if (!motivo) return;

    setProcessing(saving.id);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch(`/api/admin/savings/${saving.id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: 'rechazado',
          comentarios_rechazo: motivo,
          admin_id: user.id
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Solicitud de ahorro rechazada');
        await loadSavings();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Error al rechazar solicitud');
      }
    } catch (error: any) {
      console.error('Error rejecting:', error);
      setError(error.message || 'Error de conexión');
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <PageHeader
          title="Gestión de Ahorros"
          subtitle={user ? `Usuario: ${user.name} · Rol: ${String(user.role).replace('_',' ')}` : undefined}
          glow="admin"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          actions={
            <button
              onClick={() => setShowAdjustModal(true)}
              className="w-full sm:w-auto btn-apple-primary flex items-center justify-center h-[34px] px-6 py-0 text-sm"
            >
              <span>Gestionar ATM</span>
            </button>
          }
        />

        {/* Search and Filters */}
        <div className="mb-2 px-1 sm:px-2 flex items-center gap-2">
          <svg 
            className="w-[18px] h-[18px] text-blue-500 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-wide text-gray-800 dark:text-gray-200">
            Búsqueda y Filtros
          </h2>
        </div>
        
        <div 
          className="mb-8 glass-card p-4 sm:p-6 relative z-[60]"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <AppleSearchBar
            onSearch={handleSearch}
            placeholder="Buscar por nombre o email..."
            filters={searchFiltersConfig}
            onDropdownStateChange={handleDropdownStateChange}
            showResultsInfo={true}
            totalUsers={savings.length}
            filteredUsers={filteredSavings.length}
            onClearSearch={() => {
              setSearchQuery('');
              setGrupoFiltro('todos');
              setPeriodoFiltro('todos');
              setEstadoFiltro('pendiente');
              setFechaDesde('');
              setFechaHasta('');
            }}
          />

          {/* Fila secundaria: Filtro de fechas con icono sutil y diseño premium */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 pt-4 border-t border-black/5 dark:border-white/5 mt-4">
            <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>RANGO DE FECHAS DE SOLICITUD</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <AppleDatePicker
                value={fechaDesde}
                onChange={(date) => setFechaDesde(date)}
                placeholder="dd/mm/aaaa"
                className="rounded-2xl border-white/50 dark:border-white/[0.08] bg-white/70 dark:bg-[#1a1a1c]/70 text-gray-900 dark:text-white text-sm font-medium"
              />
              <AppleDatePicker
                value={fechaHasta}
                onChange={(date) => setFechaHasta(date)}
                placeholder="dd/mm/aaaa"
                className="rounded-2xl border-white/50 dark:border-white/[0.08] bg-white/70 dark:bg-[#1a1a1c]/70 text-gray-900 dark:text-white text-sm font-medium"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-700 font-medium">{success}</p>
            </div>
          </div>
        )}

        {/* Lista de solicitudes */}
        <div className="space-y-4">
          {savings.length === 0 ? (
            <GlassCard
              padding="lg"
              className="border border-white/20 dark:border-white/10 shadow-sm text-center py-12 relative overflow-hidden"
              auroraEffect={true}
            >
              <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-fade-in-smooth">
                <PiggyBank className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight mb-2">
                No hay solicitudes de ahorro
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                {estadoFiltro === 'pendiente' 
                  ? 'No hay solicitudes pendientes de revisión'
                  : 'No hay solicitudes con este estado'}
              </p>
            </GlassCard>
          ) : (
            filteredSavings.map((saving) => (
              <GlassCard
                key={saving.id}
                padding="md"
                className="hover:scale-[1.01] hover:shadow-xl hover:border-white/60 dark:hover:border-white/20 transition-all duration-300 relative flex flex-col justify-stretch"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  
                  {/* Contenido Principal */}
                  <div className="flex-1">
                    
                    {/* Fila superior: Pill de Estado + Nombre de la Modelo + Grupo */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {renderEstadoPill(saving.estado)}
                      
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-sm select-none">
                          {saving.model.name.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                          {saving.model.name}
                        </h3>
                      </div>
                      
                      {saving.model.user_groups && saving.model.user_groups.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.04] text-xs font-semibold text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/5">
                          {saving.model.user_groups.map(ug => ug.groups?.name).filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                    
                    {/* Grilla de Métricas / Datos Estadísticos (Mini-Cards) */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      
                      {/* Período */}
                      <div className="p-3 bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-2xl flex flex-col justify-center gap-0.5">
                        <div className="flex items-center space-x-1.5 text-gray-500 dark:text-gray-400 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase">
                          <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Período</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1">
                          {formatDate(saving.period_date)} ({saving.period_type === '1-15' ? 'P1' : 'P2'})
                        </p>
                      </div>

                      {/* Neto a Pagar */}
                      <div className="p-3 bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-2xl flex flex-col justify-center gap-0.5">
                        <div className="flex items-center space-x-1.5 text-gray-500 dark:text-gray-400 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase">
                          <Coins className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Neto Base</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1">
                          {formatCurrency(saving.neto_pagar_base)}
                        </p>
                      </div>

                      {/* Monto Ahorrado */}
                      <div className="p-3 bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-2xl flex flex-col justify-center gap-0.5">
                        <div className="flex items-center space-x-1.5 text-gray-500 dark:text-gray-400 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase">
                          <PiggyBank className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          <span>Monto Solicitado</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1">
                          {formatCurrency(saving.monto_ahorrado)}
                        </p>
                      </div>

                      {/* Porcentaje */}
                      <div className="p-3 bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-2xl flex flex-col justify-center gap-0.5">
                        <div className="flex items-center space-x-1.5 text-gray-500 dark:text-gray-400 text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase">
                          <Percent className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Porcentaje</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-1">
                          {saving.porcentaje_ahorrado.toFixed(2)}%
                        </p>
                      </div>

                    </div>

                    {/* Alertas / Mensajes de ajustes y comentarios */}
                    {saving.monto_ajustado && saving.monto_ajustado !== saving.monto_ahorrado && (
                      <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center space-x-2.5">
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          Monto ajustado por administrador: <span className="font-bold">{formatCurrency(saving.monto_ajustado)}</span>
                        </p>
                      </div>
                    )}

                    {saving.comentarios_admin && (
                      <div className="mb-3 p-3 bg-white/30 dark:bg-white/[0.01] border border-black/5 dark:border-white/[0.05] rounded-xl">
                        <p className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-1">Comentarios del Admin</p>
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">{saving.comentarios_admin}</p>
                      </div>
                    )}

                    {saving.comentarios_rechazo && (
                      <div className="mb-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2.5">
                        <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                          <X className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-400 tracking-wider uppercase mb-1">Motivo del rechazo</p>
                          <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-300 font-medium">{saving.comentarios_rechazo}</p>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                      Solicitud creada: {formatDate(saving.created_at)}
                    </p>
                  </div>

                  {/* Acciones de Admin (Aprobar / Rechazar) */}
                  {saving.estado === 'pendiente' && (
                    <div className="flex md:flex-col justify-end gap-2.5 shrink-0 w-full md:w-auto">
                      <button
                        onClick={() => {
                          setSelectedSavings(saving);
                          setMontoAjustado('');
                          setComentarios('');
                          setShowApproveModal(true);
                        }}
                        disabled={processing === saving.id}
                        className="flex-1 md:flex-none inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-full active:scale-95 transition-all duration-200 shadow-md shadow-emerald-500/20 dark:shadow-[0_0_15px_rgba(16,185,129,0.3)] text-xs font-bold tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{processing === saving.id ? 'Aprobando...' : 'Aprobar'}</span>
                      </button>
                      <button
                        onClick={() => handleReject(saving)}
                        disabled={processing === saving.id}
                        className="flex-1 md:flex-none inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 min-h-[44px] bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-full active:scale-95 transition-all duration-200 shadow-md shadow-rose-500/20 dark:shadow-[0_0_15px_rgba(244,63,94,0.3)] text-xs font-bold tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Rechazar</span>
                      </button>
                    </div>
                  )}
                  
                </div>
              </GlassCard>
            ))
          )}
        </div>

        {/* Modal de Aprobación */}
        {showApproveModal && selectedSavings && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <GlassCard padding="lg" className="max-w-md w-full border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-3xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-3 mb-5 shrink-0 pb-3 border-b border-black/5 dark:border-white/5">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Aprobar Solicitud
                </h3>
              </div>
              
              <div className="space-y-4">
                
                {/* Resumen de Datos */}
                <div className="space-y-2 p-4 bg-white/40 dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] rounded-2xl">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Modelo:</span>
                    <strong className="text-gray-900 dark:text-white font-bold">{selectedSavings.model.name}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Monto Solicitado:</span>
                    <strong className="text-emerald-500 dark:text-emerald-400 font-bold">{formatCurrency(selectedSavings.monto_ahorrado)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">NETO A PAGAR:</span>
                    <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(selectedSavings.neto_pagar_base)}</strong>
                  </div>
                </div>

                {/* Campo Monto Ajustado */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider uppercase mb-1.5">
                    Monto Ajustado (Opcional)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    <input
                      type="text"
                      value={montoAjustado}
                      onChange={(e) => setMontoAjustado(e.target.value)}
                      placeholder={formatCurrency(selectedSavings.monto_ahorrado)}
                      className="w-full border border-white/50 dark:border-white/[0.08] rounded-2xl pl-10 pr-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 dark:bg-[#1a1a1c]/70 backdrop-blur-md text-sm transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium leading-normal">
                    Deja vacío para usar el monto solicitado. Ajusta solo si es necesario.
                  </p>
                </div>

                {/* Campo Comentarios */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wider uppercase mb-1.5">
                    Comentarios (Opcional)
                  </label>
                  <textarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    rows={3}
                    className="w-full border border-white/50 dark:border-white/[0.08] rounded-2xl px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/70 dark:bg-[#1a1a1c]/70 backdrop-blur-md text-sm transition-all resize-none"
                    placeholder="Comentarios o notas de aprobación..."
                  />
                </div>

                {/* Botones del Modal */}
                <div className="flex space-x-3 pt-4 border-t border-black/5 dark:border-white/5 mt-5">
                  <button
                    onClick={handleApprove}
                    disabled={processing === selectedSavings.id}
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-6 py-2.5 min-h-[44px] bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-full active:scale-95 transition-all duration-200 shadow-md shadow-emerald-500/20 text-xs font-bold tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{processing === selectedSavings.id ? 'Aprobando...' : 'Aprobar'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowApproveModal(false);
                      setSelectedSavings(null);
                      setMontoAjustado('');
                      setComentarios('');
                    }}
                    className="px-6 py-2.5 min-h-[44px] bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full active:scale-95 transition-all duration-200 text-xs font-bold tracking-widest uppercase"
                  >
                    Cancelar
                  </button>
                </div>

              </div>
            </GlassCard>
          </div>
        )}
        {/* Modal de Ajuste de Saldo Manual */}
        <StandardModal
          isOpen={showAdjustModal}
          onClose={() => {
            setShowAdjustModal(false);
            setActiveGoal(null);
            setAdjustData({
              model_id: '',
              tipo_ajuste: 'correccion',
              concepto: '',
              monto: '',
              comentarios: ''
            });
          }}
          title="Ajuste de Saldo Manual"
          maxWidthClass="max-w-md"
          overflowClass="overflow-visible"
          formSpaceYClass="space-y-3 sm:space-y-4"
        >
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5">
              Seleccionar modelo *
            </label>
            {loadingModels ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">Cargando modelos...</div>
            ) : (
              <AppleDropdown
                options={[
                  { value: '', label: 'Selecciona una modelo...' },
                  ...modelsList
                    .filter((m) => m.name.toLowerCase().trim() !== 'aim botty')
                    .map((m) => ({
                      value: m.id,
                      label: `${m.name} (${m.email.split('@')[0]})`
                    }))
                ]}
                value={adjustData.model_id}
                onChange={(val) => {
                  setAdjustData({ ...adjustData, model_id: val });
                  loadActiveGoal(val);
                }}
                placeholder="Selecciona una modelo..."
                variant="input"
                className="w-full max-w-full"
              />
            )}
          </div>

          {loadingGoal && (
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Buscando ahorro programado activo...</span>
            </div>
          )}

          {!loadingGoal && activeGoal && (
            <div className="p-4 bg-purple-500/[0.03] dark:bg-purple-500/[0.05] border border-purple-500/15 dark:border-purple-500/25 rounded-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-lg flex items-center justify-center">
                    <PiggyBank className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 tracking-wide uppercase">
                    Ahorro Programado Activo
                  </span>
                </div>
                <span className="h-[18px] px-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                  Activa
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 relative z-10">
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase block">Objetivo</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-white truncate block">{activeGoal.nombre_meta}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase block">Fecha límite</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-white block">
                    {activeGoal.fecha_limite ? formatDate(activeGoal.fecha_limite) : 'Sin límite'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase block">Monto meta</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-white block">{formatCurrency(activeGoal.monto_meta)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase block">Acumulado actual</span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">{formatCurrency(activeGoal.saldoActual)}</span>
                </div>
              </div>

              <div className="space-y-1 relative z-10">
                <div className="flex justify-between text-[10px] font-medium text-gray-500">
                  <span>Progreso</span>
                  <span>{Math.min(100, (activeGoal.saldoActual / activeGoal.monto_meta) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (activeGoal.saldoActual / activeGoal.monto_meta) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCancelActiveGoal(activeGoal.id, activeGoal.nombre_meta)}
                disabled={cancelingGoal}
                className="w-full h-9 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-full text-xs font-semibold hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelingGoal ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-rose-500"></div>
                    <span>Cancelando Ahorro...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancelar Ahorro Programado</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5">
                Tipo de ajuste *
              </label>
              <AppleDropdown
                options={[
                  { value: 'correccion', label: 'Corrección' },
                  { value: 'bono', label: 'Bono (+)' },
                  { value: 'deduccion', label: 'Deducción (-)' },
                  { value: 'otro', label: 'Otro' }
                ]}
                value={adjustData.tipo_ajuste}
                onChange={(val) => setAdjustData({ ...adjustData, tipo_ajuste: val as any })}
                placeholder="Tipo de ajuste"
                variant="input"
                className="w-full max-w-full"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5">
                Monto COP *
              </label>
              <input
                type="text"
                value={adjustData.monto}
                onChange={(e) => {
                  const val = e.target.value;
                  // Permitir signo menos al principio para debitos
                  const clean = val.replace(/[^\d-]/g, '');
                  setAdjustData({ ...adjustData, monto: clean });
                }}
                placeholder="Ej: 500000 o -200000"
                className="apple-input h-10 text-[13px] font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5">
              Concepto / razón *
            </label>
            <input
              type="text"
              value={adjustData.concepto}
              onChange={(e) => setAdjustData({ ...adjustData, concepto: e.target.value })}
              placeholder="Ej: Bono por productividad o Corrección quincena"
              className="apple-input h-10 text-[13px] font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5">
              Comentarios adicionales
            </label>
            <textarea
              value={adjustData.comentarios}
              onChange={(e) => setAdjustData({ ...adjustData, comentarios: e.target.value })}
              rows={3}
              className="apple-input text-[13px] font-medium py-2.5 resize-none"
              placeholder="Detalle o notas internas del ajuste..."
            />
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-5">
            <button
              onClick={handleCreateAdjustment}
              disabled={adjusting}
              className="flex-1 h-9 btn-apple-primary flex items-center justify-center text-[13px] font-medium tracking-tight rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{adjusting ? 'Aplicando...' : 'Aplicar Ajuste'}</span>
            </button>
            <button
              onClick={() => {
                setShowAdjustModal(false);
                setAdjustData({
                  model_id: '',
                  tipo_ajuste: 'correccion',
                  concepto: '',
                  monto: '',
                  comentarios: ''
                });
              }}
              className="h-9 px-5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full active:scale-95 transition-all duration-200 text-[13px] font-medium"
            >
              Cancelar
            </button>
          </div>
        </StandardModal>
      </div>
    </>
  );
}
