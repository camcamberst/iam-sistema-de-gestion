/**
 * 🔍 SCRIPT DE VERIFICACIÓN Y CORRECCIÓN DE TASAS EN HISTORIAL
 * 
 * Este script:
 * 1. Verifica qué registros históricos tienen tasas NULL
 * 2. Identifica las tasas que deberían tener según el período archivado
 * 3. Propone o aplica la corrección
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndFixHistoricalRates() {
  console.log('🔍 [CHECK] Verificando tasas en registros históricos...\n');
  
  try {
    // PASO 1: Buscar registros del período 2025-10-16 (P2 de octubre)
    console.log('📋 [PASO 1] Buscando registros del período 2025-10-16 (16-31)...');
    const { data: periodRecords, error: fetchError } = await supabase
      .from('calculator_history')
      .select('id, model_id, platform_id, period_date, period_type, archived_at, rate_eur_usd, rate_gbp_usd, rate_usd_cop, value')
      .eq('period_date', '2025-10-16')
      .eq('period_type', '16-31')
      .not('archived_at', 'is', null)
      .limit(10);

    if (fetchError) {
      console.error('❌ [ERROR] Error obteniendo registros:', fetchError);
      return;
    }

    if (!periodRecords || periodRecords.length === 0) {
      console.log('⚠️ [INFO] No se encontraron registros para este período.');
      return;
    }

    console.log(`✅ [PASO 1] Se encontraron ${periodRecords.length} registros\n`);

    // PASO 2: Verificar cuáles tienen tasas NULL
    console.log('📋 [PASO 2] Verificando tasas en los registros...');
    const recordsWithoutRates = periodRecords.filter(r => 
      !r.rate_eur_usd && !r.rate_gbp_usd && !r.rate_usd_cop
    );
    const recordsWithRates = periodRecords.filter(r => 
      r.rate_eur_usd || r.rate_gbp_usd || r.rate_usd_cop
    );

    console.log(`   Registros SIN tasas: ${recordsWithoutRates.length}`);
    console.log(`   Registros CON tasas: ${recordsWithRates.length}\n`);

    if (recordsWithoutRates.length === 0 && recordsWithRates.length > 0) {
      console.log('✅ [INFO] Todos los registros tienen tasas guardadas.');
      const sample = recordsWithRates[0];
      console.log('   Ejemplo de tasas guardadas:', {
        eur_usd: sample.rate_eur_usd,
        gbp_usd: sample.rate_gbp_usd,
        usd_cop: sample.rate_usd_cop
      });
      return;
    }

    // PASO 3: Obtener tasas activas al momento del archivo (usar las más recientes)
    console.log('📋 [PASO 3] Obteniendo tasas activas actuales...');
    const { data: ratesData, error: ratesError } = await supabase
      .from('rates')
      .select('kind, value')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (ratesError) {
      console.error('❌ [ERROR] Error obteniendo tasas:', ratesError);
      return;
    }

    const currentRates = {
      eur_usd: ratesData?.find((r) => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: ratesData?.find((r) => r.kind === 'GBP→USD')?.value || 1.20,
      usd_cop: ratesData?.find((r) => r.kind === 'USD→COP')?.value || 3900
    };

    console.log('   Tasas activas actuales:', currentRates);
    console.log('');

    // PASO 4: Si hay registros con tasas, usar esas como referencia
    let ratesToApply = currentRates;
    if (recordsWithRates.length > 0) {
      const sampleWithRates = recordsWithRates[0];
      ratesToApply = {
        eur_usd: sampleWithRates.rate_eur_usd || currentRates.eur_usd,
        gbp_usd: sampleWithRates.rate_gbp_usd || currentRates.gbp_usd,
        usd_cop: sampleWithRates.rate_usd_cop || currentRates.usd_cop
      };
      console.log('📋 [PASO 4] Usando tasas de registros existentes como referencia:', ratesToApply);
      console.log('');
    }

    // PASO 5: Contar todos los registros afectados
    console.log('📋 [PASO 5] Contando todos los registros que necesitan corrección...');
    const { count: totalCount, error: countError } = await supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', '2025-10-16')
      .eq('period_type', '16-31')
      .not('archived_at', 'is', null);

    if (countError) {
      console.error('❌ [ERROR] Error contando registros:', countError);
      return;
    }

    console.log(`✅ [PASO 5] Total de registros del período: ${totalCount}\n`);

    // PASO 6: Verificar si TODOS necesitan corrección
    const { count: nullCount } = await supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', '2025-10-16')
      .eq('period_type', '16-31')
      .not('archived_at', 'is', null)
      .is('rate_eur_usd', null)
      .is('rate_gbp_usd', null)
      .is('rate_usd_cop', null);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN DEL PROBLEMA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Total de registros del período: ${totalCount}`);
    console.log(`⚠️  Registros SIN tasas (NULL): ${nullCount || 0}`);
    console.log(`✅ Registros CON tasas: ${(totalCount || 0) - (nullCount || 0)}`);
    console.log('');
    console.log('🔧 SOLUCIÓN:');
    console.log('   Las tasas deben actualizarse para los registros que las tienen en NULL.');
    console.log('   Tasas propuestas:', ratesToApply);
    console.log('');
    console.log('💡 [RECOMENDACIÓN]');
    console.log('   1. Verificar las tasas que estaban activas cuando se archivó el período');
    console.log('   2. Actualizar los registros con tasas NULL usando las tasas correctas');
    console.log('   3. Si es necesario, recalcular value_usd_bruto, value_usd_modelo, value_cop_modelo');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ [ERROR] Error en la verificación:', error);
    console.error('   Stack:', error.stack);
  }
}

checkAndFixHistoricalRates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });

