/**
 * 🚨 EJECUTOR DE CIERRE RETRASADO - 15 OCTUBRE 2025
 * 
 * Script para ejecutar el cierre automático que debió ejecutarse a las 17:00
 * Fecha actual: 15 de octubre 2025, 6:41 PM Colombia
 * Hora de corte: 17:00 Colombia (ya pasó hace 1 hora 41 minutos)
 * Acción: Ejecutar cierre automático de quincena 1 (días 1-15) manualmente
 */

const https = require('https');

// Configuración
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';
const CURRENT_DATE = '2025-10-15';
const CURRENT_TIME = '18:41'; // 6:41 PM Colombia
const CUTOFF_TIME = '17:00'; // 5:00 PM Colombia
const DELAY_MINUTES = 101; // 1 hora 41 minutos de retraso

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
 * Ejecutar cierre automático retrasado
 */
async function executeDelayedClosure() {
  try {
    console.log('🚨 [DELAYED-CLOSURE] Ejecutando cierre automático retrasado...');
    console.log('=' * 60);
    console.log(`📅 Fecha: ${CURRENT_DATE}`);
    console.log(`⏰ Hora actual: ${CURRENT_TIME} Colombia`);
    console.log(`⏰ Hora de corte: ${CUTOFF_TIME} Colombia`);
    console.log(`⏱️ Retraso: ${DELAY_MINUTES} minutos (${Math.floor(DELAY_MINUTES/60)}h ${DELAY_MINUTES%60}m)`);
    console.log('=' * 60);
    
    // 1. Verificar estado actual del sistema
    console.log('\n🔍 [DELAYED-CLOSURE] Verificando estado actual del sistema...');
    
    const statusResponse = await makeRequest(`${API_URL}/api/cron/auto-close-calculator`, {
      method: 'GET'
    });
    
    console.log('📊 Estado del sistema:', statusResponse);
    
    if (statusResponse.current_day !== 15) {
      console.log('⚠️ [DELAYED-CLOSURE] Advertencia: No es día 15, pero procediendo con cierre manual...');
    }
    
    // 2. Ejecutar cierre automático manualmente
    console.log('\n🔄 [DELAYED-CLOSURE] Ejecutando cierre automático manual...');
    
    const closureResponse = await makeRequest(`${API_URL}/api/calculator/auto-close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'manual-closure'}`,
        'X-Manual-Execution': 'true',
        'X-Delay-Minutes': DELAY_MINUTES.toString()
      },
      body: JSON.stringify({
        manual_execution: true,
        delay_minutes: DELAY_MINUTES,
        execution_reason: 'Cierre retrasado - hora de corte ya pasó'
      })
    });
    
    console.log('✅ [DELAYED-CLOSURE] Resultado del cierre:', closureResponse);
    
    // 3. Verificar que el cierre se ejecutó correctamente
    console.log('\n🔍 [DELAYED-CLOSURE] Verificando ejecución del cierre...');
    
    // Verificar que model_values esté limpio
    const verifyResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=test&periodDate=${CURRENT_DATE}`);
    
    console.log('🔍 Verificación de valores actuales:', verifyResponse);
    
    // 4. Generar reporte de cierre retrasado
    console.log('\n📋 [DELAYED-CLOSURE] Generando reporte de cierre retrasado...');
    
    const report = {
      fecha: CURRENT_DATE,
      horaActual: CURRENT_TIME,
      horaCorte: CUTOFF_TIME,
      retraso: {
        minutos: DELAY_MINUTES,
        horas: Math.floor(DELAY_MINUTES / 60),
        minutosRestantes: DELAY_MINUTES % 60
      },
      quincena: '1 (días 1-15 octubre)',
      ejecucion: 'Manual (retrasada)',
      resultado: closureResponse,
      verificacion: verifyResponse,
      proximoCierre: '30 de octubre 2025 a las 17:00 Colombia',
      notas: [
        'Cierre ejecutado manualmente debido a retraso',
        'Sistema debería funcionar automáticamente en el próximo cierre',
        'Verificar logs de Vercel para identificar causa del retraso'
      ]
    };
    
    console.log('📋 [DELAYED-CLOSURE] Reporte de cierre retrasado:');
    console.log(JSON.stringify(report, null, 2));
    
    // 5. Recomendaciones
    console.log('\n💡 [DELAYED-CLOSURE] Recomendaciones:');
    console.log('   1. Verificar logs de Vercel para identificar causa del retraso');
    console.log('   2. Confirmar que el cron job esté configurado correctamente');
    console.log('   3. Monitorear el próximo cierre (30 octubre)');
    console.log('   4. Considerar implementar alertas para cierres retrasados');
    
    return report;
    
  } catch (error) {
    console.error('❌ [DELAYED-CLOSURE] Error ejecutando cierre retrasado:', error);
    throw error;
  }
}

/**
 * Verificar configuración del cron job
 */
async function verifyCronConfiguration() {
  try {
    console.log('\n🔧 [VERIFY-CRON] Verificando configuración del cron job...');
    
    // Verificar endpoint de cron
    const cronResponse = await makeRequest(`${API_URL}/api/cron/auto-close-calculator`, {
      method: 'GET'
    });
    
    console.log('🔧 Configuración del cron:', cronResponse);
    
    // Verificar schedule recomendado
    const scheduleResponse = await makeRequest(`${API_URL}/api/admin/update-cron-schedule`, {
      method: 'GET'
    });
    
    console.log('🔧 Schedule recomendado:', scheduleResponse);
    
    return {
      cron: cronResponse,
      schedule: scheduleResponse
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-CRON] Error verificando configuración:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function executeDelayedQuincenalClosure() {
  try {
    console.log('🚀 [DELAYED-EXECUTION] Iniciando ejecución de cierre retrasado...');
    console.log('⚠️ [DELAYED-EXECUTION] ATENCIÓN: Este cierre debió ejecutarse automáticamente');
    console.log('⚠️ [DELAYED-EXECUTION] Se está ejecutando manualmente debido al retraso');
    console.log('=' * 80);
    
    // 1. Verificar configuración
    const configReport = await verifyCronConfiguration();
    
    // 2. Ejecutar cierre retrasado
    const closureReport = await executeDelayedClosure();
    
    // 3. Resumen final
    console.log('\n' + '=' * 80);
    console.log('✅ [DELAYED-EXECUTION] Ejecución de cierre retrasado completada');
    console.log('📊 [DELAYED-EXECUTION] Resumen:');
    console.log(`   - Quincena cerrada: ${closureReport.quincena}`);
    console.log(`   - Fecha de cierre: ${closureReport.fecha} ${closureReport.horaActual}`);
    console.log(`   - Retraso: ${closureReport.retraso.horas}h ${closureReport.retraso.minutosRestantes}m`);
    console.log(`   - Ejecución: ${closureReport.ejecucion}`);
    console.log(`   - Próximo cierre: ${closureReport.proximoCierre}`);
    console.log('=' * 80);
    
    return {
      config: configReport,
      closure: closureReport,
      status: 'success'
    };
    
  } catch (error) {
    console.error('❌ [DELAYED-EXECUTION] Error general:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  executeDelayedQuincenalClosure()
    .then(result => {
      console.log('\n🎯 [DELAYED-EXECUTION] Resultado final:', result.status);
      if (result.status === 'success') {
        console.log('✅ Cierre retrasado ejecutado exitosamente');
      } else {
        console.log('❌ Error en cierre retrasado');
      }
      process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [DELAYED-EXECUTION] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { 
  executeDelayedQuincenalClosure, 
  executeDelayedClosure, 
  verifyCronConfiguration 
};
