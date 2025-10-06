// Script para verificar las fechas de los valores guardados
const { createClient } = require('@supabase/supabase-js');

// Usar las variables de entorno de Vercel/producción
const supabase = createClient(
  'https://qpqpxvvmjqcvdqcgzqwf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwcXB4dnZtanFjdmRxY2d6cXdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzgxMTI4MSwiZXhwIjoyMDQzMzg3MjgxfQ.ixfEUqIhZsrVCPIhYJYFNTQZJLhLHZBKZtXaGdRJJzk'
);

async function checkDates() {
  try {
    console.log('🔍 Verificando fechas en model_values...');
    
    // Obtener fechas actuales
    const colombiaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const europeDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
    
    console.log('📅 Fecha Colombia:', colombiaDate);
    console.log('📅 Fecha Europa:', europeDate);
    
    // Buscar valores con fecha de Colombia
    const { data: colombiaValues, error: colombiaError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date, updated_at')
      .eq('period_date', colombiaDate)
      .limit(10);
    
    console.log('\n🇨🇴 Valores con fecha Colombia (' + colombiaDate + '):');
    console.log('Count:', colombiaValues?.length || 0);
    if (colombiaValues?.length > 0) {
      console.log('Primeros valores:', JSON.stringify(colombiaValues.slice(0, 3), null, 2));
    }
    
    // Buscar valores con fecha de Europa
    const { data: europeValues, error: europeError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date, updated_at')
      .eq('period_date', europeDate)
      .limit(10);
    
    console.log('\n🇪🇺 Valores con fecha Europa (' + europeDate + '):');
    console.log('Count:', europeValues?.length || 0);
    if (europeValues?.length > 0) {
      console.log('Primeros valores:', JSON.stringify(europeValues.slice(0, 3), null, 2));
    }
    
    // Buscar todas las fechas únicas recientes (sin filtro de fecha)
    const { data: allDates, error: datesError } = await supabase
      .from('model_values')
      .select('period_date, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);
    
    if (allDates && allDates.length > 0) {
      const uniqueDates = [...new Set(allDates.map(d => d.period_date))];
      console.log('\n📊 Fechas únicas encontradas (últimas 50 entradas):');
      uniqueDates.forEach(date => console.log('  -', date));
      
      console.log('\n📊 Últimas 5 entradas con timestamp:');
      allDates.slice(0, 5).forEach(entry => {
        console.log(`  - ${entry.period_date} (actualizado: ${entry.updated_at})`);
      });
    } else {
      console.log('\n❌ No se encontraron valores en model_values');
      
      // Verificar si la tabla existe y tiene datos
      const { data: tableCheck, error: tableError } = await supabase
        .from('model_values')
        .select('count(*)', { count: 'exact', head: true });
      
      console.log('📊 Total de registros en model_values:', tableCheck || 'Error al contar');
      if (tableError) console.log('Error:', tableError);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDates();
