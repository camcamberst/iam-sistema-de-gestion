/**
 * 🔍 DIAGNÓSTICO: Resumen de Facturación en Ceros
 * 
 * Este script verifica:
 * 1. Si calculator_totals tiene datos para el período actual
 * 2. Si calculator_history tiene datos para períodos cerrados
 * 3. Si hay problema con la fecha usada en billing-summary
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Función para obtener fecha Colombia (mismo que en el código)
function getColombiaDate() {
  return new Date().toLocaleDateString('en-CA', { 
    timeZone: 'America/Bogota' 
  });
}

// Función para obtener fecha UTC (como estaba antes del fix)
function getUTCDate() {
  return new Date().toISOString().split('T')[0];
}

async function diagnose() {
  console.log('🔍 DIAGNÓSTICO: Resumen de Facturación en Ceros\n');
  
  const colombiaDate = getColombiaDate();
  const utcDate = getUTCDate();
  
  console.log('📅 FECHAS:');
  console.log(`   Colombia: ${colombiaDate}`);
  console.log(`   UTC:      ${utcDate}`);
  console.log(`   Diferencia: ${colombiaDate !== utcDate ? '⚠️ HAY DIFERENCIA - Esto causaba el problema!' : '✅ Sin diferencia'}\n`);
  
  // Calcular rango de quincena
  const baseDate = new Date(colombiaDate);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  
  const quinStartStr = day <= 15
    ? `${year}-${String(month + 1).padStart(2, '0')}-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-16`;
  const quinEndStr = day <= 15
    ? `${year}-${String(month + 1).padStart(2, '0')}-15`
    : `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
  
  const isActivePeriod = colombiaDate >= quinStartStr && colombiaDate <= quinEndStr;
  
  console.log('📊 PERÍODO:');
  console.log(`   Rango: ${quinStartStr} - ${quinEndStr}`);
  console.log(`   Estado: ${isActivePeriod ? 'ACTIVO (debería buscar en calculator_totals)' : 'CERRADO (debería buscar en calculator_history)'}\n`);
  
  // Obtener todos los modelos activos
  const { data: models, error: modelsError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('role', 'modelo')
    .eq('is_active', true);
  
  if (modelsError) {
    console.error('❌ Error obteniendo modelos:', modelsError);
    return;
  }
  
  console.log(`👥 MODELOS ACTIVOS: ${models.length}\n`);
  
  const modelIds = models.map(m => m.id);
  
  // Verificar calculator_totals
  console.log('📊 VERIFICANDO calculator_totals:');
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('*')
    .in('model_id', modelIds)
    .gte('period_date', quinStartStr)
    .lte('period_date', quinEndStr);
  
  if (totalsError) {
    console.error('   ❌ Error:', totalsError);
  } else {
    console.log(`   Registros encontrados: ${totals?.length || 0}`);
    if (totals && totals.length > 0) {
      console.log(`   Modelos con datos: ${new Set(totals.map(t => t.model_id)).size}`);
      const totalUsd = totals.reduce((sum, t) => sum + (t.total_usd_modelo || 0), 0);
      console.log(`   Total USD Modelo: $${totalUsd.toFixed(2)}`);
    } else {
      console.log('   ⚠️ NO HAY DATOS en calculator_totals para el período actual');
    }
  }
  
  console.log('\n📚 VERIFICANDO calculator_history:');
  const expectedType = quinEndStr.endsWith('-15') ? 'period-1' : 'period-2';
  const { data: history, error: historyError } = await supabase
    .from('calculator_history')
    .select('model_id, period_date, period_type')
    .in('model_id', modelIds)
    .gte('period_date', quinStartStr)
    .lte('period_date', quinEndStr)
    .eq('period_type', expectedType);
  
  if (historyError) {
    console.error('   ❌ Error:', historyError);
  } else {
    console.log(`   Registros encontrados: ${history?.length || 0}`);
    if (history && history.length > 0) {
      console.log(`   Modelos con datos: ${new Set(history.map(h => h.model_id)).size}`);
    }
  }
  
  console.log('\n🔍 RESUMEN:');
  if (isActivePeriod) {
    if (!totals || totals.length === 0) {
      console.log('   ⚠️ PROBLEMA: Período está ACTIVO pero NO HAY datos en calculator_totals');
      console.log('   💡 SOLUCIÓN: Los modelos necesitan guardar valores en "Mi Calculadora"');
    } else {
      console.log('   ✅ Período activo y hay datos en calculator_totals');
    }
  } else {
    if (!history || history.length === 0) {
      console.log('   ⚠️ PROBLEMA: Período está CERRADO pero NO HAY datos en calculator_history');
      console.log('   💡 POSIBLE CAUSA: El cierre de período no se ejecutó o falló');
    } else {
      console.log('   ✅ Período cerrado y hay datos en calculator_history');
    }
  }
  
  // Verificar si hay datos en model_values (valores individuales)
  console.log('\n📝 VERIFICANDO model_values:');
  const { data: values, error: valuesError } = await supabase
    .from('model_values')
    .select('model_id, period_date')
    .in('model_id', modelIds)
    .gte('period_date', quinStartStr)
    .lte('period_date', quinEndStr);
  
  if (valuesError) {
    console.error('   ❌ Error:', valuesError);
  } else {
    console.log(`   Registros encontrados: ${values?.length || 0}`);
    if (values && values.length > 0) {
      console.log(`   Modelos con valores: ${new Set(values.map(v => v.model_id)).size}`);
    }
  }
}

diagnose().catch(console.error);

