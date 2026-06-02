"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { InfoCardGrid } from '@/components/ui/InfoCard';
import AppleDropdown from '@/components/ui/AppleDropdown';
import PillTabs from '@/components/ui/PillTabs';
import PageHeader from '@/components/ui/PageHeader';
import { Calendar, Clock, Inbox, Plus, AlertTriangle, Check, X, Copy, ChevronDown, ChevronUp, Search, Info, XCircle } from 'lucide-react';

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

  // ── Custom Action Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    id: string;
    action: 'aprobado' | 'rechazado' | 'realizado' | 'reversado';
    title: string;
    description: string;
    placeholder?: string;
    required: boolean;
  } | null>(null);
  const [modalComment, setModalComment] = useState("");

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

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalConfig) return;
    if (modalConfig.required && !modalComment.trim()) return;
    setModalOpen(false);
    await handleAction(modalConfig.id, modalConfig.action, modalComment.trim() || undefined);
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



  const handleCardClick = (t: 'all' | 'realizados' | 'pendientes' | 'pagados') => {
    if (selectedCardType === t) { setShowResults(false); setSelectedCardType('all'); }
    else { setSelectedCardType(t); setShowResults(true); }
  };

  const pendingFiltered = getPendingFiltered();

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">

        {/* Header estandarizado */}
        <PageHeader 
          title="Gestión Anticipos"
          subtitle="Revisa, aprueba y consulta el historial de solicitudes de anticipos pendientes de tu grupo"
          icon={<Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          glow="admin"
          actions={
            <PillTabs
              tabs={[
                { id: 'solicitudes', label: 'Solicitudes' },
                { id: 'historial', label: 'Historial' },
              ]}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as Tab)}
            />
          }
        />

        {loading ? (
          <div className="h-[250px] bg-transparent flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 font-normal">Cargando datos...</p>
            </div>
          </div>
        ) : !user ? (
          <div className="mt-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/20 p-8 max-w-md mx-auto text-center animate-in fade-in zoom-in-95">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página o no estás autenticado.</p>
          </div>
        ) : (
          <>
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
            {/* Filtros Centrados y fuera de la caja */}
            <div className="flex justify-center items-center gap-3 sm:gap-4 flex-wrap mb-8 relative z-30 mt-6">
              {(user.role === 'super_admin' || user.role === 'admin') && (
                <AppleDropdown
                  options={[{ value: 'todos', label: 'Todos los grupos' }, ...availableGroups.map(g => ({ value: g.id, label: g.name }))]}
                  value={grupoFiltro} 
                  onChange={setGrupoFiltro} 
                  placeholder="Filtrar por grupo" 
                  className="text-sm min-w-[160px] sm:min-w-[200px]"
                />
              )}
              <AppleDropdown
                options={[
                  { value: 'todos', label: 'Todos los estados' }, 
                  { value: 'pendiente', label: 'Pendientes' },
                  { value: 'aprobado', label: 'Aprobadas' }, 
                  { value: 'realizado', label: 'Realizadas' },
                  { value: 'confirmado', label: 'Confirmadas' }, 
                  { value: 'reversado', label: 'Reversadas' },
                ]}
                value={estadoFiltro}
                onChange={(v) => setEstadoFiltro(v as typeof estadoFiltro)}
                placeholder="Filtrar por estado" 
                className="text-sm min-w-[160px] sm:min-w-[200px]"
              />
            </div>

            {/* Lista */}
            {pendingFiltered.length === 0 ? (
              <div className="relative bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-3xl rounded-3xl border border-black/5 dark:border-white/5 p-12 text-center shadow-lg dark:shadow-blue-900/5 max-w-xl mx-auto mt-6">
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-500/10 via-indigo-500/5 to-purple-500/15 rounded-3xl border border-indigo-500/20 dark:border-indigo-400/15 flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(99,102,241,0.15)] relative">
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"></span>
                  
                  <Inbox className="w-9 h-9 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-normal text-gray-900 dark:text-gray-100 tracking-tight mb-2">
                  {estadoFiltro === 'pendiente' ? 'No hay solicitudes pendientes' : 'No hay solicitudes para este estado'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-normal">
                  {estadoFiltro === 'pendiente' ? 'Todas las solicitudes pendientes han sido procesadas' : 'Ajusta los filtros para ver otras solicitudes'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingFiltered.map(anticipo => (
                  <AnticipoPendingCardItem
                    key={anticipo.id}
                    anticipo={anticipo}
                    processing={processing}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    getMedioPagoInfo={getMedioPagoInfo}
                    formatDateCO={formatDateCO}
                    buildClipboardInfo={buildClipboardInfo}
                    setSuccess={setSuccess}
                    setError={setError}
                    setModalComment={setModalComment}
                    setModalConfig={setModalConfig}
                    setModalOpen={setModalOpen}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════ TAB: HISTORIAL ═══════════ */}
        {activeTab === 'historial' && (
          <>
            {/* Estadísticas del Periodo - Rediseño Nativo en Píldora Compacta unificada */}
            <InfoCardGrid
              cards={[
                { value: histStats.totalSolicitudes, label: selectedCardType === 'all' ? 'Total (Periodo)' : 'Total', color: 'blue', onClick: () => handleCardClick('all'), clickable: true, size: 'sm' },
                { value: histStats.realizados, label: 'Realizados', color: 'green', onClick: () => handleCardClick('realizados'), clickable: true, size: 'sm' },
                { value: histStats.pendientes, label: 'Pendientes', color: 'yellow', onClick: () => handleCardClick('pendientes'), clickable: true, size: 'sm' },
                { value: `$${histStats.totalPagado.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`, label: 'Total Pagado (COP)', color: 'purple', onClick: () => handleCardClick('pagados'), clickable: true, size: 'sm' },
              ]}
              columns={4}
              className="mb-6"
              compactContainer={true}
            />

            {/* Filtros Centrados y fuera de la caja */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-[360px] mx-auto sm:max-w-none sm:flex sm:flex-row sm:justify-center sm:items-center sm:gap-4 mb-8 relative z-30 mt-6">
              {user.role === 'super_admin' && (
                <AppleDropdown 
                  options={[{ value: '', label: 'Todos los grupos' }, ...grupos.map(g => ({ value: g.id, label: g.name }))]} 
                  value={historyFilters.grupo} 
                  onChange={v => setHistoryFilters(p => ({ ...p, grupo: v }))} 
                  placeholder="Todos los grupos" 
                  className="text-sm w-full sm:w-auto sm:min-w-[200px]" 
                />
              )}
              <AppleDropdown
                options={[{ value: '', label: 'Todos los meses' }, ...['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map(m => ({ value: m.toLowerCase(), label: m }))]}
                value={historyFilters.mes} 
                onChange={v => setHistoryFilters(p => ({ ...p, mes: v }))} 
                placeholder="Todos los meses" 
                className="text-sm w-full sm:w-auto sm:min-w-[200px]"
              />
              <AppleDropdown 
                options={[{ value: '', label: 'Todos los periodos' }, { value: 'periodo-1', label: 'Periodo 1' }, { value: 'periodo-2', label: 'Periodo 2' }]} 
                value={historyFilters.periodo} 
                onChange={v => setHistoryFilters(p => ({ ...p, periodo: v }))} 
                placeholder="Todos los periodos" 
                className="text-sm w-full sm:w-auto sm:min-w-[200px]" 
              />
              <div className={`relative w-full sm:w-auto ${user.role !== 'super_admin' ? 'col-span-2' : ''}`}>
                <input 
                  type="text" 
                  value={historyFilters.modelo} 
                  onChange={e => setHistoryFilters(p => ({ ...p, modelo: e.target.value }))} 
                  placeholder="Buscar modelo..."
                  className="w-full sm:w-[220px] bg-white/70 dark:bg-[#1a1a1c]/70 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4.5 pl-9 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 shadow-[0_4px_10px_rgba(0,0,0,0.02)] h-[38px]" 
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Lista */}
            {!showResults ? null : filteredHistory.length === 0 ? (
              <div className="relative bg-white/40 dark:bg-[#1a1a1c]/40 backdrop-blur-3xl rounded-3xl border border-black/5 dark:border-white/5 p-12 text-center shadow-lg dark:shadow-blue-900/5 max-w-xl mx-auto mt-6">
                <div className="w-20 h-20 bg-gradient-to-tr from-blue-500/10 via-indigo-500/5 to-purple-500/15 rounded-3xl border border-indigo-500/20 dark:border-indigo-400/15 flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(99,102,241,0.15)] relative">
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"></span>
                  
                  <Inbox className="w-9 h-9 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-normal text-gray-900 dark:text-gray-100 mb-2">No hay anticipos</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-normal">{anticiposHistory.length === 0 ? 'Aún no hay anticipos en el sistema' : 'No se encontraron anticipos con los filtros aplicados'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map(anticipo => (
                  <AnticipoHistoryCardItem
                    key={anticipo.id}
                    anticipo={anticipo}
                    getMedioPagoInfo={getMedioPagoInfo}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </>
    )}
  </div>

      {/* Modal de Acción Personalizado — Apple Style 2 */}
      {modalOpen && modalConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          
          {/* Modal Box */}
          <div className="relative w-full max-w-md bg-white/90 dark:bg-[#1a1a1c]/90 backdrop-blur-3xl rounded-[2rem] border border-white/50 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-6 overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Glow Ambiental Boreal */}
            <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl mix-blend-screen pointer-events-none opacity-20 ${
              modalConfig.action === 'rechazado' ? 'bg-red-500' :
              modalConfig.action === 'aprobado' ? 'bg-blue-500' :
              modalConfig.action === 'realizado' ? 'bg-emerald-500' : 'bg-orange-500'
            }`} />

            <div className="relative space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm backdrop-blur-sm ${
                  modalConfig.action === 'rechazado' ? 'bg-red-50/50 text-red-600 border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:border-red-400/30' :
                  modalConfig.action === 'aprobado' ? 'bg-blue-50/50 text-blue-600 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/30' :
                  modalConfig.action === 'realizado' ? 'bg-emerald-50/50 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/30' :
                  'bg-orange-50/50 text-orange-600 border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-400/30'
                }`}>
                  {modalConfig.action === 'rechazado' && <X className="w-5 h-5" />}
                  {modalConfig.action === 'aprobado' && <Check className="w-5 h-5" />}
                  {modalConfig.action === 'realizado' && <Check className="w-5 h-5" />}
                  {modalConfig.action === 'reversado' && <AlertTriangle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-tight">
                    {modalConfig.title}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                    Anticipos Módulo de Control
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
                {modalConfig.description}
              </p>

              {/* Form Content */}
              <form onSubmit={handleModalSubmit} className="space-y-4">
                {modalConfig.placeholder !== undefined && (
                  <div className="relative">
                    <textarea
                      value={modalComment}
                      onChange={(e) => setModalComment(e.target.value)}
                      placeholder={modalConfig.placeholder}
                      required={modalConfig.required}
                      rows={3}
                      className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] rounded-2xl px-4 py-3 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all duration-300 shadow-inner resize-none"
                    />
                    {modalConfig.required && !modalComment.trim() && (
                      <span className="absolute bottom-2 right-3 text-[9px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
                        Requerido
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 active:scale-95 touch-manipulation cursor-pointer"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    disabled={modalConfig.required && !modalComment.trim()}
                    className={`px-5 py-2 text-xs font-bold rounded-full transition-all duration-200 shadow-md active:scale-95 touch-manipulation cursor-pointer ${
                      modalConfig.required && !modalComment.trim() ? 'opacity-40 cursor-not-allowed bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400' :
                      modalConfig.action === 'rechazado' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/10' :
                      modalConfig.action === 'aprobado' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-500/10' :
                      modalConfig.action === 'realizado' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/10' :
                      'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-orange-500/10'
                    }`}
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AnticipoPendingCardItemProps {
  anticipo: Anticipo;
  processing: string | null;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  getMedioPagoInfo: (a: Anticipo) => { tipo: string; info: string };
  formatDateCO: (d?: string) => string;
  buildClipboardInfo: (a: Anticipo) => string;
  setSuccess: (msg: string | null) => void;
  setError: (msg: string | null) => void;
  setModalComment: (comment: string) => void;
  setModalConfig: (config: any) => void;
  setModalOpen: (open: boolean) => void;
}

function AnticipoPendingCardItem({
  anticipo,
  processing,
  expandedId,
  setExpandedId,
  getMedioPagoInfo,
  formatDateCO,
  buildClipboardInfo,
  setSuccess,
  setError,
  setModalComment,
  setModalConfig,
  setModalOpen
}: AnticipoPendingCardItemProps) {
  const [pillIndex, setPillIndex] = useState(0);
  const medioPagoInfo = getMedioPagoInfo(anticipo);

  const pillItems = [
    (anticipo.model.groups && anticipo.model.groups.length > 0) ? (
      <div key="sede" className="h-5 flex gap-1 items-center shrink-0">
        {anticipo.model.groups.map(g => (
          <span key={g.id} className="h-5 flex items-center justify-center text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-500/10 px-2.5 rounded-full border border-purple-500/20 dark:border-purple-400/30 shadow-sm backdrop-blur-sm text-center select-none">{g.name ? g.name.charAt(0).toUpperCase() + g.name.slice(1).toLowerCase() : ''}</span>
        ))}
      </div>
    ) : null,
    <span key="medio" className={`h-5 flex items-center justify-center text-[11px] font-semibold px-2.5 rounded-full shrink-0 border shadow-sm backdrop-blur-sm text-center select-none ${
      anticipo.medio_pago === 'nequi' ? 'bg-pink-50/60 text-pink-700 border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-400/30' :
      anticipo.medio_pago === 'daviplata' ? 'bg-rose-50/60 text-rose-700 border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/30' :
      'bg-blue-50/60 text-blue-700 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/30'
    }`}>
      {medioPagoInfo.tipo ? medioPagoInfo.tipo.charAt(0).toUpperCase() + medioPagoInfo.tipo.slice(1).toLowerCase() : ''}
    </span>
  ].filter((p): p is JSX.Element => p !== null);

  return (
    <div className="relative group bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl border border-white/50 dark:border-white/10 p-3 sm:py-3.5 sm:px-5 shadow-[0_10px_30px_rgba(0,0,0,0.02)] dark:shadow-none transition-all duration-300 hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:-translate-y-[1px]">
      <div className="space-y-2">
        {/* Fila 1: Nombre, Sedes, Medio de Pago y Monto */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col items-start min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate leading-none">
                {anticipo.model.email?.includes('@') ? anticipo.model.email.split('@')[0] : anticipo.model.name}
              </h3>
              
              {/* Desktop/Tablet Layout: Static Side-by-Side */}
              <div className="hidden sm:flex items-center gap-1.5">
                {anticipo.model.groups && anticipo.model.groups.length > 0 && (
                  <div className="flex gap-1">
                    {anticipo.model.groups.map(g => (
                      <span key={g.id} className="h-5 flex items-center justify-center text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-500/10 px-2.5 rounded-full border border-purple-500/20 dark:border-purple-400/30 shadow-sm backdrop-blur-sm text-center select-none">{g.name ? g.name.charAt(0).toUpperCase() + g.name.slice(1).toLowerCase() : ''}</span>
                    ))}
                  </div>
                )}

                <span className={`h-5 flex items-center justify-center text-[11px] font-semibold px-2.5 rounded-full shrink-0 border shadow-sm backdrop-blur-sm text-center select-none ${
                  anticipo.medio_pago === 'nequi' ? 'bg-pink-50/60 text-pink-700 border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-400/30' :
                  anticipo.medio_pago === 'daviplata' ? 'bg-rose-50/60 text-rose-700 border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/30' :
                  'bg-blue-50/60 text-blue-700 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/30'
                }`}>
                  {medioPagoInfo.tipo ? medioPagoInfo.tipo.charAt(0).toUpperCase() + medioPagoInfo.tipo.slice(1).toLowerCase() : ''}
                </span>
              </div>

              {/* Mobile Layout: Crossfade Carousel */}
              <div className="flex sm:hidden">
                {pillItems.length <= 1 ? (
                  pillItems[0]
                ) : (
                  <div 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setPillIndex(prev => (prev + 1) % pillItems.length); 
                    }}
                    className="relative cursor-pointer select-none h-5 w-[115px] flex items-center justify-start active:scale-95 transition-all duration-300 shrink-0"
                  >
                    {pillItems.map((pill, idx) => (
                      <div 
                        key={idx}
                        className={`absolute inset-y-0 left-0 flex items-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          idx === pillIndex 
                            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
                            : 'opacity-0 translate-y-1.5 scale-95 pointer-events-none'
                        }`}
                      >
                        {pill}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chevron expandir datos inline colocado debajo del nombre y las píldoras */}
            <button 
              onClick={() => setExpandedId(expandedId === anticipo.id ? null : anticipo.id)}
              className="text-blue-500 hover:text-blue-600 active:scale-95 transition-all flex items-center justify-center mt-1 cursor-pointer shrink-0"
              title="Ver datos de transferencia"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${expandedId === anticipo.id ? 'rotate-180 text-blue-600' : ''}`} />
            </button>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-base sm:text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent tabular-nums leading-none">
              ${anticipo.monto_solicitado.toLocaleString('es-CO')}
            </div>
          </div>
        </div>

        {/* Fila 2: Detalles en una sola línea + Acciones inline a la derecha */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-black/[0.02] dark:border-white/[0.02]">
          {/* Datos compactos inline */}
          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5 min-w-0">
            {anticipo.nombre_beneficiario && (
              <>
                <span className="font-semibold text-gray-600 dark:text-gray-300">Beneficiario:</span>
                <span className="opacity-85 truncate">{anticipo.nombre_beneficiario}</span>
              </>
            )}
            {anticipo.numero_telefono && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="font-semibold text-gray-600 dark:text-gray-300">Tel:</span>
                <span className="opacity-80">{anticipo.numero_telefono}</span>
              </>
            )}
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="opacity-70">{new Date(anticipo.created_at).toLocaleDateString('es-CO')}</span>
          </div>

          {/* Acciones Inline */}
          <div className="shrink-0 flex items-center gap-1.5">
            {anticipo.estado === 'pendiente' && (
              <div className="flex items-center gap-0.5 p-0.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-full backdrop-blur-md shadow-sm">
                <button 
                  onClick={() => { setModalComment(""); setModalConfig({ id: anticipo.id, action: 'aprobado', title: 'Aprobar Solicitud', description: '¿Deseas aprobar esta solicitud de anticipo? Puedes añadir comentarios de aprobación de forma opcional.', placeholder: 'Comentarios de aprobación (opcional)...', required: false }); setModalOpen(true); }} 
                  disabled={processing === anticipo.id}
                  className="w-[75px] h-[22px] text-[11px] font-semibold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full disabled:opacity-50 transition-all shadow-md shadow-cyan-500/20 dark:shadow-[0_0_10px_rgba(34,211,238,0.3)] active:scale-95 cursor-pointer leading-none flex items-center justify-center border-none"
                >
                  {processing === anticipo.id ? '...' : 'Aprobar'}
                </button>
                <button 
                  onClick={() => { setModalComment(""); setModalConfig({ id: anticipo.id, action: 'rechazado', title: 'Rechazar Solicitud', description: 'Por favor, ingresa el motivo del rechazo. Este campo es obligatorio para mantener la transparencia.', placeholder: 'Escribe el motivo del rechazo aquí...', required: true }); setModalOpen(true); }} 
                  disabled={processing === anticipo.id}
                  className="w-[75px] h-[22px] text-[11px] font-semibold bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-all active:scale-95 cursor-pointer leading-none flex items-center justify-center"
                >
                  Rechazar
                </button>
              </div>
            )}
            {anticipo.estado === 'aprobado' && (
              <div className="flex items-center gap-0.5 p-0.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-full backdrop-blur-md shadow-sm">
                <button 
                  onClick={() => { setModalComment(""); setModalConfig({ id: anticipo.id, action: 'realizado', title: 'Confirmar Transferencia', description: '¿Confirmas que la transferencia del anticipo ha sido realizada con éxito en tu banca móvil?', required: false }); setModalOpen(true); }} 
                  disabled={processing === anticipo.id}
                  className="w-[75px] h-[22px] text-[11px] font-semibold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full disabled:opacity-50 transition-all shadow-md shadow-cyan-500/20 dark:shadow-[0_0_10px_rgba(34,211,238,0.3)] active:scale-95 cursor-pointer leading-none flex items-center justify-center border-none"
                >
                  {processing === anticipo.id ? '...' : 'Realizado'}
                </button>
                <button 
                  onClick={() => { setModalComment(""); setModalConfig({ id: anticipo.id, action: 'reversado', title: 'Reversar Solicitud', description: '¿Estás seguro de reversar esta solicitud? Esto anulará la aprobación. Puedes añadir un motivo de forma opcional.', placeholder: 'Motivo de la reversión (opcional)...', required: false }); setModalOpen(true); }} 
                  disabled={processing === anticipo.id}
                  className="w-[75px] h-[22px] text-[11px] font-semibold bg-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-all active:scale-95 cursor-pointer leading-none flex items-center justify-center"
                >
                  Reversar
                </button>
              </div>
            )}
            {anticipo.estado === 'realizado' && (
              <div className="h-[22px] px-2.5 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-emerald-50/60 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/30 rounded-full shadow-sm backdrop-blur-sm leading-none shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Confirmación
              </div>
            )}
            {anticipo.estado === 'confirmado' && (
              <div className="h-[22px] px-2.5 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-emerald-50/60 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/30 rounded-full shadow-sm backdrop-blur-sm leading-none shrink-0">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                Confirmado
              </div>
            )}
            {anticipo.estado === 'reversado' && (
              <div className="h-[22px] px-2.5 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-orange-50/60 text-orange-700 border border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-400/30 rounded-full shadow-sm backdrop-blur-sm leading-none shrink-0">
                <AlertTriangle className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                Reversado
              </div>
            )}
          </div>
        </div>

        {/* Detalles expandibles progresivos */}
        {expandedId === anticipo.id && (
          <div className="mt-2.5 p-3.5 rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] border border-black/[0.03] dark:border-white/[0.03] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11.5px] text-gray-700 dark:text-gray-300 relative overflow-hidden animate-slide-up">
            <div><span className="font-semibold text-gray-500 dark:text-gray-400">Método de Pago:</span> {medioPagoInfo.tipo}</div>
            <div><span className="font-semibold text-gray-500 dark:text-gray-400">Periodo Quincenal:</span> {formatDateCO(anticipo.period?.start_date)} → {formatDateCO(anticipo.period?.end_date)}</div>
            {(anticipo.nombre_titular || anticipo.nombre_beneficiario) && <div><span className="font-semibold text-gray-500 dark:text-gray-400">Titular de Cuenta:</span> {anticipo.nombre_titular || anticipo.nombre_beneficiario}</div>}
            {(anticipo.documento_titular || anticipo.cedula_titular) && <div><span className="font-semibold text-gray-500 dark:text-gray-400">Documento / Cédula:</span> {anticipo.documento_titular || anticipo.cedula_titular}</div>}
            {(anticipo.banco || anticipo.banco_otro) && <div><span className="font-semibold text-gray-500 dark:text-gray-400">Entidad Bancaria:</span> {anticipo.banco || anticipo.banco_otro}</div>}
            {anticipo.tipo_cuenta && <div><span className="font-semibold text-gray-500 dark:text-gray-400">Tipo de Cuenta:</span> {anticipo.tipo_cuenta}</div>}
            {anticipo.numero_cuenta && <div className="break-all"><span className="font-semibold text-gray-500 dark:text-gray-400">Número de Cuenta:</span> {anticipo.numero_cuenta}</div>}
            {anticipo.numero_telefono && <div><span className="font-semibold text-gray-500 dark:text-gray-400">Teléfono Nequi/Davi:</span> {anticipo.numero_telefono}</div>}
            {anticipo.model?.email && <div className="sm:col-span-2"><span className="font-semibold text-gray-500 dark:text-gray-400">Correo Electrónico:</span> {anticipo.model.email}</div>}
            
            <div className="sm:col-span-2 mt-2 pt-2 border-t border-black/[0.03] dark:border-white/[0.03]">
              <button
                onClick={async () => { 
                  try { 
                    await navigator.clipboard.writeText(buildClipboardInfo(anticipo)); 
                    setSuccess('Información de transferencia copiada al portapapeles'); 
                    setTimeout(() => setSuccess(null), 2500); 
                  } catch { 
                    setError('No se pudo copiar'); 
                    setTimeout(() => setError(null), 2500); 
                  } 
                }}
                className="inline-flex items-center justify-center px-2.5 h-[22px] leading-none text-[10px] font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-xl shadow-md shadow-cyan-500/20 dark:shadow-[0_0_10px_rgba(34,211,238,0.3)] active:scale-95 transition-all duration-300 touch-manipulation cursor-pointer border-none"
              >
                <span>Copiar ficha</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const getEstadoColor = (e: string) => {
  const map: Record<string, string> = {
    pendiente: 'bg-amber-50/60 text-amber-700 border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-400/30',
    aprobado: 'bg-sky-50/60 text-sky-700 border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-400/30',
    rechazado: 'bg-red-50/60 text-red-700 border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:border-red-400/30',
    realizado: 'bg-emerald-50/60 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/30',
    confirmado: 'bg-teal-50/60 text-teal-700 border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-400/30',
    cancelado: 'bg-gray-50/60 text-gray-700 border-gray-500/20 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-400/30',
    reversado: 'bg-orange-50/60 text-orange-700 border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-400/30',
  };
  return map[e] || map.cancelado;
};

const getEstadoLabel = (e: string) => ({ pendiente:'Pendiente', aprobado:'Aprobado', rechazado:'Rechazado', realizado:'Realizado', confirmado:'Confirmado', cancelado:'Cancelado', reversado:'Reversado' }[e] || e);

function renderEstadoPill(estado: string) {
  const label = getEstadoLabel(estado);
  const colorClass = getEstadoColor(estado);
  
  let indicator: React.ReactNode = null;
  
  switch (estado) {
    case 'pendiente':
      indicator = (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
        </span>
      );
      break;
    case 'aprobado':
      indicator = (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500"></span>
        </span>
      );
      break;
    case 'rechazado':
      indicator = <X className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />;
      break;
    case 'realizado':
      indicator = (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
      );
      break;
    case 'confirmado':
      indicator = <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      break;
    case 'cancelado':
      indicator = <XCircle className="w-3 h-3 text-gray-500 dark:text-gray-400 shrink-0" />;
      break;
    case 'reversado':
      indicator = <AlertTriangle className="w-3 h-3 text-orange-600 dark:text-orange-400 shrink-0" />;
      break;
    default:
      break;
  }
  return (
    <>
      {/* Versión Móvil: Sin píldora (invisible wrapper, solo el indicador) */}
      <div 
        className="sm:hidden h-[22px] w-[22px] flex items-center justify-center shrink-0 select-none"
        title={label}
      >
        {indicator}
      </div>

      {/* Versión Desktop: Con la píldora circular original */}
      <div 
        className={`hidden sm:flex h-[22px] w-[22px] rounded-full border shadow-sm backdrop-blur-sm shrink-0 select-none items-center justify-center ${colorClass}`}
        title={label}
      >
        {indicator}
      </div>
    </>
  );
}

interface AnticipoHistoryCardItemProps {
  anticipo: Anticipo;
  getMedioPagoInfo: (a: Anticipo) => { tipo: string; info: string };
}

function AnticipoHistoryCardItem({
  anticipo,
  getMedioPagoInfo
}: AnticipoHistoryCardItemProps) {
  const [pillIndex, setPillIndex] = useState(0);
  const medio = getMedioPagoInfo(anticipo);
  const groupName = anticipo.model.user_groups?.[0]?.groups?.name || anticipo.model.groups?.[0]?.name;

  const pillItems = [
    groupName ? (
      <span key="group" className="h-5 inline-flex items-center justify-center text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-500/10 px-2.5 rounded-full border border-purple-500/20 dark:border-purple-400/30 shadow-sm backdrop-blur-sm">{groupName ? groupName.charAt(0).toUpperCase() + groupName.slice(1).toLowerCase() : ''}</span>
    ) : null,
    <span key="medio" className={`h-5 inline-flex items-center justify-center text-[11px] font-semibold px-2.5 rounded-full shrink-0 border shadow-sm backdrop-blur-sm ${
      anticipo.medio_pago === 'nequi' ? 'bg-pink-50/60 text-pink-700 border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-400/30' :
      anticipo.medio_pago === 'daviplata' ? 'bg-rose-50/60 text-rose-700 border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/30' :
      'bg-blue-50/60 text-blue-700 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/30'
    }`}>
      {medio.tipo ? medio.tipo.charAt(0).toUpperCase() + medio.tipo.slice(1).toLowerCase() : ''}
    </span>
  ].filter((p): p is JSX.Element => p !== null);

  return (
    <div className="relative group bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl border border-white/50 dark:border-white/10 p-3 sm:py-3.5 sm:px-5 shadow-[0_10px_30px_rgba(0,0,0,0.02)] dark:shadow-none transition-all duration-300 hover:shadow-[0_15px_40px_rgba(0,0,0,0.04)] hover:-translate-y-[1px]">
      <div className="space-y-2">
        {/* Fila 1: Nombre, Sedes, Medio de Pago, Monto y Estado */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate leading-none">
              {anticipo.model.email?.includes('@') ? anticipo.model.email.split('@')[0] : anticipo.model.name}
            </h3>
            
            {/* Desktop/Tablet Layout: Static Side-by-Side */}
            <div className="hidden sm:flex items-center gap-1.5">
              {groupName && (
                <span className="h-5 inline-flex items-center justify-center text-[11px] font-semibold text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-500/10 px-2.5 rounded-full border border-purple-500/20 dark:border-purple-400/30 shadow-sm backdrop-blur-sm">{groupName ? groupName.charAt(0).toUpperCase() + groupName.slice(1).toLowerCase() : ''}</span>
              )}

              <span className={`h-5 inline-flex items-center justify-center text-[11px] font-semibold px-2.5 rounded-full shrink-0 border shadow-sm backdrop-blur-sm ${
                anticipo.medio_pago === 'nequi' ? 'bg-pink-50/60 text-pink-700 border-pink-500/20 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-400/30' :
                anticipo.medio_pago === 'daviplata' ? 'bg-rose-50/60 text-rose-700 border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-400/30' :
                'bg-blue-50/60 text-blue-700 border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/30'
              }`}>
                {medio.tipo ? medio.tipo.charAt(0).toUpperCase() + medio.tipo.slice(1).toLowerCase() : ''}
              </span>
            </div>

            {/* Mobile Layout: Crossfade Carousel */}
            <div className="flex sm:hidden">
              {pillItems.length <= 1 ? (
                pillItems[0]
              ) : (
                <div 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setPillIndex(prev => (prev + 1) % pillItems.length); 
                  }}
                  className="relative cursor-pointer select-none h-5 w-[115px] flex items-center justify-start active:scale-95 transition-all duration-300 shrink-0"
                >
                  {pillItems.map((pill, idx) => (
                    <div 
                      key={idx}
                      className={`absolute inset-y-0 left-0 flex items-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        idx === pillIndex 
                          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' 
                          : 'opacity-0 translate-y-1.5 scale-95 pointer-events-none'
                      }`}
                    >
                      {pill}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-right -translate-y-[1px]">
            <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none flex items-center h-[22px]">
              ${anticipo.monto_solicitado.toLocaleString('es-CO')}
            </div>
            {renderEstadoPill(anticipo.estado)}
          </div>
        </div>

        {/* Fila 2: Detalles en una sola línea */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-black/[0.02] dark:border-white/[0.02]">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5 min-w-0">
            {anticipo.nombre_beneficiario && (
              <>
                <span className="font-semibold text-gray-600 dark:text-gray-300">Beneficiario:</span>
                <span className="opacity-85 truncate">{anticipo.nombre_beneficiario}</span>
              </>
            )}
            {anticipo.numero_telefono && (
              <>
                {anticipo.nombre_beneficiario && <span className="text-gray-300 dark:text-gray-600">•</span>}
                <span className="font-semibold text-gray-600 dark:text-gray-300">Tel:</span>
                <span className="opacity-80">{anticipo.numero_telefono}</span>
              </>
            )}
            {(anticipo.nombre_beneficiario || anticipo.numero_telefono) && <span className="text-gray-300 dark:text-gray-600">•</span>}
            <span className="opacity-70">{new Date(anticipo.created_at).toLocaleDateString('es-CO')}</span>
          </div>
        </div>

        {/* Comentarios condicionales (fuera del flujo por defecto si existen) */}
        {anticipo.comentarios_admin && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl text-[10.5px] text-blue-800 dark:text-blue-300 mt-2 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <div><span className="font-bold">Comentarios Admin:</span> {anticipo.comentarios_admin}</div>
          </div>
        )}
        {anticipo.comentarios_rechazo && (
          <div className="p-2 bg-red-50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-900/20 rounded-xl text-[10.5px] text-red-800 dark:text-red-300 mt-2 flex items-start gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <div><span className="font-bold">Motivo de Rechazo:</span> {anticipo.comentarios_rechazo}</div>
          </div>
        )}
      </div>
    </div>
  );
}
