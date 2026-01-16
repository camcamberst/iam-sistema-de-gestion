/**
 * 🔍 SCRIPT: Verificar Estado de P2 de Diciembre
 * 
 * Verifica el estado actual de los valores y archivos
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan variables de entorno');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarEstado() {
  console.log('\n🔍 VERIFICACIÓN DE ESTADO: P2 de Diciembre 2025');
  console.log('='.repeat(60));
  
  const startDate = '2025-12-16';
  const endDate = '2025-12-31';
  const periodType = '16-31';
  const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
  const fechaLimiteISO = fechaLimite.toISOString();

  try {
    // 1. Contar registros en calculator_history
    console.log('\n📦 Registros en calculator_history:');
    const { count: historyCount, error: historyError } = await supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (historyError) {
      console.error('❌ Error:', historyError);
    } else {
      console.log(`   Total: ${historyCount || 0} registros archivados`);
    }

    // 2. Contar valores en model_values
    console.log('\n📊 Valores en model_values:');
    const { count: modelValuesCount, error: mvError } = await supabase
      .from('model_values')
      .select('*', { count: 'exact', head: true })
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    if (mvError) {
      console.error('❌ Error:', mvError);
    } else {
      console.log(`   Total: ${modelValuesCount || 0} valores (hasta ${fechaLimiteISO})`);
    }

    // 3. Obtener modelos con valores
    if (modelValuesCount > 0) {
      console.log('\n👥 Modelos con valores:');
      const { data: valores, error: valoresError } = await supabase
        .from('model_values')
        .select('model_id')
        .gte('period_date', startDate)
        .lte('period_date', endDate)
        .lte('updated_at', fechaLimiteISO);

      if (!valoresError && valores) {
        const modelosUnicos = Array.from(new Set(valores.map(v => v.model_id)));
        console.log(`   Total modelos: ${modelosUnicos.length}`);

        // Obtener emails
        const { data: users } = await supabase
          .from('users')
          .select('id, email')
          .in('id', modelosUnicos);

        const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

        // Verificar cuáles tienen archivo
        let conArchivo = 0;
        let sinArchivo = 0;

        for (const modelId of modelosUnicos) {
          const { data: archivo } = await supabase
            .from('calculator_history')
            .select('id')
            .eq('model_id', modelId)
            .eq('period_date', startDate)
            .eq('period_type', periodType)
            .limit(1);

          if (archivo && archivo.length > 0) {
            conArchivo++;
          } else {
            sinArchivo++;
            const email = emailMap.get(modelId) || modelId;
            console.log(`   ⚠️ ${email}: Sin archivo`);
          }
        }

        console.log(`   ✅ Con archivo: ${conArchivo}`);
        console.log(`   ⚠️ Sin archivo: ${sinArchivo}`);
      }
    }

    // 4. Resumen
    console.log('\n📊 RESUMEN:');
    console.log('='.repeat(60));
    console.log(`📦 Registros archivados: ${historyCount || 0}`);
    console.log(`📊 Valores en calculadora: ${modelValuesCount || 0}`);
    
    if (historyCount > 0 && modelValuesCount > 0) {
      console.log('\n✅ Estado: Los valores están archivados y listos para eliminar');
    } else if (historyCount > 0 && modelValuesCount === 0) {
      console.log('\n✅ Estado: Los valores ya fueron eliminados');
    } else if (historyCount === 0 && modelValuesCount > 0) {
      console.log('\n⚠️ Estado: Hay valores pero NO están archivados');
      console.log('   Acción requerida: Ejecutar archivado primero');
    } else {
      console.log('\n✅ Estado: No hay valores ni archivos (proceso completado o no iniciado)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verificarEstado()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });





