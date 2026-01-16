/**
 * 🔍 SCRIPT: Verificar Valores Actuales en model_values
 * 
 * Verifica qué valores hay actualmente en model_values
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarValoresActuales() {
  console.log('\n🔍 VERIFICACIÓN DE VALORES ACTUALES EN model_values');
  console.log('='.repeat(60));
  console.log(`🔗 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`);
  console.log('='.repeat(60));

  // Verificar diferentes rangos
  const rangos = [
    { nombre: '16-31 Diciembre', start: '2025-12-16', end: '2025-12-31' },
    { nombre: 'Todo Diciembre', start: '2025-12-01', end: '2025-12-31' },
    { nombre: 'Últimos 60 días', start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] }
  ];

  for (const rango of rangos) {
    console.log(`\n📋 Verificando: ${rango.nombre} (${rango.start} a ${rango.end})`);
    
    // Sin filtro de updated_at primero
    const { data: valoresSinFiltro, error: error1 } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date, updated_at')
      .gte('period_date', rango.start)
      .lte('period_date', rango.end)
      .limit(100);

    if (error1) {
      console.error(`   ❌ Error: ${error1.message}`);
    } else {
      const count = valoresSinFiltro?.length || 0;
      console.log(`   ✅ Valores encontrados (sin filtro de tiempo): ${count}`);
      
      if (count > 0 && count < 100) {
        // Mostrar algunos ejemplos
        console.log(`\n   📊 Muestra de valores:`);
        valoresSinFiltro.slice(0, 5).forEach((v, idx) => {
          console.log(`      ${idx + 1}. Modelo: ${v.model_id.substring(0, 8)}..., Plataforma: ${v.platform_id}, Valor: ${v.value}, Fecha: ${v.period_date}, Actualizado: ${v.updated_at}`);
        });
        
        // Verificar fechas de actualización
        const fechas = valoresSinFiltro.map(v => new Date(v.updated_at));
        const fechaMin = new Date(Math.min(...fechas.map(d => d.getTime())));
        const fechaMax = new Date(Math.max(...fechas.map(d => d.getTime())));
        console.log(`\n   📅 Rango de actualización:`);
        console.log(`      Mínima: ${fechaMin.toISOString()}`);
        console.log(`      Máxima: ${fechaMax.toISOString()}`);
        
        // Verificar cuántos están dentro del límite
        const fechaLimite = new Date(`${rango.end}T23:59:59.999Z`);
        const dentroDelLimite = valoresSinFiltro.filter(v => new Date(v.updated_at) <= fechaLimite);
        console.log(`      Valores hasta ${rango.end} 23:59:59: ${dentroDelLimite.length} de ${count}`);
      } else if (count >= 100) {
        console.log(`   ⚠️ Hay más de 100 valores (mostrando solo primeros 100)`);
      }
    }
  }

  // Verificar valores más recientes en general
  console.log('\n📋 Verificando valores más recientes en model_values...');
  const { data: recientes, error: errorRecientes } = await supabase
    .from('model_values')
    .select('period_date, updated_at, COUNT(*)')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (!errorRecientes && recientes) {
    console.log('   Fechas más recientes con datos:');
    recientes.slice(0, 10).forEach(r => {
      console.log(`      - ${r.period_date}: Actualizado ${r.updated_at}`);
    });
  }
}

verificarValoresActuales()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });







