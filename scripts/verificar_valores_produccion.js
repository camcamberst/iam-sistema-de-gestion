/**
 * 🔍 SCRIPT: Verificar Valores en Producción
 * 
 * Verifica si hay valores en model_values para el período 16-31 de diciembre
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarValoresProduccion() {
  console.log('\n🔍 VERIFICACIÓN DE VALORES EN PRODUCCIÓN');
  console.log('='.repeat(60));
  console.log(`🔗 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`);
  console.log('='.repeat(60));

  // Verificar diferentes rangos
  const rangos = [
    { nombre: '16-31 Diciembre', start: '2025-12-16', end: '2025-12-31' },
    { nombre: 'Todo Diciembre', start: '2025-12-01', end: '2025-12-31' },
    { nombre: 'Últimos 30 días', start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }
  ];

  for (const rango of rangos) {
    console.log(`\n📋 Verificando: ${rango.nombre} (${rango.start} a ${rango.end})`);
    
    const { data: valores, error: error } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date')
      .gte('period_date', rango.start)
      .lte('period_date', rango.end);

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
    } else {
      const count = valores?.length || 0;
      console.log(`   ✅ Valores encontrados: ${count}`);
      
      if (count > 0) {
        // Agrupar por modelo
        const porModelo = new Map();
        valores.forEach(v => {
          const count = porModelo.get(v.model_id) || 0;
          porModelo.set(v.model_id, count + 1);
        });

        console.log(`   📊 Modelos con valores: ${porModelo.size}`);
        
        // Mostrar primeros 5 modelos
        const primeros5 = Array.from(porModelo.entries()).slice(0, 5);
        primeros5.forEach(([modelId, count]) => {
          console.log(`      - ${modelId}: ${count} valores`);
        });

        // Verificar fechas únicas
        const fechas = new Set(valores.map(v => v.period_date));
        console.log(`   📅 Fechas únicas: ${Array.from(fechas).sort().join(', ')}`);
      }
    }
  }

  // Verificar si hay datos recientes en general
  console.log('\n📋 Verificando datos más recientes en model_values...');
  const { data: recientes, error: errorRecientes } = await supabase
    .from('model_values')
    .select('period_date, COUNT(*)')
    .order('period_date', { ascending: false })
    .limit(10);

  if (!errorRecientes && recientes) {
    console.log('   Fechas más recientes con datos:');
    recientes.forEach(r => {
      console.log(`      - ${r.period_date}: ${r.count || 'N/A'} valores`);
    });
  }
}

verificarValoresProduccion()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







