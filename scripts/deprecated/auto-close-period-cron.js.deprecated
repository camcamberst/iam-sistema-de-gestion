/**
 * 🔄 CRON JOB: Cierre Automático de Períodos de Calculadora
 * 
 * Este script se ejecuta automáticamente los días 15 y 30 de cada mes
 * a las 17:00 (5:00 PM) en huso horario de Colombia, sincronizado con medianoche europea.
 * 
 * FUNCIONES:
 * 1. Archivar valores actuales a tabla histórica
 * 2. Resetear calculadora a ceros
 * 3. Preparar nuevo período
 */

const https = require('https');
const { getCalculatorDate, getCurrentCalculatorPeriod } = require('../utils/calculator-dates');

// Configuración del endpoint
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ENDPOINT = `${API_URL}/api/calculator/auto-close-period`;

/**
 * Ejecutar cierre automático de período
 */
async function executeAutoClose() {
  try {
    console.log('🔄 [CRON] Iniciando cierre automático de período...');
    console.log('🔄 [CRON] Fecha actual (Europa Central):', getCalculatorDate());
    console.log('🔄 [CRON] Período:', getCurrentCalculatorPeriod().description);
    
    // Verificar si es día de corte (15 o 30)
    const today = new Date();
    const day = today.getDate();
    
    if (day !== 15 && day !== 30) {
      console.log('⏭️ [CRON] No es día de corte (15 o 30), saltando ejecución');
      return;
    }
    
    console.log('✅ [CRON] Es día de corte, ejecutando cierre automático...');
    
    // Llamar al endpoint de cierre automático
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'cron-secret'}` // Seguridad básica
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ [CRON] Cierre automático completado exitosamente');
      console.log('📊 [CRON] Resultados:', result.results);
      console.log('📈 [CRON] Resumen:', result.summary);
    } else {
      console.error('❌ [CRON] Error en cierre automático:', result.error);
    }
    
  } catch (error) {
    console.error('❌ [CRON] Error ejecutando cierre automático:', error);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  executeAutoClose();
}

module.exports = { executeAutoClose };
