/**
 * 🔍 BÚSQUEDA EXHAUSTIVA: DATOS P1 ENERO 2026
 * 
 * Este script busca los datos del P1 en TODAS las tablas posibles
 * y con TODAS las variaciones de fecha que se nos ocurran.
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

async function busquedaExhaustiva() {
  console.log('🔍 BÚSQUEDA EXHAUSTIVA: P1 ENERO 2026\n');
  console.log('═'.repeat(80));

  const resultados = {
    encontrado: false,
    ubicaciones: []
  };

  try {
    // =====================================================
    // 1. CALCULATOR_HISTORY
    // =====================================================
    console.log('\n📊 1. CALCULATOR_HISTORY\n');

    // 1.1. Fecha correcta (2026-01-01)
    const { data: hist2026, error: histError2026 } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('period_date', '2026-01-01')
      .eq('period_type', '1-15');

    if (!histError2026 && hist2026 && hist2026.length > 0) {
      console.log(`   ✅ ENCONTRADO: ${hist2026.length} registros con fecha 2026-01-01`);
      const modelos = new Set(hist2026.map(r => r.model_id));
      const plataformas = new Set(hist2026.map(r => r.platform_id));
      console.log(`   ✅ ${modelos.size} modelos, ${plataformas.size} plataformas`);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'calculator_history',
        fecha: '2026-01-01',
        registros: hist2026.length,
        modelos: modelos.size
      });
    } else {
      console.log(`   ❌ No hay registros con fecha 2026-01-01`);
    }

    // 1.2. Error de año (2025-01-01)
    const { data: hist2025, error: histError2025 } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('period_date', '2025-01-01')
      .eq('period_type', '1-15');

    if (!histError2025 && hist2025 && hist2025.length > 0) {
      console.log(`   ⚠️ ENCONTRADO CON ERROR DE AÑO: ${hist2025.length} registros con fecha 2025-01-01`);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'calculator_history',
        fecha: '2025-01-01 (ERROR DE AÑO)',
        registros: hist2025.length
      });
    } else {
      console.log(`   ❌ No hay registros con fecha 2025-01-01`);
    }

    // 1.3. Cualquier fecha de enero 2026
    const { data: histEnero2026, error: histEneroError } = await supabase
      .from('calculator_history')
      .select('period_date, period_type, model_id, platform_id')
      .gte('period_date', '2026-01-01')
      .lte('period_date', '2026-01-31');

    if (!histEneroError && histEnero2026 && histEnero2026.length > 0) {
      console.log(`   ⚠️ ENCONTRADO: ${histEnero2026.length} registros en enero 2026 (cualquier fecha)`);
      const fechasUnicas = [...new Set(histEnero2026.map(r => r.period_date))];
      console.log(`   Fechas encontradas:`, fechasUnicas);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'calculator_history',
        fecha: 'enero 2026 (varios)',
        registros: histEnero2026.length,
        fechas: fechasUnicas
      });
    } else {
      console.log(`   ❌ No hay registros en enero 2026`);
    }

    // 1.4. Por fecha de archivo (15-17 enero)
    const { data: histByArchived, error: histArchivedError } = await supabase
      .from('calculator_history')
      .select('period_date, period_type, archived_at, model_id')
      .gte('archived_at', '2026-01-15T00:00:00Z')
      .lte('archived_at', '2026-01-17T23:59:59Z');

    if (!histArchivedError && histByArchived && histByArchived.length > 0) {
      console.log(`   ⚠️ ENCONTRADO POR FECHA DE ARCHIVO: ${histByArchived.length} registros`);
      console.log(`   Períodos archivados:`, [...new Set(histByArchived.map(r => r.period_date))]);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'calculator_history',
        busqueda: 'por archived_at (15-17 ene)',
        registros: histByArchived.length
      });
    } else {
      console.log(`   ❌ No hay registros archivados entre 15-17 enero`);
    }

    // =====================================================
    // 2. MODEL_VALUES
    // =====================================================
    console.log('\n\n📊 2. MODEL_VALUES\n');

    // 2.1. Rango del P1 (2026-01-01 a 2026-01-15)
    const { data: values2026, error: valuesError2026 } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', '2026-01-01')
      .lte('period_date', '2026-01-15');

    if (!valuesError2026 && values2026 && values2026.length > 0) {
      console.log(`   🎉 ¡¡¡ENCONTRADO!!! ${values2026.length} valores en model_values`);
      const modelos = new Set(values2026.map(v => v.model_id));
      const plataformas = new Set(values2026.map(v => v.platform_id));
      console.log(`   🎉 ${modelos.size} modelos, ${plataformas.size} plataformas`);
      console.log(`   🎉 ¡¡LOS DATOS NO SE PERDIERON!!`);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'model_values',
        fecha: '2026-01-01 a 2026-01-15',
        registros: values2026.length,
        modelos: modelos.size,
        CRITICO: '¡¡¡DATOS ENCONTRADOS!!!'
      });

      // Mostrar muestra
      console.log('\n   Muestra de datos (primeros 5):');
      values2026.slice(0, 5).forEach((v, i) => {
        console.log(`   ${i + 1}. Model: ${v.model_id.substring(0, 8)}, Platform: ${v.platform_id}, Value: ${v.value}, Date: ${v.period_date}`);
      });
    } else {
      console.log(`   ❌ No hay valores en model_values para 2026-01-01 a 15`);
    }

    // 2.2. Error de año (2025-01-01 a 2025-01-15)
    const { data: values2025, error: valuesError2025 } = await supabase
      .from('model_values')
      .select('*')
      .gte('period_date', '2025-01-01')
      .lte('period_date', '2025-01-15');

    if (!valuesError2025 && values2025 && values2025.length > 0) {
      console.log(`   ⚠️ ENCONTRADO CON ERROR DE AÑO: ${values2025.length} valores con fecha 2025-01-01 a 15`);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'model_values',
        fecha: '2025-01-01 a 15 (ERROR DE AÑO)',
        registros: values2025.length
      });
    } else {
      console.log(`   ❌ No hay valores con error de año (2025)`);
    }

    // =====================================================
    // 3. CALC_SNAPSHOTS
    // =====================================================
    console.log('\n\n📊 3. CALC_SNAPSHOTS\n');

    // 3.1. Por fecha de creación
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('calc_snapshots')
      .select('*')
      .gte('created_at', '2026-01-15T00:00:00Z')
      .lte('created_at', '2026-01-17T23:59:59Z');

    if (!snapshotsError && snapshots && snapshots.length > 0) {
      console.log(`   🎉 ENCONTRADO: ${snapshots.length} snapshots`);
      console.log(`   🎉 ¡¡HAY BACKUPS!!`);
      resultados.encontrado = true;
      resultados.ubicaciones.push({
        tabla: 'calc_snapshots',
        busqueda: 'created_at 15-17 ene',
        registros: snapshots.length,
        CRITICO: '¡¡¡BACKUPS ENCONTRADOS!!!'
      });

      // Revisar el JSON
      snapshots.forEach((snap, i) => {
        if (snap.totals_json && snap.totals_json.values) {
          console.log(`\n   Snapshot ${i + 1}:`);
          console.log(`   - Model: ${snap.model_id?.substring(0, 8)}`);
          console.log(`   - Created: ${snap.created_at}`);
          console.log(`   - Values: ${snap.totals_json.values?.length || 0}`);
          console.log(`   - Period: ${snap.totals_json.period_date} (${snap.totals_json.period_type})`);
        }
      });
    } else {
      console.log(`   ❌ No hay snapshots del 15-17 enero`);
    }

    // =====================================================
    // 4. CALCULATOR_TOTALS
    // =====================================================
    console.log('\n\n📊 4. CALCULATOR_TOTALS\n');

    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .eq('period_date', '2026-01-01');

    if (!totalsError && totals && totals.length > 0) {
      console.log(`   ✅ ENCONTRADO: ${totals.length} totales (ya lo sabíamos)`);
      const suma = totals.reduce((acc, t) => acc + parseFloat(t.total_usd_bruto || 0), 0);
      console.log(`   Suma total USD: $${suma.toFixed(2)}`);
    } else {
      console.log(`   ❌ No hay totales`);
    }

    // =====================================================
    // 5. MODEL_VALUES_DELETION_LOG
    // =====================================================
    console.log('\n\n📊 5. MODEL_VALUES_DELETION_LOG\n');

    const { data: deletions, error: deletionsError } = await supabase
      .from('model_values_deletion_log')
      .select('*')
      .gte('deleted_at', '2026-01-15T00:00:00Z')
      .lte('deleted_at', '2026-01-17T23:59:59Z');

    if (!deletionsError && deletions && deletions.length > 0) {
      console.log(`   ⚠️ ENCONTRADO: ${deletions.length} registros de borrados`);
      const sinArchivo = deletions.filter(d => !d.archived_first);
      const conArchivo = deletions.filter(d => d.archived_first);
      console.log(`   - Con archivo previo: ${conArchivo.length}`);
      console.log(`   - SIN archivo previo: ${sinArchivo.length}`);

      if (sinArchivo.length > 0) {
        console.log(`\n   🎉 ¡¡PODEMOS RECUPERAR ${sinArchivo.length} VALORES DESDE EL LOG!!`);
        resultados.encontrado = true;
        resultados.ubicaciones.push({
          tabla: 'model_values_deletion_log',
          busqueda: 'borrados sin archivo',
          registros: sinArchivo.length,
          CRITICO: '¡¡¡RECUPERABLES DESDE LOG!!!'
        });
      }
    } else if (deletionsError) {
      console.log(`   ⚠️ La tabla aún no existe (trigger no instalado)`);
    } else {
      console.log(`   ❌ No hay registros de borrados`);
    }

    // =====================================================
    // RESUMEN FINAL
    // =====================================================
    console.log('\n\n═'.repeat(80));
    console.log('\n📊 RESUMEN FINAL\n');

    if (resultados.encontrado) {
      console.log('✅ ¡¡SE ENCONTRARON DATOS!!\n');
      console.log('Ubicaciones:');
      resultados.ubicaciones.forEach((ubicacion, i) => {
        console.log(`\n${i + 1}. ${ubicacion.tabla.toUpperCase()}`);
        Object.keys(ubicacion).forEach(key => {
          if (key !== 'tabla') {
            console.log(`   - ${key}: ${JSON.stringify(ubicacion[key])}`);
          }
        });
      });

      console.log('\n\n🎯 PRÓXIMOS PASOS:');
      console.log('1. Si hay datos en model_values → ¡¡NO SE PERDIERON!! Archivar AHORA');
      console.log('2. Si hay datos en calc_snapshots → Recuperar desde backups');
      console.log('3. Si hay datos en deletion_log → Recuperar desde log de borrados');
      console.log('4. Si hay datos con error de año → Corregir el año y archivar');
    } else {
      console.log('❌ NO SE ENCONTRARON DATOS EN NINGUNA UBICACIÓN');
      console.log('\nConfirmado: Los datos del detalle se perdieron permanentemente.');
      console.log('Solo quedan los totales consolidados en calculator_totals.');
    }

    console.log('\n═'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  }
}

busquedaExhaustiva()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
