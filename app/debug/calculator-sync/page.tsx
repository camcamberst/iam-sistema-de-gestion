'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SyncIssue {
  model: string;
  email: string;
  issue: 'missing_totals' | 'missing_values';
  modelValues: number;
  calculatorTotals: number;
}

export default function DebugCalculatorSyncPage() {
  const [loading, setLoading] = useState(true);
  const [syncIssues, setSyncIssues] = useState<SyncIssue[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugCalculatorSync();
  }, []);

  const debugCalculatorSync = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 [DIAGNÓSTICO] Iniciando análisis de sincronización...');

      // 1. Obtener fecha actual
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      console.log('📅 [DIAGNÓSTICO] Fecha actual:', todayStr);

      // 2. Obtener todos los modelos activos
      console.log('👥 [DIAGNÓSTICO] Obteniendo modelos activos...');
      const { data: modelsData, error: modelsError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .eq('role', 'modelo')
        .eq('is_active', true);

      if (modelsError) {
        throw new Error(`Error obteniendo modelos: ${modelsError.message}`);
      }

      console.log(`✅ [DIAGNÓSTICO] Modelos encontrados: ${modelsData?.length || 0}`);
      setModels(modelsData || []);

      // 3. Para cada modelo, verificar datos en ambas tablas
      const issues: SyncIssue[] = [];
      
      for (const model of modelsData || []) {
        console.log(`🔍 [DIAGNÓSTICO] Analizando modelo: ${model.name} (${model.email})`);
        
        // Verificar datos en model_values (Mi Calculadora)
        const { data: modelValues, error: mvError } = await supabase
          .from('model_values')
          .select('*')
          .eq('model_id', model.id)
          .eq('period_date', todayStr);

        if (mvError) {
          console.error(`❌ [DIAGNÓSTICO] Error obteniendo model_values para ${model.name}:`, mvError);
          continue;
        }

        // Verificar datos en calculator_totals (Resumen de Facturación)
        const { data: calculatorTotals, error: ctError } = await supabase
          .from('calculator_totals')
          .select('*')
          .eq('model_id', model.id)
          .eq('period_date', todayStr);

        if (ctError) {
          console.error(`❌ [DIAGNÓSTICO] Error obteniendo calculator_totals para ${model.name}:`, ctError);
          continue;
        }

        // Analizar sincronización
        const hasModelValues = modelValues && modelValues.length > 0;
        const hasCalculatorTotals = calculatorTotals && calculatorTotals.length > 0;
        
        console.log(`  📊 [DIAGNÓSTICO] Model Values: ${hasModelValues ? '✅' : '❌'} (${modelValues?.length || 0} registros)`);
        console.log(`  📊 [DIAGNÓSTICO] Calculator Totals: ${hasCalculatorTotals ? '✅' : '❌'} (${calculatorTotals?.length || 0} registros)`);

        // Detectar problemas de sincronización
        if (hasModelValues && !hasCalculatorTotals) {
          console.log(`  ⚠️  [DIAGNÓSTICO] PROBLEMA: Tiene datos en Mi Calculadora pero NO en Resumen de Facturación`);
          issues.push({
            model: model.name,
            email: model.email,
            issue: 'missing_totals',
            modelValues: modelValues.length,
            calculatorTotals: 0
          });
        } else if (!hasModelValues && hasCalculatorTotals) {
          console.log(`  ⚠️  [DIAGNÓSTICO] PROBLEMA: Tiene datos en Resumen de Facturación pero NO en Mi Calculadora`);
          issues.push({
            model: model.name,
            email: model.email,
            issue: 'missing_values',
            modelValues: 0,
            calculatorTotals: calculatorTotals.length
          });
        } else if (hasModelValues && hasCalculatorTotals) {
          console.log(`  ✅ [DIAGNÓSTICO] Sincronización correcta`);
        } else {
          console.log(`  ℹ️  [DIAGNÓSTICO] Sin datos en ninguna tabla (normal si no ha usado la calculadora hoy)`);
        }

        // Mostrar detalles si hay datos
        if (hasModelValues) {
          const totalValue = modelValues.reduce((sum, mv) => sum + (mv.value || 0), 0);
          console.log(`    💰 [DIAGNÓSTICO] Total en Model Values: $${totalValue.toFixed(2)}`);
        }

        if (hasCalculatorTotals) {
          const totals = calculatorTotals[0];
          console.log(`    💰 [DIAGNÓSTICO] Total USD Bruto: $${totals.total_usd_bruto || 0}`);
          console.log(`    💰 [DIAGNÓSTICO] Total USD Modelo: $${totals.total_usd_modelo || 0}`);
          console.log(`    💰 [DIAGNÓSTICO] Total COP Modelo: $${totals.total_cop_modelo || 0}`);
        }
      }

      setSyncIssues(issues);
      console.log(`\n📋 [DIAGNÓSTICO] Análisis completado. Problemas encontrados: ${issues.length}`);

    } catch (error: any) {
      console.error('❌ [DIAGNÓSTICO] Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fixSyncIssue = async (issue: SyncIssue) => {
    try {
      console.log(`🔧 [FIX] Intentando corregir problema para ${issue.model}...`);
      
      // Buscar el modelo
      const model = models.find(m => m.email === issue.email);
      if (!model) {
        throw new Error('Modelo no encontrado');
      }

      if (issue.issue === 'missing_totals') {
        // El modelo tiene datos en model_values pero no en calculator_totals
        // Necesitamos calcular los totales
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Obtener valores del modelo
        const { data: modelValues, error: mvError } = await supabase
          .from('model_values')
          .select('*')
          .eq('model_id', model.id)
          .eq('period_date', todayStr);

        if (mvError || !modelValues) {
          throw new Error('Error obteniendo valores del modelo');
        }

        // Calcular totales
        const totalUsdBruto = modelValues.reduce((sum, mv) => sum + (mv.value || 0), 0);
        const totalUsdModelo = totalUsdBruto * 0.7; // 70% para el modelo
        const totalCopModelo = totalUsdModelo * 3900; // Tasa aproximada

        // Guardar en calculator_totals
        const { error: saveError } = await supabase
          .from('calculator_totals')
          .upsert({
            model_id: model.id,
            period_date: todayStr,
            total_usd_bruto: totalUsdBruto,
            total_usd_modelo: totalUsdModelo,
            total_cop_modelo: totalCopModelo,
            updated_at: new Date().toISOString()
          }, { onConflict: 'model_id,period_date' });

        if (saveError) {
          throw new Error(`Error guardando totales: ${saveError.message}`);
        }

        console.log(`✅ [FIX] Totales calculados y guardados para ${issue.model}`);
        alert(`✅ Problema corregido para ${issue.model}. Los totales han sido calculados y guardados.`);
        
      } else if (issue.issue === 'missing_values') {
        // El modelo tiene datos en calculator_totals pero no en model_values
        // Esto es más complejo de corregir automáticamente
        console.log(`⚠️  [FIX] No se puede corregir automáticamente el problema de ${issue.model} (datos obsoletos en calculator_totals)`);
        alert(`⚠️ No se puede corregir automáticamente el problema de ${issue.model}. Los datos en calculator_totals parecen ser obsoletos.`);
      }

      // Recargar análisis
      await debugCalculatorSync();

    } catch (error: any) {
      console.error('❌ [FIX] Error:', error);
      alert(`❌ Error corrigiendo problema: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Analizando sincronización de calculadoras...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🔍 Diagnóstico de Sincronización Mi Calculadora ↔ Resumen de Facturación
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Análisis de problemas de sincronización entre las calculadoras de modelos y el resumen de facturación
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-red-800 dark:text-red-200 font-medium">Error: {error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 Resumen General
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Total Modelos:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{models.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Problemas Encontrados:</span>
                <span className={`font-medium ${syncIssues.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {syncIssues.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Estado:</span>
                <span className={`font-medium ${syncIssues.length === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {syncIssues.length === 0 ? '✅ Sincronización Correcta' : '❌ Problemas Detectados'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              🔧 Acciones Disponibles
            </h2>
            <div className="space-y-3">
              <button
                onClick={debugCalculatorSync}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                🔄 Reanalizar Sincronización
              </button>
              {syncIssues.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('¿Estás seguro de que quieres intentar corregir todos los problemas automáticamente?')) {
                      syncIssues.forEach(issue => fixSyncIssue(issue));
                    }
                  }}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  🛠️ Corregir Todos los Problemas
                </button>
              )}
            </div>
          </div>
        </div>

        {syncIssues.length > 0 && (
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              ⚠️ Problemas de Sincronización Detectados
            </h2>
            <div className="space-y-4">
              {syncIssues.map((issue, index) => (
                <div key={index} className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-red-900 dark:text-red-100">
                      {issue.model} ({issue.email})
                    </h3>
                    <button
                      onClick={() => fixSyncIssue(issue)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      🛠️ Corregir
                    </button>
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    <p><strong>Problema:</strong> {
                      issue.issue === 'missing_totals' 
                        ? 'Tiene datos en Mi Calculadora pero NO en Resumen de Facturación'
                        : 'Tiene datos en Resumen de Facturación pero NO en Mi Calculadora'
                    }</p>
                    <p><strong>Model Values:</strong> {issue.modelValues} registros</p>
                    <p><strong>Calculator Totals:</strong> {issue.calculatorTotals} registros</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {syncIssues.length === 0 && (
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                ✅ Sincronización Correcta
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                No se encontraron problemas de sincronización entre Mi Calculadora y Resumen de Facturación.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            📋 Información Técnica
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
            <p><strong>Fecha de Análisis:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Tablas Analizadas:</strong> model_values, calculator_totals</p>
            <p><strong>Período:</strong> {new Date().toISOString().split('T')[0]}</p>
            <p><strong>Filtros:</strong> role = 'modelo', is_active = true</p>
          </div>
        </div>
      </div>
    </div>
  );
}
