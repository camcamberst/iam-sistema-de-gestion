"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { InfoCardGrid } from '@/components/ui/InfoCard';
import AppleDropdown from '@/components/ui/AppleDropdown';
import PillTabs from '@/components/ui/PillTabs';

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
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'realizado' | 'confirmado' | 'cancelado' | 'reversado';
  nombre_beneficiario?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  banco?: string;
  banco_otro?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  documento_titular?: string;
  cedula_titular?: string;
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  realized_at?: string;
  cancelled_at?: string;
  model: {
    id: string;
    name: string;
    email: string;
    groups?: Array<{ id: string; name: string }>;
    user_groups?: Array<{ group_id: string; groups: { id: string; name: string } }>;
  };
  period: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

type Tab = 'solicitudes' | 'historial';

export default function GestionAnticiposPage() {
  const [activeTab, setActiveTab] = useState<Tab>('solicitudes');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  // ── Solicitudes state ──
  const [anticiposPending, setAnticiposPending] = useState<Anticipo[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'realizado' | 'confirmado' | 'reversado'>('pendiente');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Historial state ──
  const [anticiposHistory, setAnticiposHistory] = useState<Anticipo[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<Anticipo[]>([]);
  const [historyFilters, setHistoryFilters] = useState({ modelo: '', mes: '', periodo: '', grupo: '' });
  const [grupos, setGrupos] = useState<Array<{id: string, name: string}>>([]);
  const [histStats, setHistStats] = useState({ totalSolicitudes: 0, realizados: 0, pendientes: 0, totalPagado: 0 });
  const [selectedCardType, setSelectedCardType] = useState<'all' | 'realizados' | 'pendientes' | 'pagados'>('all');
  const [showResults, setShowResults] = useState(true);

  // ── Load user ──
  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { router.push('/login'); return; }
      const { data: userData } = await supabase.from('users').select('id, name, email, role').eq('id', auth.user.id).single();
      if (!userData || !['admin', 'super_admin', 'superadmin_aff'].includes(userData.role)) { router.push('/login'); return; }
      setUser(userData);
      await Promise.all([
        loadPendingAnticipos(userData.id, userData.role),
        loadHistoryAnticipos(userData.id, userData.role),
      ]);
    } catch (err) {
      console.error('Error loading user:', err);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  // ── Solicitudes: load ──
  const loadPendingAnticipos = async (adminId: string, role?: string) => {
    try {
      const res = await fetch(`/api/anticipos?adminId=${adminId}&estado=pendiente,aprobado,reversado`);
      const data = await res.json();
      if (data.success) {
        const raw = data.anticipos || data.data || [];
        const processed = raw.map((a: Anticipo) => ({
          ...a,
          model: { ...a.model, groups: a.model.groups?.map((ug: any) => ug.group || ug) || [] }
        }));
        setAnticiposPending(processed);
        const groupsSet = new Map<string, {id: string, name: string}>();
        processed.forEach((a: Anticipo) => a.model.groups?.forEach((g: any) => { if (g?.id) groupsSet.set(g.id, g); }));
        const fromAnticipos = Array.from(groupsSet.values());
        setAvailableGroups(fromAnticipos);
        if ((role === 'super_admin') && fromAnticipos.length === 0) {
          const { data: allGroups } = await supabase.from('groups').select('id, name').order('name');
          if (Array.isArray(allGroups) && allGroups.length > 0) setAvailableGroups(allGroups);
        }
      } else { setError(data.error || 'Error al cargar solicitudes'); }
    } catch { setError('Error al cargar solicitudes'); }
  };

  // ── Historial: load ──
  const loadHistoryAnticipos = async (adminId: string, role?: string) => {
    try {
      const res = await fetch(`/api/anticipos?adminId=${adminId}`);
      const data = await res.json();
      if (data.success) {
        const raw = data.anticipos || data.data || [];
        setAnticiposHistory(raw);
        calculateHistStats(raw);
        if (role === 'super_admin') {
          const { data: allGroups } = await supabase.from('groups').select('id, name').order('name');
          if (allGroups) setGrupos(allGroups);
        }
      }
    } catch { /* silent */ }
  };

  const calculateHistStats = (list: Anticipo[]) => {
    const today = new Date();
    const day = today.getDate();
    const isP1 = day >= 1 && day <= 15;
    const inPeriod = list.filter(a => {
      const d = new Date(a.created_at).getDate();
      return isP1 ? d >= 1 && d <= 15 : d >= 16;
    });
    setHistStats({
      totalSolicitudes: inPeriod.length,
      realizados: inPeriod.filter(a => a.estado === 'realizado' || a.estado === 'confirmado').length,
      pendientes: inPeriod.filter(a => a.estado === 'pendiente' || a.estado === 'aprobado').length,
      totalPagado: inPeriod.filter(a => a.estado === 'realizado' || a.estado === 'confirmado').reduce((s, a) => s + a.monto_solicitado, 0),
    });
  };

  // ── Historial: filter ──
  const applyHistoryFilters = useCallback(() => {
    let filtered = [...anticiposHistory];

    if (selectedCardType !== 'all') {
      const today = new Date();
      const day = today.getDate();
      const isP1 = day >= 1 && day <= 15;
      filtered = filtered.filter(a => {
        const d = new Date(a.created_at).getDate();
        return isP1 ? d >= 1 && d <= 15 : d >= 16;
      });
      if (selectedCardType === 'realizados' || selectedCardType === 'pagados')
        filtered = filtered.filter(a => a.estado === 'realizado' || a.estado === 'confirmado');
      else if (selectedCardType === 'pendientes')
        filtered = filtered.filter(a => a.estado === 'pendiente' || a.estado === 'aprobado');
    }

    if (user?.role === 'super_admin' && historyFilters.grupo) {
      filtered = filtered.filter(a => a.model.user_groups?.[0]?.group_id === historyFilters.grupo);
    }
    if (historyFilters.modelo) {
      const q = historyFilters.modelo.toLowerCase();
      filtered = filtered.filter(a => a.model.name.toLowerCase().includes(q) || a.model.email.toLowerCase().includes(q));
    }
    if (historyFilters.mes) {
      const months: Record<string, number> = { enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11 };
      const m = months[historyFilters.mes];
      if (m !== undefined) filtered = filtered.filter(a => new Date(a.created_at).getMonth() === m);
    }
    if (historyFilters.periodo) {
      if (historyFilters.periodo === 'periodo-1') filtered = filtered.filter(a => new Date(a.created_at).getDate() <= 15);
      else filtered = filtered.filter(a => new Date(a.created_at).getDate() >= 16);
    }
    if (!showResults) { setFilteredHistory([]); return; }
    setFilteredHistory(filtered);
  }, [anticiposHistory, historyFilters, selectedCardType, showResults, user?.role]);

  useEffect(() => { applyHistoryFilters(); }, [applyHistoryFilters]);

  // ── Solicitudes: filter ──
  const getPendingFiltered = () => {
    let filtered = anticiposPending;
    if (estadoFiltro === 'todos') filtered = filtered.filter(a => a.estado !== 'reversado');
    else filtered = filtered.filter(a => a.estado === estadoFiltro);
    if ((user?.role === 'super_admin' || user?.role === 'admin') && grupoFiltro !== 'todos')
      filtered = filtered.filter(a => a.model.groups?.some(g => g.id === grupoFiltro));
    return filtered;
  };

  // ── Solicitudes: actions ──
  const handleAction = async (id: string, action: 'aprobado' | 'rechazado' | 'realizado' | 'reversado', comentarios?: string) => {
    try {
      setProcessing(id); setError(null); setSuccess(null);
      const res = await fetch(`/api/anticipos/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: action,
          comentarios_admin: action === 'aprobado' ? comentarios : undefined,
          comentarios_rechazo: action === 'rechazado' ? comentarios : undefined,
          motivo_reversa: action === 'reversado' ? comentarios : undefined,
          admin_id: user?.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Solicitud ${action} correctamente`);
        if (user) {
          await loadPendingAnticipos(user.id, user.role);
          await loadHistoryAnticipos(user.id, user.role);
        }
      } else { setError(data.error || `Error al ${action} solicitud`); }
    } catch { setError(`Error al ${action} solicitud`); }
    finally { setProcessing(null); }
  };

  const getMedioPagoInfo = (a: Anticipo) => {
    if (a.medio_pago === 'nequi' || a.medio_pago === 'daviplata')
      return { tipo: a.medio_pago.toUpperCase(), info: `${a.nombre_beneficiario} - ${a.numero_telefono}` };
    return { tipo: 'Cuenta Bancaria', info: `${a.banco || a.banco_otro} - ${a.tipo_cuenta} - ${a.numero_cuenta}` };
  };

  const formatDateCO = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  const buildClipboardInfo = (a: Anticipo) => {
    const lines = [
      `Anticipo de: ${a.model?.name || ''}`,
      `Monto: $${(a.monto_solicitado || 0).toLocaleString('es-CO')} COP`,
      `Medio: ${getMedioPagoInfo(a).tipo}`,
      `Periodo: ${formatDateCO(a.period?.start_date)} → ${formatDateCO(a.period?.end_date)}`,
    ];
    if (a.nombre_titular || a.nombre_beneficiario) lines.push(`Titular: ${a.nombre_titular || a.nombre_beneficiario}`);
    if (a.documento_titular || a.cedula_titular) lines.push(`Documento: ${a.documento_titular || a.cedula_titular}`);
    if (a.banco || a.banco_otro) lines.push(`Banco: ${a.banco || a.banco_otro}`);
    if (a.tipo_cuenta) lines.push(`Tipo de cuenta: ${a.tipo_cuenta}`);
    if (a.numero_cuenta) lines.push(`Número de cuenta: ${a.numero_cuenta}`);
    if (a.numero_telefono) lines.push(`Teléfono: ${a.numero_telefono}`);
    if (a.model?.email) lines.push(`Email: ${a.model.email}`);
    if (a.model?.groups?.length) lines.push(`Grupo/Sede: ${a.model.groups.map(g => g.name).join(', ')}`);
    return lines.join('\n');
  };

  const getEstadoColor = (e: string) => {
    const map: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      aprobado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      rechazado: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      realizado: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      confirmado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
      cancelado: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
      reversado: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
    };
    return map[e] || map.cancelado;
  };
  const getEstadoLabel = (e: string) => ({ pendiente:'Pendiente', aprobado:'Aprobado', rechazado:'Rechazado', realizado:'Realizado', confirmado:'Confirmado', cancelado:'Cancelado', reversado:'Reversado' }[e] || e);

  const handleCardClick = (t: 'all' | 'realizados' | 'pendientes' | 'pagados') => {
    if (selectedCardType === t) { setShowResults(false); setSelectedCardType('all'); }
    else { setSelectedCardType(t); setShowResults(true); }
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-24">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/20 p-8 max-w-md text-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  const pendingFiltered = getPendingFiltered();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl" />
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight">
                    Gestión Anticipos
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">Solicitudes y historial de anticipos de tu grupo</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <PillTabs
          tabs={[
            { id: 'solicitudes', label: 'Solicitudes' },
            { id: 'historial', label: 'Historial' },
          ]}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as Tab)}
          className="mb-6"
        />

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
          </div>
        )}

        {/* ═══════════ TAB: SOLICITUDES ═══════════ */}
        {activeTab === 'solicitudes' && (
          <>
            {/* Filtros */}
            <div className="mb-6">
              <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(user.role === 'super_admin' || user.role === 'admin') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Filtrar por grupo:</label>
                      <AppleDropdown
                        options={[{ value: 'todos', label: 'Todos los grupos' }, ...availableGroups.map(g => ({ value: g.id, label: g.name }))]}
                        value={grupoFiltro} onChange={setGrupoFiltro} placeholder="Selecciona un grupo" className="text-sm"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Filtrar por estado:</label>
                    <AppleDropdown
                      options={[
                        { value: 'todos', label: 'Todos' }, { value: 'pendiente', label: 'Pendientes' },
                        { value: 'aprobado', label: 'Aprobadas' }, { value: 'realizado', label: 'Realizadas' },
                        { value: 'confirmado', label: 'Confirmadas' }, { value: 'reversado', label: 'Reversadas' },
                      ]}
                      value={estadoFiltro}
                      onChange={(v) => setEstadoFiltro(v as typeof estadoFiltro)}
                      placeholder="Selecciona un estado" className="text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Lista */}
            {pendingFiltered.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-8 px-6">
                <svg className="w-8 h-8 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {estadoFiltro === 'pendiente' ? 'No hay solicitudes pendientes' : 'No hay solicitudes para este estado'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {estadoFiltro === 'pendiente' ? 'Todas las solicitudes pendientes han sido procesadas' : 'Ajusta los filtros para ver otras solicitudes'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingFiltered.map(anticipo => {
                  const medioPagoInfo = getMedioPagoInfo(anticipo);
                  return (
                    <div key={anticipo.id} className="bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600/20 p-3 sm:p-4 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                      <div className="space-y-2 sm:space-y-3">
                        {/* Modelo y monto */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{anticipo.model.name}</h3>
                            {anticipo.model.groups && anticipo.model.groups.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {anticipo.model.groups.map(g => (
                                  <span key={g.id} className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">{g.name}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">${anticipo.monto_solicitado.toLocaleString('es-CO')} COP</div>
                          </div>
                        </div>

                        {/* Info compacta */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-1 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
                            <span><span className="font-medium">Medio:</span> {medioPagoInfo.tipo}</span>
                            {anticipo.nombre_beneficiario && <span className="truncate"><span className="font-medium">Beneficiario:</span> {anticipo.nombre_beneficiario}</span>}
                            {anticipo.numero_telefono && <span><span className="font-medium">Tel:</span> {anticipo.numero_telefono}</span>}
                          </div>
                          <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">{new Date(anticipo.created_at).toLocaleDateString('es-CO')}</div>
                        </div>

                        {/* Detalles expandibles */}
                        <div className="mt-1">
                          <button onClick={() => setExpandedId(expandedId === anticipo.id ? null : anticipo.id)} className="text-[10px] sm:text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline active:scale-95 touch-manipulation">
                            {expandedId === anticipo.id ? 'Ocultar detalles' : 'Ver detalles de transferencia'}
                          </button>
                          {expandedId === anticipo.id && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-300">
                              <div><span className="font-semibold">Método:</span> {medioPagoInfo.tipo}</div>
                              <div><span className="font-semibold">Periodo:</span> {formatDateCO(anticipo.period?.start_date)} → {formatDateCO(anticipo.period?.end_date)}</div>
                              {(anticipo.nombre_titular || anticipo.nombre_beneficiario) && <div><span className="font-semibold">Titular:</span> {anticipo.nombre_titular || anticipo.nombre_beneficiario}</div>}
                              {(anticipo.documento_titular || anticipo.cedula_titular) && <div><span className="font-semibold">Documento:</span> {anticipo.documento_titular || anticipo.cedula_titular}</div>}
                              {(anticipo.banco || anticipo.banco_otro) && <div><span className="font-semibold">Banco:</span> {anticipo.banco || anticipo.banco_otro}</div>}
                              {anticipo.tipo_cuenta && <div><span className="font-semibold">Tipo de cuenta:</span> {anticipo.tipo_cuenta}</div>}
                              {anticipo.numero_cuenta && <div className="break-all"><span className="font-semibold">Número de cuenta:</span> {anticipo.numero_cuenta}</div>}
                              {anticipo.numero_telefono && <div><span className="font-semibold">Teléfono:</span> {anticipo.numero_telefono}</div>}
                              {anticipo.model?.email && <div className="sm:col-span-2"><span className="font-semibold">Email:</span> {anticipo.model.email}</div>}
                              {anticipo.model?.groups && anticipo.model.groups.length > 0 && <div className="sm:col-span-2"><span className="font-semibold">Grupo/Sede:</span> {anticipo.model.groups.map(g => g.name).join(', ')}</div>}
                              <div className="sm:col-span-2 mt-1.5">
                                <button
                                  onClick={async () => { try { await navigator.clipboard.writeText(buildClipboardInfo(anticipo)); setSuccess('Información copiada'); setTimeout(() => setSuccess(null), 2000); } catch { setError('No se pudo copiar'); setTimeout(() => setError(null), 2000); } }}
                                  className="w-full sm:w-auto px-2.5 py-1.5 text-[10px] sm:text-[11px] font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors active:scale-95 touch-manipulation"
                                >Copiar información</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-600">
                          {anticipo.estado === 'pendiente' && (
                            <>
                              <button onClick={() => { const c = prompt('Comentarios (opcional):'); handleAction(anticipo.id, 'aprobado', c || undefined); }} disabled={processing === anticipo.id}
                                className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95 touch-manipulation">
                                {processing === anticipo.id ? '...' : 'Aprobar'}
                              </button>
                              <button onClick={() => { const c = prompt('Motivo del rechazo:'); if (c) handleAction(anticipo.id, 'rechazado', c); }} disabled={processing === anticipo.id}
                                className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 disabled:opacity-50 transition-all shadow-md active:scale-95 touch-manipulation">
                                Rechazar
                              </button>
                            </>
                          )}
                          {anticipo.estado === 'aprobado' && (
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                              <button onClick={() => { if (confirm('¿Confirmas que el anticipo ha sido realizado/pagado?')) handleAction(anticipo.id, 'realizado'); }} disabled={processing === anticipo.id}
                                className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 transition-all shadow-md active:scale-95 touch-manipulation">
                                {processing === anticipo.id ? '...' : 'Realizado'}
                              </button>
                              <button onClick={() => { const m = prompt('Motivo de la reversión (opcional):'); if (m !== null && confirm('¿Reversar esta solicitud?\n\nEsto anulará la aprobación.')) handleAction(anticipo.id, 'reversado', m || undefined); }} disabled={processing === anticipo.id}
                                className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 disabled:opacity-50 transition-all shadow-md active:scale-95 touch-manipulation">
                                {processing === anticipo.id ? '...' : 'Reversar'}
                              </button>
                            </div>
                          )}
                          {anticipo.estado === 'realizado' && (
                            <div className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium text-center sm:text-left">Esperando confirmación de la modelo</div>
                          )}
                          {anticipo.estado === 'confirmado' && (
                            <div className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium text-center sm:text-left">Confirmado por la modelo</div>
                          )}
                          {anticipo.estado === 'reversado' && (
                            <div className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-lg text-xs font-medium text-center sm:text-left flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                              Reversada — sin descuento a la modelo
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ═══════════ TAB: HISTORIAL ═══════════ */}
        {activeTab === 'historial' && (
          <>
            {/* Stats */}
            <InfoCardGrid
              cards={[
                { value: histStats.totalSolicitudes, label: selectedCardType === 'all' ? 'Total (Periodo)' : 'Total', color: 'blue', onClick: () => handleCardClick('all'), clickable: true, size: 'sm' },
                { value: histStats.realizados, label: 'Realizados', color: 'green', onClick: () => handleCardClick('realizados'), clickable: true, size: 'sm' },
                { value: histStats.pendientes, label: 'Pendientes', color: 'yellow', onClick: () => handleCardClick('pendientes'), clickable: true, size: 'sm' },
                { value: `$${histStats.totalPagado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, label: 'Total Pagado (COP)', color: 'purple', onClick: () => handleCardClick('pagados'), clickable: true, size: 'sm' },
              ]}
              columns={4} className="mb-6"
            />

            {/* Filtros */}
            <div className="relative z-[99998] bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 mb-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Filtros</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {user.role === 'super_admin' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">Grupo</label>
                    <AppleDropdown options={grupos.map(g => ({ value: g.id, label: g.name }))} value={historyFilters.grupo} onChange={v => setHistoryFilters(p => ({ ...p, grupo: v }))} placeholder="Seleccionar grupo" className="text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">Mes</label>
                  <AppleDropdown
                    options={['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => ({ value: m.toLowerCase(), label: m }))}
                    value={historyFilters.mes} onChange={v => setHistoryFilters(p => ({ ...p, mes: v }))} placeholder="Seleccionar mes" className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">Periodo</label>
                  <AppleDropdown options={[{ value: 'periodo-1', label: 'Periodo 1' }, { value: 'periodo-2', label: 'Periodo 2' }]} value={historyFilters.periodo} onChange={v => setHistoryFilters(p => ({ ...p, periodo: v }))} placeholder="Seleccionar periodo" className="text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">Modelo</label>
                  <input type="text" value={historyFilters.modelo} onChange={e => setHistoryFilters(p => ({ ...p, modelo: e.target.value }))} placeholder="Buscar por nombre o email"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2.5 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100" />
                </div>
              </div>
            </div>

            {/* Lista */}
            {!showResults ? null : filteredHistory.length === 0 ? (
              <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-8 border border-white/20 dark:border-gray-600/20 text-center">
                <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay anticipos</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{anticiposHistory.length === 0 ? 'Aún no hay anticipos en el sistema' : 'No se encontraron anticipos con los filtros aplicados'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map(anticipo => {
                  const medio = getMedioPagoInfo(anticipo);
                  const groupName = anticipo.model.user_groups?.[0]?.groups?.name || anticipo.model.groups?.[0]?.name;
                  return (
                    <div key={anticipo.id} className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-white/20 dark:border-gray-600/20 p-3 sm:p-4 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{anticipo.model.name}</h3>
                            <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              <span className="font-medium">Email:</span> <span className="truncate">{anticipo.model.email}</span>
                              {groupName && <><span className="hidden sm:inline"> | </span><span className="block sm:inline"><span className="font-medium sm:ml-0 ml-1">Grupo:</span> {groupName}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2">
                            <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">${anticipo.monto_solicitado.toLocaleString('es-CO')} COP</div>
                            <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0 ${getEstadoColor(anticipo.estado)}`}>{getEstadoLabel(anticipo.estado)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] sm:text-xs text-gray-600 dark:text-gray-300">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-1">
                            {anticipo.nombre_beneficiario && <span className="truncate"><span className="font-medium">Beneficiario:</span> {anticipo.nombre_beneficiario}</span>}
                            <span><span className="font-medium">Medio:</span> {medio.tipo}</span>
                            {(anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata') && anticipo.numero_telefono && <span><span className="font-medium">Tel:</span> {anticipo.numero_telefono}</span>}
                            {anticipo.medio_pago === 'cuenta_bancaria' && anticipo.banco && <span className="truncate"><span className="font-medium">Banco:</span> {anticipo.banco}</span>}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">{new Date(anticipo.created_at).toLocaleDateString('es-CO')}</div>
                        </div>
                        {anticipo.comentarios_admin && (
                          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded text-[10px] sm:text-xs text-blue-800 dark:text-blue-300"><span className="font-medium">Admin:</span> {anticipo.comentarios_admin}</div>
                        )}
                        {anticipo.comentarios_rechazo && (
                          <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded text-[10px] sm:text-xs text-red-800 dark:text-red-300"><span className="font-medium">Rechazo:</span> {anticipo.comentarios_rechazo}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
