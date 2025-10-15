/**
 * 🔍 VERIFICADOR DEL SISTEMA DE CRON JOBS
 * 
 * Script para verificar que el sistema de cron jobs esté funcionando correctamente
 * y diagnosticar cualquier problema antes del próximo cierre automático
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
 * Verificar configuración del cron job
 */
async function verifyCronConfiguration() {
  try {
    console.log('🔧 [VERIFY-CRON] Verificando configuración del cron job...');
    
    // 1. Verificar endpoint de cron
    console.log('\n📡 [VERIFY-CRON] Probando endpoint de cron...');
    const cronResponse = await makeRequest(`${API_URL}/api/cron/auto-close-calculator`, {
      method: 'GET'
    });
    
    console.log('📡 Respuesta del endpoint de cron:', cronResponse);
    
    // 2. Verificar schedule recomendado
    console.log('\n📅 [VERIFY-CRON] Verificando schedule recomendado...');
    const scheduleResponse = await makeRequest(`${API_URL}/api/admin/update-cron-schedule`, {
      method: 'GET'
    });
    
    console.log('📅 Schedule recomendado:', scheduleResponse);
    
    // 3. Verificar endpoint de cierre automático
    console.log('\n🔄 [VERIFY-CRON] Verificando endpoint de cierre automático...');
    const closureResponse = await makeRequest(`${API_URL}/api/calculator/auto-close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        test_mode: true,
        verify_only: true
      })
    });
    
    console.log('🔄 Respuesta del endpoint de cierre:', closureResponse);
    
    return {
      cron: cronResponse,
      schedule: scheduleResponse,
      closure: closureResponse
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-CRON] Error verificando configuración:', error);
    throw error;
  }
}

/**
 * Verificar timezone y horarios
 */
async function verifyTimezoneConfiguration() {
  try {
    console.log('\n🕐 [VERIFY-TIMEZONE] Verificando configuración de timezone...');
    
    const scheduleResponse = await makeRequest(`${API_URL}/api/admin/update-cron-schedule`, {
      method: 'GET'
    });
    
    if (scheduleResponse.success) {
      const timezone = scheduleResponse.timezone;
      const cronSchedule = scheduleResponse.cronSchedule;
      
      console.log('🕐 Información de timezone:');
      console.log(`   - Horario europeo: ${timezone.europeanTimezone}`);
      console.log(`   - Horario colombia: ${timezone.colombiaTimezone}`);
      console.log(`   - Diferencia: ${timezone.hourDifference} horas`);
      console.log(`   - Hora de corte: ${timezone.colombiaTimeForEuropeanMidnight}`);
      console.log(`   - Schedule actual: ${cronSchedule.current}`);
      
      // Verificar próximos cierres
      console.log('\n📅 Próximos cierres programados:');
      scheduleResponse.nextClosures.forEach((closure, index) => {
        console.log(`   ${index + 1}. ${closure.date} - ${closure.description} (${closure.colombiaTime} Colombia)`);
      });
      
      return {
        timezone: timezone,
        schedule: cronSchedule,
        nextClosures: scheduleResponse.nextClosures
      };
    }
    
    throw new Error('No se pudo obtener información de timezone');
    
  } catch (error) {
    console.error('❌ [VERIFY-TIMEZONE] Error verificando timezone:', error);
    throw error;
  }
}

/**
 * Verificar estado actual del sistema
 */
async function verifySystemStatus() {
  try {
    console.log('\n📊 [VERIFY-SYSTEM] Verificando estado actual del sistema...');
    
    // Verificar fecha actual
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    console.log(`📅 Fecha actual: ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
    console.log(`📅 Día del mes: ${day}`);
    
    // Verificar si es día de corte
    const isCutoffDay = day === 15 || day === 30;
    console.log(`🎯 Es día de corte: ${isCutoffDay ? 'SÍ' : 'NO'}`);
    
    if (isCutoffDay) {
      console.log('⚠️ [VERIFY-SYSTEM] ADVERTENCIA: Hoy es día de corte, el cron debería ejecutarse');
    }
    
    // Calcular días hasta próximo cierre
    let nextCutoffDay;
    if (day < 15) {
      nextCutoffDay = 15;
    } else if (day < 30) {
      nextCutoffDay = 30;
    } else {
      nextCutoffDay = 15; // Próximo mes
    }
    
    const daysUntilNext = nextCutoffDay - day;
    console.log(`📅 Días hasta próximo cierre: ${daysUntilNext} días`);
    console.log(`📅 Próximo cierre: Día ${nextCutoffDay} del mes actual`);
    
    return {
      currentDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      currentDay: day,
      isCutoffDay: isCutoffDay,
      nextCutoffDay: nextCutoffDay,
      daysUntilNext: daysUntilNext
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-SYSTEM] Error verificando estado del sistema:', error);
    throw error;
  }
}

/**
 * Generar recomendaciones
 */
function generateRecommendations(verificationResults) {
  console.log('\n💡 [RECOMMENDATIONS] Generando recomendaciones...');
  
  const recommendations = [];
  
  // Verificar configuración del cron
  if (!verificationResults.cron.success) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Endpoint de cron no responde correctamente',
      solution: 'Verificar que el endpoint /api/cron/auto-close-calculator esté funcionando'
    });
  }
  
  // Verificar timezone
  if (verificationResults.timezone) {
    const timezone = verificationResults.timezone.timezone;
    if (timezone.hourDifference !== 7 && timezone.hourDifference !== 6) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Diferencia de horario inesperada',
        solution: 'Verificar cálculo de timezone para horario de verano/invierno'
      });
    }
  }
  
  // Verificar si es día de corte
  if (verificationResults.system.isCutoffDay) {
    recommendations.push({
      priority: 'HIGH',
      issue: 'Hoy es día de corte pero el cron no se ejecutó automáticamente',
      solution: 'Ejecutar cierre manual y verificar logs de Vercel'
    });
  }
  
  // Verificar próximos cierres
  if (verificationResults.system.daysUntilNext <= 3) {
    recommendations.push({
      priority: 'MEDIUM',
      issue: 'Próximo cierre en menos de 3 días',
      solution: 'Monitorear el sistema y estar preparado para cierre manual si es necesario'
    });
  }
  
  console.log('💡 Recomendaciones:');
  recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. [${rec.priority}] ${rec.issue}`);
    console.log(`      Solución: ${rec.solution}`);
  });
  
  return recommendations;
}

/**
 * Función principal de verificación
 */
async function verifyCronSystem() {
  try {
    console.log('🚀 [VERIFY-SYSTEM] Iniciando verificación completa del sistema de cron...');
    console.log('=' * 80);
    
    // 1. Verificar configuración del cron
    const cronConfig = await verifyCronConfiguration();
    
    // 2. Verificar timezone
    const timezoneConfig = await verifyTimezoneConfiguration();
    
    // 3. Verificar estado del sistema
    const systemStatus = await verifySystemStatus();
    
    // 4. Generar recomendaciones
    const recommendations = generateRecommendations({
      cron: cronConfig.cron,
      timezone: timezoneConfig,
      system: systemStatus
    });
    
    // 5. Resumen final
    console.log('\n' + '=' * 80);
    console.log('✅ [VERIFY-SYSTEM] Verificación completada');
    console.log('📊 [VERIFY-SYSTEM] Resumen:');
    console.log(`   - Endpoint de cron: ${cronConfig.cron.success ? '✅ Funcionando' : '❌ Con problemas'}`);
    console.log(`   - Configuración de timezone: ${timezoneConfig ? '✅ Correcta' : '❌ Con problemas'}`);
    console.log(`   - Estado del sistema: ${systemStatus.isCutoffDay ? '⚠️ Día de corte' : '✅ Normal'}`);
    console.log(`   - Próximo cierre: Día ${systemStatus.nextCutoffDay} (${systemStatus.daysUntilNext} días)`);
    console.log(`   - Recomendaciones: ${recommendations.length} encontradas`);
    console.log('=' * 80);
    
    return {
      cron: cronConfig,
      timezone: timezoneConfig,
      system: systemStatus,
      recommendations: recommendations,
      status: 'completed'
    };
    
  } catch (error) {
    console.error('❌ [VERIFY-SYSTEM] Error en verificación:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  verifyCronSystem()
    .then(result => {
      console.log('\n🎯 [VERIFY-SYSTEM] Resultado final:', result.status);
      process.exit(result.status === 'completed' ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [VERIFY-SYSTEM] Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { 
  verifyCronSystem, 
  verifyCronConfiguration, 
  verifyTimezoneConfiguration, 
  verifySystemStatus 
};
