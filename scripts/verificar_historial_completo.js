/**
 * 🔍 SCRIPT: Verificar calculator_history Completo
 * 
 * Busca en calculator_history con diferentes criterios
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarHistorialCompleto() {
  console.log('\n🔍 VERIFICACIÓN COMPLETA DE calculator_history');
  console.log('='.repeat(60));

  // 1. Buscar todos los registros de diciembre 2025
  console.log('\n📋 1. Buscando registros de diciembre 2025...');
  const { data: diciembre, error: e1 } = await supabase
    .from('calculator_history')
    .select('*')
    .gte('period_date', '2025-12-01')
    .lte('period_date', '2025-12-31');

  console.log(`   Registros encontrados: ${diciembre?.length || 0}`);

  // 2. Buscar por period_type específico
  console.log('\n📋 2. Buscando por period_type 1-15...');
  const { data: p1, error: e2 } = await supabase
    .from('calculator_history')
    .select('*')
    .eq('period_type', '1-15')
    .gte('archived_at', '2025-12-01');

  console.log(`   Registros 1-15 desde diciembre: ${p1?.length || 0}`);

  // 3. Buscar por period_type 16-31
  console.log('\n📋 3. Buscando por period_type 16-31...');
  const { data: p2, error: e3 } = await supabase
    .from('calculator_history')
    .select('*')
    .eq('period_type', '16-31')
    .gte('archived_at', '2025-12-01');

  console.log(`   Registros 16-31 desde diciembre: ${p2?.length || 0}`);

  // 4. Buscar todos los registros recientes (últimos 30 días)
  console.log('\n📋 4. Buscando registros de los últimos 30 días...');
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 30);
  
  const { data: recientes, error: e4 } = await supabase
    .from('calculator_history')
    .select('period_date, period_type, COUNT(*)')
    .gte('archived_at', fechaLimite.toISOString())
    .order('archived_at', { ascending: false });

  console.log(`   Registros recientes: ${recientes?.length || 0}`);

  // 5. Verificar estructura de la tabla
  console.log('\n📋 5. Verificando estructura de la tabla...');
  const { data: estructura, error: e5 } = await supabase
    .from('calculator_history')
    .select('*')
    .limit(1);

  if (estructura && estructura.length > 0) {
    console.log('   ✅ La tabla existe y tiene datos');
    console.log('   Columnas disponibles:', Object.keys(estructura[0]).join(', '));
  } else {
    console.log('   ⚠️ La tabla existe pero está vacía o no hay datos');
  }

  // 6. Buscar registros archivados el 16 de diciembre (día del cierre)
  console.log('\n📋 6. Buscando registros archivados el 16 de diciembre...');
  const { data: archivados16, error: e6 } = await supabase
    .from('calculator_history')
    .select('*')
    .gte('archived_at', '2025-12-16T00:00:00')
    .lte('archived_at', '2025-12-16T23:59:59');

  console.log(`   Registros archivados el 16 de diciembre: ${archivados16?.length || 0}`);
  
  if (archivados16 && archivados16.length > 0) {
    console.log('\n   📊 MUESTRA DE REGISTROS:');
    archivados16.slice(0, 5).forEach((r, idx) => {
      console.log(`\n   ${idx + 1}. Modelo: ${r.model_id}`);
      console.log(`      Plataforma: ${r.platform_id}`);
      console.log(`      Período: ${r.period_date} (${r.period_type})`);
      console.log(`      Valor: ${r.value}`);
      console.log(`      Archivado: ${r.archived_at}`);
    });
  }

  // 7. Verificar si hay registros con period_date incorrecto
  console.log('\n📋 7. Buscando registros con period_date = 2025-12-15 (día anterior)...');
  const { data: dia15, error: e7 } = await supabase
    .from('calculator_history')
    .select('*')
    .eq('period_date', '2025-12-15')
    .eq('period_type', '1-15');

  console.log(`   Registros con period_date 2025-12-15: ${dia15?.length || 0}`);

  // RESUMEN
  console.log('\n📊 RESUMEN FINAL:');
  console.log('='.repeat(60));
  console.log(`✅ Registros en diciembre 2025: ${diciembre?.length || 0}`);
  console.log(`✅ Registros 1-15 desde diciembre: ${p1?.length || 0}`);
  console.log(`✅ Registros 16-31 desde diciembre: ${p2?.length || 0}`);
  console.log(`✅ Registros archivados el 16 de diciembre: ${archivados16?.length || 0}`);
  console.log(`✅ Registros con period_date 2025-12-15: ${dia15?.length || 0}`);

  if ((diciembre?.length || 0) === 0 && 
      (p1?.length || 0) === 0 && 
      (p2?.length || 0) === 0 && 
      (archivados16?.length || 0) === 0 &&
      (dia15?.length || 0) === 0) {
    console.log('\n❌ CONCLUSIÓN: NO HAY DATOS ARCHIVADOS PARA DICIEMBRE 2025');
    console.log('   Los datos NO fueron insertados en calculator_history');
    console.log('   A pesar de que el proceso de cierre marcó "completed"');
  } else {
    console.log('\n✅ CONCLUSIÓN: Se encontraron algunos datos');
    console.log('   Revisar los detalles arriba');
  }

  // Exportar
  const fs = require('fs');
  const reporte = {
    fecha_verificacion: new Date().toISOString(),
    resultados: {
      diciembre_2025: diciembre?.length || 0,
      periodo_1_15: p1?.length || 0,
      periodo_16_31: p2?.length || 0,
      archivados_16_dic: archivados16?.length || 0,
      period_date_15_dic: dia15?.length || 0
    },
    muestra_registros: archivados16?.slice(0, 10) || []
  };

  fs.writeFileSync('reporte_historial_completo.json', JSON.stringify(reporte, null, 2));
  console.log('\n💾 Reporte guardado en: reporte_historial_completo.json');
}

verificarHistorialCompleto()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







