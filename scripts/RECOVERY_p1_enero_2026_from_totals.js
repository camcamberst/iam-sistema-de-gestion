/**
 * 🚨 RECUPERACIÓN CRÍTICA: P1 ENERO 2026
 * 
 * Este script recupera el historial perdido desde calculator_totals
 * y lo inserta en calculator_history de forma consolidada.
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

async function recover() {
  console.log('🚨 RECUPERACIÓN CRÍTICA: P1 ENERO 2026\n');
  console.log('═'.repeat(80));

  try {
    // 1. Obtener totales
    console.log('\n📊 1. OBTENIENDO DATOS DE CALCULATOR_TOTALS...\n');
    
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

    if (totalsError) throw totalsError;

    const modelsWithData = totals.filter(t => parseFloat(t.total_usd_bruto || 0) > 0);
    console.log(`   ✅ ${modelsWithData.length} modelos con datos`);

    // 2. Crear registros consolidados
    console.log('\n📝 2. CREANDO REGISTROS HISTÓRICOS CONSOLIDADOS...\n');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const total of modelsWithData) {
      try {
        const email = total.users?.email || 'Desconocido';
        const usdBruto = parseFloat(total.total_usd_bruto || 0);
        const usdModelo = parseFloat(total.total_usd_modelo || 0);
        const copModelo = parseFloat(total.total_cop_modelo || 0);

        console.log(`   📝 ${email}: $${usdBruto.toFixed(2)} USD...`);

        // Insertar registro consolidado
        const { error: insertError } = await supabase
          .from('calculator_history')
          .insert({
            model_id: total.model_id,
            platform_id: '__consolidated_recovery__', // ID especial
            value: usdBruto,
            period_date: PERIOD_DATE,
            period_type: PERIOD_TYPE,
            value_usd_bruto: usdBruto,
            value_usd_modelo: usdModelo,
            value_cop_modelo: copModelo,
            archived_at: new Date().toISOString()
            // metadata no existe en la tabla
          });

        if (insertError) throw insertError;

        successCount++;
        console.log(`   ✅ ${email}: Recuperado`);

      } catch (error) {
        errorCount++;
        const email = total.users?.email || total.model_id;
        console.error(`   ❌ ${email}: ${error.message}`);
        errors.push({ model: email, error: error.message });
      }
    }

    // 3. Marcar período como cerrado
    console.log('\n\n📝 3. MARCANDO PERÍODO COMO CERRADO...\n');
    
    const { error: statusError } = await supabase
      .from('calculator_period_closure_status')
      .insert({
        period_date: PERIOD_DATE,
        period_type: PERIOD_TYPE,
        status: 'completed',
        metadata: {
          recovery_type: 'manual_emergency_recovery',
          recovered_at: new Date().toISOString(),
          recovered_models: successCount,
          failed_models: errorCount,
          total_models: modelsWithData.length,
          note: 'Recuperación de emergencia - cron falló el 16/01/2026',
          data_quality: 'consolidated_only',
          missing_detail: 'platform_breakdown'
        }
      });

    if (statusError) {
      console.warn('   ⚠️ Error marcando período:', statusError.message);
    } else {
      console.log('   ✅ Período marcado como cerrado');
    }

    // 4. Resumen
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 RESUMEN DE RECUPERACIÓN:\n');
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📦 Total: ${modelsWithData.length}`);

    if (errors.length > 0) {
      console.log('\n\n❌ ERRORES:\n');
      errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.model}: ${err.error}`);
      });
    }

    console.log('\n═'.repeat(80));
    console.log('\n✅ RECUPERACIÓN COMPLETADA\n');
    console.log('   ⚠️ IMPORTANTE: Los registros son CONSOLIDADOS');
    console.log('   ⚠️ NO hay detalle por plataforma (ese dato se perdió)');
    console.log('   ✅ Las modelos PUEDEN ver sus totales en Mi Historial\n');

  } catch (error) {
    console.error('\n❌ ERROR FATAL:', error);
    process.exit(1);
  }
}

recover()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
