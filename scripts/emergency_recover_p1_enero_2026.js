/**
 * 🚨 RECUPERACIÓN DE EMERGENCIA: P1 ENERO 2026
 * 
 * Este script recupera los datos del P1 de enero 2026 desde calculator_totals
 * y crea los registros históricos correspondientes.
 * 
 * IMPORTANTE: Este script solo crea el archivo histórico con TOTALES consolidados,
 * no con los valores por plataforma (que ya fueron eliminados de model_values).
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
  console.log('🚨 RECUPERACIÓN DE EMERGENCIA: P1 ENERO 2026\n');
  console.log('═'.repeat(80));

  // 1. Obtener datos de calculator_totals
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

  if (totalsError) {
    console.error('❌ Error obteniendo calculator_totals:', totalsError);
    process.exit(1);
  }

  console.log(`   ✅ Encontrados ${totals.length} modelos con totales`);
  
  const modelsWithData = totals.filter(t => parseFloat(t.total_usd_bruto || 0) > 0);
  console.log(`   ✅ ${modelsWithData.length} modelos con datos > 0`);

  // 2. Obtener model_values históricos si existen
  console.log('\n📊 2. INTENTANDO RECUPERAR MODEL_VALUES...\n');
  
  // Verificar si hay valores en model_values para cada modelo
  const modelsWithValues = [];
  for (const model of totals) {
    const { data: values } = await supabase
      .from('model_values')
      .select('platform_id, value, period_date')
      .eq('model_id', model.model_id)
      .gte('period_date', '2026-01-01')
      .lte('period_date', '2026-01-15');

    if (values && values.length > 0) {
      modelsWithValues.push({
        model_id: model.model_id,
        values: values
      });
    }
  }

  console.log(`   ${modelsWithValues.length > 0 ? '✅' : '⚠️'} Encontrados ${modelsWithValues.length} modelos con valores en model_values`);

  // 3. Confirmar con el usuario
  console.log('\n\n═'.repeat(80));
  console.log('\n⚠️  CONFIRMACIÓN REQUERIDA\n');
  console.log(`Este script creará registros históricos para ${totals.length} modelos.`);
  console.log(`\nMétodo de recuperación:`);
  
  if (modelsWithValues.length > 0) {
    console.log(`   ✅ RECUPERACIÓN COMPLETA: ${modelsWithValues.length} modelos tienen valores por plataforma`);
    console.log(`   ⚠️ RECUPERACIÓN PARCIAL: ${totals.length - modelsWithValues.length} modelos solo tienen totales consolidados`);
  } else {
    console.log(`   ⚠️ RECUPERACIÓN SOLO CON TOTALES: No hay valores por plataforma disponibles`);
    console.log(`   ⚠️ Se creará un registro histórico consolidado por modelo`);
  }

  console.log(`\n¿Deseas continuar? (Este script se ejecutará automáticamente)`);
  console.log('═'.repeat(80));

  // 4. Crear registros históricos
  console.log('\n\n📝 3. CREANDO REGISTROS HISTÓRICOS...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const total of totals) {
    try {
      const modelEmail = total.users?.email || 'Desconocido';
      const modelName = total.users?.name || 'Desconocido';
      
      // Verificar si este modelo tiene valores por plataforma
      const modelValues = modelsWithValues.find(m => m.model_id === total.model_id);
      
      if (modelValues && modelValues.values.length > 0) {
        // CASO 1: Hay valores por plataforma - crear registro histórico completo
        console.log(`   📝 Recuperando ${modelValues.values.length} plataformas para ${modelEmail}...`);
        
        const historyRecords = modelValues.values.map(v => ({
          model_id: total.model_id,
          platform_id: v.platform_id,
          value: v.value,
          period_date: PERIOD_DATE,
          period_type: PERIOD_TYPE,
          created_at: total.updated_at || new Date().toISOString()
        }));

        const { error: historyError } = await supabase
          .from('calculator_history')
          .insert(historyRecords);

        if (historyError) {
          throw historyError;
        }

        successCount++;
        console.log(`   ✅ ${modelEmail}: ${historyRecords.length} plataformas archivadas`);
        
      } else {
        // CASO 2: Solo hay totales - crear registro consolidado
        const totalUsdBruto = parseFloat(total.total_usd_bruto || 0);
        
        if (totalUsdBruto === 0) {
          console.log(`   ⏭️  ${modelEmail}: Sin datos (total = 0), omitiendo...`);
          continue;
        }

        console.log(`   📝 Creando registro consolidado para ${modelEmail} (Total USD: $${totalUsdBruto.toFixed(2)})...`);
        
        // Crear un registro "consolidado" con platform_id especial
        const { error: historyError } = await supabase
          .from('calculator_history')
          .insert({
            model_id: total.model_id,
            platform_id: '__consolidated__', // ID especial para totales consolidados
            value: totalUsdBruto,
            period_date: PERIOD_DATE,
            period_type: PERIOD_TYPE,
            metadata: {
              recovery_type: 'emergency_from_totals',
              original_totals: {
                usd_bruto: total.total_usd_bruto,
                usd_modelo: total.total_usd_modelo,
                cop_modelo: total.total_cop_modelo
              },
              recovered_at: new Date().toISOString(),
              note: 'Recuperado desde calculator_totals - archivo consolidado'
            },
            created_at: total.updated_at || new Date().toISOString()
          });

        if (historyError) {
          throw historyError;
        }

        successCount++;
        console.log(`   ✅ ${modelEmail}: Registro consolidado creado`);
      }
      
    } catch (error) {
      errorCount++;
      const modelEmail = total.users?.email || total.model_id;
      console.error(`   ❌ Error procesando ${modelEmail}:`, error.message);
      errors.push({
        model_id: total.model_id,
        email: modelEmail,
        error: error.message
      });
    }
  }

  console.log('\n═'.repeat(80));
  console.log('\n📊 RESUMEN DE RECUPERACIÓN:\n');
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📦 Total procesados: ${totals.length}`);

  if (errors.length > 0) {
    console.log('\n\n❌ ERRORES DETALLADOS:\n');
    errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.email}: ${err.error}`);
    });
  }

  // 5. Marcar período como cerrado
  console.log('\n\n📝 4. MARCANDO PERÍODO COMO CERRADO...\n');
  
  const { error: statusError } = await supabase
    .from('calculator_period_closure_status')
    .insert({
      period_date: PERIOD_DATE,
      period_type: PERIOD_TYPE,
      status: 'completed',
      metadata: {
        recovery_type: 'emergency_manual_recovery',
        recovered_at: new Date().toISOString(),
        recovered_models: successCount,
        failed_models: errorCount,
        note: 'Recuperación de emergencia - cron no se ejecutó automáticamente'
      }
    });

  if (statusError) {
    console.error('   ❌ Error marcando período como cerrado:', statusError);
  } else {
    console.log('   ✅ Período marcado como cerrado');
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ RECUPERACIÓN COMPLETADA\n');
  console.log('   Los datos históricos han sido recreados desde calculator_totals.');
  console.log('   Las modelos ahora pueden ver su historial en "Mi Historial".\n');
}

recover()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
