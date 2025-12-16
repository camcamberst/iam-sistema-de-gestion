/**
 * Script para ejecutar Early Freeze manualmente
 * Ejecutar con: node scripts/execute-early-freeze-now.js
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                'https://iam-sistema-de-gestion.vercel.app';

const cronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';

async function executeEarlyFreeze() {
  try {
    console.log('🔒 [MANUAL-EARLY-FREEZE] Ejecutando Early Freeze manualmente...');
    console.log(`📍 URL: ${baseUrl}/api/calculator/period-closure/early-freeze`);
    
    const response = await fetch(`${baseUrl}/api/calculator/period-closure/early-freeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-testing-mode': 'true',
        'Authorization': `Bearer ${cronSecret}`
      }
    });

    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ [MANUAL-EARLY-FREEZE] Early Freeze ejecutado exitosamente');
      console.log('📊 Resultado:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ [MANUAL-EARLY-FREEZE] Error:', data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ [MANUAL-EARLY-FREEZE] Error de conexión:', error.message);
    process.exit(1);
  }
}

executeEarlyFreeze();

