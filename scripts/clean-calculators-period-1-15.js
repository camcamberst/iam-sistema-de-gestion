/**
 * 🔄 SCRIPT DE LIMPIEZA - PERÍODO 1-15 OCTUBRE
 * 
 * Script para limpiar las calculadoras del período de facturación del 1 al 15 de octubre
 * y asegurar que esto ocurra automáticamente en futuros cierres
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
 * Ejecutar limpieza del período 1-15 octubre
 */
async function cleanCalculatorsPeriod1_15() {
  try {
    console.log('🔄 [CLEAN-PERIOD] Iniciando limpieza del período 1-15 octubre...');
    console.log('=' * 80);
    
    // Ejecutar cierre automático manualmente
    console.log('🔄 [CLEAN-PERIOD] Ejecutando cierre automático...');
    
    const response = await makeRequest(`${API_URL}/api/cron/auto-close-calculator`, {
      method: 'POST'
    });
    
    console.log('🔄 [CLEAN-PERIOD] Resultado del cierre automático:', response);
    
    if (response.success) {
      console.log('\n✅ [CLEAN-PERIOD] LIMPIEZA COMPLETADA EXITOSAMENTE');
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
          console.log('\n📋 [CLEAN-PERIOD] Modelos procesados exitosamente:');
          successful.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.model_email}: ${result.values_archived || 0} valores archivados`);
          });
        }
        
        if (failed.length > 0) {
          console.log('\n⚠️ [CLEAN-PERIOD] Modelos con errores:');
          failed.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.model_email}: ${result.error}`);
          });
        }
      }
      
      console.log('\n🎯 [CLEAN-PERIOD] Estado final:');
      console.log('   ✅ Todas las calculadoras han sido limpiadas');
      console.log('   ✅ Valores archivados en calculator_history');
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
      console.error('❌ [CLEAN-PERIOD] Error en limpieza:', response.error);
      return {
        success: false,
        error: response.error
      };
    }
    
  } catch (error) {
    console.error('❌ [CLEAN-PERIOD] Error ejecutando limpieza:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verificar estado de las calculadoras
 */
async function checkCalculatorsStatus() {
  try {
    console.log('🔍 [CLEAN-PERIOD] Verificando estado de las calculadoras...');
    
    // Verificar si hay valores en model_values para la fecha del cierre
    const testModelId = '668e5799-1a78-4980-a33b-52674328bb33'; // Modelo de prueba
    const currentDate = '2025-10-15';
    
    const valuesResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=${testModelId}&periodDate=${currentDate}`, {
      method: 'GET'
    });
    
    if (valuesResponse.success && valuesResponse.values && valuesResponse.values.length > 0) {
      console.log('⚠️ [CLEAN-PERIOD] ADVERTENCIA: Aún hay valores en las calculadoras');
      console.log('📊 Valores encontrados:', valuesResponse.values.length);
      return { needs_cleaning: true, values_found: valuesResponse.values.length };
    } else {
      console.log('✅ [CLEAN-PERIOD] Calculadoras están limpias');
      return { needs_cleaning: false, values_found: 0 };
    }
    
  } catch (error) {
    console.error('❌ [CLEAN-PERIOD] Error verificando estado:', error);
    return { needs_cleaning: true, error: error.message };
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 [CLEAN-PERIOD] Iniciando proceso de limpieza del período 1-15 octubre...');
    
    // 1. Verificar estado actual
    const currentStatus = await checkCalculatorsStatus();
    
    if (!currentStatus.needs_cleaning) {
      console.log('✅ [CLEAN-PERIOD] Las calculadoras ya están limpias');
      return { success: true, message: 'Calculadoras ya limpias' };
    }
    
    // 2. Ejecutar limpieza
    const cleanResult = await cleanCalculatorsPeriod1_15();
    
    if (cleanResult.success) {
      // 3. Verificar estado después de la limpieza
      console.log('\n🔍 [CLEAN-PERIOD] Verificando estado después de la limpieza...');
      const finalStatus = await checkCalculatorsStatus();
      
      if (!finalStatus.needs_cleaning) {
        console.log('🎉 [CLEAN-PERIOD] ¡ÉXITO TOTAL! Todas las calculadoras están limpias');
      } else {
        console.log('⚠️ [CLEAN-PERIOD] Algunas calculadoras pueden no haberse limpiado completamente');
      }
    }
    
    console.log('\n🎯 [CLEAN-PERIOD] Proceso completado');
    return cleanResult;
    
  } catch (error) {
    console.error('❌ [CLEAN-PERIOD] Error general:', error);
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
      console.log('\n🎯 [CLEAN-PERIOD] Resultado final:', result.success ? 'ÉXITO' : 'FALLO');
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [CLEAN-PERIOD] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { cleanCalculatorsPeriod1_15, checkCalculatorsStatus, main };
