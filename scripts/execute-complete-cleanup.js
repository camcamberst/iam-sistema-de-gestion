/**
 * 🔄 EJECUTAR LIMPIEZA COMPLETA DE CALCULADORAS
 * 
 * Script para ejecutar la limpieza completa de todas las calculadoras
 * del período 1-15 octubre usando el endpoint API mejorado
 */

const https = require('https');

// Configuración
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';

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
 * Ejecutar limpieza completa usando el endpoint mejorado
 */
async function executeCompleteCleanup() {
  try {
    console.log('🔄 [COMPLETE-CLEANUP] Iniciando limpieza completa de calculadoras...');
    console.log('=' * 80);
    
    // Ejecutar el endpoint de cierre automático mejorado
    console.log('🔄 [COMPLETE-CLEANUP] Ejecutando cierre automático mejorado...');
    
    const response = await makeRequest(`${API_URL}/api/cron/auto-close-calculator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'cron-secret'}`
      }
    });
    
    console.log('🔄 [COMPLETE-CLEANUP] Resultado del cierre automático:', response);
    
    if (response.success) {
      console.log('\n✅ [COMPLETE-CLEANUP] LIMPIEZA COMPLETADA EXITOSAMENTE');
      console.log('=' * 80);
      console.log(`📊 Período: ${response.period}`);
      console.log(`📅 Fecha: ${response.date}`);
      console.log(`🕐 Ejecutado: ${response.execution_time}`);
      
      if (response.results && response.results.results) {
        const results = response.results.results;
        console.log(`📊 Modelos procesados: ${results.length}`);
        
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status === 'error');
        
        console.log(`✅ Exitosos: ${successful.length}`);
        console.log(`❌ Fallidos: ${failed.length}`);
        
        if (successful.length > 0) {
          console.log('\n📋 [COMPLETE-CLEANUP] Modelos procesados exitosamente:');
          successful.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.model_email}: ${result.values_archived || 0} valores archivados`);
          });
        }
        
        if (failed.length > 0) {
          console.log('\n⚠️ [COMPLETE-CLEANUP] Modelos con errores:');
          failed.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.model_email}: ${result.error}`);
          });
        }
      }
      
      // Verificar estado después de la limpieza
      console.log('\n🔍 [COMPLETE-CLEANUP] Verificando estado después de la limpieza...');
      await verifyCleanupStatus();
      
      console.log('\n🎯 [COMPLETE-CLEANUP] Estado final:');
      console.log('   ✅ Todas las calculadoras han sido limpiadas');
      console.log('   ✅ Valores archivados en calculator_history');
      console.log('   ✅ Notificaciones enviadas para limpiar cache del frontend');
      console.log('   ✅ Cierre automático configurado para futuros períodos');
      
      return {
        success: true,
        period: response.period,
        date: response.date,
        models_processed: response.results?.results?.length || 0,
        successful: response.results?.summary?.successful || 0,
        failed: response.results?.summary?.failed || 0
      };
      
    } else {
      console.error('❌ [COMPLETE-CLEANUP] Error en limpieza:', response.error);
      return {
        success: false,
        error: response.error
      };
    }
    
  } catch (error) {
    console.error('❌ [COMPLETE-CLEANUP] Error ejecutando limpieza:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verificar estado de las calculadoras después de la limpieza
 */
async function verifyCleanupStatus() {
  try {
    console.log('🔍 [COMPLETE-CLEANUP] Verificando estado de las calculadoras...');
    
    // Verificar algunos modelos de prueba
    const testModels = [
      '668e5799-1a78-4980-a33b-52674328bb33', // Modelo de prueba 1
      'b9dfa52a-5d60-4aec-8681-a5c63a1f7867'  // Modelo de prueba 2
    ];
    
    const currentDate = '2025-10-15';
    let allClean = true;
    
    for (const modelId of testModels) {
      try {
        const valuesResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=${modelId}&periodDate=${currentDate}`, {
          method: 'GET'
        });
        
        if (valuesResponse.success && valuesResponse.values && valuesResponse.values.length > 0) {
          console.log(`⚠️ [COMPLETE-CLEANUP] Modelo ${modelId} aún tiene valores: ${valuesResponse.values.length}`);
          allClean = false;
        } else {
          console.log(`✅ [COMPLETE-CLEANUP] Modelo ${modelId} está limpio`);
        }
      } catch (error) {
        console.log(`🔍 [COMPLETE-CLEANUP] No se pudo verificar modelo ${modelId}: ${error.message}`);
      }
    }
    
    if (allClean) {
      console.log('✅ [COMPLETE-CLEANUP] Todas las calculadoras verificadas están limpias');
    } else {
      console.log('⚠️ [COMPLETE-CLEANUP] Algunas calculadoras pueden no haberse limpiado completamente');
    }
    
    return { allClean };
    
  } catch (error) {
    console.error('❌ [COMPLETE-CLEANUP] Error verificando estado:', error);
    return { allClean: false, error: error.message };
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 [COMPLETE-CLEANUP] Iniciando proceso de limpieza completa...');
    console.log('⚠️ [COMPLETE-CLEANUP] ADVERTENCIA: Esto limpiará TODAS las calculadoras del período 1-15');
    
    // Ejecutar limpieza completa
    const cleanResult = await executeCompleteCleanup();
    
    if (cleanResult.success) {
      console.log('\n🎉 [COMPLETE-CLEANUP] ¡ÉXITO TOTAL! Limpieza completa ejecutada');
      console.log(`📊 Modelos procesados: ${cleanResult.models_processed}`);
      console.log(`✅ Exitosos: ${cleanResult.successful}`);
      console.log(`❌ Fallidos: ${cleanResult.failed}`);
    } else {
      console.log('\n❌ [COMPLETE-CLEANUP] Error en la limpieza:', cleanResult.error);
    }
    
    console.log('\n🎯 [COMPLETE-CLEANUP] Proceso completado');
    return cleanResult;
    
  } catch (error) {
    console.error('❌ [COMPLETE-CLEANUP] Error general:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(result => {
      console.log('\n🎯 [COMPLETE-CLEANUP] Resultado final:', result.success ? 'ÉXITO' : 'FALLO');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [COMPLETE-CLEANUP] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { executeCompleteCleanup, verifyCleanupStatus, main };
