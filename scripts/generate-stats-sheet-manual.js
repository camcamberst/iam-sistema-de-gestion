/**
 * Script para generar manualmente la planilla de Stats de un mes específico
 * Uso: node scripts/generate-stats-sheet-manual.js [año] [mes]
 * Ejemplo: node scripts/generate-stats-sheet-manual.js 2024 12
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Variables de entorno requeridas no configuradas');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✅' : '❌');
  process.exit(1);
}

const args = process.argv.slice(2);
const year = args[0] ? parseInt(args[0]) : new Date().getFullYear();
const month = args[1] ? parseInt(args[1]) : new Date().getMonth() + 1;

if (month < 1 || month > 12) {
  console.error('❌ Error: Mes inválido (debe ser entre 1 y 12)');
  process.exit(1);
}

console.log(`📊 Generando planilla de Stats para ${year}-${String(month).padStart(2, '0')}...`);

async function generateSheet() {
  try {
    const response = await fetch(`${APP_URL}/api/gestor/stats/generate-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        year,
        month
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error generando planilla:', result);
      process.exit(1);
    }

    console.log('✅ Planilla generada exitosamente:');
    console.log(`   - Registros creados: ${result.recordsCreated || 0}`);
    console.log(`   - Modelos procesados: ${result.totalModels || 0}`);
    console.log(`   - Grupos procesados: ${result.totalGroups || 0}`);
    console.log(`   - Período P1: ${result.periodDateP1}`);
    console.log(`   - Período P2: ${result.periodDateP2}`);

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

generateSheet();

