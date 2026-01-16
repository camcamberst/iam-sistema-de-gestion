/**
 * 🚨 DIAGNÓSTICO URGENTE: P1 ENERO 2026 NO SE ARCHIVÓ
 * 
 * Este script verifica:
 * 1. Si hay registros en calculator_history para P1 enero 2026
 * 2. Si hay registros en calculator_period_closure_status
 * 3. Si hay backups en calc_snapshots
 * 4. Si quedan datos en model_values
 * 5. Estado actual de las calculadoras
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

async function diagnose() {
  console.log('🚨 DIAGNÓSTICO URGENTE: P1 ENERO 2026\n');
  console.log('═'.repeat(80));

  // 1. Verificar registros en calculator_history
  console.log('\n📊 1. VERIFICANDO CALCULATOR_HISTORY...\n');
  
  const { data: historyP1, error: historyError } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id, value, created_at')
    .eq('period_date', '2026-01-01')
    .eq('period_type', '1-15');

  if (historyError) {
    console.error('❌ Error consultando calculator_history:', historyError);
  } else {
    console.log(`   Total registros en calculator_history para P1 2026-01: ${historyP1?.length || 0}`);
    
    if (historyP1 && historyP1.length > 0) {
      const modelosUnicos = new Set(historyP1.map(r => r.model_id));
      console.log(`   ✅ Modelos con archivo: ${modelosUnicos.size}`);
      console.log(`   ✅ Total plataformas archivadas: ${historyP1.length}`);
    } else {
      console.log('   ⚠️ NO HAY REGISTROS EN CALCULATOR_HISTORY PARA P1 ENERO 2026');
    }
  }

  // 2. Verificar estado del cierre en calculator_period_closure_status
  console.log('\n\n📊 2. VERIFICANDO ESTADO DEL CIERRE...\n');
  
  const { data: closureStatus, error: closureError } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .eq('period_date', '2026-01-01')
    .eq('period_type', '1-15')
    .order('created_at', { ascending: false });

  if (closureError) {
    console.error('❌ Error consultando calculator_period_closure_status:', closureError);
  } else {
    if (closureStatus && closureStatus.length > 0) {
      console.log(`   Total registros de estado: ${closureStatus.length}`);
      closureStatus.forEach((status, index) => {
        console.log(`\n   Intento #${index + 1}:`);
        console.log(`   - Estado: ${status.status}`);
        console.log(`   - Fecha: ${status.created_at}`);
        console.log(`   - Metadata:`, JSON.stringify(status.metadata, null, 2));
      });
    } else {
      console.log('   ⚠️ NO HAY REGISTROS DE ESTADO DEL CIERRE PARA P1 ENERO 2026');
      console.log('   ⚠️ ESTO SIGNIFICA QUE EL CRON NUNCA SE EJECUTÓ O FALLÓ ANTES DE ACTUALIZAR EL ESTADO');
    }
  }

  // 3. Verificar backups en calc_snapshots
  console.log('\n\n📊 3. VERIFICANDO BACKUPS EN CALC_SNAPSHOTS...\n');
  
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('calc_snapshots')
    .select('model_id, snapshot_type, created_at')
    .eq('period_date', '2026-01-01')
    .eq('period_type', '1-15');

  if (snapshotsError) {
    console.error('❌ Error consultando calc_snapshots:', snapshotsError);
  } else {
    console.log(`   Total backups para P1 2026-01: ${snapshots?.length || 0}`);
    
    if (snapshots && snapshots.length > 0) {
      const modelosUnicos = new Set(snapshots.map(s => s.model_id));
      console.log(`   ✅ Modelos con backup: ${modelosUnicos.size}`);
    } else {
      console.log('   ⚠️ NO HAY BACKUPS EN CALC_SNAPSHOTS PARA P1 ENERO 2026');
    }
  }

  // 4. Verificar si quedan datos en model_values del P1
  console.log('\n\n📊 4. VERIFICANDO MODEL_VALUES (DATOS DEL P1)...\n');
  
  const { data: modelValuesP1, error: valuesError } = await supabase
    .from('model_values')
    .select('model_id, platform_id, value, period_date')
    .gte('period_date', '2026-01-01')
    .lte('period_date', '2026-01-15');

  if (valuesError) {
    console.error('❌ Error consultando model_values:', valuesError);
  } else {
    console.log(`   Total valores en model_values para P1 2026-01: ${modelValuesP1?.length || 0}`);
    
    if (modelValuesP1 && modelValuesP1.length > 0) {
      const modelosUnicos = new Set(modelValuesP1.map(v => v.model_id));
      console.log(`   ⚠️ DATOS TODAVÍA PRESENTES EN MODEL_VALUES`);
      console.log(`   ⚠️ Modelos con datos: ${modelosUnicos.size}`);
      console.log(`   ⚠️ Total registros: ${modelValuesP1.length}`);
      console.log('\n   Muestra de datos (primeros 5):');
      modelValuesP1.slice(0, 5).forEach(v => {
        console.log(`   - Model: ${v.model_id.substring(0, 8)}, Platform: ${v.platform_id}, Value: ${v.value}, Date: ${v.period_date}`);
      });
    } else {
      console.log('   ✅ No hay datos del P1 en model_values (fueron eliminados correctamente)');
    }
  }

  // 5. Verificar estado actual del período (calculator_totals)
  console.log('\n\n📊 5. VERIFICANDO CALCULATOR_TOTALS...\n');
  
  const { data: totalsP1, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('model_id, total_usd_bruto, total_usd_modelo, total_cop_modelo, period_date')
    .eq('period_date', '2026-01-01');

  if (totalsError) {
    console.error('❌ Error consultando calculator_totals:', totalsError);
  } else {
    console.log(`   Total registros en calculator_totals para P1 2026-01: ${totalsP1?.length || 0}`);
    
    if (totalsP1 && totalsP1.length > 0) {
      const modelosConDatos = totalsP1.filter(t => parseFloat(t.total_usd_bruto || 0) > 0);
      console.log(`   Modelos con totales: ${totalsP1.length}`);
      console.log(`   Modelos con totales > 0: ${modelosConDatos.length}`);
      console.log('\n   Muestra de totales (primeros 5 con datos):');
      modelosConDatos.slice(0, 5).forEach(t => {
        console.log(`   - Model: ${t.model_id.substring(0, 8)}, USD Bruto: ${t.total_usd_bruto}, USD Modelo: ${t.total_usd_modelo}`);
      });
    } else {
      console.log('   ⚠️ No hay registros en calculator_totals para P1 2026-01');
    }
  }

  // 6. DIAGNÓSTICO FINAL
  console.log('\n\n═'.repeat(80));
  console.log('\n🔍 DIAGNÓSTICO FINAL:\n');

  const hasHistory = historyP1 && historyP1.length > 0;
  const hasBackup = snapshots && snapshots.length > 0;
  const hasClosureStatus = closureStatus && closureStatus.length > 0;
  const stillHasData = modelValuesP1 && modelValuesP1.length > 0;

  if (!hasHistory && !hasBackup && !hasClosureStatus) {
    console.log('❌ FALLO CRÍTICO: EL CRON NUNCA SE EJECUTÓ');
    console.log('   - No hay archivo en calculator_history');
    console.log('   - No hay backups en calc_snapshots');
    console.log('   - No hay registros de estado del cierre');
    console.log('\n   POSIBLES CAUSAS:');
    console.log('   1. El cron de Vercel no se ejecutó (verificar logs de Vercel)');
    console.log('   2. El cron está mal configurado (verificar vercel.json)');
    console.log('   3. El endpoint falló antes de empezar el proceso');
  } else if (hasClosureStatus && !hasHistory) {
    console.log('❌ FALLO PARCIAL: EL CIERRE SE INICIÓ PERO FALLÓ');
    console.log('   - El cron se ejecutó (hay registros de estado)');
    console.log('   - Pero NO se completó el archivado');
    console.log('\n   REVISAR LOGS DEL ÚLTIMO ESTADO DE CIERRE ARRIBA');
  } else if (hasBackup && !hasHistory) {
    console.log('⚠️ SITUACIÓN ANÓMALA: HAY BACKUP PERO NO HAY ARCHIVO');
    console.log('   - Se crearon los backups');
    console.log('   - Pero el archivado falló después');
    console.log('\n   BUENAS NOTICIAS: ¡LOS DATOS ESTÁN EN CALC_SNAPSHOTS!');
    console.log('   PODEMOS RECUPERARLOS');
  } else if (hasHistory && hasBackup) {
    console.log('✅ SITUACIÓN NORMAL: HAY ARCHIVO Y BACKUP');
    console.log('   El cierre se ejecutó correctamente');
    console.log('\n   ¿Por qué el usuario no ve el archivo?');
    console.log('   - Verificar que la interfaz de "Mi Historial" está consultando correctamente');
    console.log('   - Verificar que el usuario está buscando el período correcto');
  }

  if (stillHasData) {
    console.log('\n⚠️ IMPORTANTE: AÚN HAY DATOS EN MODEL_VALUES DEL P1');
    console.log('   Esto significa que el DELETE no se ejecutó');
    console.log('   Las calculadoras NO están en 0\'s');
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ Diagnóstico completado\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
