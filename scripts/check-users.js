const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function checkUsers() {
  try {
    console.log('🔍 [USERS] Verificando usuarios en el sistema...');
    
    // 1. Verificar tabla users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.error('❌ [USERS] Error en tabla users:', usersError);
    } else {
      console.log('📊 [USERS] Tabla users:');
      console.log('  - Total registros:', users?.length || 0);
      if (users && users.length > 0) {
        console.log('  - Roles:', new Set(users.map(u => u.role)));
        console.log('  - Activos:', users.filter(u => u.is_active).length);
        console.log('  - Primeros 3 usuarios:');
        users.slice(0, 3).forEach((user, i) => {
          console.log(`    ${i+1}. ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Activo: ${user.is_active}`);
        });
      }
    }
    
    // 2. Verificar si hay datos en otras tablas relacionadas
    const { data: calculatorConfigs, error: configError } = await supabase
      .from('calculator_config')
      .select('*');
    
    if (configError) {
      console.error('❌ [USERS] Error en calculator_config:', configError);
    } else {
      console.log('📊 [USERS] Tabla calculator_config:');
      console.log('  - Total registros:', calculatorConfigs?.length || 0);
      if (calculatorConfigs && calculatorConfigs.length > 0) {
        console.log('  - Modelos con config:', calculatorConfigs.length);
        console.log('  - Primeros 3 configs:');
        calculatorConfigs.slice(0, 3).forEach((config, i) => {
          console.log(`    ${i+1}. Model ID: ${config.model_id}, Activo: ${config.active}`);
        });
      }
    }
    
    // 3. Verificar si hay datos en daily_earnings
    const { data: dailyEarnings, error: earningsError } = await supabase
      .from('daily_earnings')
      .select('*');
    
    if (earningsError) {
      console.log('ℹ️ [USERS] Tabla daily_earnings no existe o error:', earningsError.message);
    } else {
      console.log('📊 [USERS] Tabla daily_earnings:');
      console.log('  - Total registros:', dailyEarnings?.length || 0);
    }
    
    // 4. Verificar si hay datos en daily_earnings_history
    const { data: dailyEarningsHistory, error: historyError } = await supabase
      .from('daily_earnings_history')
      .select('*');
    
    if (historyError) {
      console.log('ℹ️ [USERS] Tabla daily_earnings_history no existe o error:', historyError.message);
    } else {
      console.log('📊 [USERS] Tabla daily_earnings_history:');
      console.log('  - Total registros:', dailyEarningsHistory?.length || 0);
    }
    
  } catch (error) {
    console.error('❌ [USERS] Error:', error);
  }
}

checkUsers();


