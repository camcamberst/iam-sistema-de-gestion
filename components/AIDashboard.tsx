'use client';

import { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  Lightbulb, 
  Target, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Calendar,
  DollarSign
} from 'lucide-react';

interface AIDashboardProps {
  userId: string;
  userRole: string;
}

interface AIInsight {
  type: 'tip' | 'analysis' | 'recommendation' | 'trend';
  title: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  actionable: boolean;
}

interface AIDashboardData {
  insights: AIInsight[];
  dailyTip: string;
  performanceSummary: {
    todayEarnings: number;
    weeklyTrend: number;
    bestPlatform: string;
    goalProgress: number;
  };
  recommendations: string[];
  lastUpdated: string;
}

export default function AIDashboard({ userId, userRole }: AIDashboardProps) {
  const [data, setData] = useState<AIDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'tips' | 'analysis'>('insights');

  const loadAIData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/ai-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userRole })
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Error al cargar datos de IA');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos de IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && userRole === 'modelo') {
      loadAIData();
    }
  }, [userId, userRole]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tip':
        return <Lightbulb className="w-4 h-4 text-yellow-600" />;
      case 'analysis':
        return <BarChart3 className="w-4 h-4 text-blue-600" />;
      case 'recommendation':
        return <Target className="w-4 h-4 text-green-600" />;
      case 'trend':
        return <TrendingUp className="w-4 h-4 text-purple-600" />;
      default:
        return <Brain className="w-4 h-4 text-gray-600" />;
    }
  };

  if (userRole !== 'modelo') {
    return null;
  }

  return (
    <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 transition-all duration-300 hover:shadow-lg hover:bg-white/80">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Asistente AI</h3>
              <p className="text-sm text-gray-500">Insights y recomendaciones personalizadas</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadAIData();
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-lg transition-all duration-200"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200/50">
          {loading ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Generando insights personalizados...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <div className="text-red-500 mb-2">Error al cargar datos</div>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadAIData}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
              >
                Reintentar
              </button>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {[
                  { id: 'insights', label: 'Insights', icon: Sparkles },
                  { id: 'tips', label: 'Tips', icon: Lightbulb },
                  { id: 'analysis', label: 'Análisis', icon: BarChart3 }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'insights' && (
                <div className="space-y-3">
                  {data.insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${getPriorityColor(insight.priority)} transition-all duration-200 hover:shadow-sm`}
                    >
                      <div className="flex items-start space-x-3">
                        {getTypeIcon(insight.type)}
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                          <p className="text-sm text-gray-700 leading-relaxed">{insight.content}</p>
                          {insight.actionable && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Accionable
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tips' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start space-x-3">
                      <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">💡 Tip del Día</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{data.dailyTip}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <Target className="w-4 h-4 text-green-600" />
                      <span>Recomendaciones Específicas</span>
                    </h4>
                    {data.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 text-sm font-bold">{index + 1}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        ${data.performanceSummary.todayEarnings.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">Ganancias Hoy</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        +{data.performanceSummary.weeklyTrend.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Tendencia Semanal</div>
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                      <span>Resumen de Rendimiento</span>
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mejor Plataforma:</span>
                        <span className="font-medium text-gray-900">{data.performanceSummary.bestPlatform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Progreso del Objetivo:</span>
                        <span className="font-medium text-gray-900">{data.performanceSummary.goalProgress.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-gray-200/50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Última actualización: {new Date(data.lastUpdated).toLocaleString('es-ES')}</span>
                  <span className="flex items-center space-x-1">
                    <Brain className="w-3 h-3" />
                    <span>Powered by AI</span>
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
