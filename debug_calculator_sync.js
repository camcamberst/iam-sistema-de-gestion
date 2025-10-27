#!/usr/bin/env node

/**
 * DIAGNÓSTICO: Problema de Sincronización Mi Calculadora ↔ Resumen de Facturación
 * 
 * Este script analiza el problema reportado donde algunos modelos no se sincronizan
 * correctamente entre "Mi Calculadora" y "Resumen de Facturación".
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCalculatorSync() {
  console.log('🔍 [DIAGNÓSTICO] Iniciando análisis de sincronización...\n');

  try {
    // 1. Obtener fecha actual de Colombia
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log('📅 [DIAGNÓSTICO] Fecha actual:', todayStr);

    // 2. Obtener todos los modelos activos
    console.log('\n👥 [DIAGNÓSTICO] Obteniendo modelos activos...');
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('❌ [DIAGNÓSTICO] Error obteniendo modelos:', modelsError);
      return;
    }

    console.log(`✅ [DIAGNÓSTICO] Modelos encontrados: ${models.length}`);

    // 3. Para cada modelo, verificar datos en ambas tablas
    const syncIssues = [];
    
    for (const model of models) {
      console.log(`\n🔍 [DIAGNÓSTICO] Analizando modelo: ${model.name} (${model.email})`);
      
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
        syncIssues.push({
          model: model.name,
          email: model.email,
          issue: 'missing_totals',
          modelValues: modelValues.length,
          calculatorTotals: 0
        });
      } else if (!hasModelValues && hasCalculatorTotals) {
        console.log(`  ⚠️  [DIAGNÓSTICO] PROBLEMA: Tiene datos en Resumen de Facturación pero NO en Mi Calculadora`);
        syncIssues.push({
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

    // 4. Resumen de problemas encontrados
    console.log('\n📋 [DIAGNÓSTICO] RESUMEN DE PROBLEMAS:');
    if (syncIssues.length === 0) {
      console.log('✅ [DIAGNÓSTICO] No se encontraron problemas de sincronización');
    } else {
      console.log(`❌ [DIAGNÓSTICO] Se encontraron ${syncIssues.length} problemas:`);
      syncIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. Modelo: ${issue.model} (${issue.email})`);
        console.log(`   Problema: ${issue.issue === 'missing_totals' ? 'Faltan datos en Resumen de Facturación' : 'Faltan datos en Mi Calculadora'}`);
        console.log(`   Model Values: ${issue.modelValues} registros`);
        console.log(`   Calculator Totals: ${issue.calculatorTotals} registros`);
      });
    }

    // 5. Análisis de posibles causas
    console.log('\n🔍 [DIAGNÓSTICO] ANÁLISIS DE CAUSAS POSIBLES:');
    
    if (syncIssues.some(issue => issue.issue === 'missing_totals')) {
      console.log('⚠️  [DIAGNÓSTICO] CAUSA PROBABLE: Error en el proceso de cálculo de totales');
      console.log('   - Los valores se guardan en model_values pero no se calculan los totales');
      console.log('   - Posible problema en la función calculateTotals() o en /api/calculator/totals');
    }

    if (syncIssues.some(issue => issue.issue === 'missing_values')) {
      console.log('⚠️  [DIAGNÓSTICO] CAUSA PROBABLE: Datos obsoletos en calculator_totals');
      console.log('   - Los totales existen pero los valores individuales fueron eliminados');
      console.log('   - Posible problema en el proceso de limpieza de datos');
    }

    // 6. Recomendaciones
    console.log('\n💡 [DIAGNÓSTICO] RECOMENDACIONES:');
    console.log('1. Verificar logs de la función calculateTotals() en Mi Calculadora');
    console.log('2. Revisar el endpoint /api/calculator/totals para errores');
    console.log('3. Verificar que el autosave esté funcionando correctamente');
    console.log('4. Considerar ejecutar un proceso de sincronización manual');

  } catch (error) {
    console.error('❌ [DIAGNÓSTICO] Error general:', error);
  }
}

// Ejecutar diagnóstico
debugCalculatorSync().then(() => {
  console.log('\n✅ [DIAGNÓSTICO] Análisis completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ [DIAGNÓSTICO] Error fatal:', error);
  process.exit(1);
});
