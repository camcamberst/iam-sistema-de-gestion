'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ModelData {
  id: string;
  name: string;
  email: string;
  modelValues: any[];
  calculatorTotals: any[];
  totalUsdBruto: number;
  totalUsdModelo: number;
  status: 'working' | 'no-data' | 'zero-values' | 'error';
  issue?: string;
}

export default function PartialSyncDiagnostic() {
  const [models, setModels] = useState<ModelData[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const analyzePartialSync = async () => {
    try {
      setLoading(true);
      setAnalysisComplete(false);
      
      console.log('🔍 [PARTIAL-SYNC] Iniciando análisis de sincronización parcial...');
      
      const today = new Date().toISOString().split('T')[0];
      console.log('📅 [PARTIAL-SYNC] Fecha actual:', today);
      
      // 1. Obtener todos los modelos activos
      const { data: allModels, error: modelsError } = await supabase
        .from('users')
        .select('id, email, name, role, is_active')
        .eq('role', 'modelo')
        .eq('is_active', true);
      
      if (modelsError) {
        throw new Error(`Error obteniendo modelos: ${modelsError.message}`);
      }
      
      console.log(`✅ [PARTIAL-SYNC] Modelos encontrados: ${allModels?.length || 0}`);
      
      if (!allModels || allModels.length === 0) {
        console.log('❌ [PARTIAL-SYNC] No se encontraron modelos');
        return;
      }
      
      const modelAnalysis: ModelData[] = [];
      
      // 2. Analizar cada modelo individualmente
      for (const model of allModels) {
        console.log(`🔍 [PARTIAL-SYNC] Analizando: ${model.name} (${model.id})`);
        
        try {
          // Verificar model_values
          const { data: modelValues, error: valuesError } = await supabase
            .from('model_values')
            .select('*')
            .eq('model_id', model.id)
            .eq('period_date', today);
          
          // Verificar calculator_totals
          const { data: calculatorTotals, error: totalsError } = await supabase
            .from('calculator_totals')
            .select('*')
            .eq('model_id', model.id)
            .eq('period_date', today);
          
          const hasValues = modelValues && modelValues.length > 0;
          const hasTotals = calculatorTotals && calculatorTotals.length > 0;
          
          let totalUsdBruto = 0;
          let totalUsdModelo = 0;
          let status: ModelData['status'] = 'working';
          let issue: string | undefined;
          
          if (hasTotals && calculatorTotals[0]) {
            totalUsdBruto = calculatorTotals[0].total_usd_bruto || 0;
            totalUsdModelo = calculatorTotals[0].total_usd_modelo || 0;
          }
          
          // Determinar el estado del modelo
          if (!hasValues && !hasTotals) {
            status = 'no-data';
            issue = 'Sin datos en ambas tablas';
          } else if (!hasTotals) {
            status = 'no-data';
            issue = 'Sin totales consolidados (calculator_totals)';
          } else if (totalUsdBruto === 0 && totalUsdModelo === 0) {
            status = 'zero-values';
            issue = 'Totales en $0.00 (posible problema de cálculo)';
          } else if (valuesError || totalsError) {
            status = 'error';
            const errorMessage = (valuesError as any)?.message || (totalsError as any)?.message || 'Error desconocido';
            issue = `Error en consulta: ${errorMessage}`;
          }
          
          const modelData: ModelData = {
            id: model.id,
            name: model.name,
            email: model.email,
            modelValues: modelValues || [],
            calculatorTotals: calculatorTotals || [],
            totalUsdBruto,
            totalUsdModelo,
            status,
            issue
          };
          
          modelAnalysis.push(modelData);
          
          console.log(`📊 [PARTIAL-SYNC] ${model.name}:`, {
            status,
            issue,
            modelValues: hasValues ? `${modelValues.length} registros` : 'Sin datos',
            calculatorTotals: hasTotals ? `${calculatorTotals.length} registros` : 'Sin datos',
            totalUsdBruto,
            totalUsdModelo,
            valuesError: (valuesError as any)?.message,
            totalsError: (totalsError as any)?.message
          });
          
        } catch (error) {
          console.error(`❌ [PARTIAL-SYNC] Error analizando ${model.name}:`, error);
          modelAnalysis.push({
            id: model.id,
            name: model.name,
            email: model.email,
            modelValues: [],
            calculatorTotals: [],
            totalUsdBruto: 0,
            totalUsdModelo: 0,
            status: 'error',
            issue: `Error: ${(error as any)?.message || 'Error desconocido'}`
          });
        }
      }
      
      setModels(modelAnalysis);
      setAnalysisComplete(true);
      
      // Resumen final
      const working = modelAnalysis.filter(m => m.status === 'working').length;
      const noData = modelAnalysis.filter(m => m.status === 'no-data').length;
      const zeroValues = modelAnalysis.filter(m => m.status === 'zero-values').length;
      const errors = modelAnalysis.filter(m => m.status === 'error').length;
      
      console.log('📋 [PARTIAL-SYNC] Resumen final:', {
        total: modelAnalysis.length,
        working,
        noData,
        zeroValues,
        errors
      });
      
    } catch (error) {
      console.error('❌ [PARTIAL-SYNC] Error general:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixModelIssues = async (modelId: string) => {
    try {
      console.log(`🔧 [PARTIAL-SYNC] Intentando corregir modelo: ${modelId}`);
      
      // Llamar a la API de recálculo
      const response = await fetch('/api/calculator/recalculate-totals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ [PARTIAL-SYNC] Modelo ${modelId} corregido`);
        // Re-analizar después de la corrección
        await analyzePartialSync();
      } else {
        console.error(`❌ [PARTIAL-SYNC] Error corrigiendo ${modelId}:`, result.error);
      }
      
    } catch (error) {
      console.error(`❌ [PARTIAL-SYNC] Error en corrección:`, error);
    }
  };

  const getStatusColor = (status: ModelData['status']) => {
    switch (status) {
      case 'working': return 'text-green-600 bg-green-50';
      case 'no-data': return 'text-red-600 bg-red-50';
      case 'zero-values': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: ModelData['status']) => {
    switch (status) {
      case 'working': return '✅';
      case 'no-data': return '❌';
      case 'zero-values': return '⚠️';
      case 'error': return '🔴';
      default: return '❓';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🔍 Diagnóstico de Sincronización Parcial
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Analiza por qué algunos modelos muestran valores en &quot;Resumen de Facturación&quot; y otros muestran $0.00
          </p>
          
          <button
            onClick={analyzePartialSync}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Analizando...' : 'Iniciar Análisis'}
          </button>
        </div>

        {analysisComplete && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 Resumen del Análisis
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">✅</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Funcionando</div>
                <div className="text-lg font-semibold text-green-600">
                  {models.filter(m => m.status === 'working').length}
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">❌</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Sin Datos</div>
                <div className="text-lg font-semibold text-red-600">
                  {models.filter(m => m.status === 'no-data').length}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">⚠️</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Valores en $0</div>
                <div className="text-lg font-semibold text-yellow-600">
                  {models.filter(m => m.status === 'zero-values').length}
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">🔴</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Errores</div>
                <div className="text-lg font-semibold text-gray-600">
                  {models.filter(m => m.status === 'error').length}
                </div>
              </div>
            </div>
          </div>
        )}

        {models.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                📋 Detalles por Modelo
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Modelo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      USD Bruto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      USD Modelo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Model Values
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Calculator Totals
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {models.map((model) => (
                    <tr key={model.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {model.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {model.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {model.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(model.status)}`}>
                          {getStatusIcon(model.status)} {model.status}
                        </span>
                        {model.issue && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {model.issue}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${model.totalUsdBruto.toFixed(2)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        ${model.totalUsdModelo.toFixed(2)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {model.modelValues.length} registros
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {model.calculatorTotals.length} registros
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {model.status !== 'working' && (
                          <button
                            onClick={() => fixModelIssues(model.id)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            🔧 Corregir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 Interpretación de Resultados
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p><strong>✅ Funcionando:</strong> Modelo con datos correctos en ambas tablas</p>
            <p><strong>❌ Sin Datos:</strong> Modelo sin registros en model_values o calculator_totals</p>
            <p><strong>⚠️ Valores en $0:</strong> Modelo con datos pero totales calculados en $0.00</p>
            <p><strong>🔴 Errores:</strong> Problemas técnicos en la consulta de datos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
