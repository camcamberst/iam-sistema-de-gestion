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
    totalPeriods: number;
    totalEarnings: number;
    avgPeriodEarnings: number;
    bestPlatform: string | null;
    growthRate: number;
  };
  platformStats: Array<{
    name: string;
    code: string;
    totalEarnings: number;
    totalPeriods: number;
    avgEarnings: number;
    maxEarnings: number;
    minEarnings: number;
    periods: string[];
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
        return <TrendingUp className="w-[18px] h-[18px] text-[#10B981] stroke-[2]" />;
      case 'down':
        return <TrendingDown className="w-[18px] h-[18px] text-[#F43F5E] stroke-[2]" />;
      default:
        return <Activity className="w-[18px] h-[18px] text-[#6F7A96] stroke-[2]" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-[#10B981] bg-[#0A1A17] border-[#10B981]/20';
      case 'down':
        return 'text-[#F43F5E] bg-[#1F0A0E] border-[#F43F5E]/20';
      default:
        return 'text-[#BDC6DB] bg-[#0F121C] border-[#252C40]';
    }
  };

  if (loading) {
    return (
      <div className="relative bg-[#181C27] rounded-[20px] shadow-lg border border-[#252C40] p-6 lg:p-8">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4B85FF]"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative bg-[#1F0A0E] rounded-[20px] shadow-lg border border-[#F43F5E]/30 p-6 lg:p-8">
        <div className="text-center">
          <div className="text-[#F43F5E] font-bold text-[18px] mb-2 tracking-tight">Error al cargar análisis</div>
          <p className="text-[#FDA4AF] text-[14px] mb-6">{error}</p>
          <button
            onClick={loadAnalytics}
            className="px-6 py-2.5 h-11 bg-gradient-to-r from-[#F43F5E] to-[#E11D48] text-white font-bold text-[14px] rounded-[12px] hover:opacity-90 active:scale-95 transition-all duration-200 flex items-center space-x-2 mx-auto touch-manipulation shadow-lg"
          >
            <RefreshCw className="w-[18px] h-[18px] stroke-[2]" />
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
      <div className="relative bg-[#181C27] rounded-2xl shadow-lg border border-[#252C40] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[17px] font-bold text-white flex items-center space-x-2 tracking-tight">
            <BarChart3 className="w-[20px] h-[20px] text-[#4B85FF] stroke-[2]" />
            <span>Resumen de Rendimiento</span>
          </h3>
          <button
            onClick={loadAnalytics}
            className="w-10 h-10 flex items-center justify-center text-[#6F7A96] hover:text-[#517EFF] hover:bg-[#252C40] rounded-[12px] active:scale-95 transition-all duration-200 touch-manipulation"
            title="Actualizar análisis"
          >
            <RefreshCw className="w-[18px] h-[18px] stroke-[2]" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#0F121C] border border-transparent rounded-xl flex flex-col justify-between min-h-[90px]">
            <div className="text-[22px] font-bold text-[#4B85FF] leading-none mb-1">{analyticsData.summary.totalPeriods}</div>
            <div className="text-[13px] font-semibold text-[#6F7A96]">Períodos Quincenales</div>
          </div>
          <div className="p-4 bg-[#0F121C] border border-transparent rounded-xl flex flex-col justify-between min-h-[90px]">
            <div className="text-[22px] font-bold text-[#10B981] leading-none mb-1">
              ${analyticsData.summary.totalEarnings.toFixed(2)}
            </div>
            <div className="text-[13px] font-semibold text-[#6F7A96]">Total USD</div>
          </div>
          <div className="p-4 bg-[#0F121C] border border-transparent rounded-xl flex flex-col justify-between min-h-[90px]">
            <div className="text-[22px] font-bold text-[#A855F7] leading-none mb-1">
              ${analyticsData.summary.avgPeriodEarnings.toFixed(2)}
            </div>
            <div className="text-[13px] font-semibold text-[#6F7A96]">Promedio Periodo</div>
          </div>
          <div className={`p-4 rounded-xl flex flex-col justify-between min-h-[90px] ${
            analyticsData.summary.growthRate > 0 ? 'bg-[#0A1A17] border border-[#10B981]/20' : 
            analyticsData.summary.growthRate < 0 ? 'bg-[#1F0A0E] border border-[#F43F5E]/20' : 'bg-[#0F121C] border border-transparent'
          }`}>
            <div className={`text-[22px] font-bold leading-none mb-1 ${
              analyticsData.summary.growthRate > 0 ? 'text-[#10B981]' : 
              analyticsData.summary.growthRate < 0 ? 'text-[#F43F5E]' : 'text-[#6F7A96]'
            }`}>
              {analyticsData.summary.growthRate > 0 ? '+' : ''}{analyticsData.summary.growthRate.toFixed(1)}%
            </div>
            <div className="text-[13px] font-semibold text-[#6F7A96]">Crecimiento</div>
          </div>
        </div>
      </div>

      {/* Análisis Principal */}
      <div className="relative bg-[#181C27] rounded-2xl shadow-lg border border-[#252C40] p-6">
        <h3 className="text-[17px] font-bold text-white mb-5 flex items-center space-x-2 tracking-tight">
          <Target className="w-[20px] h-[20px] text-[#4B85FF] stroke-[2]" />
          <span>Análisis Sintético</span>
        </h3>
        <div className="prose prose-sm max-w-none">
          <div className="whitespace-pre-line text-[#BDC6DB] font-medium leading-relaxed text-[14px]">
            {analyticsData.analysis}
          </div>
        </div>
      </div>

      {/* Tendencias */}
      {analyticsData.trends.length > 0 && (
        <div className="relative bg-[#181C27] rounded-2xl shadow-lg border border-[#252C40] p-6">
          <h3 className="text-[17px] font-bold text-white mb-5 flex items-center space-x-2 tracking-tight">
            <TrendingUp className="w-[20px] h-[20px] text-[#4B85FF] stroke-[2]" />
            <span>Métricas Direccionales</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {analyticsData.trends.map((trend, index) => (
              <div key={index} className={`p-4 rounded-xl border ${getTrendColor(trend.trend)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[15px] text-white">{trend.label}</div>
                    <div className="text-[13px] font-semibold opacity-80 mt-0.5">{trend.change}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(trend.trend)}
                    <span className="font-bold text-[18px]">{trend.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendaciones */}
      <div className="relative bg-[#181C27] rounded-2xl shadow-lg border border-[#252C40] p-6">
        <h3 className="text-[17px] font-bold text-white mb-5 flex items-center space-x-2 tracking-tight">
          <Lightbulb className="w-[20px] h-[20px] text-[#FCD34D] stroke-[2]" />
          <span>Recomendaciones AIM</span>
        </h3>
        <div className="space-y-3">
          {analyticsData.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3 p-4 bg-[#1E1508] rounded-xl border border-[#F59E0B]/20">
              <div className="flex-shrink-0 w-7 h-7 bg-[#F59E0B]/20 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-[#FCD34D] text-[13px] font-bold">{index + 1}</span>
              </div>
              <p className="text-[#FDE68A] text-[14px] font-medium leading-relaxed pt-1 pr-1">{recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Estadísticas por Plataforma */}
      {analyticsData.platformStats.length > 0 && (
        <div className="relative bg-[#181C27] rounded-2xl shadow-lg border border-[#252C40] p-6">
          <h3 className="text-[17px] font-bold text-white mb-5 flex items-center space-x-2 tracking-tight">
            <DollarSign className="w-[20px] h-[20px] text-[#10B981] stroke-[2]" />
            <span>Rendimiento por Plataforma</span>
          </h3>
          <div className="space-y-4">
            {analyticsData.platformStats.map((platform, index) => (
              <div key={index} className="border border-[#252C40] bg-[#0F121C] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-white text-[15px]">{platform.name}</h4>
                    <p className="text-[13px] font-semibold text-[#6F7A96]">{platform.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-bold text-[#10B981] leading-tight">
                      ${platform.avgEarnings.toFixed(2)}
                    </div>
                    <div className="text-[13px] font-semibold text-[#6F7A96]">/ período</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center border-t border-[#252C40] pt-4">
                  <div>
                    <div className="text-[12px] font-semibold text-[#6F7A96] mb-1">Total</div>
                    <div className="font-bold text-white text-[14px]">${platform.totalEarnings.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#6F7A96] mb-1">Máx</div>
                    <div className="font-bold text-white text-[14px]">${platform.maxEarnings.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#6F7A96] mb-1">Mín</div>
                    <div className="font-bold text-white text-[14px]">${platform.minEarnings.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Información de actualización */}
      <div className="text-center font-semibold text-[12px] text-[#6F7A96] uppercase tracking-wider">
        ACTUALIZACIÓN SINTÉTICA: {new Date(analyticsData.lastUpdated).toLocaleString('es-ES')}
      </div>
    </div>
  );
}
