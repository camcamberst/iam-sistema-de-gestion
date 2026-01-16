/**
 * 🔍 INVESTIGACIÓN FORENSE: ¿QUIÉN BORRÓ LOS DATOS?
 * 
 * Buscar cualquier pista de quién o qué pudo haber eliminado los datos de model_values:
 * 1. Logs en calculator_period_closure_status
 * 2. Realtime messages (si existen)
 * 3. Audit logs (si existen)
 * 4. Cualquier registro de actividad administrativa
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

async function investigar() {
  console.log('🔍 INVESTIGACIÓN FORENSE: ¿QUIÉN BORRÓ LOS DATOS?\n');
  console.log('═'.repeat(80));

  // 1. Verificar TODOS los registros de cierre (no solo 2026-01-01)
  console.log('\n📊 1. BUSCANDO REGISTROS DE CIERRE DE PERÍODO...\n');
  
  const { data: closureRecords, error: closureError } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (closureError) {
    console.error('❌ Error:', closureError);
  } else {
    console.log(`   Total registros: ${closureRecords?.length || 0}`);
    
    if (closureRecords && closureRecords.length > 0) {
      console.log('\n   Últimos registros de cierre:');
      closureRecords.forEach((record, index) => {
        console.log(`\n   === REGISTRO ${index + 1} ===`);
        console.log(`   Period Date: ${record.period_date}`);
        console.log(`   Period Type: ${record.period_type}`);
        console.log(`   Status: ${record.status}`);
        console.log(`   Created: ${new Date(record.created_at).toLocaleString('es-CO')}`);
        console.log(`   Updated: ${record.updated_at ? new Date(record.updated_at).toLocaleString('es-CO') : 'N/A'}`);
        if (record.metadata) {
          console.log(`   Metadata:`, JSON.stringify(record.metadata, null, 4));
        }
      });
    } else {
      console.log('   ⚠️ NO hay registros de cierre de período');
    }
  }

  // 2. Buscar en TODOS los períodos si hay registros de cierre
  console.log('\n\n📊 2. BUSCANDO CUALQUIER REGISTRO DE ENERO 2026...\n');
  
  const { data: jan2026Records, error: jan2026Error } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .gte('period_date', '2026-01-01')
    .lte('period_date', '2026-01-31');

  if (!jan2026Error && jan2026Records && jan2026Records.length > 0) {
    console.log(`   ✅ Encontrados ${jan2026Records.length} registros de enero 2026`);
    jan2026Records.forEach(r => {
      console.log(`   - ${r.period_date} (${r.period_type}): ${r.status}`);
    });
  } else {
    console.log('   ⚠️ NO hay registros de enero 2026');
  }

  // 3. Verificar si hay datos de DICIEMBRE que puedan dar pistas
  console.log('\n\n📊 3. VERIFICANDO ÚLTIMO CIERRE EXITOSO (DICIEMBRE)...\n');
  
  const { data: decRecords, error: decError } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .eq('period_date', '2025-12-16')
    .eq('period_type', '16-31');

  if (!decError && decRecords && decRecords.length > 0) {
    console.log('   ✅ Encontrado cierre de P2 diciembre 2025');
    decRecords.forEach(r => {
      console.log(`   Status: ${r.status}`);
      console.log(`   Created: ${new Date(r.created_at).toLocaleString('es-CO')}`);
      if (r.metadata) {
        console.log(`   Metadata:`, JSON.stringify(r.metadata, null, 2));
      }
    });
  } else {
    console.log('   ⚠️ Tampoco hay registros del cierre de diciembre');
  }

  // 4. Buscar en realtime_messages si hay mensajes de cierre
  console.log('\n\n📊 4. BUSCANDO MENSAJES RELACIONADOS CON CIERRE...\n');
  
  const { data: messages, error: messagesError } = await supabase
    .from('realtime_messages')
    .select('*')
    .or('type.eq.calculator_cleared,type.eq.periodo_cerrado,message.ilike.%cierre%')
    .gte('created_at', '2026-01-15T00:00:00Z')
    .lte('created_at', '2026-01-17T23:59:59Z')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!messagesError && messages && messages.length > 0) {
    console.log(`   ✅ Encontrados ${messages.length} mensajes relacionados`);
    messages.forEach((msg, index) => {
      console.log(`\n   MENSAJE ${index + 1}:`);
      console.log(`   Type: ${msg.type}`);
      console.log(`   Created: ${new Date(msg.created_at).toLocaleString('es-CO')}`);
      console.log(`   Payload:`, JSON.stringify(msg.payload, null, 2));
    });
  } else if (messagesError) {
    console.log('   ⚠️ Error buscando mensajes:', messagesError.message);
  } else {
    console.log('   ⚠️ No hay mensajes relacionados con cierre');
  }

  // 5. Verificar si calculator_totals tiene timestamp que nos dé pistas
  console.log('\n\n📊 5. VERIFICANDO TIMESTAMPS DE CALCULATOR_TOTALS...\n');
  
  const { data: totalsWithTimestamps, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('model_id, period_date, updated_at, created_at')
    .eq('period_date', '2026-01-01')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (!totalsError && totalsWithTimestamps && totalsWithTimestamps.length > 0) {
    console.log('   Últimas actualizaciones de totals para P1 2026-01:');
    totalsWithTimestamps.forEach((t, index) => {
      console.log(`   ${index + 1}. Model: ${t.model_id.substring(0, 8)} | Created: ${new Date(t.created_at).toLocaleString('es-CO')} | Updated: ${new Date(t.updated_at).toLocaleString('es-CO')}`);
    });
    
    const lastUpdate = new Date(totalsWithTimestamps[0].updated_at);
    console.log(`\n   🕐 Última actualización: ${lastUpdate.toLocaleString('es-CO')}`);
    console.log(`   🕐 Si es después del 16 de enero 00:00, significa que las modelos siguieron actualizando después de que debería haberse cerrado`);
  } else {
    console.log('   ⚠️ No se pudieron obtener timestamps');
  }

  // 6. Verificar si hay early_frozen_platforms que den pistas
  console.log('\n\n📊 6. VERIFICANDO EARLY FREEZE RECORDS...\n');
  
  const { data: earlyFreeze, error: earlyFreezeError } = await supabase
    .from('calculator_early_frozen_platforms')
    .select('*')
    .gte('frozen_at', '2026-01-15T00:00:00Z')
    .lte('frozen_at', '2026-01-17T23:59:59Z')
    .limit(10);

  if (!earlyFreezeError && earlyFreeze && earlyFreeze.length > 0) {
    console.log(`   ✅ Encontrados ${earlyFreeze.length} registros de early freeze`);
    earlyFreeze.forEach((ef, index) => {
      console.log(`   ${index + 1}. Period: ${ef.period_date} | Platform: ${ef.platform_id} | Frozen: ${new Date(ef.frozen_at).toLocaleString('es-CO')}`);
    });
  } else if (earlyFreezeError) {
    console.log('   ⚠️ Error:', earlyFreezeError.message);
  } else {
    console.log('   ⚠️ No hay registros de early freeze');
  }

  console.log('\n\n═'.repeat(80));
  console.log('\n🔍 CONCLUSIÓN DE LA INVESTIGACIÓN:\n');
  
  const hayCierreRegistrado = closureRecords && closureRecords.length > 0;
  const hayMensajesCierre = messages && messages.length > 0;
  const hayEarlyFreeze = earlyFreeze && earlyFreeze.length > 0;

  if (!hayCierreRegistrado && !hayMensajesCierre && !hayEarlyFreeze) {
    console.log('❌ NO HAY NINGUNA EVIDENCIA DE QUE EL SISTEMA SE EJECUTÓ');
    console.log('   - No hay registros de cierre');
    console.log('   - No hay mensajes de notificación');
    console.log('   - No hay registros de early freeze');
    console.log('\n   POSIBLES CAUSAS:');
    console.log('   1. El cron de Vercel NO se ejecutó');
    console.log('   2. Hay un problema de configuración en vercel.json');
    console.log('   3. Los cron jobs no están habilitados en el proyecto de Vercel');
    console.log('\n   PRÓXIMOS PASOS:');
    console.log('   1. Verificar logs de Vercel directamente en el dashboard');
    console.log('   2. Verificar que el cron esté habilitado en la configuración del proyecto');
    console.log('   3. Ejecutar manualmente el cierre para P1 enero 2026');
  } else {
    console.log('⚠️ HAY EVIDENCIA PARCIAL:');
    if (hayCierreRegistrado) console.log('   ✅ Hay registros de cierre (pero no de enero 2026)');
    if (hayMensajesCierre) console.log('   ✅ Hay mensajes de notificación');
    if (hayEarlyFreeze) console.log('   ✅ Hay registros de early freeze');
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ Investigación completada\n');
}

investigar()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
