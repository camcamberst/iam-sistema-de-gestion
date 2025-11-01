/**
 * Script para forzar el cierre correcto del período 16-31 de octubre
 * Esto corrige el cierre anterior que se ejecutó con fecha incorrecta
 */

require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch').default || require('node-fetch');

const API_URL = 'https://iam-sistema-de-gestion.vercel.app';

async function forceCorrectClosure() {
  try {
    console.log('🚨 [FORCE-CLOSURE] Ejecutando cierre CORRECTO del período 16-31 de octubre...');
    
    // Primero, verificar qué período debería cerrarse
    const statusResponse = await fetch(`${API_URL}/api/calculator/period-closure/check-status`);
    const statusData = await statusResponse.json();
    console.log('📊 Estado actual:', JSON.stringify(statusData, null, 2));
    
    // Ejecutar cierre con modo testing para bypass de validaciones
    const response = await fetch(`${API_URL}/api/calculator/period-closure/close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-testing-mode': 'true' // Bypass validaciones de tiempo y día
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ [FORCE-CLOSURE] Error:', result);
      
      // Si el error es que ya está cerrado, intentar eliminar el estado incorrecto
      if (result.already_closed) {
        console.log('⚠️ [FORCE-CLOSURE] El sistema dice que ya está cerrado.');
        console.log('💡 [FORCE-CLOSURE] Esto puede ser porque el cierre anterior usó fecha incorrecta.');
        console.log('💡 [FORCE-CLOSURE] El cierre debería ejecutarse con la nueva lógica que usa getPeriodToClose().');
      }
      
      process.exit(1);
    }

    console.log('✅ [FORCE-CLOSURE] Cierre ejecutado exitosamente:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n📋 [FORCE-CLOSURE] Resumen:');
    console.log(`   - Período cerrado: ${result.period_date} (${result.period_type})`);
    if (result.new_period_date) {
      console.log(`   - Nuevo período iniciado: ${result.new_period_date} (${result.new_period_type})`);
    }
    console.log(`   - Modelos archivados: ${result.archive_summary?.successful || 0}/${result.archive_summary?.total || 0}`);
    console.log(`   - Modelos reseteados: ${result.reset_summary?.successful || 0}/${result.reset_summary?.total || 0}`);

  } catch (error) {
    console.error('❌ [FORCE-CLOSURE] Error:', error);
    process.exit(1);
  }
}

forceCorrectClosure();

