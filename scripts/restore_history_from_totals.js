const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreHistory() {
  console.log('🚑 Iniciando restauración de historial desde Totales del 15 de Noviembre...');

  // 1. Obtener los totales del 15 de noviembre (último día del periodo)
  const { data: totals, error } = await supabase
    .from('calculator_totals')
    .select('*')
    .eq('period_date', '2025-11-15'); 

  if (error) {
    console.error('❌ Error leyendo calculator_totals:', error);
    return;
  }

  console.log(`📊 Encontrados ${totals.length} registros de totales para el 15 de Nov.`);

  if (totals.length === 0) {
    console.log('⚠️ No hay datos para restaurar.');
    return;
  }

  // 2. Preparar inserciones en calculator_history sin columnas extrañas
  const historyEntries = totals.map(t => ({
    model_id: t.model_id,
    platform_id: 'TOTAL_RECUPERADO', 
    value: t.total_usd_bruto || 0,
    period_date: '2025-11-01', // FECHA DE INICIO DEL PERIODO
    period_type: '1-15',
    archived_at: new Date().toISOString(),
    rate_eur_usd: 1.01, 
    rate_gbp_usd: 1.20,
    rate_usd_cop: 3900, 
    platform_percentage: 100, 
    value_usd_bruto: t.total_usd_bruto || 0,
    value_usd_modelo: t.total_usd_modelo || 0,
    value_cop_modelo: t.total_cop_modelo || 0
  }));

  console.log(`🔄 Preparando ${historyEntries.length} registros para calculator_history...`);
  
  const { data: existing } = await supabase
    .from('calculator_history')
    .select('model_id')
    .eq('period_date', '2025-11-01')
    .eq('platform_id', 'TOTAL_RECUPERADO');
    
  const existingModelIds = new Set(existing?.map(e => e.model_id) || []);
  const toInsert = historyEntries.filter(e => !existingModelIds.has(e.model_id));
  
  console.log(`✨ Registros nuevos a insertar: ${toInsert.length}`);

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('calculator_history')
      .insert(toInsert);
      
    if (insertError) {
      console.error('❌ Error insertando historial:', insertError);
    } else {
      console.log('✅ Historial restaurado exitosamente.');
    }
  } else {
    console.log('👍 No hay nuevos registros para insertar.');
  }
}

restoreHistory();
