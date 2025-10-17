// Script para consultar, eliminar y recrear cuentas problemáticas
const { createClient } = require('@supabase/supabase-js');

// Usar las credenciales que funcionan en el navegador
const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgxNjU0NywiZXhwIjoyMDc0MzkyNTQ3fQ.REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Emails de las cuentas problemáticas
const PROBLEMATIC_EMAILS = ['angelicawinter@tuemailya.com', 'maiteflores@tuemailya.com'];

async function backupAndRecreateAccounts() {
  console.log('🚀 [MAIN] Iniciando proceso de backup y recreación...');
  
  try {
    // 1. Buscar usuarios existentes
    console.log('\n📋 [STEP 1] Buscando usuarios existentes...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('email', PROBLEMATIC_EMAILS);
    
    if (usersError) {
      console.error('❌ Error buscando usuarios:', usersError);
      return;
    }
    
    console.log('👥 Usuarios encontrados:', users.length);
    users.forEach(user => {
      console.log(`  - ${user.email}: ${user.name} (ID: ${user.id})`);
    });
    
    if (users.length === 0) {
      console.log('❌ No se encontraron usuarios con esos emails');
      return;
    }
    
    const userIds = users.map(u => u.id);
    
    // 2. Hacer backup de todos los datos
    console.log('\n📋 [STEP 2] Haciendo backup de datos...');
    
    // User groups
    const { data: userGroups, error: groupsError } = await supabase
      .from('user_groups')
      .select(`
        *,
        groups:group_id (
          id,
          name,
          organization_id
        )
      `)
      .in('user_id', userIds);
    
    if (groupsError) {
      console.error('❌ Error en user_groups:', groupsError);
    } else {
      console.log('👥 User groups encontrados:', userGroups.length);
    }
    
    // Model values
    const { data: modelValues, error: modelValuesError } = await supabase
      .from('model_values')
      .select('*')
      .in('model_id', userIds);
    
    if (modelValuesError) {
      console.error('❌ Error en model_values:', modelValuesError);
    } else {
      console.log('📊 Model values encontrados:', modelValues.length);
    }
    
    // Calculator history
    const { data: calculatorHistory, error: historyError } = await supabase
      .from('calculator_history')
      .select('*')
      .in('model_id', userIds);
    
    if (historyError) {
      console.error('❌ Error en calculator_history:', historyError);
    } else {
      console.log('📊 Calculator history encontrado:', calculatorHistory.length);
    }
    
    // Calculator totals
    const { data: calculatorTotals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('*')
      .in('model_id', userIds);
    
    if (totalsError) {
      console.error('❌ Error en calculator_totals:', totalsError);
    } else {
      console.log('📊 Calculator totals encontrados:', calculatorTotals.length);
    }
    
    // Anticipos
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('*')
      .in('model_id', userIds);
    
    if (anticiposError) {
      console.error('❌ Error en anticipos:', anticiposError);
    } else {
      console.log('💰 Anticipos encontrados:', anticipos.length);
    }
    
    // 3. Crear backup completo
    const backupData = {
      users,
      userGroups,
      modelValues,
      calculatorHistory,
      calculatorTotals,
      anticipos,
      timestamp: new Date().toISOString()
    };
    
    console.log('\n💾 [BACKUP] Guardando backup...');
    const fs = require('fs');
    const backupFile = `backup_accounts_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup guardado en: ${backupFile}`);
    
    // 4. Eliminar cuentas existentes
    console.log('\n🗑️ [DELETE] Eliminando cuentas existentes...');
    
    // Eliminar en orden correcto (respetando foreign keys)
    const deleteOperations = [
      { table: 'anticipos', field: 'model_id' },
      { table: 'calculator_totals', field: 'model_id' },
      { table: 'calculator_history', field: 'model_id' },
      { table: 'model_values', field: 'model_id' },
      { table: 'user_groups', field: 'user_id' },
      { table: 'users', field: 'id' }
    ];
    
    for (const operation of deleteOperations) {
      const { error } = await supabase
        .from(operation.table)
        .delete()
        .in(operation.field, userIds);
      
      if (error) {
        console.error(`❌ Error eliminando ${operation.table}:`, error);
      } else {
        console.log(`✅ ${operation.table} eliminado`);
      }
    }
    
    // 5. Recrear cuentas
    console.log('\n🔄 [RECREATE] Recreando cuentas...');
    
    const newUserIds = {};
    
    // Recrear usuarios
    for (const user of users) {
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          email: user.email,
          name: user.name,
          role: user.role,
          organization_id: user.organization_id,
          room_id: user.room_id,
          jornada: user.jornada,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (userError) {
        console.error(`❌ Error recreando usuario ${user.email}:`, userError);
        return;
      }
      
      newUserIds[user.id] = newUser.id;
      console.log(`✅ Usuario recreado: ${user.email} (${user.id} → ${newUser.id})`);
    }
    
    // Recrear user_groups
    for (const userGroup of userGroups || []) {
      const newUserId = newUserIds[userGroup.user_id];
      if (newUserId) {
        const { error: groupError } = await supabase
          .from('user_groups')
          .insert({
            user_id: newUserId,
            group_id: userGroup.group_id,
            created_at: new Date().toISOString()
          });
        
        if (groupError) {
          console.error(`❌ Error recreando grupo para usuario ${newUserId}:`, groupError);
        } else {
          console.log(`✅ Grupo recreado para usuario ${newUserId}`);
        }
      }
    }
    
    // Recrear model_values
    for (const modelValue of modelValues || []) {
      const newUserId = newUserIds[modelValue.model_id];
      if (newUserId) {
        const { error: mvError } = await supabase
          .from('model_values')
          .insert({
            model_id: newUserId,
            platform_id: modelValue.platform_id,
            value: modelValue.value,
            created_at: new Date().toISOString()
          });
        
        if (mvError) {
          console.error(`❌ Error recreando model value para usuario ${newUserId}:`, mvError);
        } else {
          console.log(`✅ Model value recreado para usuario ${newUserId}`);
        }
      }
    }
    
    // Recrear calculator_history
    for (const history of calculatorHistory || []) {
      const newUserId = newUserIds[history.model_id];
      if (newUserId) {
        const { error: chError } = await supabase
          .from('calculator_history')
          .insert({
            model_id: newUserId,
            platform_id: history.platform_id,
            value: history.value,
            period_date: history.period_date,
            period_type: history.period_type,
            created_at: new Date().toISOString()
          });
        
        if (chError) {
          console.error(`❌ Error recreando calculator history para usuario ${newUserId}:`, chError);
        } else {
          console.log(`✅ Calculator history recreado para usuario ${newUserId}`);
        }
      }
    }
    
    // Recrear calculator_totals
    for (const total of calculatorTotals || []) {
      const newUserId = newUserIds[total.model_id];
      if (newUserId) {
        const { error: ctError } = await supabase
          .from('calculator_totals')
          .insert({
            model_id: newUserId,
            total_usd_bruto: total.total_usd_bruto,
            total_usd_modelo: total.total_usd_modelo,
            total_cop_modelo: total.total_cop_modelo,
            period_date: total.period_date,
            period_type: total.period_type,
            created_at: new Date().toISOString()
          });
        
        if (ctError) {
          console.error(`❌ Error recreando calculator total para usuario ${newUserId}:`, ctError);
        } else {
          console.log(`✅ Calculator total recreado para usuario ${newUserId}`);
        }
      }
    }
    
    // Recrear anticipos
    for (const anticipo of anticipos || []) {
      const newUserId = newUserIds[anticipo.model_id];
      if (newUserId) {
        const { error: antError } = await supabase
          .from('anticipos')
          .insert({
            model_id: newUserId,
            monto: anticipo.monto,
            porcentaje: anticipo.porcentaje,
            fecha_solicitud: anticipo.fecha_solicitud,
            estado: anticipo.estado,
            created_at: new Date().toISOString()
          });
        
        if (antError) {
          console.error(`❌ Error recreando anticipo para usuario ${newUserId}:`, antError);
        } else {
          console.log(`✅ Anticipo recreado para usuario ${newUserId}`);
        }
      }
    }
    
    console.log('\n🎉 [SUCCESS] Proceso completado exitosamente!');
    console.log('✅ Las cuentas han sido recreadas y deberían aparecer correctamente en el Resumen de Facturación');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar el proceso
backupAndRecreateAccounts();
