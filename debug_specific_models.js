const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEjAq6KVsAH_RNw8c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugModels() {
  console.log('🔍 [DEBUG] Investigando modelos angelicawinter y maiteflores...');
  
  // Primero obtener los IDs de los usuarios
  console.log('\n👤 [DEBUG] 0. Obteniendo IDs de usuarios...');
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .in('email', ['angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com']);
    
  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError);
    return;
  }
  
  console.log('👤 Usuarios encontrados:', usersData?.length || 0);
  if (usersData && usersData.length > 0) {
    usersData.forEach(user => {
      console.log(`  - ${user.email}: ${user.id}`);
    });
  }
  
  const userIds = usersData?.map(u => u.id) || [];
  if (userIds.length === 0) {
    console.log('❌ No se encontraron usuarios');
    return;
  }
  
  // 1. Verificar datos en calculator_history para octubre 16, 2025
  console.log('\n📚 [DEBUG] 1. Verificando calculator_history para 2025-10-16...');
  const { data: historyData, error: historyError } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id, value, period_date, period_type, archived_at')
    .eq('period_date', '2025-10-16')
    .in('model_id', userIds);
    
  if (historyError) {
    console.error('❌ Error en calculator_history:', historyError);
  } else {
    console.log('📚 calculator_history (2025-10-16):', historyData?.length || 0, 'registros');
    if (historyData && historyData.length > 0) {
      historyData.forEach(item => {
        const user = usersData.find(u => u.id === item.model_id);
        console.log(`  - ${user?.email}: ${item.platform_id} = ${item.value}`);
      });
    }
  }
  
  // 2. Verificar datos en calculator_totals para octubre 16, 2025
  console.log('\n📊 [DEBUG] 2. Verificando calculator_totals para 2025-10-16...');
  const { data: totalsData, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('model_id, total_usd_bruto, total_usd_modelo, total_cop_modelo, period_date, updated_at')
    .eq('period_date', '2025-10-16')
    .in('model_id', userIds);
    
  if (totalsError) {
    console.error('❌ Error en calculator_totals:', totalsError);
  } else {
    console.log('📊 calculator_totals (2025-10-16):', totalsData?.length || 0, 'registros');
    if (totalsData && totalsData.length > 0) {
      totalsData.forEach(item => {
        const user = usersData.find(u => u.id === item.model_id);
        console.log(`  - ${user?.email}: USD Bruto=${item.total_usd_bruto}, USD Modelo=${item.total_usd_modelo}`);
      });
    }
  }
  
  // 3. Verificar datos en model_values para octubre 16, 2025
  console.log('\n💾 [DEBUG] 3. Verificando model_values para 2025-10-16...');
  const { data: valuesData, error: valuesError } = await supabase
    .from('model_values')
    .select('model_id, platform_id, value, period_date, updated_at')
    .eq('period_date', '2025-10-16')
    .in('model_id', userIds);
    
  if (valuesError) {
    console.error('❌ Error en model_values:', valuesError);
  } else {
    console.log('💾 model_values (2025-10-16):', valuesData?.length || 0, 'registros');
    if (valuesData && valuesData.length > 0) {
      valuesData.forEach(item => {
        const user = usersData.find(u => u.id === item.model_id);
        console.log(`  - ${user?.email}: ${item.platform_id} = ${item.value}`);
      });
    }
  }
  
  // 4. Verificar si hay datos en otros períodos de octubre 2025
  console.log('\n🔍 [DEBUG] 4. Verificando otros períodos de octubre 2025...');
  const { data: otherPeriodsData, error: otherPeriodsError } = await supabase
    .from('calculator_history')
    .select('model_id, platform_id, value, period_date, period_type, archived_at')
    .gte('period_date', '2025-10-01')
    .lte('period_date', '2025-10-31')
    .in('model_id', userIds)
    .order('period_date', { ascending: true });
    
  if (otherPeriodsError) {
    console.error('❌ Error en otros períodos:', otherPeriodsError);
  } else {
    console.log('🔍 Otros períodos octubre 2025:', otherPeriodsData?.length || 0, 'registros');
    if (otherPeriodsData && otherPeriodsData.length > 0) {
      otherPeriodsData.forEach(item => {
        const user = usersData.find(u => u.id === item.model_id);
        console.log(`  - ${user?.email}: ${item.period_date} ${item.period_type} ${item.platform_id} = ${item.value}`);
      });
    }
  }
  
  // 5. Verificar si hay datos en calculator_totals en otros períodos
  console.log('\n📊 [DEBUG] 5. Verificando calculator_totals en otros períodos...');
  const { data: otherTotalsData, error: otherTotalsError } = await supabase
    .from('calculator_totals')
    .select('model_id, total_usd_bruto, total_usd_modelo, total_cop_modelo, period_date, updated_at')
    .gte('period_date', '2025-10-01')
    .lte('period_date', '2025-10-31')
    .in('model_id', userIds)
    .order('period_date', { ascending: true });
    
  if (otherTotalsError) {
    console.error('❌ Error en otros calculator_totals:', otherTotalsError);
  } else {
    console.log('📊 calculator_totals otros períodos:', otherTotalsData?.length || 0, 'registros');
    if (otherTotalsData && otherTotalsData.length > 0) {
      otherTotalsData.forEach(item => {
        const user = usersData.find(u => u.id === item.model_id);
        console.log(`  - ${user?.email}: ${item.period_date} USD Bruto=${item.total_usd_bruto}, USD Modelo=${item.total_usd_modelo}`);
      });
    }
  }
  
  console.log('\n✅ [DEBUG] Investigación completada');
}

debugModels().catch(console.error);
