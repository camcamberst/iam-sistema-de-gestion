/**
 * 🔍 ANALIZADOR DE PROBLEMA DE ARCHIVADO
 * 
 * Script para analizar por qué algunos modelos no tienen valores archivados
 * en el cierre automático de quincena
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
 * Analizar por qué algunos modelos no tienen valores archivados
 */
async function analyzeArchivingIssue() {
  try {
    console.log('🔍 [ANALYZE-ARCHIVING] Analizando problema de archivado...');
    console.log('=' * 80);
    
    // 1. Obtener lista de todos los modelos
    console.log('\n📊 [ANALYZE-ARCHIVING] Obteniendo lista de modelos...');
    
    const modelsResponse = await makeRequest(`${API_URL}/api/calculator/models`, {
      method: 'GET'
    });
    
    console.log('📊 Modelos encontrados:', modelsResponse);
    
    if (!modelsResponse.success || !modelsResponse.models) {
      throw new Error('No se pudieron obtener los modelos');
    }
    
    const models = modelsResponse.models;
    console.log(`📊 Total de modelos: ${models.length}`);
    
    // 2. Para cada modelo, verificar:
    //    - Si tiene configuración activa
    //    - Si tiene valores en model_values para la fecha
    //    - Si tiene valores archivados en calculator_history
    
    const analysisResults = [];
    
    for (const model of models) {
      console.log(`\n🔍 [ANALYZE-ARCHIVING] Analizando modelo: ${model.name} (${model.id})`);
      
      const modelAnalysis = {
        model_id: model.id,
        model_name: model.name,
        model_email: model.email,
        has_config: model.hasConfig,
        current_config: model.currentConfig,
        has_values_today: false,
        values_count: 0,
        has_archived_values: false,
        archived_count: 0,
        issues: []
      };
      
      // Verificar si tiene valores en model_values para hoy
      try {
        const valuesResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=${model.id}&periodDate=${CURRENT_DATE}`, {
          method: 'GET'
        });
        
        if (valuesResponse.success && valuesResponse.values) {
          modelAnalysis.has_values_today = valuesResponse.values.length > 0;
          modelAnalysis.values_count = valuesResponse.values.length;
          
          if (valuesResponse.values.length > 0) {
            console.log(`   ✅ Tiene ${valuesResponse.values.length} valores para hoy`);
          } else {
            console.log(`   ⚠️ No tiene valores para hoy`);
            modelAnalysis.issues.push('No tiene valores en model_values para la fecha de cierre');
          }
        } else {
          console.log(`   ❌ Error obteniendo valores: ${valuesResponse.error}`);
          modelAnalysis.issues.push(`Error obteniendo valores: ${valuesResponse.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Error en petición de valores: ${error.message}`);
        modelAnalysis.issues.push(`Error en petición: ${error.message}`);
      }
      
      // Verificar si tiene valores archivados en calculator_history
      try {
        const historyResponse = await makeRequest(`${API_URL}/api/calculator/history?modelId=${model.id}&startDate=2025-10-01&endDate=2025-10-15`, {
          method: 'GET'
        });
        
        if (historyResponse.success && historyResponse.history) {
          modelAnalysis.has_archived_values = historyResponse.history.length > 0;
          modelAnalysis.archived_count = historyResponse.history.length;
          
          if (historyResponse.history.length > 0) {
            console.log(`   ✅ Tiene ${historyResponse.history.length} valores archivados`);
          } else {
            console.log(`   ⚠️ No tiene valores archivados`);
            if (modelAnalysis.has_values_today) {
              modelAnalysis.issues.push('Tenía valores para hoy pero no se archivaron');
            }
          }
        } else {
          console.log(`   ❌ Error obteniendo historial: ${historyResponse.error}`);
          modelAnalysis.issues.push(`Error obteniendo historial: ${historyResponse.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Error en petición de historial: ${error.message}`);
        modelAnalysis.issues.push(`Error en petición de historial: ${error.message}`);
      }
      
      // Verificar configuración
      if (!modelAnalysis.has_config) {
        modelAnalysis.issues.push('No tiene configuración de calculadora');
        console.log(`   ⚠️ No tiene configuración de calculadora`);
      } else {
        console.log(`   ✅ Tiene configuración activa`);
      }
      
      analysisResults.push(modelAnalysis);
    }
    
    // 3. Generar resumen del análisis
    console.log('\n' + '=' * 80);
    console.log('📊 [ANALYZE-ARCHIVING] Resumen del análisis:');
    
    const totalModels = analysisResults.length;
    const modelsWithConfig = analysisResults.filter(m => m.has_config).length;
    const modelsWithValues = analysisResults.filter(m => m.has_values_today).length;
    const modelsWithArchived = analysisResults.filter(m => m.has_archived_values).length;
    const modelsWithIssues = analysisResults.filter(m => m.issues.length > 0).length;
    
    console.log(`   - Total de modelos: ${totalModels}`);
    console.log(`   - Modelos con configuración: ${modelsWithConfig}`);
    console.log(`   - Modelos con valores hoy: ${modelsWithValues}`);
    console.log(`   - Modelos con valores archivados: ${modelsWithArchived}`);
    console.log(`   - Modelos con problemas: ${modelsWithIssues}`);
    
    // 4. Mostrar modelos con problemas
    console.log('\n🚨 [ANALYZE-ARCHIVING] Modelos con problemas:');
    
    const problematicModels = analysisResults.filter(m => m.issues.length > 0);
    
    if (problematicModels.length === 0) {
      console.log('   ✅ No se encontraron problemas');
    } else {
      problematicModels.forEach((model, index) => {
        console.log(`\n   ${index + 1}. ${model.model_name} (${model.model_email})`);
        console.log(`      - Configuración: ${model.has_config ? 'Sí' : 'No'}`);
        console.log(`      - Valores hoy: ${model.values_count}`);
        console.log(`      - Valores archivados: ${model.archived_count}`);
        console.log(`      - Problemas:`);
        model.issues.forEach(issue => {
          console.log(`        • ${issue}`);
        });
      });
    }
    
    // 5. Mostrar modelos que deberían haber sido archivados
    console.log('\n📋 [ANALYZE-ARCHIVING] Modelos que deberían haber sido archivados:');
    
    const shouldBeArchived = analysisResults.filter(m => 
      m.has_config && m.has_values_today && !m.has_archived_values
    );
    
    if (shouldBeArchived.length === 0) {
      console.log('   ✅ Todos los modelos con valores fueron archivados correctamente');
    } else {
      console.log(`   ⚠️ ${shouldBeArchived.length} modelos tenían valores pero no fueron archivados:`);
      shouldBeArchived.forEach((model, index) => {
        console.log(`      ${index + 1}. ${model.model_name} - ${model.values_count} valores no archivados`);
      });
    }
    
    // 6. Recomendaciones
    console.log('\n💡 [ANALYZE-ARCHIVING] Recomendaciones:');
    
    if (shouldBeArchived.length > 0) {
      console.log('   1. [HIGH] Ejecutar archivado manual para modelos con valores no archivados');
      console.log('   2. [MEDIUM] Verificar logs del cierre automático para identificar errores');
      console.log('   3. [MEDIUM] Revisar permisos de la tabla calculator_history');
    }
    
    if (modelsWithConfig === 0) {
      console.log('   1. [HIGH] No hay modelos con configuración activa');
      console.log('   2. [MEDIUM] Verificar tabla calculator_config');
    }
    
    console.log('   4. [LOW] Implementar monitoreo de archivado en tiempo real');
    console.log('   5. [LOW] Crear alertas para modelos con problemas de archivado');
    
    return {
      totalModels,
      modelsWithConfig,
      modelsWithValues,
      modelsWithArchived,
      modelsWithIssues,
      problematicModels,
      shouldBeArchived,
      analysisResults
    };
    
  } catch (error) {
    console.error('❌ [ANALYZE-ARCHIVING] Error en análisis:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 [ANALYZE-ARCHIVING] Iniciando análisis de problema de archivado...');
    
    const results = await analyzeArchivingIssue();
    
    console.log('\n' + '=' * 80);
    console.log('✅ [ANALYZE-ARCHIVING] Análisis completado');
    console.log('📊 [ANALYZE-ARCHIVING] Resultado final:');
    console.log(`   - Modelos analizados: ${results.totalModels}`);
    console.log(`   - Modelos con problemas: ${results.modelsWithIssues}`);
    console.log(`   - Modelos no archivados: ${results.shouldBeArchived.length}`);
    console.log('=' * 80);
    
    return results;
    
  } catch (error) {
    console.error('❌ [ANALYZE-ARCHIVING] Error general:', error);
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
      console.log('\n🎯 [ANALYZE-ARCHIVING] Resultado final:', result.status || 'completed');
      process.exit(result.status === 'error' ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 [ANALYZE-ARCHIVING] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { analyzeArchivingIssue, main };
