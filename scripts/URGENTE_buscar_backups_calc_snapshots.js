/**
 * 🚨 BÚSQUEDA URGENTE DE BACKUPS EN CALC_SNAPSHOTS
 * 
 * Según el código, la función createBackupSnapshot() DEBE haber guardado
 * los datos en calc_snapshots con la siguiente estructura:
 * - model_id
 * - period_id (UUID generado)
 * - totals_json (contiene los valores de model_values)
 * - rates_applied_json (contiene las tasas)
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

async function buscarBackups() {
  console.log('🚨 BÚSQUEDA URGENTE: BACKUPS EN CALC_SNAPSHOTS\n');
  console.log('═'.repeat(80));

  // 1. Buscar TODOS los snapshots (sin filtros)
  console.log('\n📊 1. BUSCANDO TODOS LOS SNAPSHOTS...\n');
  
  const { data: allSnapshots, error: allError } = await supabase
    .from('calc_snapshots')
    .select('*')
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('❌ Error consultando calc_snapshots:', allError);
    console.log('\n⚠️ Puede que la tabla no exista o tenga otra estructura.');
  } else {
    console.log(`   Total snapshots en la BD: ${allSnapshots?.length || 0}`);
    
    if (allSnapshots && allSnapshots.length > 0) {
      console.log('\n   📋 Estructura de la tabla (primer registro):');
      const sample = allSnapshots[0];
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        const preview = type === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : value;
        console.log(`   - ${key.padEnd(25)} (${type}): ${preview}`);
      });

      console.log('\n   📋 Lista de snapshots:');
      allSnapshots.forEach((snap, index) => {
        const created = new Date(snap.created_at).toLocaleString('es-CO');
        console.log(`   ${(index + 1).toString().padStart(2)}. Model: ${snap.model_id?.substring(0, 8)} | Created: ${created}`);
      });

      // 2. Buscar snapshots que puedan ser de enero 2026
      console.log('\n\n📊 2. FILTRANDO POSIBLES SNAPSHOTS DE ENERO 2026...\n');
      
      const enero2026Snapshots = allSnapshots.filter(snap => {
        const createdDate = new Date(snap.created_at);
        const isJan2026 = createdDate.getFullYear() === 2026 && createdDate.getMonth() === 0;
        
        // También revisar si el JSON tiene referencias a 2026-01
        const jsonStr = JSON.stringify(snap.totals_json || {});
        const hasJan2026Ref = jsonStr.includes('2026-01');
        
        return isJan2026 || hasJan2026Ref;
      });

      console.log(`   Snapshots candidatos de enero 2026: ${enero2026Snapshots.length}`);
      
      if (enero2026Snapshots.length > 0) {
        console.log('\n   🎯 ¡ENCONTRADOS! Detalles:');
        enero2026Snapshots.forEach((snap, index) => {
          console.log(`\n   === SNAPSHOT ${index + 1} ===`);
          console.log(`   Model ID: ${snap.model_id}`);
          console.log(`   Period ID: ${snap.period_id}`);
          console.log(`   Created: ${new Date(snap.created_at).toLocaleString('es-CO')}`);
          
          if (snap.totals_json) {
            const totals = snap.totals_json;
            console.log(`   Period Date: ${totals.period_date || 'N/A'}`);
            console.log(`   Period Type: ${totals.period_type || 'N/A'}`);
            console.log(`   Period Start: ${totals.period_start || 'N/A'}`);
            console.log(`   Period End: ${totals.period_end || 'N/A'}`);
            console.log(`   Total Platforms: ${totals.total_platforms || 0}`);
            console.log(`   Total Value: ${totals.total_value || 0}`);
            console.log(`   Values in snapshot: ${totals.values?.length || 0}`);
            
            if (totals.values && totals.values.length > 0) {
              console.log(`\n   📋 Primeros 5 valores guardados:`);
              totals.values.slice(0, 5).forEach((v, i) => {
                console.log(`      ${i + 1}. Platform: ${v.platform_id} | Value: ${v.value} | Date: ${v.period_date}`);
              });
            }
          }
        });

        console.log('\n\n🎉 ¡¡¡LOS BACKUPS EXISTEN!!!');
        console.log('   Los datos NO se perdieron');
        console.log('   Podemos recuperar TODA la información con detalle por plataforma');
      } else {
        console.log('\n   ⚠️ No se encontraron snapshots de enero 2026');
      }

    } else {
      console.log('   ⚠️ La tabla calc_snapshots está VACÍA');
      console.log('   ⚠️ Los backups NO se crearon');
    }
  }

  // 3. Buscar también en fechas cercanas (por si hay desfase de timezone)
  console.log('\n\n📊 3. BUSCANDO EN FECHAS CERCANAS (15-17 ENERO)...\n');
  
  const { data: nearSnapshots, error: nearError } = await supabase
    .from('calc_snapshots')
    .select('*')
    .gte('created_at', '2026-01-15T00:00:00Z')
    .lte('created_at', '2026-01-17T23:59:59Z');

  if (!nearError && nearSnapshots && nearSnapshots.length > 0) {
    console.log(`   ✅ Encontrados ${nearSnapshots.length} snapshots en ese rango`);
    nearSnapshots.forEach((snap, index) => {
      console.log(`   ${index + 1}. Created: ${snap.created_at} | Model: ${snap.model_id?.substring(0, 8)}`);
    });
  } else {
    console.log('   ⚠️ No hay snapshots en ese rango de fechas');
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ Búsqueda completada\n');
}

buscarBackups()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
