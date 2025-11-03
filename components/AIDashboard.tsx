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

  const loadAIData = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/ai-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userRole, forceRefresh })
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
        // Tono sólido dentro de contenedor oscuro
        return 'border-l-purple-500 bg-purple-100/70 dark:bg-purple-900/25';
      case 'medium':
        return 'border-l-blue-500 bg-blue-100/70 dark:bg-blue-900/20';
      case 'low':
        return 'border-l-emerald-500 bg-emerald-100/70 dark:bg-emerald-900/20';
      default:
        return 'border-l-slate-400 bg-slate-100/70 dark:bg-slate-800/25';
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
    <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/50 dark:border-gray-600/20 transition-all duration-300 hover:shadow-md hover:bg-white/90 dark:hover:bg-gray-600/90 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
      {/* Header */}
      <div 
        className="px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-blue-600 rounded-md">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Asistente AI</h3>
              <p className="text-xs text-gray-500 dark:text-gray-300">Insights personalizados</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadAIData(true);
              }}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-600 rounded-md transition-all duration-200"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-200/50 dark:border-gray-600/20">
          {loading ? (
            <div className="py-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-3"></div>
              <p className="text-xs text-gray-600 dark:text-gray-300">Generando insights...</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <div className="text-red-500 dark:text-red-400 mb-2 text-sm">Error al cargar datos</div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">{error}</p>
              <button
                onClick={() => loadAIData(true)}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200 text-sm"
              >
                Reintentar
              </button>
            </div>
          ) : data ? (
            <div className="space-y-3">
              {/* Prompt chips amigables */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Plan de 3 pasos', action: () => setActiveTab('tips') },
                  { label: 'En qué enfocarme hoy', action: () => setActiveTab('insights') },
                  { label: 'Ver progreso', action: () => setActiveTab('analysis') }
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={chip.action}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-gradient-to-r from-slate-100 to-white dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-100 border border-gray-200/60 dark:border-gray-600/40 hover:shadow-sm transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {/* Tabs */}
              <div className="flex space-x-0.5 bg-gray-100 dark:bg-gray-600 rounded-md p-0.5">
                {[
                  { id: 'insights', label: 'Insights', icon: Sparkles },
                  { id: 'tips', label: 'Tips', icon: Lightbulb },
                  { id: 'analysis', label: 'Análisis', icon: BarChart3 }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-sm text-xs font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'insights' && (
                <div className="space-y-2">
                  {data.insights.map((insight, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-md border-l-3 ${getPriorityColor(insight.priority)} transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5`}
                    >
                      <div className="flex items-start space-x-2">
                        {getTypeIcon(insight.type)}
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1 text-sm">{insight.title}</h4>
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{insight.content}</p>
                          {insight.actionable && (
                            <div className="mt-1.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-purple-800 dark:text-purple-300 border border-purple-200/50 dark:border-purple-700/40">
                                Ver cómo aplicarlo
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
                <div className="space-y-3">
                  <div className="p-3 bg-amber-100/70 dark:bg-amber-900/25 rounded-md border border-amber-300 dark:border-amber-700/50 shadow-sm">
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1 text-sm">💡 Tip del Día</h4>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{data.dailyTip}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center space-x-1.5 text-sm">
                      <Target className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      <span>Recomendaciones</span>
                    </h4>
                    {data.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start space-x-2 p-2.5 bg-green-100/70 dark:bg-green-900/25 rounded-md border border-green-300 dark:border-green-700/50 shadow-sm">
                        <div className="flex-shrink-0 w-5 h-5 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center">
                          <span className="text-green-600 dark:text-green-400 text-xs font-bold">{index + 1}</span>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-blue-100/70 dark:bg-blue-900/25 rounded-md text-center shadow-sm">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-300">
                        ${data.performanceSummary.todayEarnings.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">Ganancias Hoy</div>
                    </div>
                    <div className="p-3 bg-green-100/70 dark:bg-green-900/25 rounded-md text-center shadow-sm">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        +{data.performanceSummary.weeklyTrend.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">Tendencia Semanal</div>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-100/70 dark:bg-purple-900/25 rounded-md shadow-sm">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center space-x-1.5 text-sm">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>Resumen de Rendimiento</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Mejor Plataforma:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{data.performanceSummary.bestPlatform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-300">Progreso del Objetivo:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{data.performanceSummary.goalProgress.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-600/20">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Actualizado: {new Date(data.lastUpdated).toLocaleString('es-ES', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}</span>
                  <span className="flex items-center space-x-1">
                    <Brain className="w-3 h-3" />
                    <span>AI</span>
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
