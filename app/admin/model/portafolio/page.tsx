'use client';

import { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { supabase } from '@/lib/supabase';
import PortfolioAnalytics from '@/components/PortfolioAnalytics';
import { 
  Building2, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  Target,
  Activity,
  ExternalLink,
  Lock,
  Copy,
  User,
  Info
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import GlassCard from '@/components/ui/GlassCard';
import PillTabs from '@/components/ui/PillTabs';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';

interface Platform {
  id: string;
  platform_id: string;
  status: string;
  requested_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  deactivated_at: string | null;
  notes: string | null;
  is_initial_config: boolean;
  calculator_sync: boolean;
  calculator_activated_at: string | null;
  created_at: string;
  updated_at: string;
  calculator_platforms: {
    id: string;
    name: string;
    currency: string;
    login_url: string | null;
  };
  stats: {
    totalDays: number;
    connectionPercentage: number;
    avgUsdModelo: number;
    totalUsdModelo: number;
    lastActivity: string | null;
    trend: string; // Tendencia: ↑, ↓, =
  };
}

interface PortfolioData {
  platforms: Platform[];
  summary: {
    totalPlatforms: number;
    activePlatforms: number;
    pendingConfirmation: number;
    totalUsdModelo: number;
    totalCopModelo: number;
    avgUsdPerPlatform: number;
  };
  lastUpdated: string;
}

interface Credentials {
  login_username: string | null;
  login_password: string | null;
  login_url: string | null;
  hasCredentials: boolean;
}

interface Credentials3CX {
  app_3cx_username: string | null;
  app_3cx_password: string | null;
  hasCredentials: boolean;
}

export default function MiPortafolio() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [confirmingPlatform, setConfirmingPlatform] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'platforms' | 'analytics'>('platforms');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [platformTab, setPlatformTab] = useState<'details' | 'metrics'>('details');
  const [credentials3CX, setCredentials3CX] = useState<Credentials3CX>({
    app_3cx_username: '',
    app_3cx_password: '',
    hasCredentials: false
  });
  const [loading3CX, setLoading3CX] = useState(false);
  const [showPassword3CX, setShowPassword3CX] = useState(false);

  // Cargar usuario autenticado
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUser(authUser);
        } else {
          setError('Usuario no autenticado');
        }
      } catch (err) {
        setError('Error al cargar usuario');
      }
    };
    loadUser();
  }, []);

  // Cargar datos del portafolio
  useEffect(() => {
    if (user?.id) {
      loadPortfolioData();
    }
  }, [user?.id]);

  // Cargar credenciales cuando se selecciona una plataforma
  useEffect(() => {
    if (selectedPlatform && user?.id) {
      loadCredentials(selectedPlatform.platform_id);
      setPlatformTab('details'); // Resetear a pestaña de detalles al cambiar de plataforma
      
      // Cargar credenciales de 3CX si es Superfoon
      const isSuperfoon = 
        selectedPlatform.calculator_platforms.id?.toLowerCase() === 'superfoon' ||
        selectedPlatform.calculator_platforms.name?.toLowerCase().includes('superfoon');
      
      if (isSuperfoon) {
        loadCredentials3CX(selectedPlatform.platform_id);
      } else {
        setCredentials3CX({
          app_3cx_username: '',
          app_3cx_password: '',
          hasCredentials: false
        });
      }
    } else {
      setCredentials(null);
      setShowPassword(false);
      setCredentials3CX({
        app_3cx_username: '',
        app_3cx_password: '',
        hasCredentials: false
      });
    }
  }, [selectedPlatform, user?.id]);

  // 🔧 Asegurar que la página inicie en la parte superior (0%)
  useEffect(() => {
    // Scroll to top cuando se carga la página
    window.scrollTo(0, 0);
  }, []);

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/modelo-portafolio?modelId=${user?.id}`);
      const result = await response.json();

      if (result.success) {
        setPortfolioData(result.data);
        // No seleccionar ninguna plataforma por defecto
        setSelectedPlatform(null);
      } else {
        setError(result.error || 'Error al cargar el portafolio');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el portafolio');
    } finally {
      setLoading(false);
    }
  };

  const confirmPlatform = async (platformId: string) => {
    try {
      setConfirmingPlatform(platformId);
      const response = await fetch('/api/modelo-portafolio/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId,
          modelId: user?.id
        })
      });

      const result = await response.json();

      if (result.success) {
        // Recargar datos
        loadPortfolioData();
      } else {
        setError(result.error || 'Error al confirmar plataforma');
      }
    } catch (err: any) {
      setError(err.message || 'Error al confirmar plataforma');
    } finally {
      setConfirmingPlatform(null);
    }
  };

  const loadCredentials = async (platformId: string) => {
    if (!user?.id || !platformId) return;

    try {
      setLoadingCredentials(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error('No se pudo obtener token de autenticación');
        return;
      }

      const response = await fetch(
        `/api/modelo-plataformas/credentials?platform_id=${platformId}&model_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Asegurar que hasCredentials se establece correctamente
          setCredentials({
            ...result.data,
            hasCredentials: result.hasCredentials !== undefined ? result.hasCredentials : !!(result.data?.login_username && result.data?.login_password)
          });
        } else {
          // Si no hay credenciales, usar el login_url de la plataforma
          setCredentials({
            login_username: null,
            login_password: null,
            login_url: result.data?.login_url || selectedPlatform?.calculator_platforms?.login_url || null,
            hasCredentials: false
          });
        }
      } else {
        console.error('Error cargando credenciales:', await response.text());
        // Si hay error, al menos mostrar el login_url de la plataforma si existe
        setCredentials({
          login_username: null,
          login_password: null,
          login_url: selectedPlatform?.calculator_platforms?.login_url || null,
          hasCredentials: false
        });
      }
    } catch (err: any) {
      console.error('Error cargando credenciales:', err);
      setCredentials(null);
    } finally {
      setLoadingCredentials(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Opcional: mostrar notificación de éxito
      alert('Copiado al portapapeles');
    }).catch(err => {
      console.error('Error copiando al portapapeles:', err);
    });
  };

  const loadCredentials3CX = async (platformId: string) => {
    if (!user?.id || !platformId) return;

    try {
      setLoading3CX(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        console.error('No se pudo obtener token de autenticación');
        return;
      }

      const response = await fetch(
        `/api/modelo-plataformas/credentials-3cx?platform_id=${platformId}&model_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCredentials3CX({
            app_3cx_username: result.data.app_3cx_username || '',
            app_3cx_password: result.data.app_3cx_password || '',
            hasCredentials: !!(result.data.app_3cx_username && result.data.app_3cx_password)
          });
        } else {
          setCredentials3CX({
            app_3cx_username: '',
            app_3cx_password: '',
            hasCredentials: false
          });
        }
      } else {
        setCredentials3CX({
          app_3cx_username: '',
          app_3cx_password: '',
          hasCredentials: false
        });
      }
    } catch (err: any) {
      console.error('Error cargando credenciales 3CX:', err);
      setCredentials3CX({
        app_3cx_username: '',
        app_3cx_password: '',
        hasCredentials: false
      });
    } finally {
      setLoading3CX(false);
    }
  };


  // Función para obtener el color base según la divisa de la plataforma
  const getCurrencyDotColor = (currency: string) => {
    const curr = (currency || '').toUpperCase();
    if (curr === 'EUR') return 'bg-emerald-500'; // Verde
    if (curr === 'USD') return 'bg-purple-500'; // Morado
    if (curr === 'TOKENS') return 'bg-purple-500'; // Manejados como USD
    if (curr === 'GBP') return 'bg-blue-500'; // Azul
    if (curr === 'COP') return 'bg-yellow-500';
    return 'bg-slate-400'; // Default
  };

  // Función para obtener el halo brillante según la divisa
  const getCurrencyGlowColor = (currency: string) => {
    const curr = (currency || '').toUpperCase();
    if (curr === 'EUR') return 'bg-emerald-500/20 ring-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    if (curr === 'USD') return 'bg-purple-500/20 ring-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.6)]';
    if (curr === 'TOKENS') return 'bg-purple-500/20 ring-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.6)]'; // Manejados como USD
    if (curr === 'GBP') return 'bg-blue-500/20 ring-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
    if (curr === 'COP') return 'bg-yellow-500/20 ring-yellow-500/30 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
    return 'bg-slate-400/30 ring-slate-400/20';
  };

  // Función para obtener el color de la etiqueta de la divisa
  const getCurrencyBadgeColor = (currency: string) => {
    const curr = (currency || '').toUpperCase();
    if (curr === 'EUR') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30';
    if (curr === 'USD') return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30';
    if (curr === 'TOKENS') return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30';
    if (curr === 'GBP') return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30';
    if (curr === 'COP') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-200 dark:border-slate-500/30';
  };

  // Función para manejar click en etiqueta de plataforma (toggle expandir/contraer)
  const handlePlatformClick = (platform: Platform) => {
    // Si la plataforma ya está seleccionada, la deseleccionamos (contraer)
    if (selectedPlatform?.id === platform.id) {
      setSelectedPlatform(null);
    } else {
      // Si no está seleccionada, la seleccionamos (expandir)
      setSelectedPlatform(platform);
      
      // Auto-scroll en móvil para centrar el modal recién abierto
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        setTimeout(() => {
          document.getElementById('mobile-platform-modal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmada':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'entregada':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'desactivada':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        // Tratar estados no reconocidos como confirmados (por configuración inicial)
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmada':
        return 'Confirmada';
      case 'entregada':
        return 'Pendiente de confirmación';
      case 'desactivada':
        return 'Desactivada';
      default:
        // Tratar estados no definidos como confirmados
        return 'Confirmada';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700/50 text-green-700 dark:text-green-300';
      case 'entregada':
        return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700/50 text-yellow-700 dark:text-yellow-300';
      case 'desactivada':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300';
      default:
        // Tratar estados no definidos como confirmados
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700/50 text-green-700 dark:text-green-300';
    }
  };

  // Detectar si la plataforma seleccionada es Superfoon (por id o nombre)
  const isSelectedPlatformSuperfoon =
    !!selectedPlatform &&
    (
      selectedPlatform.calculator_platforms.id?.toLowerCase() === 'superfoon' ||
      selectedPlatform.calculator_platforms.name?.toLowerCase().includes('superfoon')
    );

  if (loading) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center bg-white/20 dark:bg-gray-900/40 p-6 rounded-2xl backdrop-blur-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-800 dark:text-gray-200 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center bg-white/20 dark:bg-gray-900/40 p-8 rounded-2xl backdrop-blur-md border border-white/20">
          <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-screen-2xl mx-auto max-sm:px-0 px-4 sm:px-6 lg:px-20 xl:px-32 py-8 pt-6 sm:pt-8 relative z-10">
        {/* Header — Migrado a PageHeader */}
        <PageHeader
          title="Mi Portafolio"
          subtitle="Gestiona tus plataformas y confirma entregas"
          glow="model"
          icon={<Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          actionClassName="max-sm:hidden"
          actions={
            <PillTabs
              tabs={[
                { id: 'platforms', label: 'Mis Plataformas' },
                { id: 'analytics', label: 'Tendencia' }
              ]}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
              variant="guardar"
            />
          }
        />

        {/* Controles de Pestañas (Exclusivo en MÓVIL, centrado y debajo del header) */}
        <div className="w-full sm:hidden flex justify-center px-0 mb-6">
          <PillTabs
            tabs={[
              { id: 'platforms', label: 'Mis Plataformas' },
              { id: 'analytics', label: 'Tendencia' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
            variant="guardar"
          />
        </div>

        {activeTab === 'platforms' && (
          <>
            {/* Título de sección Apple Style 2 */}
            <div className="flex items-center justify-between px-1 mb-2 mt-2">
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <div className="flex items-center justify-center text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]">
                  <Activity className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" strokeWidth={2.5} />
                </div>
                <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  Mis Plataformas
                </h2>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[12px] sm:text-[13px] font-medium text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/10">
                  {portfolioData?.platforms.length || 0} en total
                </span>
              </div>
            </div>

            {/* Caja de Plataformas */}
            <GlassCard padding="md">

              {portfolioData?.platforms.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tienes plataformas asignadas</h3>
                  <p className="text-gray-500 dark:text-gray-400">Contacta a tu administrador para asignar plataformas a tu portafolio.</p>
                </div>
              ) : (
                <>
                  {/* Lista Integrada (Estilo iOS) */}
                  <div className="flex flex-col bg-white/40 dark:bg-black/20 rounded-xl sm:rounded-2xl border border-black/[0.05] dark:border-white/[0.05] overflow-y-auto mb-4 sm:mb-6 divide-y divide-black/5 dark:divide-white/5 max-h-[274px] sm:max-h-[284px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/20 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-black/30 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {portfolioData?.platforms.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        className={`flex items-center justify-between w-full p-4 sm:px-5 sm:py-4 text-left transition-all duration-200 touch-manipulation group ${
                          selectedPlatform?.id === platform.id
                            ? 'bg-blue-50/60 dark:bg-blue-900/20 shadow-[inset_3px_0_0_0_rgba(59,130,246,1)] dark:shadow-[inset_3px_0_0_0_rgba(96,165,250,1)]'
                            : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:bg-black/[0.04] dark:active:bg-white/[0.04]'
                        }`}
                        onClick={() => handlePlatformClick(platform)}
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Indicador mágico multicapa (Basado en Divisas) */}
                          <div className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
                            <span className={`absolute inset-0 rounded-full ring-1 ${getCurrencyGlowColor(platform.calculator_platforms.currency)} ${selectedPlatform?.id === platform.id ? 'animate-ping opacity-50 duration-700' : 'animate-pulse'}`}></span>
                            <span className={`relative w-2 h-2 rounded-full ${getCurrencyDotColor(platform.calculator_platforms.currency)} z-10`}></span>
                          </div>
                          <span className={`text-[14px] sm:text-[15px] font-semibold tracking-tight ${selectedPlatform?.id === platform.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                            {platform.calculator_platforms.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center">
                          <svg 
                            className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 ${selectedPlatform?.id === platform.id ? 'text-blue-500 rotate-90' : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Ventana de Visualización con transición */}
                  <div id="mobile-platform-modal" className={`overflow-visible transition-all duration-500 ease-out transform ${
                    selectedPlatform 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'max-h-0 opacity-0 translate-y-0 scale-100 overflow-hidden'
                  }`}>
                    {selectedPlatform && (
                      <div className="mt-2 sm:mt-4 rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-white/40 dark:bg-black/20 backdrop-blur-3xl border border-black/[0.05] dark:border-white/[0.05] shadow-lg dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 relative overflow-hidden">
                        {/* Botón cerrar solo en móvil */}
                        <div className="flex justify-end mb-2 sm:hidden">
                          <button
                            onClick={() => setSelectedPlatform(null)}
                            className="p-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
                            aria-label="Cerrar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {/* Header con información principal */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-5 sm:mb-6">
                          <div className="flex items-center min-w-0 flex-1">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-row items-center gap-2 sm:gap-3">
                                {selectedPlatform.calculator_platforms.currency && (
                                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider flex-shrink-0 ${getCurrencyBadgeColor(selectedPlatform.calculator_platforms.currency)}`}>
                                    {selectedPlatform.calculator_platforms.currency}
                                  </span>
                                )}
                                <h3 className="text-[18px] sm:text-[20px] font-bold text-gray-900 dark:text-gray-100 break-words sm:truncate tracking-tight uppercase">
                                  {selectedPlatform.calculator_platforms.name}
                                </h3>
                              </div>
                            </div>
                          </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 sm:flex-shrink-0">
                          {selectedPlatform.status === 'entregada' && (
                              <button
                                onClick={() => confirmPlatform(selectedPlatform.platform_id)}
                                disabled={confirmingPlatform === selectedPlatform.platform_id}
                                className="w-full sm:w-auto px-5 py-3 sm:px-4 sm:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 text-base sm:text-sm font-medium shadow-md hover:shadow-lg active:scale-95 touch-manipulation min-h-[48px] sm:min-h-0"
                              >
                                {confirmingPlatform === selectedPlatform.platform_id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-5 w-5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                                    <span>Confirmando...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                                    <span>Confirmar Recepción</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Pestañas internas del modal */}
                        <div className="mb-5 sm:mb-6 border-b border-black/10 dark:border-white/10">
                          <div className="flex space-x-6 sm:space-x-8">
                            <button
                              onClick={() => {
                                setPlatformTab('details');
                                if (typeof window !== 'undefined' && window.innerWidth < 640) {
                                  setTimeout(() => {
                                    document.getElementById('mobile-platform-modal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 150);
                                }
                              }}
                              className={`pb-3 text-[14px] sm:text-[15px] font-semibold transition-all duration-200 active:scale-95 touch-manipulation relative ${
                                platformTab === 'details'
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              Detalles
                              {platformTab === 'details' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-900 dark:bg-white rounded-t-full"></span>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setPlatformTab('metrics');
                                if (typeof window !== 'undefined' && window.innerWidth < 640) {
                                  setTimeout(() => {
                                    document.getElementById('mobile-platform-modal')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 150);
                                }
                              }}
                              className={`pb-3 text-[14px] sm:text-[15px] font-semibold transition-all duration-200 active:scale-95 touch-manipulation relative ${
                                platformTab === 'metrics'
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              Métricas
                              {platformTab === 'metrics' && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-gray-900 dark:bg-white rounded-t-full"></span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Contenido de pestaña: Detalles */}
                        {platformTab === 'details' && (
                          <div className="space-y-5 sm:space-y-4">
                            {/* Credenciales de acceso */}
                            {(selectedPlatform.status === 'entregada' || selectedPlatform.status === 'confirmada') && (
                              <div className="mt-2 sm:mt-4 pt-5 sm:pt-4 border-t-2 sm:border-t border-gray-200 dark:border-gray-600 space-y-5 sm:space-y-4">
                                {loadingCredentials ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Cargando credenciales...</span>
                                  </div>
                                ) : credentials?.hasCredentials ? (
                                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl sm:rounded-lg p-5 sm:p-4 space-y-4 sm:space-y-3 border-2 sm:border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center space-x-2 mb-4 sm:mb-3">
                                      <Lock className="w-5 h-5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                                      <h4 className="text-base sm:text-sm font-bold sm:font-semibold text-gray-900 dark:text-gray-100">Credenciales de Acceso</h4>
                                    </div>
                                    
                                    {/* Usuario */}
                                    {credentials.login_username && (
                                      <div className="space-y-2 sm:space-y-1">
                                        <label className="text-sm sm:text-xs font-semibold sm:font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                                          <User className="w-4 h-4 sm:w-3 sm:h-3" />
                                          <span>Usuario</span>
                                        </label>
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type="text"
                                            value={credentials.login_username}
                                            readOnly
                                            className="flex-1 px-3 sm:px-3 py-2.5 sm:py-2 h-12 sm:h-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
                                          />
                                          <button
                                            onClick={() => copyToClipboard(credentials.login_username!)}
                                            className="p-2.5 sm:p-2 min-h-[48px] sm:min-h-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 active:scale-95 transition-all touch-manipulation"
                                            title="Copiar usuario"
                                          >
                                            <Copy className="w-4 h-4 sm:w-4 sm:h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Contraseña */}
                                    {credentials.login_password && (
                                      <div className="space-y-2 sm:space-y-1">
                                        <label className="text-sm sm:text-xs font-semibold sm:font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                                          <Lock className="w-4 h-4 sm:w-3 sm:h-3" />
                                          <span>Contraseña</span>
                                        </label>
                                        <div className="flex items-center space-x-2">
                                          <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={credentials.login_password}
                                            readOnly
                                            className="flex-1 px-3 sm:px-3 py-2.5 sm:py-2 h-12 sm:h-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono touch-manipulation"
                                          />
                                          <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-2.5 sm:p-2 min-h-[48px] sm:min-h-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 active:scale-95 transition-all touch-manipulation"
                                            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                          >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                          </button>
                                          <button
                                            onClick={() => copyToClipboard(credentials.login_password!)}
                                            className="p-2.5 sm:p-2 min-h-[48px] sm:min-h-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 active:scale-95 transition-all touch-manipulation"
                                            title="Copiar contraseña"
                                          >
                                            <Copy className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Enlace de login - Siempre visible al final */}
                                    {(credentials.login_url || selectedPlatform.calculator_platforms.login_url) && (
                                      <div className="pt-4 sm:pt-3 mt-4 sm:mt-3 border-t-2 sm:border-t border-blue-100 dark:border-blue-900/30 flex justify-center">
                                        <a
                                          href={credentials.login_url || selectedPlatform.calculator_platforms.login_url || '#'}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center space-x-1.5 px-6 py-2.5 min-h-[40px] bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full active:scale-95 transition-all duration-200 shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] text-[12px] font-bold tracking-widest uppercase touch-manipulation"
                                        >
                                          <span>ABRIR PLATAFORMA</span>
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="pt-2">
                                    {/* Enlace de login (siempre mostrar si existe, incluso sin credenciales) */}
                                    {(credentials?.login_url || selectedPlatform.calculator_platforms.login_url) && (
                                      <div className="border-t border-gray-100 dark:border-white/5 pt-5 mt-2 flex justify-center">
                                        <a
                                          href={credentials?.login_url || selectedPlatform.calculator_platforms.login_url || '#'}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center space-x-1.5 px-6 py-2.5 min-h-[40px] bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full active:scale-95 transition-all duration-200 shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] text-[12px] font-bold tracking-widest uppercase touch-manipulation"
                                        >
                                          <span>ABRIR PLATAFORMA</span>
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Enlace especial solo para Superfoon */}
                                {isSelectedPlatformSuperfoon && (
                                  <div className="pt-5 sm:pt-4 mt-5 sm:mt-4 border-t-2 sm:border-t border-dashed border-gray-300 dark:border-gray-600">
                                    <div className="flex items-center space-x-2 mb-4 sm:mb-3">
                                      <div className="relative">
                                        <div className="w-2.5 h-2.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-ping absolute"></div>
                                        <div className="w-2.5 h-2.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full relative"></div>
                                      </div>
                                      <p className="text-base sm:text-sm font-bold sm:font-semibold text-gray-700 dark:text-gray-300">
                                        App de llamadas 3CX
                                      </p>
                                    </div>

                                    {/* Credenciales 3CX - Solo lectura para modelos */}
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl sm:rounded-lg p-3.5 sm:p-3 space-y-3 border-2 sm:border border-purple-200 dark:border-purple-800 mb-4 sm:mb-3">
                                      <div className={`flex items-center space-x-2 ${(credentials3CX.hasCredentials || loading3CX) ? 'mb-3' : ''}`}>
                                        <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        <h4 className="text-sm font-bold sm:font-semibold text-gray-900 dark:text-gray-100">Credenciales App 3CX</h4>
                                      </div>

                                      {loading3CX ? (
                                        <div className="flex items-center justify-center py-4">
                                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Cargando...</span>
                                        </div>
                                      ) : credentials3CX.hasCredentials ? (
                                        <>
                                          {/* Usuario 3CX - Solo lectura */}
                                          <div className="space-y-2 sm:space-y-1">
                                            <label className="text-sm sm:text-xs font-semibold sm:font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                                              <User className="w-4 h-4 sm:w-3 sm:h-3" />
                                              <span>Usuario 3CX</span>
                                            </label>
                                            <div className="flex items-center space-x-2">
                                              <input
                                                type="text"
                                                value={credentials3CX.app_3cx_username || ''}
                                                readOnly
                                                className="flex-1 px-3 sm:px-3 py-2.5 sm:py-2 h-12 sm:h-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none touch-manipulation"
                                              />
                                              <button
                                                onClick={() => copyToClipboard(credentials3CX.app_3cx_username || '')}
                                                className="p-2.5 sm:p-2 min-h-[48px] sm:min-h-0 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 active:scale-95 transition-all touch-manipulation"
                                                title="Copiar usuario"
                                              >
                                                <Copy className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Contraseña 3CX - Solo lectura */}
                                          <div className="space-y-2 sm:space-y-1">
                                            <label className="text-sm sm:text-xs font-semibold sm:font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                                              <Lock className="w-4 h-4 sm:w-3 sm:h-3" />
                                              <span>Contraseña 3CX</span>
                                            </label>
                                            <div className="flex items-center space-x-2">
                                              <input
                                                type={showPassword3CX ? 'text' : 'password'}
                                                value={credentials3CX.app_3cx_password || ''}
                                                readOnly
                                                className="flex-1 px-3 sm:px-3 py-2.5 sm:py-2 h-12 sm:h-auto bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none font-mono touch-manipulation"
                                              />
                                              <button
                                                onClick={() => setShowPassword3CX(!showPassword3CX)}
                                                className="p-2.5 sm:p-2 min-h-[48px] sm:min-h-0 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 active:scale-95 transition-all touch-manipulation"
                                                title={showPassword3CX ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                              >
                                                {showPassword3CX ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                              </button>
                                              <button
                                                onClick={() => copyToClipboard(credentials3CX.app_3cx_password || '')}
                                                className="p-2.5 sm:p-2 min-h-[48px] sm:min-h-0 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 active:scale-95 transition-all touch-manipulation"
                                                title="Copiar contraseña"
                                              >
                                                <Copy className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                    
                                    {/* Botón "Abrir app" */}
                                    <div className="flex justify-center pt-2">
                                      <a
                                        href="https://superfoon.synergy4.com/#/login"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center space-x-1.5 px-6 py-2.5 min-h-[40px] bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full active:scale-95 transition-all duration-200 shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] text-[12px] font-bold tracking-widest uppercase touch-manipulation"
                                      >
                                        <span>ABRIR APP</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    </div>
                                    
                                    {/* URL como texto secundario */}
                                    <p className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 text-right mt-2 font-medium">
                                      https://superfoon.synergy4.com/#/login
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Contenido de pestaña: Métricas */}
                        {platformTab === 'metrics' && (
                          <div className="space-y-3">
                            <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0 mb-3 px-1">
                              <div className="flex items-center justify-center text-sky-500 drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]">
                                <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 20V10M12 20V4M6 20v-6" />
                                </svg>
                              </div>
                              <div className="relative flex items-center">
                                <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
                                  Estadísticas de Rendimiento
                                </h2>
                              </div>
                            </div>
                            <div className="bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
                              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              {/* Tarjeta 1: Promedio Conexión */}
                              <div className="bg-white/40 dark:bg-[#1A1A1A] rounded-[16px] p-4 flex flex-col items-center justify-center border border-black/5 dark:border-transparent">
                                <span className="text-[20px] font-bold text-blue-500 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] dark:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)] tracking-tight">
                                  {selectedPlatform.stats.connectionPercentage}%
                                </span>
                                <div className="mt-3 bg-blue-500/10 rounded-full px-3 py-1 text-[10px] sm:text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide truncate max-w-full">
                                  Promedio Conexión
                                </div>
                              </div>
                              
                              {/* Tarjeta 2: Promedio Quincenal */}
                              <div className="bg-white/40 dark:bg-[#1A1A1A] rounded-[16px] p-4 flex flex-col items-center justify-center border border-black/5 dark:border-transparent relative">
                                <div className="flex items-center justify-center gap-1">
                                  <span className="text-[20px] font-bold text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] dark:drop-shadow-[0_0_8px_rgba(52,211,153,0.5)] tracking-tight">
                                    ${selectedPlatform.stats.avgUsdModelo.toFixed(2)}
                                  </span>
                                  {selectedPlatform.stats.trend !== '=' && (
                                    <span className={`text-[12px] font-bold ${selectedPlatform.stats.trend === '↑' ? 'text-emerald-500' : 'text-red-500'}`}>
                                      {selectedPlatform.stats.trend}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-3 bg-emerald-500/10 rounded-full px-3 py-1 text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide truncate max-w-full">
                                  Promedio Quincenal
                                </div>
                              </div>

                              {/* Tarjeta 3: Total 30 días */}
                              <div className="bg-white/40 dark:bg-[#1A1A1A] rounded-[16px] p-4 flex flex-col items-center justify-center border border-black/5 dark:border-transparent">
                                <span className="text-[20px] font-bold text-purple-500 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.3)] dark:drop-shadow-[0_0_8px_rgba(192,132,252,0.5)] tracking-tight">
                                  ${selectedPlatform.stats.totalUsdModelo.toFixed(2)}
                                </span>
                                <div className="mt-3 bg-purple-500/10 rounded-full px-3 py-1 text-[10px] sm:text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide truncate max-w-full">
                                  Total (30 días)
                                </div>
                              </div>

                              {/* Tarjeta 4: Última Actividad */}
                              <div className="bg-white/40 dark:bg-[#1A1A1A] rounded-[16px] p-4 flex flex-col items-center justify-center border border-black/5 dark:border-transparent">
                                <span className="text-[16px] sm:text-[18px] font-bold text-slate-600 dark:text-slate-300 drop-shadow-[0_0_8px_rgba(148,163,184,0.3)] tracking-tight">
                                  {selectedPlatform.stats.lastActivity ? 
                                    new Date(selectedPlatform.stats.lastActivity).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 
                                    'N/A'
                                  }
                                </span>
                                <div className="mt-3 bg-slate-500/10 rounded-full px-3 py-1 text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide truncate max-w-full">
                                  Última Actividad
                                </div>
                              </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Información de estado y fechas */}
                        <div className="flex flex-row items-center justify-between mt-6 sm:mt-8 pt-4 sm:pt-4 border-t border-black/10 dark:border-white/10 overflow-hidden">
                          <div className="flex flex-row items-center gap-4 sm:gap-8 shrink-0">
                            {selectedPlatform.delivered_at && (
                              <div className="flex items-center space-x-1.5 sm:space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[11px] sm:text-[12px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Entregada:</p>
                                  <p className="text-[12px] sm:text-[13px] text-gray-700 dark:text-gray-300 font-semibold">
                                    {new Date(selectedPlatform.delivered_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>
                            )}
                            {selectedPlatform.confirmed_at && (
                              <div className="flex items-center space-x-1.5 sm:space-x-2">
                                <CheckCircle className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[11px] sm:text-[12px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Confirmada:</p>
                                  <p className="text-[12px] sm:text-[13px] text-gray-700 dark:text-gray-300 font-semibold">
                                    {new Date(selectedPlatform.confirmed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Target className="w-4 h-4 sm:w-3 sm:h-3 text-gray-400 dark:text-gray-500" />
                            <span className="text-xs sm:text-xs text-gray-500 dark:text-gray-400 font-medium">Plataforma activa</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </GlassCard>
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Resumen - Tarjetas Estadísticas */}
            {portfolioData && (
              <div className="max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] max-sm:backdrop-blur-xl max-sm:ring-1 max-sm:ring-black/[0.05] max-sm:dark:ring-white/[0.1] max-sm:rounded-[1.25rem] max-sm:p-2.5 max-sm:shadow-sm">
                <InfoCardGrid
                  columns={4}
                  cards={[
                    {
                      value: portfolioData.summary.totalPlatforms.toString(),
                      label: "Total Plataformas",
                      color: "blue",
                      size: "md"
                    },
                    {
                      value: portfolioData.summary.activePlatforms.toString(),
                      label: "Activas",
                      color: "green",
                      size: "md"
                    },
                    {
                      value: portfolioData.summary.pendingConfirmation.toString(),
                      label: "Pendientes",
                      color: "yellow",
                      size: "md"
                    },
                    {
                      value: `$${(portfolioData.summary.totalCopModelo || 0).toLocaleString('es-CO')}`,
                      label: "Ganancias (30 días)",
                      color: "purple",
                      size: "md"
                    }
                  ]}
                />
              </div>
            )}

            {/* Análisis Detallado */}
            <GlassCard padding="lg">
              <PortfolioAnalytics modelId={user?.id} />
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
