/**
 * 🔍 BUSCAR PERÍODOS HISTÓRICOS Y VERIFICAR TASAS
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findHistoricalPeriods() {
  console.log('🔍 [SEARCH] Buscando períodos históricos archivados...\n');
  
  try {
    // Buscar TODOS los períodos archivados (sin filtro de fecha específica)
    const { data: allRecords, error: fetchError } = await supabase
      .from('calculator_history')
      .select('period_date, period_type, archived_at, rate_eur_usd, rate_gbp_usd, rate_usd_cop')
      .not('archived_at', 'is', null)
      .order('period_date', { ascending: false })
      .order('archived_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('❌ [ERROR] Error obteniendo registros:', fetchError);
      return;
    }

    if (!allRecords || allRecords.length === 0) {
      console.log('⚠️ [INFO] No se encontraron registros archivados.');
      return;
    }

    console.log(`✅ Se encontraron ${allRecords.length} registros archivados\n`);

    // Agrupar por período único
    const periodsMap = new Map();
    allRecords.forEach(record => {
      const key = `${record.period_date}-${record.period_type}`;
      if (!periodsMap.has(key)) {
        periodsMap.set(key, {
          period_date: record.period_date,
          period_type: record.period_type,
          archived_at: record.archived_at,
          has_rates: !!(record.rate_eur_usd || record.rate_gbp_usd || record.rate_usd_cop),
          sample_rates: {
            eur_usd: record.rate_eur_usd,
            gbp_usd: record.rate_gbp_usd,
            usd_cop: record.rate_usd_cop
          }
        });
      }
    });

    const periods = Array.from(periodsMap.values());
    console.log(`📊 Períodos únicos encontrados: ${periods.length}\n`);

    periods.forEach((period, index) => {
      console.log(`${index + 1}. ${period.period_date} (${period.period_type})`);
      console.log(`   Archivado: ${new Date(period.archived_at).toLocaleDateString('es-CO')}`);
      console.log(`   Tiene tasas: ${period.has_rates ? '✅ SÍ' : '❌ NO'}`);
      if (period.has_rates) {
        console.log(`   Tasas:`, period.sample_rates);
      }
      console.log('');
    });

    // Buscar específicamente períodos de octubre 2025
    console.log('\n📋 Buscando períodos de OCTUBRE 2025...');
    const oct2025Records = allRecords.filter(r => 
      r.period_date && r.period_date.startsWith('2025-10')
    );

    if (oct2025Records.length > 0) {
      console.log(`✅ Se encontraron ${oct2025Records.length} registros de octubre 2025\n`);
      
      // Agrupar por período
      const octPeriodsMap = new Map();
      oct2025Records.forEach(record => {
        const key = `${record.period_date}-${record.period_type}`;
        if (!octPeriodsMap.has(key)) {
          octPeriodsMap.set(key, {
            period_date: record.period_date,
            period_type: record.period_type,
            has_rates: !!(record.rate_eur_usd || record.rate_gbp_usd || record.rate_usd_cop),
            sample_rates: {
              eur_usd: record.rate_eur_usd,
              gbp_usd: record.rate_gbp_usd,
              usd_cop: record.rate_usd_cop
            }
          });
        }
      });

      const octPeriods = Array.from(octPeriodsMap.values());
      octPeriods.forEach(period => {
        console.log(`   ${period.period_date} (${period.period_type})`);
        console.log(`   Tiene tasas: ${period.has_rates ? '✅ SÍ' : '❌ NO'}`);
        if (period.has_rates) {
          console.log(`   Tasas:`, period.sample_rates);
        }
        console.log('');
      });
    } else {
      console.log('⚠️ No se encontraron registros de octubre 2025\n');
    }

  } catch (error) {
    console.error('❌ [ERROR] Error en la búsqueda:', error);
    console.error('   Stack:', error.stack);
  }
}

findHistoricalPeriods()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });



