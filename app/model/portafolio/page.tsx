'use client';

import { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
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
  Calendar,
  Target,
  Activity
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

export default function MiPortafolio() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [confirmingPlatform, setConfirmingPlatform] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'platforms' | 'analytics'>('platforms');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  const supabase = require('@/lib/supabase').supabase;

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

  // 🔧 NUEVO: Posicionar scrollbar en el punto medio al cargar la página
  useEffect(() => {
    const positionScrollbar = () => {
      // Esperar a que el contenido se haya renderizado completamente
      setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = document.documentElement.clientHeight;
        const scrollableHeight = scrollHeight - clientHeight;
        
        // Calcular la posición un poco más abajo (aproximadamente 50% desde arriba)
        const targetPosition = scrollableHeight * 0.50;
        
        // Hacer scroll suave a esa posición
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        console.log('🔍 [PORTFOLIO] Scrollbar positioned at:', {
          scrollHeight,
          clientHeight,
          scrollableHeight,
          targetPosition
        });
      }, 1000); // Delay para asegurar que el contenido esté renderizado
    };

    // Solo posicionar si no hay error y los datos están cargados
    if (!loading && !error && portfolioData) {
      positionScrollbar();
    }
  }, [loading, error, portfolioData]);

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
        await loadPortfolioData();
      } else {
        setError(result.error || 'Error al confirmar la plataforma');
      }
    } catch (err: any) {
      setError(err.message || 'Error al confirmar la plataforma');
    } finally {
      setConfirmingPlatform(null);
    }
  };

  // Función para obtener estilos de etiquetas (igual que Portafolio Modelo)
  const getTagClasses = (status: string) => {
    switch (status) {
      case 'disponible':
        return 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300';
      case 'solicitada':
        return 'bg-blue-300 text-blue-800 border border-blue-400 hover:bg-blue-400';
      case 'pendiente':
        return 'bg-yellow-300 text-yellow-800 border border-yellow-400 hover:bg-yellow-400';
      case 'entregada':
        return 'bg-green-300 text-green-800 border border-green-400 hover:bg-green-400';
      case 'confirmada':
        return 'bg-emerald-300 text-emerald-800 border border-emerald-400 hover:bg-emerald-400';
      case 'desactivada':
        return 'bg-gray-800 text-white border border-gray-800 hover:opacity-90';
      case 'inviable':
        return 'bg-red-300 text-red-800 border border-red-400 hover:bg-red-400';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
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
        return 'bg-green-50 border-green-200 text-green-700';
      case 'entregada':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'desactivada':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        // Tratar estados no definidos como confirmados
        return 'bg-green-50 border-green-200 text-green-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-24">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-10">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    Mi Portafolio
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Gestiona tus plataformas y confirma entregas
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  Acceso: <span className="font-medium text-blue-600">Modelo</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Última actualización</p>
                  <p className="text-sm font-medium text-gray-900">
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

        {/* Tabs */}
        <div className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('platforms')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'platforms'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white/70 text-gray-600 hover:bg-white/90'
            }`}
          >
            Mis Plataformas
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white/70 text-gray-600 hover:bg-white/90'
            }`}
          >
            Análisis y Estadísticas
          </button>
        </div>

        {activeTab === 'platforms' && (
          <>
            {/* Resumen */}
            {portfolioData && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Plataformas</p>
                      <p className="text-2xl font-bold text-gray-900">{portfolioData.summary.totalPlatforms}</p>
                    </div>
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Activas</p>
                      <p className="text-2xl font-bold text-green-600">{portfolioData.summary.activePlatforms}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pendientes</p>
                      <p className="text-2xl font-bold text-yellow-600">{portfolioData.summary.pendingConfirmation}</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-600" />
                  </div>
                </div>

                <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Ganancias (30 días)</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${portfolioData.summary.totalCopModelo.toLocaleString('es-CO')} COP
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Etiquetas de Plataformas */}
            <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Mis Plataformas</h2>
                <div className="flex items-center space-x-2">
                  <Activity className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-500">
                    {portfolioData?.platforms.length || 0} plataformas
                  </span>
                </div>
              </div>

              {portfolioData?.platforms.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tienes plataformas asignadas</h3>
                  <p className="text-gray-500">Contacta a tu administrador para asignar plataformas a tu portafolio.</p>
                </div>
              ) : (
                <>
                  {/* Etiquetas de plataformas */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {portfolioData?.platforms.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        className={`px-2.5 py-1 rounded-full text-[11px] leading-5 font-medium transition-colors inline-flex items-center ${getTagClasses(platform.status)} ${
                          selectedPlatform?.id === platform.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                        }`}
                        onClick={() => handlePlatformClick(platform)}
                      >
                        {platform.calculator_platforms.name}
                      </button>
                    ))}
                  </div>

                  {/* Ventana de Visualización con transición */}
                  <div className={`overflow-hidden transition-all duration-500 ease-out transform ${
                    selectedPlatform 
                      ? 'max-h-[400px] opacity-100 translate-y-0 scale-100' 
                      : 'max-h-0 opacity-0 translate-y-0 scale-100'
                  }`}>
                    {selectedPlatform && (
                      <div className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-lg transition-shadow duration-300">
                        {/* Header con información principal */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(selectedPlatform.status)}
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">
                                {selectedPlatform.calculator_platforms.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {selectedPlatform.calculator_platforms.id} • {selectedPlatform.calculator_platforms.currency}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedPlatform.status)}`}>
                              {getStatusText(selectedPlatform.status)}
                            </span>
                            {selectedPlatform.status === 'entregada' && (
                              <button
                                onClick={() => confirmPlatform(selectedPlatform.platform_id)}
                                disabled={confirmingPlatform === selectedPlatform.platform_id}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2 text-sm"
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

                        {/* Estadísticas de la plataforma */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Estadísticas de Rendimiento</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                              <p className="text-sm text-gray-500 mb-1">Promedio Conexión</p>
                              <p className="text-lg font-bold text-blue-600">{selectedPlatform.stats.connectionPercentage}%</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-500 mb-1">Promedio Quincenal</p>
                              <div className="flex items-center justify-center space-x-1">
                                <p className="text-lg font-bold text-green-600">
                                  ${selectedPlatform.stats.avgUsdModelo.toFixed(2)} USD
                                </p>
                                <span className={`text-sm font-medium ${
                                  selectedPlatform.stats.trend === '↑' ? 'text-green-500' :
                                  selectedPlatform.stats.trend === '↓' ? 'text-red-500' :
                                  'text-gray-400'
                                }`}>
                                  {selectedPlatform.stats.trend}
                                </span>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-500 mb-1">Total (30 días)</p>
                              <p className="text-lg font-bold text-blue-600">
                                ${selectedPlatform.stats.totalUsdModelo.toFixed(2)} USD
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-gray-500 mb-1">Última Actividad</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {selectedPlatform.stats.lastActivity ? 
                                  new Date(selectedPlatform.stats.lastActivity).toLocaleDateString('es-ES') : 
                                  'N/A'
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Información de estado y fechas */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6">
                            {selectedPlatform.delivered_at && (
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-400">Entregada</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(selectedPlatform.delivered_at).toLocaleDateString('es-ES')}
                                  </p>
                                </div>
                              </div>
                            )}
                            {selectedPlatform.confirmed_at && (
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="w-3 h-3 text-gray-400" />
                                <div>
                                  <p className="text-xs text-gray-400">Confirmada</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(selectedPlatform.confirmed_at).toLocaleDateString('es-ES')}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Target className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">Plataforma activa</span>
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
          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
            <PortfolioAnalytics modelId={user?.id} />
          </div>
        )}
      </div>
    </div>
  );
}
