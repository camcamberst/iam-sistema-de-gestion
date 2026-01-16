/**
 * 🚨 RECUPERACIÓN INMEDIATA P1 ENERO 2026
 * 
 * Crea registros históricos desde calculator_totals porque el sistema
 * de cierre FALLÓ y borró los datos sin crear el archivo.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const PERIOD_DATE = '2026-01-01';
const PERIOD_TYPE = '1-15';

async function recuperar() {
  console.log('🚨 RECUPERACIÓN INMEDIATA: P1 ENERO 2026\n');
  console.log('═'.repeat(80));

  // 1. Obtener totales
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select(`
      model_id,
      total_usd_bruto,
      total_usd_modelo,
      total_cop_modelo,
      period_date,
      updated_at,
      users:model_id (
        email,
        name
      )
    `)
    .eq('period_date', PERIOD_DATE);

  if (totalsError) {
    console.error('❌ Error obteniendo totales:', totalsError);
    process.exit(1);
  }

  console.log(`\n📊 Encontrados ${totals.length} modelos con totales`);
  
  const modelsWithData = totals.filter(t => parseFloat(t.total_usd_bruto || 0) > 0);
  console.log(`📊 ${modelsWithData.length} modelos con datos > 0\n`);

  // 2. Crear registros históricos usando SOLO TOTALS (sin plataformas individuales)
  console.log('📝 Creando registros históricos consolidados...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const total of modelsWithData) {
    try {
      const modelEmail = total.users?.email || 'Desconocido';
      const modelName = total.users?.name || 'Desconocido';
      const totalUsdBruto = parseFloat(total.total_usd_bruto || 0);
      const totalUsdModelo = parseFloat(total.total_usd_modelo || 0);
      const totalCopModelo = parseFloat(total.total_cop_modelo || 0);

      console.log(`   📝 ${modelEmail}: USD Bruto $${totalUsdBruto.toFixed(2)}`);

      // Crear UN registro consolidado por modelo
      const { error: historyError } = await supabase
        .from('calculator_history')
        .insert({
          model_id: total.model_id,
          platform_id: '__CONSOLIDATED_TOTAL__', // ID especial para indicar que es un total consolidado
          value: totalUsdBruto,
          period_date: PERIOD_DATE,
          period_type: PERIOD_TYPE,
          value_usd_bruto: totalUsdBruto,
          value_usd_modelo: totalUsdModelo,
          value_cop_modelo: totalCopModelo,
          archived_at: total.updated_at || new Date().toISOString()
        });

      if (historyError) {
        throw historyError;
      }

      successCount++;
      console.log(`   ✅ ${modelEmail}: Registro creado`);

    } catch (error) {
      errorCount++;
      const modelEmail = total.users?.email || total.model_id;
      console.error(`   ❌ ${modelEmail}: ${error.message}`);
      errors.push({
        model_id: total.model_id,
        email: modelEmail,
        error: error.message
      });
    }
  }

  console.log('\n═'.repeat(80));
  console.log('\n📊 RESUMEN:\n');
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📦 Total: ${modelsWithData.length}`);

  if (errors.length > 0) {
    console.log('\n\n❌ ERRORES:\n');
    errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.email}: ${err.error}`);
    });
  }

  // 3. Marcar período como cerrado
  console.log('\n📝 Marcando período como cerrado...\n');

  const { error: statusError } = await supabase
    .from('calculator_period_closure_status')
    .insert({
      period_date: PERIOD_DATE,
      period_type: PERIOD_TYPE,
      status: 'completed',
      metadata: {
        recovery_type: 'emergency_from_totals',
        recovered_at: new Date().toISOString(),
        recovered_models: successCount,
        failed_models: errorCount,
        note: 'Recuperación de emergencia - sistema falló en crear archivo y borró datos',
        warning: 'Solo contiene totales consolidados, NO detalle por plataforma'
      }
    });

  if (statusError) {
    console.error('   ❌ Error marcando período:', statusError);
  } else {
    console.log('   ✅ Período marcado como cerrado');
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ RECUPERACIÓN COMPLETADA\n');
  console.log('⚠️  NOTA: Los registros históricos contienen SOLO TOTALES CONSOLIDADOS');
  console.log('⚠️  NO hay detalle por plataforma (esos datos se perdieron)\n');
}

recuperar()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
