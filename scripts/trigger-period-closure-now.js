/**
 * Script para ejecutar el cierre de período manualmente
 * Ejecutar cuando el cron no se ejecutó a tiempo
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch').default || require('node-fetch');

// Forzar URL de producción para ejecutar cierre
const API_URL = 'https://iam-sistema-de-gestion.vercel.app';

async function triggerPeriodClosure() {
  try {
    console.log('🚨 [MANUAL-CLOSURE] Ejecutando cierre de período manualmente...');
    console.log(`📡 URL: ${API_URL}/api/calculator/period-closure/close-period`);
    
    const response = await fetch(`${API_URL}/api/calculator/period-closure/close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-testing-mode': 'true' // Bypass validaciones de tiempo
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ [MANUAL-CLOSURE] Error:', result);
      process.exit(1);
    }

    console.log('✅ [MANUAL-CLOSURE] Cierre ejecutado exitosamente:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ [MANUAL-CLOSURE] Error:', error);
    process.exit(1);
  }
}

triggerPeriodClosure();

