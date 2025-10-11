'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Calendar,
  DollarSign,
  Activity,
  Lightbulb,
  RefreshCw
} from 'lucide-react';

interface AnalyticsData {
  analysis: string;
  recommendations: string[];
  trends: Array<{
    type: string;
    label: string;
    value: string | number;
    change: string;
    trend: 'up' | 'down' | 'neutral';
  }>;
  summary: {
    totalDays: number;
    totalEarnings: number;
    avgDailyEarnings: number;
    bestPlatform: string | null;
    growthRate: number;
  };
  platformStats: Array<{
    name: string;
    code: string;
    percentage: number;
    totalEarnings: number;
    totalDays: number;
    avgEarnings: number;
    maxEarnings: number;
    minEarnings: number;
  }>;
  lastUpdated: string;
}

interface PortfolioAnalyticsProps {
  modelId: string;
}

export default function PortfolioAnalytics({ modelId }: PortfolioAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/modelo-portafolio/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId, analysisType: 'comprehensive' })
      });

      const result = await response.json();

      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        setError(result.error || 'Error al cargar análisis');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar análisis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modelId) {
      loadAnalytics();
    }
  }, [modelId]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="text-center">
          <div className="text-red-500 mb-2">Error al cargar análisis</div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar</span>
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Estadísticas */}
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Resumen de Rendimiento</span>
          </h3>
          <button
            onClick={loadAnalytics}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-lg transition-all duration-200"
            title="Actualizar análisis"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{analyticsData.summary.totalDays}</div>
            <div className="text-sm text-gray-600">Días Activos</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              ${analyticsData.summary.totalEarnings.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total USD</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              ${analyticsData.summary.avgDailyEarnings.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Promedio Diario</div>
          </div>
          <div className={`text-center p-4 rounded-lg ${
            analyticsData.summary.growthRate > 0 ? 'bg-green-50' : 
            analyticsData.summary.growthRate < 0 ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <div className={`text-2xl font-bold ${
              analyticsData.summary.growthRate > 0 ? 'text-green-600' : 
              analyticsData.summary.growthRate < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {analyticsData.summary.growthRate > 0 ? '+' : ''}{analyticsData.summary.growthRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Crecimiento</div>
          </div>
        </div>
      </div>

      {/* Análisis Principal */}
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Target className="w-5 h-5 text-blue-600" />
          <span>Análisis de Rendimiento</span>
        </h3>
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-line text-gray-700 leading-relaxed">
            {analyticsData.analysis}
          </div>
        </div>
      </div>

      {/* Tendencias */}
      {analyticsData.trends.length > 0 && (
        <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span>Tendencias</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analyticsData.trends.map((trend, index) => (
              <div key={index} className={`p-4 rounded-lg border ${getTrendColor(trend.trend)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{trend.label}</div>
                    <div className="text-sm opacity-75">{trend.change}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trend.trend)}
                    <span className="font-bold">{trend.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Lightbulb className="w-5 h-5 text-yellow-600" />
          <span>Recomendaciones</span>
        </h3>
        <div className="space-y-3">
          {analyticsData.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 text-sm font-bold">{index + 1}</span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Estadísticas por Plataforma */}
      {analyticsData.platformStats.length > 0 && (
        <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span>Rendimiento por Plataforma</span>
          </h3>
          <div className="space-y-4">
            {analyticsData.platformStats.map((platform, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{platform.name}</h4>
                    <p className="text-sm text-gray-500">{platform.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      ${platform.avgEarnings.toFixed(2)}/día
                    </div>
                    <div className="text-sm text-gray-500">{platform.totalDays} días</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="font-semibold text-gray-900">${platform.totalEarnings.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Máximo</div>
                    <div className="font-semibold text-gray-900">${platform.maxEarnings.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Mínimo</div>
                    <div className="font-semibold text-gray-900">${platform.minEarnings.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Información de actualización */}
      <div className="text-center text-xs text-gray-500">
        Última actualización: {new Date(analyticsData.lastUpdated).toLocaleString('es-ES')}
      </div>
    </div>
  );
}
