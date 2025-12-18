/**
 * 🔄 SCRIPT PARA CERRAR MANUALMENTE EL PERÍODO P1 DICIEMBRE 2025
 * 
 * Este script cierra el período 1-15 de diciembre 2025 manualmente
 * usando el endpoint de cierre con headers especiales.
 * 
 * USO:
 * 1. Asegúrate de tener CRON_SECRET_KEY en .env.local
 * 2. Ejecuta: node scripts/close-december-p1-manually.js
 */

require('dotenv').config({ path: '.env.local' });

const CRON_SECRET_KEY = process.env.CRON_SECRET_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!CRON_SECRET_KEY) {
  console.error('❌ Error: CRON_SECRET_KEY no está configurado en .env.local');
  process.exit(1);
}

async function closePeriodManually() {
  console.log('🔄 Iniciando cierre manual del período P1 Diciembre 2025...');
  console.log(`📍 URL: ${API_URL}/api/calculator/period-closure/close-period`);
  console.log(`📅 Período: 2025-12-01 (1-15)`);
  
  try {
    const response = await fetch(`${API_URL}/api/calculator/period-closure/close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-force-period-date': '2025-12-01',
        'x-force-period-type': '1-15',
        'x-force-close-secret': CRON_SECRET_KEY,
        'x-testing-mode': 'true' // Reduce tiempos de espera para testing
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error al cerrar período:', data);
      process.exit(1);
    }

    console.log('✅ Período cerrado exitosamente:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.archive_summary) {
      console.log(`\n📦 Resumen de archivado:`);
      console.log(`   Total: ${data.archive_summary.total}`);
      console.log(`   Exitosos: ${data.archive_summary.successful}`);
      console.log(`   Fallidos: ${data.archive_summary.failed}`);
    }

    if (data.reset_summary) {
      console.log(`\n🔄 Resumen de reseteo:`);
      console.log(`   Total: ${data.reset_summary.total}`);
      console.log(`   Exitosos: ${data.reset_summary.successful}`);
      console.log(`   Fallidos: ${data.reset_summary.failed}`);
    }

  } catch (error) {
    console.error('❌ Error ejecutando cierre:', error);
    process.exit(1);
  }
}

closePeriodManually();

