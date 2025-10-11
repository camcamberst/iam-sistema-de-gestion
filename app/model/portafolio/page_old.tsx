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
  status: 'entregada' | 'confirmada' | 'desactivada';
  requested_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
  calculator_platforms: {
    id: string;
    name: string;
    currency: string;
  };
  stats: {
    totalDays: number;
    totalValue: number;
    totalUsdBruto: number;
    totalUsdModelo: number;
    totalCopModelo: number;
    avgValue: number;
    avgUsdModelo: number;
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
  const [selectedPlatform, setSelectedPlatform] = useState<any>(null);

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
  const handlePlatformClick = (platform: any) => {
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
        return 'Desconocido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'entregada':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'desactivada':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Error</h3>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
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
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'platforms'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white/70 text-gray-700 hover:bg-white/90 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>Mis Plataformas</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white/70 text-gray-700 hover:bg-white/90 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Análisis y Estadísticas</span>
            </div>
          </button>
        </div>

        {/* Contenido según tab activo */}
        {activeTab === 'platforms' ? (
          <>
            {/* Resumen General */}
            {portfolioData?.summary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

            {/* Lista de Plataformas */}
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
                <div className="space-y-4">
                  {portfolioData?.platforms.map((platform) => (
                    <div key={platform.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(platform.status)}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">
                                {platform.calculator_platforms.name}
                              </h3>
                          <p className="text-sm text-gray-500">
                            {platform.calculator_platforms.id} • {platform.calculator_platforms.currency}
                          </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(platform.status)}`}>
                            {getStatusText(platform.status)}
                          </span>
                          {platform.status === 'entregada' && (
                            <button
                              onClick={() => confirmPlatform(platform.platform_id)}
                              disabled={confirmingPlatform === platform.platform_id}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
                            >
                              {confirmingPlatform === platform.platform_id ? (
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Días Activos</p>
                          <p className="text-lg font-semibold text-gray-900">{platform.stats.totalDays}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Promedio Diario</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${platform.stats.avgUsdModelo.toFixed(2)} USD
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Total (30 días)</p>
                          <p className="text-lg font-semibold text-gray-900">
                            ${platform.stats.totalUsdModelo.toFixed(2)} USD
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Última Actividad</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {platform.stats.lastActivity ? 
                              new Date(platform.stats.lastActivity).toLocaleDateString('es-ES') : 
                              'N/A'
                            }
                          </p>
                        </div>
                      </div>

                      {/* Información adicional */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-4">
                            {platform.delivered_at && (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>Entregada: {new Date(platform.delivered_at).toLocaleDateString('es-ES')}</span>
                              </div>
                            )}
                            {platform.confirmed_at && (
                              <div className="flex items-center space-x-1">
                                <CheckCircle className="w-4 h-4" />
                                <span>Confirmada: {new Date(platform.confirmed_at).toLocaleDateString('es-ES')}</span>
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
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Tab de Análisis */
          <PortfolioAnalytics modelId={user?.id || ''} />
        )}
      </div>
    </div>
  );
}
