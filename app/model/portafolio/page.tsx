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
    avgUsdModelo: number;
    totalUsdModelo: number;
    lastActivity: string | null;
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

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

  const loadPortfolioData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/modelo-portafolio?modelId=${user?.id}`);
      const result = await response.json();

      if (result.success) {
        setPortfolioData(result.data);
        // Seleccionar la primera plataforma por defecto
        if (result.data.platforms.length > 0) {
          setSelectedPlatform(result.data.platforms[0]);
        }
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

  // Función para manejar click en etiqueta de plataforma
  const handlePlatformClick = (platform: Platform) => {
    setSelectedPlatform(platform);
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
        return <Clock className="w-5 h-5 text-gray-500" />;
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
        return 'Estado desconocido';
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
        return 'bg-gray-50 border-gray-200 text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-24">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-24">
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
        <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi Portafolio</h1>
              <p className="text-gray-600">Gestiona tus plataformas y confirma entregas</p>
            </div>
            <div className="flex items-center space-x-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <div className="text-right">
                <p className="text-sm text-gray-500">Última actualización</p>
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
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${getTagClasses(platform.status)} ${
                          selectedPlatform?.id === platform.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                        }`}
                        onClick={() => handlePlatformClick(platform)}
                      >
                        {platform.calculator_platforms.name}
                      </button>
                    ))}
                  </div>

                  {/* Ventana de Visualización */}
                  {selectedPlatform && (
                    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(selectedPlatform.status)}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {selectedPlatform.calculator_platforms.name}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {selectedPlatform.calculator_platforms.id} • {selectedPlatform.calculator_platforms.currency}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedPlatform.status)}`}>
                            {getStatusText(selectedPlatform.status)}
                          </span>
                          {selectedPlatform.status === 'entregada' && (
                            <button
                              onClick={() => confirmPlatform(selectedPlatform.platform_id)}
                              disabled={confirmingPlatform === selectedPlatform.platform_id}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Días Activos</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedPlatform.stats.totalDays}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Promedio Diario</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${selectedPlatform.stats.avgUsdModelo.toFixed(2)} USD
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Total (30 días)</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${selectedPlatform.stats.totalUsdModelo.toFixed(2)} USD
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Última Actividad</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {selectedPlatform.stats.lastActivity ? 
                              new Date(selectedPlatform.stats.lastActivity).toLocaleDateString('es-ES') : 
                              'N/A'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Fechas importantes */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            {selectedPlatform.delivered_at && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>Entregada: {new Date(selectedPlatform.delivered_at).toLocaleDateString('es-ES')}</span>
                              </div>
                            )}
                            {selectedPlatform.confirmed_at && (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="w-4 h-4" />
                                <span>Confirmada: {new Date(selectedPlatform.confirmed_at).toLocaleDateString('es-ES')}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Target className="w-4 h-4" />
                            <span>Plataforma activa</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
