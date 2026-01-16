/**
 * Script para verificar si el archivado de P2 de Diciembre se ejecutó correctamente
 * Verifica si hay registros en calculator_history para el período 16-31 de diciembre 2025
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarArchivado() {
  console.log('🔍 Verificando archivado de P2 de Diciembre 2025...\n');

  const startDate = '2025-12-16';
  const periodType = '16-31';

  // 1. Verificar registros en calculator_history
  const { data: history, error: historyError } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id, period_date, period_type, value, archived_at')
    .eq('period_date', startDate)
    .eq('period_type', periodType);

  if (historyError) {
    console.error('❌ Error consultando calculator_history:', historyError);
    return;
  }

  console.log(`📊 Registros en calculator_history para ${startDate} (${periodType}):`);
  console.log(`   Total: ${history?.length || 0} registros\n`);

  if (!history || history.length === 0) {
    console.log('⚠️  NO HAY REGISTROS ARCHIVADOS');
    console.log('   El archivado aún no se ha ejecutado o falló.\n');
    
    // Verificar si hay valores en model_values
    const { data: modelValues, error: modelValuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, period_date, value')
      .gte('period_date', startDate)
      .lte('period_date', '2025-12-31');

    if (!modelValuesError && modelValues && modelValues.length > 0) {
      console.log(`📦 Valores disponibles en model_values para archivar:`);
      console.log(`   Total: ${modelValues.length} registros`);
      
      // Agrupar por modelo
      const porModelo = new Map();
      modelValues.forEach(v => {
        const count = porModelo.get(v.model_id) || 0;
        porModelo.set(v.model_id, count + 1);
      });
      
      console.log(`   Modelos con valores: ${porModelo.size}`);
      console.log(`   Ejecuta el archivado desde: /admin/emergency-archive-p2\n`);
    }
    return;
  }

  // Agrupar por modelo
  const porModelo = new Map();
  history.forEach(h => {
    const count = porModelo.get(h.model_id) || 0;
    porModelo.set(h.model_id, count + 1);
  });

  console.log(`✅ ARCHIVADO EXITOSO:`);
  console.log(`   Modelos archivados: ${porModelo.size}`);
  console.log(`   Total de registros: ${history.length}`);
  console.log(`   Fecha de archivado más reciente: ${history[0]?.archived_at || 'N/A'}\n`);

  // Mostrar algunos ejemplos
  console.log('📋 Ejemplos de registros archivados:');
  const ejemplos = history.slice(0, 5);
  ejemplos.forEach((h, i) => {
    console.log(`   ${i + 1}. Modelo: ${h.model_id.substring(0, 8)}... | Plataforma: ${h.platform_id} | Valor: ${h.value}`);
  });

  // Verificar si hay valores residuales en model_values
  const { data: residuales, error: residualesError } = await supabase
    .from('model_values')
    .select('model_id, platform_id, period_date, value')
    .gte('period_date', startDate)
    .lte('period_date', '2025-12-31');

  if (!residualesError && residuales && residuales.length > 0) {
    console.log(`\n⚠️  VALORES RESIDUALES EN model_values:`);
    console.log(`   Total: ${residuales.length} registros`);
    console.log(`   Estos valores deberían eliminarse después de verificar el archivado.\n`);
  } else {
    console.log(`\n✅ No hay valores residuales en model_values.\n`);
  }
}

verificarArchivado().catch(console.error);







