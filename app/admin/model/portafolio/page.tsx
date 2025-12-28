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
  User
} from 'lucide-react';

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


  // Función para obtener estilos de etiquetas (igual que Portafolio Modelo)
  const getTagClasses = (status: string) => {
    switch (status) {
      case 'disponible':
        return 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-300 dark:hover:bg-slate-600';
      case 'solicitada':
        return 'bg-blue-300 dark:bg-blue-700 text-blue-800 dark:text-blue-300 border border-blue-400 dark:border-blue-600 hover:bg-blue-400 dark:hover:bg-blue-600';
      case 'pendiente':
        return 'bg-yellow-300 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-300 border border-yellow-400 dark:border-yellow-600 hover:bg-yellow-400 dark:hover:bg-yellow-600';
      case 'entregada':
        return 'bg-green-300 dark:bg-green-700 text-green-800 dark:text-green-300 border border-green-400 dark:border-green-600 hover:bg-green-400 dark:hover:bg-green-600';
      case 'confirmada':
        return 'bg-emerald-300 dark:bg-emerald-700 text-emerald-800 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-600 hover:bg-emerald-400 dark:hover:bg-emerald-600';
      case 'desactivada':
        return 'bg-gray-800 dark:bg-gray-600 text-white dark:text-gray-200 border border-gray-800 dark:border-gray-500 hover:opacity-90';
      case 'inviable':
        return 'bg-red-300 dark:bg-red-700 text-red-800 dark:text-red-300 border border-red-400 dark:border-red-600 hover:bg-red-400 dark:hover:bg-red-600';
      default:
        return 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
    }
  };

  // Función para manejar click en etiqueta de plataforma (toggle expandir/contraer)
  const handlePlatformClick = (platform: Platform) => {
    // Si la plataforma ya está seleccionada, la deseleccionamos (contraer)
    if (selectedPlatform?.id === platform.id) {
      setSelectedPlatform(null);
    } else {
      // Si no está seleccionada, la seleccionamos (expandir)
      setSelectedPlatform(platform);
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Error</h2>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              {/* Layout móvil: vertical, escritorio: horizontal */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                {/* Título e icono */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Mi Portafolio
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      Gestiona tus plataformas y confirma entregas
                    </p>
                  </div>
                </div>

                {/* Información de actualización - Oculto en móvil */}
                <div className="hidden md:flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Última actualización</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {portfolioData?.lastUpdated ? 
                        new Date(portfolioData.lastUpdated).toLocaleString('es-ES') : 
                        'N/A'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 sm:space-x-1 mb-6 sm:mb-8">
          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-4 sm:px-5 py-2.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 active:scale-95 touch-manipulation ${
              activeTab === 'platforms'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                : 'bg-white/70 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-gray-600/80'
            }`}
          >
            Mis Plataformas
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 sm:px-5 py-2.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 active:scale-95 touch-manipulation ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                : 'bg-white/70 dark:bg-gray-700/70 text-gray-600 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-gray-600/80'
            }`}
          >
            Análisis y Estadísticas
          </button>
        </div>

        {activeTab === 'platforms' && (
          <>
            {/* Etiquetas de Plataformas */}
            <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 sm:p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Mis Plataformas</h2>
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {portfolioData?.platforms.length || 0} plataformas
                  </span>
                </div>
              </div>

              {portfolioData?.platforms.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-gray-300 dark:text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tienes plataformas asignadas</h3>
                  <p className="text-gray-500 dark:text-gray-400">Contacta a tu administrador para asignar plataformas a tu portafolio.</p>
                </div>
              ) : (
                <>
                  {/* Etiquetas de plataformas */}
                  <div className="flex flex-wrap gap-2 sm:gap-2 mb-4 sm:mb-6">
                    {portfolioData?.platforms.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        className={`px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-full text-xs sm:text-[11px] leading-5 font-medium transition-colors inline-flex items-center active:scale-95 touch-manipulation ${getTagClasses(platform.status)} ${
                          selectedPlatform?.id === platform.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                        }`}
                        onClick={() => handlePlatformClick(platform)}
                      >
                        {platform.calculator_platforms.name}
                      </button>
                    ))}
                  </div>

                  {/* Ventana de Visualización con transición */}
                  <div className={`overflow-visible transition-all duration-500 ease-out transform ${
                    selectedPlatform 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'max-h-0 opacity-0 translate-y-0 scale-100 overflow-hidden'
                  }`}>
                    {selectedPlatform && (
                      <div className="border border-gray-200 dark:border-gray-600/20 rounded-lg p-3 sm:p-4 bg-white dark:bg-gray-700/80 hover:shadow-lg transition-shadow duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                        {/* Header con información principal */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="flex-shrink-0">
                              {getStatusIcon(selectedPlatform.status)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                                {selectedPlatform.calculator_platforms.name}
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                                {selectedPlatform.calculator_platforms.id} • {selectedPlatform.calculator_platforms.currency}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:flex-shrink-0">
                            <span className={`px-3 py-1.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium text-center ${getStatusColor(selectedPlatform.status)}`}>
                              {getStatusText(selectedPlatform.status)}
                            </span>
                            {selectedPlatform.status === 'entregada' && (
                              <button
                                onClick={() => confirmPlatform(selectedPlatform.platform_id)}
                                disabled={confirmingPlatform === selectedPlatform.platform_id}
                                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 text-sm shadow-md active:scale-95 touch-manipulation"
                              >
                                {confirmingPlatform === selectedPlatform.platform_id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Confirmando...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Confirmar Recepción</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Pestañas internas del modal */}
                        <div className="mb-4 border-b border-gray-200 dark:border-gray-600">
                          <div className="flex gap-1 sm:space-x-1">
                            <button
                              onClick={() => setPlatformTab('details')}
                              className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-sm font-medium transition-all duration-200 active:scale-95 touch-manipulation ${
                                platformTab === 'details'
                                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              Detalles
                            </button>
                            <button
                              onClick={() => setPlatformTab('metrics')}
                              className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-sm font-medium transition-all duration-200 active:scale-95 touch-manipulation ${
                                platformTab === 'metrics'
                                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              Métricas
                            </button>
                          </div>
                        </div>

                        {/* Contenido de pestaña: Detalles */}
                        {platformTab === 'details' && (
                          <div className="space-y-4">
                            {/* Credenciales de acceso */}
                            {(selectedPlatform.status === 'entregada' || selectedPlatform.status === 'confirmada') && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4">
                                {loadingCredentials ? (
                                  <div className="flex items-center justify-center py-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Cargando credenciales...</span>
                                  </div>
                                ) : credentials?.hasCredentials ? (
                                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 space-y-3 border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center space-x-2 mb-3">
                                      <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Credenciales de Acceso</h4>
                                    </div>
                                    
                                    {/* Usuario */}
                                    {credentials.login_username && (
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                                          <User className="w-3 h-3" />
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
                                      <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                                          <Lock className="w-3 h-3" />
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
                                      <div className="pt-3 mt-3 border-t border-blue-200 dark:border-blue-800">
                                        <a
                                          href={credentials.login_url || selectedPlatform.calculator_platforms.login_url || '#'}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-full inline-flex items-center justify-center space-x-2 px-4 sm:px-4 py-3 sm:py-2.5 h-12 sm:h-auto bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-sm font-medium touch-manipulation"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          <span>Abrir plataforma</span>
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {/* Mensaje de advertencia si no hay credenciales */}
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                      <div className="flex items-center space-x-2">
                                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                          Las credenciales aún no han sido configuradas por el administrador.
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Enlace de login (siempre mostrar si existe, incluso sin credenciales) */}
                                    {(credentials?.login_url || selectedPlatform.calculator_platforms.login_url) && (
                                      <div className="pt-2">
                                        <a
                                          href={credentials?.login_url || selectedPlatform.calculator_platforms.login_url || '#'}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-full inline-flex items-center justify-center space-x-2 px-4 sm:px-4 py-3 sm:py-2.5 h-12 sm:h-auto bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-sm font-medium touch-manipulation"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          <span>Abrir plataforma</span>
                                        </a>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center font-medium">
                                          Haz clic para acceder a la plataforma
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Enlace especial solo para Superfoon */}
                                {isSelectedPlatformSuperfoon && (
                                  <div className="pt-4 mt-4 border-t border-dashed border-gray-300 dark:border-gray-600">
                                    <div className="flex items-center space-x-2 mb-3">
                                      <div className="relative">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping absolute"></div>
                                        <div className="w-2 h-2 bg-blue-500 rounded-full relative"></div>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        📞 App de llamadas 3CX
                                      </p>
                                      <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>

                                    {/* Credenciales 3CX - Solo lectura para modelos */}
                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 space-y-3 border border-purple-200 dark:border-purple-800 mb-3">
                                      <div className="flex items-center space-x-2 mb-3">
                                        <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Credenciales App 3CX</h4>
                                      </div>

                                      {loading3CX ? (
                                        <div className="flex items-center justify-center py-4">
                                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                                          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Cargando...</span>
                                        </div>
                                      ) : credentials3CX.hasCredentials ? (
                                        <>
                                          {/* Usuario 3CX - Solo lectura */}
                                          <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                                              <User className="w-3 h-3" />
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
                                          <div className="space-y-1">
                                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                                              <Lock className="w-3 h-3" />
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
                                      ) : (
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                          <div className="flex items-center space-x-2">
                                            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                              Las credenciales de 3CX aún no han sido configuradas por el administrador.
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Botón "Abrir app" */}
                                    <a
                                      href="https://superfoon.synergy4.com/#/login"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full inline-flex items-center justify-center space-x-2 px-4 sm:px-4 py-3 sm:py-2.5 h-12 sm:h-auto bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 active:scale-95 transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-sm font-medium mb-3 touch-manipulation"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                      <span>Abrir app</span>
                                    </a>
                                    
                                    {/* URL como texto secundario */}
                                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center font-medium">
                                      https://superfoon.synergy4.com/#/login
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 text-center">
                                      ⚡ Acceso directo a la aplicación de llamadas
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Contenido de pestaña: Métricas */}
                        {platformTab === 'metrics' && (
                          <div className="bg-gray-50 dark:bg-gray-600/80 rounded-lg p-3 sm:p-4">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Estadísticas de Rendimiento</h4>
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                              <div className="text-center p-2 sm:p-0 bg-white/50 dark:bg-gray-700/50 rounded-lg sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Promedio Conexión</p>
                                <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">{selectedPlatform.stats.connectionPercentage}%</p>
                              </div>
                              <div className="text-center p-2 sm:p-0 bg-white/50 dark:bg-gray-700/50 rounded-lg sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Promedio Quincenal</p>
                                <div className="flex items-center justify-center space-x-1">
                                  <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                                    ${selectedPlatform.stats.avgUsdModelo.toFixed(2)} USD
                                  </p>
                                  <span className={`text-xs sm:text-sm font-medium ${
                                    selectedPlatform.stats.trend === '↑' ? 'text-green-500 dark:text-green-400' :
                                    selectedPlatform.stats.trend === '↓' ? 'text-red-500 dark:text-red-400' :
                                    'text-gray-400 dark:text-gray-500'
                                  }`}>
                                    {selectedPlatform.stats.trend}
                                  </span>
                                </div>
                              </div>
                              <div className="text-center p-2 sm:p-0 bg-white/50 dark:bg-gray-700/50 rounded-lg sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Total (30 días)</p>
                                <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                                  ${selectedPlatform.stats.totalUsdModelo.toFixed(2)} USD
                                </p>
                              </div>
                              <div className="text-center p-2 sm:p-0 bg-white/50 dark:bg-gray-700/50 rounded-lg sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Última Actividad</p>
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {selectedPlatform.stats.lastActivity ? 
                                    new Date(selectedPlatform.stats.lastActivity).toLocaleDateString('es-ES') : 
                                    'N/A'
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Información de estado y fechas */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                            {selectedPlatform.delivered_at && (
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                <div>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">Entregada</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(selectedPlatform.delivered_at).toLocaleDateString('es-ES')}
                                  </p>
                                </div>
                              </div>
                            )}
                            {selectedPlatform.confirmed_at && (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                <div>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">Confirmada</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(selectedPlatform.confirmed_at).toLocaleDateString('es-ES')}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Target className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">Plataforma activa</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Resumen - Tarjetas Estadísticas */}
            {portfolioData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
                <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 sm:p-6 hover:shadow-xl hover:bg-white/95 dark:hover:bg-gray-600/80 hover:scale-[1.02] transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Total Plataformas</p>
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{portfolioData.summary.totalPlatforms}</p>
                    </div>
                    <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 sm:p-6 hover:shadow-xl hover:bg-white/95 dark:hover:bg-gray-600/80 hover:scale-[1.02] transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Activas</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{portfolioData.summary.activePlatforms}</p>
                    </div>
                    <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 sm:p-6 hover:shadow-xl hover:bg-white/95 dark:hover:bg-gray-600/80 hover:scale-[1.02] transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Pendientes</p>
                      <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{portfolioData.summary.pendingConfirmation}</p>
                    </div>
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 sm:p-6 hover:shadow-xl hover:bg-white/95 dark:hover:bg-gray-600/80 hover:scale-[1.02] transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 col-span-2 md:col-span-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">Ganancias (30 días)</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">
                        ${portfolioData.summary.totalCopModelo.toLocaleString('es-CO')} COP
                      </p>
                    </div>
                    <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400 flex-shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* Análisis Detallado */}
            <div className="relative bg-white/70 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <PortfolioAnalytics modelId={user?.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
