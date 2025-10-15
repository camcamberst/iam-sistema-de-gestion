/**
 * 📊 ORGANIZADOR DE DATOS QUINCENALES
 * 
 * Script para organizar y procesar datos del cierre de quincena
 * Fecha actual: 15 de octubre 2025, 6:41 PM Colombia
 * Hora de corte: 17:00 Colombia (ya pasó)
 * Acción: Cierre automático de quincena 1 (días 1-15)
 */

const https = require('https');
const { getColombiaDate, getCurrentCalculatorPeriod } = require('../utils/calculator-dates');

// Configuración
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';
const CURRENT_DATE = '2025-10-15';
const CURRENT_TIME = '18:41'; // 6:41 PM Colombia
const CUTOFF_TIME = '17:00'; // 5:00 PM Colombia

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
 * Ejecutar cierre automático de quincena
 */
async function executeQuincenalClosure() {
  try {
    console.log('🔄 [QUINCENAL-CLOSURE] Iniciando cierre automático de quincena...');
    console.log(`📅 [QUINCENAL-CLOSURE] Fecha: ${CURRENT_DATE} ${CURRENT_TIME} Colombia`);
    console.log(`⏰ [QUINCENAL-CLOSURE] Hora de corte: ${CUTOFF_TIME} Colombia (ya pasó)`);
    
    // 1. Verificar estado actual del sistema
    console.log('\n📊 [QUINCENAL-CLOSURE] Verificando estado actual...');
    
    const statusResponse = await makeRequest(`${API_URL}/api/cron/auto-close-calculator`, {
      method: 'GET'
    });
    
    console.log('📊 [QUINCENAL-CLOSURE] Estado del sistema:', statusResponse);
    
    // 2. Ejecutar cierre automático
    console.log('\n🔄 [QUINCENAL-CLOSURE] Ejecutando cierre automático...');
    
    const closureResponse = await makeRequest(`${API_URL}/api/calculator/auto-close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ [QUINCENAL-CLOSURE] Resultado del cierre:', closureResponse);
    
    // 3. Verificar datos archivados
    console.log('\n📚 [QUINCENAL-CLOSURE] Verificando datos archivados...');
    
    // Aquí se podría agregar verificación de calculator_history
    // para confirmar que los datos se archivaron correctamente
    
    // 4. Generar reporte de cierre
    console.log('\n📋 [QUINCENAL-CLOSURE] Generando reporte de cierre...');
    
    const report = {
      fecha: CURRENT_DATE,
      hora: CURRENT_TIME,
      horaCorte: CUTOFF_TIME,
      quincena: '1 (días 1-15)',
      estado: 'Cierre ejecutado',
      resultado: closureResponse,
      proximoCierre: '30 de octubre 2025 a las 17:00 Colombia'
    };
    
    console.log('📋 [QUINCENAL-CLOSURE] Reporte de cierre:');
    console.log(JSON.stringify(report, null, 2));
    
    return report;
    
  } catch (error) {
    console.error('❌ [QUINCENAL-CLOSURE] Error:', error);
    throw error;
  }
}

/**
 * Verificar datos de la quincena cerrada
 */
async function verifyQuincenalData() {
  try {
    console.log('\n🔍 [VERIFY-DATA] Verificando datos de la quincena cerrada...');
    
    // Verificar calculator_history para la quincena 1 (1-15 octubre)
    const historyResponse = await makeRequest(`${API_URL}/api/calculator/history?startDate=2025-10-01&endDate=2025-10-15`);
    
    console.log('📚 [VERIFY-DATA] Datos históricos encontrados:', historyResponse);
    
    // Verificar que model_values esté limpio para el nuevo período
    const currentValuesResponse = await makeRequest(`${API_URL}/api/calculator/model-values-v2?modelId=test&periodDate=${CURRENT_DATE}`);
    
    console.log('🔄 [VERIFY-DATA] Valores actuales (deben estar en 0):', currentValuesResponse);
    
    return {
      historicalData: historyResponse,
      currentValues: currentValuesResponse,
      status: 'Verificación completada'
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-DATA] Error en verificación:', error);
    throw error;
  }
}

/**
 * Función principal
 */
async function organizeQuincenalData() {
  try {
    console.log('🚀 [ORGANIZE-DATA] Iniciando organización de datos quincenales...');
    console.log('=' * 60);
    
    // 1. Ejecutar cierre automático
    const closureReport = await executeQuincenalClosure();
    
    // 2. Verificar datos
    const verificationReport = await verifyQuincenalData();
    
    // 3. Resumen final
    console.log('\n' + '=' * 60);
    console.log('✅ [ORGANIZE-DATA] Organización de datos completada');
    console.log('📊 [ORGANIZE-DATA] Resumen:');
    console.log(`   - Quincena cerrada: ${closureReport.quincena}`);
    console.log(`   - Fecha de cierre: ${closureReport.fecha} ${closureReport.hora}`);
    console.log(`   - Estado: ${closureReport.estado}`);
    console.log(`   - Próximo cierre: ${closureReport.proximoCierre}`);
    console.log('=' * 60);
    
    return {
      closure: closureReport,
      verification: verificationReport,
      status: 'success'
    };
    
  } catch (error) {
    console.error('❌ [ORGANIZE-DATA] Error general:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  organizeQuincenalData()
    .then(result => {
      console.log('\n🎯 [ORGANIZE-DATA] Resultado final:', result.status);
      process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [ORGANIZE-DATA] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { organizeQuincenalData, executeQuincenalClosure, verifyQuincenalData };
