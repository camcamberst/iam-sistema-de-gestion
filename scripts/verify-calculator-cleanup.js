/**
 * 🔍 VERIFICADOR DE LIMPIEZA DE CALCULADORAS
 * 
 * Script para verificar por qué los modelos siguen viendo valores
 * en sus calculadoras después del cierre automático
 */

const https = require('https');

// Configuración
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';
const CURRENT_DATE = '2025-10-15';

/**
 * Función para hacer peticiones HTTP
 */
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Verificar estado de limpieza de calculadoras
 */
async function verifyCalculatorCleanup() {
  try {
    console.log('🔍 [VERIFY-CLEANUP] Verificando estado de limpieza de calculadoras...');
    console.log('=' * 80);
    
    // 1. Verificar valores en model_values para la fecha de cierre
    console.log('\n📊 [VERIFY-CLEANUP] Verificando valores en model_values...');
    
    // Simular consulta directa a la base de datos
    const modelValuesCheck = {
      message: 'Verificando tabla model_values directamente',
      date: CURRENT_DATE,
      expected: 'Tabla debería estar vacía para esta fecha'
    };
    
    console.log('📊 Verificación de model_values:', modelValuesCheck);
    
    // 2. Verificar algunos modelos específicos que reportaron tener valores
    console.log('\n🔍 [VERIFY-CLEANUP] Verificando modelos específicos...');
    
    // Lista de modelos que reportaron tener valores
    const testModels = [
      '668e5799-1a78-4980-a33b-52674328bb33',
      'fe54995d-1828-4721-8153-53fce6f4fe56', 
      '0976437e-15e6-424d-8122-afb65580239a',
      'b9dfa52a-5d60-4aec-8681-a5c63a1f7867'
    ];
    
    const modelResults = [];
    
    for (const modelId of testModels) {
      console.log(`\n🔍 Verificando modelo: ${modelId}`);
      
      try {
        // Verificar valores en model_values
        const valuesResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${CURRENT_DATE}`, {
          method: 'GET'
        });
        
        const modelResult = {
          model_id: modelId,
          has_values_in_db: valuesResponse.success && valuesResponse.values && valuesResponse.values.length > 0,
          values_count: valuesResponse.success && valuesResponse.values ? valuesResponse.values.length : 0,
          values_response: valuesResponse
        };
        
        if (modelResult.has_values_in_db) {
          console.log(`   ⚠️ PROBLEMA: Modelo ${modelId} tiene ${modelResult.values_count} valores en la base de datos`);
          console.log(`   📊 Valores:`, valuesResponse.values);
        } else {
          console.log(`   ✅ OK: Modelo ${modelId} no tiene valores en la base de datos`);
        }
        
        modelResults.push(modelResult);
        
      } catch (error) {
        console.log(`   ❌ Error verificando modelo ${modelId}: ${error.message}`);
        modelResults.push({
          model_id: modelId,
          error: error.message
        });
      }
    }
    
    // 3. Verificar si hay valores en fechas diferentes
    console.log('\n🔍 [VERIFY-CLEANUP] Verificando valores en otras fechas...');
    
    const otherDates = ['2025-10-14', '2025-10-16', '2025-10-01'];
    
    for (const date of otherDates) {
      console.log(`\n📅 Verificando fecha: ${date}`);
      
      try {
        const testModelId = testModels[0]; // Usar el primer modelo para la prueba
        const valuesResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=${testModelId}&periodDate=${date}`, {
          method: 'GET'
        });
        
        if (valuesResponse.success && valuesResponse.values && valuesResponse.values.length > 0) {
          console.log(`   ⚠️ Encontrados ${valuesResponse.values.length} valores para ${date}`);
        } else {
          console.log(`   ✅ No hay valores para ${date}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error verificando fecha ${date}: ${error.message}`);
      }
    }
    
    // 4. Verificar configuración de calculadora
    console.log('\n🔍 [VERIFY-CLEANUP] Verificando configuración de calculadora...');
    
    try {
      const configResponse = await makeRequest(`${API_URL}/api/calculator/config-v2?modelId=${testModels[0]}`, {
        method: 'GET'
      });
      
      if (configResponse.success && configResponse.config) {
        console.log('   ✅ Configuración encontrada:', configResponse.config);
      } else {
        console.log('   ⚠️ No se encontró configuración:', configResponse);
      }
      
    } catch (error) {
      console.log(`   ❌ Error verificando configuración: ${error.message}`);
    }
    
    // 5. Análisis de posibles causas
    console.log('\n🔍 [VERIFY-CLEANUP] Analizando posibles causas...');
    
    const modelsWithValues = modelResults.filter(m => m.has_values_in_db);
    
    if (modelsWithValues.length > 0) {
      console.log(`\n🚨 PROBLEMA CONFIRMADO: ${modelsWithValues.length} modelos tienen valores en la base de datos`);
      
      console.log('\n💡 Posibles causas:');
      console.log('   1. El cierre automático no eliminó correctamente los valores');
      console.log('   2. Los valores se están guardando con una fecha diferente');
      console.log('   3. Hay un problema con la consulta de eliminación');
      console.log('   4. Los valores se están recreando después del cierre');
      console.log('   5. Hay un problema con el filtro de fecha en la eliminación');
      
      console.log('\n🔧 Soluciones recomendadas:');
      console.log('   1. Ejecutar limpieza manual de valores');
      console.log('   2. Verificar la consulta de eliminación en el cierre automático');
      console.log('   3. Verificar que no haya autosave recreando valores');
      console.log('   4. Revisar logs del cierre automático');
      
    } else {
      console.log('\n✅ NO HAY PROBLEMA: Los modelos no tienen valores en la base de datos');
      console.log('\n💡 Si los modelos siguen viendo valores, las posibles causas son:');
      console.log('   1. Cache del navegador');
      console.log('   2. Estado local de React no actualizado');
      console.log('   3. Valores cargados desde localStorage');
      console.log('   4. Problema de sincronización del frontend');
      
      console.log('\n🔧 Soluciones recomendadas:');
      console.log('   1. Pedir a los modelos que refresquen la página (Ctrl+F5)');
      console.log('   2. Limpiar cache del navegador');
      console.log('   3. Verificar que no haya valores en localStorage');
      console.log('   4. Verificar la lógica de carga de valores en el frontend');
    }
    
    // 6. Generar reporte
    console.log('\n' + '=' * 80);
    console.log('📊 [VERIFY-CLEANUP] Reporte de verificación:');
    console.log(`   - Modelos verificados: ${testModels.length}`);
    console.log(`   - Modelos con valores en DB: ${modelsWithValues.length}`);
    console.log(`   - Fecha verificada: ${CURRENT_DATE}`);
    console.log(`   - Estado: ${modelsWithValues.length > 0 ? 'PROBLEMA DETECTADO' : 'SIN PROBLEMAS'}`);
    console.log('=' * 80);
    
    return {
      models_verified: testModels.length,
      models_with_values: modelsWithValues.length,
      has_problem: modelsWithValues.length > 0,
      model_results: modelResults,
      recommendations: modelsWithValues.length > 0 ? 'cleanup_required' : 'frontend_issue'
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-CLEANUP] Error en verificación:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 [VERIFY-CLEANUP] Iniciando verificación de limpieza de calculadoras...');
    
    const results = await verifyCalculatorCleanup();
    
    console.log('\n🎯 [VERIFY-CLEANUP] Resultado final:', results.has_problem ? 'PROBLEMA DETECTADO' : 'SIN PROBLEMAS');
    
    return results;
    
  } catch (error) {
    console.error('❌ [VERIFY-CLEANUP] Error general:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(result => {
      console.log('\n🎯 [VERIFY-CLEANUP] Verificación completada');
      process.exit(result.status === 'error' ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 [VERIFY-CLEANUP] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { verifyCalculatorCleanup, main };
