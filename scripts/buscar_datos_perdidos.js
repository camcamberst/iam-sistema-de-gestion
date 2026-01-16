/**
 * 🚨 SCRIPT CRÍTICO: Buscar Datos Perdidos
 * 
 * Busca en todas las fuentes posibles para recuperar los datos
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function buscarDatosPerdidos() {
  console.log('\n🚨 BÚSQUEDA CRÍTICA DE DATOS PERDIDOS');
  console.log('='.repeat(60));
  console.log('📅 Período: Diciembre 2025');
  console.log('='.repeat(60));

  // 1. Verificar backups en calc_snapshots
  console.log('\n📋 1. VERIFICANDO BACKUPS EN calc_snapshots...');
  const { data: snapshots, error: snapError } = await supabase
    .from('calc_snapshots')
    .select('*')
    .gte('created_at', '2025-12-01')
    .order('created_at', { ascending: false })
    .limit(50);

  if (snapError) {
    console.error('❌ Error consultando snapshots:', snapError);
  } else {
    console.log(`✅ Encontrados ${snapshots?.length || 0} snapshots`);
    
    if (snapshots && snapshots.length > 0) {
      console.log('\n📊 SNAPSHOTS ENCONTRADOS:');
      snapshots.forEach((snap, idx) => {
        console.log(`\n   ${idx + 1}. Snapshot ID: ${snap.id}`);
        console.log(`      Modelo: ${snap.model_id}`);
        console.log(`      Fecha creación: ${snap.created_at}`);
        if (snap.totals_json) {
          const totals = typeof snap.totals_json === 'string' 
            ? JSON.parse(snap.totals_json) 
            : snap.totals_json;
          console.log(`      Período: ${totals.period_date} (${totals.period_type})`);
          console.log(`      Valores: ${totals.total_platforms || 0} plataformas`);
        }
      });
    } else {
      console.log('⚠️ No se encontraron snapshots');
    }
  }

  // 2. Verificar estado del cierre
  console.log('\n📋 2. VERIFICANDO ESTADO DEL CIERRE...');
  const { data: closureStatus, error: closureError } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .gte('created_at', '2025-12-01')
    .order('created_at', { ascending: false })
    .limit(10);

  if (closureError) {
    console.error('❌ Error consultando closure status:', closureError);
  } else {
    console.log(`✅ Encontrados ${closureStatus?.length || 0} registros de cierre`);
    
    if (closureStatus && closureStatus.length > 0) {
      console.log('\n📊 ESTADO DEL CIERRE:');
      closureStatus.forEach((status, idx) => {
        console.log(`\n   ${idx + 1}. Período: ${status.period_date} (${status.period_type})`);
        console.log(`      Estado: ${status.status}`);
        console.log(`      Fecha: ${status.created_at}`);
        if (status.metadata) {
          const meta = typeof status.metadata === 'string' 
            ? JSON.parse(status.metadata) 
            : status.metadata;
          console.log(`      Metadata: ${JSON.stringify(meta, null, 2)}`);
        }
      });
    } else {
      console.log('⚠️ No se encontraron registros de cierre');
    }
  }

  // 3. Verificar calculator_totals (puede tener totales aunque no detalle)
  console.log('\n📋 3. VERIFICANDO calculator_totals...');
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('*')
    .gte('period_date', '2025-12-01')
    .lte('period_date', '2025-12-31')
    .order('period_date', { ascending: false });

  if (totalsError) {
    console.error('❌ Error consultando totals:', totalsError);
  } else {
    console.log(`✅ Encontrados ${totals?.length || 0} registros en calculator_totals`);
    
    if (totals && totals.length > 0) {
      console.log('\n📊 TOTALES ENCONTRADOS:');
      const porModelo = new Map();
      totals.forEach(t => {
        const key = `${t.model_id}_${t.period_date}`;
        if (!porModelo.has(key)) {
          porModelo.set(key, []);
        }
        porModelo.get(key).push(t);
      });

      console.log(`   Modelos con totales: ${porModelo.size}`);
      Array.from(porModelo.entries()).slice(0, 5).forEach(([key, values]) => {
        const [modelId, periodDate] = key.split('_');
        console.log(`\n   Modelo: ${modelId}`);
        console.log(`   Período: ${periodDate}`);
        values.forEach(v => {
          console.log(`      Total USD bruto: ${v.total_usd_bruto || 0}`);
          console.log(`      Total USD modelo: ${v.total_usd_modelo || 0}`);
          console.log(`      Total COP modelo: ${v.total_cop_modelo || 0}`);
        });
      });
      
      console.log('\n   ⚠️ NOTA: calculator_totals solo tiene totales, NO detalle por plataforma');
    } else {
      console.log('⚠️ No se encontraron totales');
    }
  }

  // 4. Verificar si hay datos en calculator_history de otros períodos (para comparar)
  console.log('\n📋 4. VERIFICANDO calculator_history (otros períodos para referencia)...');
  const { data: history, error: historyError } = await supabase
    .from('calculator_history')
    .select('period_date, period_type, COUNT(*)')
    .gte('period_date', '2025-11-01')
    .lte('period_date', '2025-12-31')
    .order('period_date', { ascending: false });

  if (historyError) {
    console.error('❌ Error consultando history:', historyError);
  } else {
    // Agrupar por período
    const porPeriodo = new Map();
    if (history) {
      history.forEach(h => {
        const key = `${h.period_date}_${h.period_type}`;
        porPeriodo.set(key, (porPeriodo.get(key) || 0) + 1);
      });
    }

    console.log(`✅ Períodos con archivo:`);
    Array.from(porPeriodo.entries()).forEach(([key, count]) => {
      const [date, type] = key.split('_');
      console.log(`   ${date} (${type}): ${count} registros`);
    });
  }

  // 5. Verificar logs de auditoría si existen
  console.log('\n📋 5. VERIFICANDO LOGS DE AUDITORÍA...');
  const { data: auditLogs, error: auditError } = await supabase
    .from('audit_logs')
    .select('*')
    .gte('created_at', '2025-12-01')
    .ilike('action', '%close%')
    .or('action.ilike.%archive%,action.ilike.%period%')
    .order('created_at', { ascending: false })
    .limit(20);

  if (auditError) {
    console.log('⚠️ No se encontró tabla audit_logs o error:', auditError.message);
  } else {
    console.log(`✅ Encontrados ${auditLogs?.length || 0} logs de auditoría`);
    if (auditLogs && auditLogs.length > 0) {
      auditLogs.slice(0, 5).forEach(log => {
        console.log(`   ${log.created_at}: ${log.action} - ${log.details || ''}`);
      });
    }
  }

  // RESUMEN FINAL
  console.log('\n📊 RESUMEN DE BÚSQUEDA:');
  console.log('='.repeat(60));
  
  const tieneSnapshots = snapshots && snapshots.length > 0;
  const tieneTotals = totals && totals.length > 0;
  const tieneClosureStatus = closureStatus && closureStatus.length > 0;

  if (tieneSnapshots) {
    console.log('✅ BACKUPS ENCONTRADOS: Los datos pueden recuperarse desde calc_snapshots');
    console.log(`   Total snapshots: ${snapshots.length}`);
  } else {
    console.log('❌ NO HAY BACKUPS: No se encontraron snapshots');
  }

  if (tieneTotals) {
    console.log('⚠️ TOTALES ENCONTRADOS: Hay totales pero NO detalle por plataforma');
    console.log(`   Total registros: ${totals.length}`);
  } else {
    console.log('❌ NO HAY TOTALES: No se encontraron registros en calculator_totals');
  }

  if (tieneClosureStatus) {
    console.log('📋 ESTADO DEL CIERRE: Se encontraron registros de estado');
    console.log(`   Total registros: ${closureStatus.length}`);
  } else {
    console.log('⚠️ NO HAY ESTADO: No se encontraron registros de cierre');
  }

  // Exportar reporte completo
  const fs = require('fs');
  const reporte = {
    fecha_busqueda: new Date().toISOString(),
    snapshots: {
      encontrados: snapshots?.length || 0,
      datos: snapshots || []
    },
    closure_status: {
      encontrados: closureStatus?.length || 0,
      datos: closureStatus || []
    },
    totals: {
      encontrados: totals?.length || 0,
      datos: totals?.slice(0, 10) || [] // Solo primeros 10 para no hacer el archivo muy grande
    },
    conclusion: {
      tiene_backups: tieneSnapshots,
      tiene_totales: tieneTotals,
      puede_recuperar: tieneSnapshots || tieneTotals
    }
  };

  fs.writeFileSync('reporte_busqueda_datos_perdidos.json', JSON.stringify(reporte, null, 2));
  console.log('\n💾 Reporte completo guardado en: reporte_busqueda_datos_perdidos.json');

  return {
    tieneSnapshots,
    tieneTotals,
    snapshots,
    totals
  };
}

buscarDatosPerdidos()
  .then((resultado) => {
    if (resultado.tieneSnapshots) {
      console.log('\n✅ ESPERANZA: Se encontraron backups que pueden contener los datos');
      console.log('   Necesitamos crear un script de recuperación desde snapshots');
    } else if (resultado.tieneTotals) {
      console.log('\n⚠️ PARCIAL: Solo hay totales, no detalle por plataforma');
      console.log('   Los datos por plataforma se perdieron');
    } else {
      console.log('\n❌ CRÍTICO: No se encontraron backups ni totales');
      console.log('   Los datos pueden estar completamente perdidos');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  });

