const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRestoredData() {
  console.log('🔍 Verificando datos restaurados en calculator_history para P1 Noviembre...');

  // Buscar registros insertados recientemente o con platform_id 'TOTAL_RECUPERADO'
  const { data: restored, error } = await supabase
    .from('calculator_history')
    .select('*')
    .eq('platform_id', 'TOTAL_RECUPERADO');

  if (error) {
    console.error('❌ Error consultando calculator_history:', error);
    return;
  }

  console.log(`📊 Registros 'TOTAL_RECUPERADO' encontrados: ${restored.length}`);
  
  if (restored.length > 0) {
    console.log('📋 Ejemplo de registro restaurado:');
    console.log(JSON.stringify(restored[0], null, 2));
    
    // Verificar campos clave
    const sample = restored[0];
    console.log('\n🔍 Verificación de campos clave:');
    console.log(`   - period_date: ${sample.period_date} (Debe ser YYYY-MM-DD)`);
    console.log(`   - period_type: ${sample.period_type} (Debe ser '1-15')`);
    console.log(`   - model_id: ${sample.model_id}`);
    console.log(`   - value: ${sample.value}`);
  } else {
    console.log('⚠️ No se encontraron registros con platform_id="TOTAL_RECUPERADO".');
    
    // Buscar cualquier registro para la fecha por si acaso
    const { data: anyP1, error: anyError } = await supabase
        .from('calculator_history')
        .select('*')
        .eq('period_date', '2025-11-01');
        
    console.log(`📊 Registros generales para 2025-11-01: ${anyP1?.length || 0}`);
  }
}

verifyRestoredData();



