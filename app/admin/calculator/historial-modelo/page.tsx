'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from '@/components/ui/PageHeader';
import { Building2, History, Plus, Search, Users, X, AlertTriangle, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo' | 'superadmin_aff';
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

interface GroupOption {
  id: string;
  name: string;
}

interface Model {
  id: string;
  email: string;
  name: string;
  groups: Array<{ id: string; name: string }>;
  hasConfig?: boolean;
  currentConfig?: any;
}

export default function HistorialModeloPage() {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI filtros (como en la imagen)
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');

  const [allModels, setAllModels] = useState<Model[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Estados para recreación manual de períodos históricos (Admin)
  const [showRecreateModal, setShowRecreateModal] = useState(false);
  const [recreateYear, setRecreateYear] = useState(new Date().getFullYear().toString());
  const [recreateMonth, setRecreateMonth] = useState((new Date().getMonth() + 1).toString());
  const [recreatePeriodType, setRecreatePeriodType] = useState('1-15');
  const [rates, setRates] = useState({ eur_usd: '1.01', gbp_usd: '1.20', usd_cop: '3900' });
  const [portfolioPlatforms, setPortfolioPlatforms] = useState<any[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({});
  const [platformValues, setPlatformValues] = useState<Record<string, string>>({});
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeHasData, setIframeHasData] = useState(false);
  const [iframeSelectedPeriod, setIframeSelectedPeriod] = useState<any>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'PERIOD_DATA_STATUS') {
          setIframeHasData(event.data.hasData);
          setIframeSelectedPeriod({
            year: event.data.selectedYear,
            month: event.data.selectedMonth,
            periodType: event.data.selectedPeriodType
          });
          if (event.data.selectedYear) setRecreateYear(event.data.selectedYear);
          if (event.data.selectedMonth) setRecreateMonth(event.data.selectedMonth);
          if (event.data.selectedPeriodType) setRecreatePeriodType(event.data.selectedPeriodType);
        } else if (event.data.type === 'OPEN_RECREATE_MODAL') {
          handleOpenRecreateModal();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const router = useRouter();
  const hasNavigatedRef = useRef(false);

  // Inicializar usuario + cargar grupos + cargar modelos
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setError('No hay usuario autenticado');
          return;
        }

        // Cargar usuario (tabla negocio)
        const { data: userRow, error: userError } = await supabase
          .from('users')
          // `users.groups` NO existe en la BD; la relación se modela vía `user_groups`
          .select('id,email,name,role,organization_id,is_active,last_login')
          .eq('id', uid)
          .single();

        if (userError || !userRow) {
          setError(userError?.message || 'Usuario no encontrado');
          return;
        }

        setUser(userRow);

        // Token para /api/groups
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setError('No hay sesión válida');
          return;
        }

        // Grupos (ya aplican filtro de afiliado en el backend)
        const groupsRes = await fetch('/api/groups', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const groupsData = await groupsRes.json();

        if (groupsData?.success && Array.isArray(groupsData.groups)) {
          const mappedGroups = groupsData.groups.map((g: any) => ({ id: g.id, name: g.name }));
          setAvailableGroups(mappedGroups);
        } else {
          setAvailableGroups([]);
        }

        // Modelos (backend filtra por admin/afiliado con adminId)
        const modelsRes = await fetch(`/api/calculator/models?adminId=${uid}`);
        const modelsData = await modelsRes.json();
        if (modelsData?.success) {
          setAllModels(modelsData.models || []);
        } else {
          setAllModels([]);
        }
      } catch (e: any) {
        setError(e?.message || 'Error inicializando');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // El iframe se encarga de mostrar el historial en el panel derecho.

  // Pre-poblar tasas automáticas cuando cambian los filtros del modal
  useEffect(() => {
    if (showRecreateModal) {
      fetchPortfolioAndRates();
    }
  }, [recreateYear, recreateMonth, recreatePeriodType, showRecreateModal]);

  const handleOpenRecreateModal = () => {
    setShowRecreateModal(true);
    setRates({ eur_usd: '1.01', gbp_usd: '1.20', usd_cop: '3900' });
    setSelectedPlatforms({});
    setPlatformValues({});
  };

  const fetchPortfolioAndRates = async () => {
    if (!selectedModelId) return;
    setLoadingPortfolio(true);

    try {
      // 1. Cargar portafolio de la modelo
      const portfolioRes = await fetch(`/api/modelo-plataformas?model_id=${selectedModelId}`);
      const portfolio = await portfolioRes.json();
      setPortfolioPlatforms(portfolio || []);

      // Seleccionar por defecto todas las plataformas activas
      const defaultSelections: Record<string, boolean> = {};
      (portfolio || []).forEach((item: any) => {
        defaultSelections[item.platform_id] = true;
      });
      setSelectedPlatforms(defaultSelections);

      // 2. Fetch rates for the selected period date from database history or active catalog
      const dateStr = `${recreateYear}-${recreateMonth.padStart(2, '0')}-${recreatePeriodType === '1-15' ? '01' : '16'}`;
      
      const { data: historyRates } = await supabase
        .from('calculator_history')
        .select('rate_eur_usd, rate_gbp_usd, rate_usd_cop')
        .eq('period_date', dateStr)
        .neq('platform_id', '__CONSOLIDATED_TOTAL__')
        .limit(1);

      if (historyRates && historyRates.length > 0) {
        setRates({
          eur_usd: historyRates[0].rate_eur_usd?.toString() || '1.01',
          gbp_usd: historyRates[0].rate_gbp_usd?.toString() || '1.20',
          usd_cop: historyRates[0].rate_usd_cop?.toString() || '3900'
        });
      } else {
        const { data: activeRates } = await supabase
          .from('rates')
          .select('kind, value')
          .eq('active', true)
          .is('valid_to', null);
        if (activeRates) {
          setRates({
            eur_usd: activeRates.find((r: any) => r.kind === 'EUR→USD')?.value?.toString() || '1.01',
            gbp_usd: activeRates.find((r: any) => r.kind === 'GBP→USD')?.value?.toString() || '1.20',
            usd_cop: activeRates.find((r: any) => r.kind === 'USD→COP')?.value?.toString() || '3900'
          });
        }
      }
    } catch (e) {
      console.error('Error fetching details:', e);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const handleSaveRecreation = async () => {
    if (!selectedModelId || saving) return;

    // Filtrar plataformas seleccionadas que tengan valor mayor a cero
    const platformsData: Record<string, number> = {};
    let hasAtLeastOne = false;
    
    portfolioPlatforms.forEach(p => {
      if (selectedPlatforms[p.platform_id]) {
        const val = Number(platformValues[p.platform_id]) || 0;
        if (val > 0) {
          platformsData[p.platform_id] = val;
          hasAtLeastOne = true;
        }
      }
    });

    if (!hasAtLeastOne) {
      alert('Debes ingresar un valor mayor a cero en al menos una plataforma seleccionada para poder recrear el período.');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Sesión no válida');

      const targetDate = `${recreateYear}-${recreateMonth.padStart(2, '0')}-${recreatePeriodType === '1-15' ? '01' : '16'}`;

      const response = await fetch('/api/admin/calculator-history/recreate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          modelId: selectedModelId,
          period_date: targetDate,
          period_type: recreatePeriodType,
          rates: {
            eur_usd: Number(rates.eur_usd) || 1.01,
            gbp_usd: Number(rates.gbp_usd) || 1.20,
            usd_cop: Number(rates.usd_cop) || 3900
          },
          platforms: platformsData
        })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setShowRecreateModal(false);
      setIframeKey(prev => prev + 1); // Forzar recarga del iframe al instante
    } catch (e: any) {
      alert('Error recreando período: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredModels = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return (allModels || []).filter((m) => {
      const groupOk = !selectedGroup || (m.groups || []).some((g) => g.id === selectedGroup);
      const nameOk = !q || (m.email || '').toLowerCase().includes(q) || (m.name || '').toLowerCase().includes(q);
      return groupOk && nameOk;
    });
  }, [allModels, nameFilter, selectedGroup]);

  const selectedModel = useMemo(() => {
    return filteredModels.find((m) => m.id === selectedModelId) || null;
  }, [filteredModels, selectedModelId]);

  // Si los filtros cambian y el modelo seleccionado deja de estar en el filtro, limpiar selección.
  useEffect(() => {
    if (!selectedModelId) return;
    const stillVisible = filteredModels.some((m) => m.id === selectedModelId);
    if (!stillVisible) setSelectedModelId('');
  }, [filteredModels, selectedModelId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-600/20 p-8 max-w-md">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4 text-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header estandarizado */}
        <PageHeader 
          title="Histórico Modelos"
          subtitle="Filtra por grupo y consulta el historial de facturación de una modelo"
          icon={<History className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          glow="admin"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 px-3 sm:px-0">
          {/* Panel izquierdo: Filtros */}
          <div className="md:col-span-1 relative z-20">
            {/* Título exterior: Por Grupo */}
            {availableGroups.length > 0 && (
              <div className="flex items-center gap-2 px-1 sm:px-2 mb-2 sm:mb-3">
                <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Por Grupo</h2>
              </div>
            )}
            
            <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-3 space-y-4 sm:space-y-6">
              {/* Filtro por Grupo */}
              {availableGroups.length > 0 && (
                <div>
                  <AppleDropdown
                    options={[
                      ...availableGroups.map((g) => ({ value: g.id, label: g.name }))
                    ]}
                    value={selectedGroup}
                    onChange={setSelectedGroup}
                    placeholder="Selecciona"
                    className="text-sm"
                  />
                </div>
              )}
              
              {/* Buscador y Selección de Modelo Integrados */}
              <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-xl p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-[18px] h-[18px] text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.5)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Buscar o Seleccionar</h2>
                  </div>
                  {nameFilter.trim() !== '' && (
                    <span className="text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      {filteredModels.length} resultados
                    </span>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-black/30 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar por correo o nombre..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="apple-input w-full text-sm h-[38px] pl-9 pr-8 rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
                    />
                    {nameFilter && (
                      <button 
                        onClick={() => setNameFilter('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <AppleDropdown
                    options={
                      filteredModels.length === 0
                        ? [{ value: '', label: 'No hay modelos disponibles' }]
                        : filteredModels.map((m) => ({
                            value: m.id,
                            label: m.email.split('@')[0],
                            badge: m.hasConfig ? 'Configurada' : 'Sin configurar',
                            badgeColor: (m.hasConfig ? 'green' : 'gray') as 'green' | 'gray'
                          }))
                    }
                    value={selectedModelId}
                    onChange={setSelectedModelId}
                    placeholder="Selecciona un modelo"
                    className="text-sm"
                    autoOpen={nameFilter.length > 0 && filteredModels.length > 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Panel derecho: Historial o Estado Vacío */}
          <div className="md:col-span-2 relative z-10">
            {!selectedModelId ? (
              <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-6 md:p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="text-gray-400/50 dark:text-gray-500/30 mb-6 text-6xl">📄</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">Selecciona un modelo</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm text-center">
                  Usa los filtros o el buscador en el panel izquierdo para seleccionar un modelo y ver su historial.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header of the right panel */}
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
                    Historial de {selectedModel?.name ? selectedModel.name.trim().split(/\s+/).slice(0, 2).join(' ') : selectedModel?.email.split('@')[0]}
                  </h3>
                   {!iframeHasData && (
                    <button
                      onClick={handleOpenRecreateModal}
                      className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-semibold btn-apple-primary active:scale-[0.97] touch-manipulation shrink-0"
                    >
                      Recrear Historial
                    </button>
                  )}
                </div>
                
                <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-4">
                  <iframe
                    key={`${selectedModelId}-${iframeKey}`}
                    src={`/admin/model/calculator/historial?modelId=${selectedModelId}&embedded=true`}
                    className="w-full h-[75vh] rounded-lg border-0 bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL GLASSMÓRFICO: Recrear Período Histórico Completo */}
      {showRecreateModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-white/90 dark:bg-[#161618]/90 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl p-6 overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
            <div className="absolute top-0 right-0 p-4">
              <button
                onClick={() => setShowRecreateModal(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[10px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">Administración</span>
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Recrear Período Histórico
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Modelo: {selectedModel?.name || selectedModel?.email}
              </p>
            </div>

            {/* Scrollable Form Content */}
            <div className="space-y-5 overflow-y-auto pr-1 flex-1 apple-scroll">
              
              {/* Sección 1: Selección de Fecha y Quincena */}
              <div className="grid grid-cols-3 gap-3 bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-2xl border border-black/5 dark:border-white/5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Año</label>
                  <select
                    value={recreateYear}
                    onChange={(e) => setRecreateYear(e.target.value)}
                    className="w-full h-9 text-xs px-2.5 rounded-xl bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Mes</label>
                  <select
                    value={recreateMonth}
                    onChange={(e) => setRecreateMonth(e.target.value)}
                    className="w-full h-9 text-xs px-2.5 rounded-xl bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>
                        {new Date(2000, m - 1, 1).toLocaleString('es-CO', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Quincena</label>
                  <select
                    value={recreatePeriodType}
                    onChange={(e) => setRecreatePeriodType(e.target.value)}
                    className="w-full h-9 text-xs px-2.5 rounded-xl bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="1-15">P1 (1-15)</option>
                    <option value="16-31">P2 (16-final)</option>
                  </select>
                </div>
              </div>

              {/* Sección 2: Tasas de Cambio del Período */}
              <div className="space-y-3 bg-black/[0.02] dark:bg-white/[0.02] p-3 rounded-2xl border border-black/5 dark:border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest">Tasas Aplicadas</span>
                  <span className="text-[9px] font-medium text-gray-400 tracking-normal">(Pre-cargadas automáticamente)</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-1">EUR→USD</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={rates.eur_usd}
                      onChange={(e) => setRates({ ...rates, eur_usd: e.target.value })}
                      className="w-full h-9 text-xs px-2 rounded-xl bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-1">GBP→USD</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={rates.gbp_usd}
                      onChange={(e) => setRates({ ...rates, gbp_usd: e.target.value })}
                      className="w-full h-9 text-xs px-2 rounded-xl bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-1">USD→COP</label>
                    <input
                      type="number"
                      step="1"
                      value={rates.usd_cop}
                      onChange={(e) => setRates({ ...rates, usd_cop: e.target.value })}
                      className="w-full h-9 text-xs px-2 rounded-xl bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 text-gray-900 dark:text-white font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 3: Valores de Plataformas habilitadas */}
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest block">Valores del Período</span>
                {loadingPortfolio ? (
                  <div className="h-20 flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5">
                    <span className="text-xs text-gray-500 animate-pulse">Cargando portafolio...</span>
                  </div>
                ) : portfolioPlatforms.length === 0 ? (
                  <div className="p-4 text-center bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-2xl">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">Esta modelo no tiene plataformas habilitadas en su portafolio de calculadora.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 apple-scroll">
                    {portfolioPlatforms.map((platform) => {
                      const isChecked = selectedPlatforms[platform.platform_id] || false;
                      const displayCurrency = ['chaturbate', 'myfreecams', 'stripchat', 'dxlive'].includes(platform.platform_id.toLowerCase()) ? 'TKN' : (platform.currency || 'USD');
                      return (
                        <div key={platform.platform_id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isChecked 
                            ? 'bg-black/[0.02] dark:bg-white/[0.02] border-black/10 dark:border-white/10 opacity-100' 
                            : 'bg-black/[0.01] dark:bg-white/[0.01] border-black/5 dark:border-white/5 opacity-60'
                        }`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => setSelectedPlatforms({ ...selectedPlatforms, [platform.platform_id]: e.target.checked })}
                              className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 shrink-0 cursor-pointer"
                            />
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`text-[8.5px] uppercase font-extrabold px-1.5 py-[2px] rounded shrink-0 ${
                                platform.currency === 'EUR' ? 'bg-emerald-100/60 dark:bg-[#2dd4bf]/15 text-emerald-700 dark:text-[#2dd4bf]' :
                                platform.currency === 'GBP' ? 'bg-blue-100/60 dark:bg-[#5caaf5]/15 text-blue-700 dark:text-[#5caaf5]' :
                                'bg-purple-100/60 dark:bg-[#c488fc]/15 text-purple-700 dark:text-[#c488fc]'
                              }`}>
                                {displayCurrency}
                              </span>
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-800 dark:text-gray-200 truncate">
                                {platform.platform_name || platform.platform_id}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="number"
                              disabled={!isChecked}
                              placeholder="0.00"
                              value={platformValues[platform.platform_id] || ''}
                              onChange={(e) => setPlatformValues({ ...platformValues, [platform.platform_id]: e.target.value })}
                              className="h-8 w-20 bg-white dark:bg-[#202023] border border-black/10 dark:border-white/10 rounded-xl px-2 text-right text-xs font-semibold focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-black/5 dark:border-white/5 shrink-0">
              <button
                onClick={() => setShowRecreateModal(false)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRecreation}
                disabled={saving || loadingPortfolio || portfolioPlatforms.length === 0}
                className="flex-1 py-2.5 text-xs font-bold btn-apple-primary active:scale-[0.97] touch-manipulation disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? 'Recreando...' : 'Guardar y Recrear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

