const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function debugAllHistory() {
  try {
    console.log('🔍 [DEBUG] Verificando TODOS los datos históricos...');
    
    // 1. Verificar TODOS los registros en calculator_history (sin filtros)
    const { data: allHistory, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .order('archived_at', { ascending: false });
    
    if (historyError) {
      console.error('❌ Error en calculator_history:', historyError);
    } else {
      console.log('📊 [DEBUG] TODOS los registros en calculator_history:');
      console.log('  - Total registros:', allHistory?.length || 0);
      
      if (allHistory && allHistory.length > 0) {
        console.log('  - Fechas de archivo:', allHistory.map(r => r.archived_at).slice(0, 5));
        console.log('  - Períodos:', new Set(allHistory.map(r => r.period_type)));
        console.log('  - Modelos:', new Set(allHistory.map(r => r.model_id)));
        console.log('  - Suma total:', allHistory.reduce((sum, r) => sum + (r.value || 0), 0));
        
        // Mostrar algunos registros de ejemplo
        console.log('  - Primeros 3 registros:');
        allHistory.slice(0, 3).forEach((record, i) => {
          console.log(`    ${i+1}. Modelo: ${record.model_id}, Plataforma: ${record.platform_id}, Valor: ${record.value}, Período: ${record.period_type}, Fecha: ${record.period_date}`);
        });
      }
    }
    
    // 2. Verificar TODOS los registros en model_values
    const { data: allModelValues, error: modelValuesError } = await supabase
      .from('model_values')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (modelValuesError) {
      console.error('❌ Error en model_values:', modelValuesError);
    } else {
      console.log('📊 [DEBUG] TODOS los registros en model_values:');
      console.log('  - Total registros:', allModelValues?.length || 0);
      
      if (allModelValues && allModelValues.length > 0) {
        console.log('  - Fechas de período:', new Set(allModelValues.map(r => r.period_date)));
        console.log('  - Modelos:', new Set(allModelValues.map(r => r.model_id)));
        console.log('  - Suma total:', allModelValues.reduce((sum, r) => sum + (r.value || 0), 0));
      }
    }
    
    // 3. Verificar TODOS los registros en calculator_totals
    const { data: allTotals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (totalsError) {
      console.error('❌ Error en calculator_totals:', totalsError);
    } else {
      console.log('📊 [DEBUG] TODOS los registros en calculator_totals:');
      console.log('  - Total registros:', allTotals?.length || 0);
      
      if (allTotals && allTotals.length > 0) {
        console.log('  - Fechas de período:', new Set(allTotals.map(r => r.period_date)));
        console.log('  - Modelos:', new Set(allTotals.map(r => r.model_id)));
        console.log('  - Suma USD Modelo:', allTotals.reduce((sum, r) => sum + (r.total_usd_modelo || 0), 0));
        console.log('  - Suma COP Modelo:', allTotals.reduce((sum, r) => sum + (r.total_cop_modelo || 0), 0));
      }
    }
    
    // 4. Verificar si hay datos en otras tablas relacionadas
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('role', 'modelo')
      .eq('is_active', true);
    
    if (!usersError) {
      console.log('📊 [DEBUG] Modelos activos en el sistema:');
      console.log('  - Total modelos activos:', users?.length || 0);
      if (users && users.length > 0) {
        console.log('  - Primeros 3 modelos:');
        users.slice(0, 3).forEach((user, i) => {
          console.log(`    ${i+1}. ID: ${user.id}, Email: ${user.email}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ [DEBUG] Error general:', error);
  }
}

debugAllHistory();


