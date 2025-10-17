// Script final para eliminar las cuentas problemáticas
const { createClient } = require('@supabase/supabase-js');

// Usar las credenciales que funcionan en el navegador
const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgxNjU0NywiZXhwIjoyMDc0MzkyNTQ3fQ.REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

// IDs de las cuentas problemáticas
const PROBLEMATIC_IDS = [
    'fe54995d-1828-4721-8153-53fce6f4fe56', // angelicawinter
    '411902e6-a96d-4c8a-823b-2b92469ab469'  // maiteflores
];

async function deleteProblematicAccounts() {
    console.log('🗑️ [DELETE] Iniciando eliminación completa de cuentas problemáticas...');
    console.log('📋 IDs a eliminar:', PROBLEMATIC_IDS);
    
    try {
        // 1. Eliminar anticipos
        console.log('\n📋 [STEP 1] Eliminando anticipos...');
        const { error: anticiposError } = await supabase
            .from('anticipos')
            .delete()
            .in('model_id', PROBLEMATIC_IDS);
        
        if (anticiposError) {
            console.error('❌ Error eliminando anticipos:', anticiposError);
        } else {
            console.log('✅ Anticipos eliminados');
        }
        
        // 2. Eliminar calculator_totals
        console.log('\n📋 [STEP 2] Eliminando calculator_totals...');
        const { error: totalsError } = await supabase
            .from('calculator_totals')
            .delete()
            .in('model_id', PROBLEMATIC_IDS);
        
        if (totalsError) {
            console.error('❌ Error eliminando calculator_totals:', totalsError);
        } else {
            console.log('✅ Calculator totals eliminados');
        }
        
        // 3. Eliminar calculator_history
        console.log('\n📋 [STEP 3] Eliminando calculator_history...');
        const { error: historyError } = await supabase
            .from('calculator_history')
            .delete()
            .in('model_id', PROBLEMATIC_IDS);
        
        if (historyError) {
            console.error('❌ Error eliminando calculator_history:', historyError);
        } else {
            console.log('✅ Calculator history eliminado');
        }
        
        // 4. Eliminar model_values
        console.log('\n📋 [STEP 4] Eliminando model_values...');
        const { error: modelValuesError } = await supabase
            .from('model_values')
            .delete()
            .in('model_id', PROBLEMATIC_IDS);
        
        if (modelValuesError) {
            console.error('❌ Error eliminando model_values:', modelValuesError);
        } else {
            console.log('✅ Model values eliminados');
        }
        
        // 5. Eliminar user_groups
        console.log('\n📋 [STEP 5] Eliminando user_groups...');
        const { error: userGroupsError } = await supabase
            .from('user_groups')
            .delete()
            .in('user_id', PROBLEMATIC_IDS);
        
        if (userGroupsError) {
            console.error('❌ Error eliminando user_groups:', userGroupsError);
        } else {
            console.log('✅ User groups eliminados');
        }
        
        // 6. Eliminar usuarios principales
        console.log('\n📋 [STEP 6] Eliminando usuarios principales...');
        const { error: usersError } = await supabase
            .from('users')
            .delete()
            .in('id', PROBLEMATIC_IDS);
        
        if (usersError) {
            console.error('❌ Error eliminando usuarios:', usersError);
        } else {
            console.log('✅ Usuarios eliminados');
        }
        
        // 7. Verificar eliminación
        console.log('\n📋 [VERIFY] Verificando eliminación...');
        
        const { data: remainingUsers, error: verifyUsersError } = await supabase
            .from('users')
            .select('id, email, name')
            .in('id', PROBLEMATIC_IDS);
        
        if (verifyUsersError) {
            console.error('❌ Error verificando usuarios:', verifyUsersError);
        } else {
            console.log('👥 Usuarios restantes:', remainingUsers?.length || 0);
            if (remainingUsers && remainingUsers.length > 0) {
                remainingUsers.forEach(user => {
                    console.log(`  - ${user.email}: ${user.name} (${user.id})`);
                });
            }
        }
        
        const { data: remainingGroups, error: verifyGroupsError } = await supabase
            .from('user_groups')
            .select('user_id')
            .in('user_id', PROBLEMATIC_IDS);
        
        if (verifyGroupsError) {
            console.error('❌ Error verificando user_groups:', verifyGroupsError);
        } else {
            console.log('👥 User groups restantes:', remainingGroups?.length || 0);
        }
        
        const { data: remainingValues, error: verifyValuesError } = await supabase
            .from('model_values')
            .select('model_id')
            .in('model_id', PROBLEMATIC_IDS);
        
        if (verifyValuesError) {
            console.error('❌ Error verificando model_values:', verifyValuesError);
        } else {
            console.log('📊 Model values restantes:', remainingValues?.length || 0);
        }
        
        const { data: remainingHistory, error: verifyHistoryError } = await supabase
            .from('calculator_history')
            .select('model_id')
            .in('model_id', PROBLEMATIC_IDS);
        
        if (verifyHistoryError) {
            console.error('❌ Error verificando calculator_history:', verifyHistoryError);
        } else {
            console.log('📊 Calculator history restante:', remainingHistory?.length || 0);
        }
        
        const { data: remainingTotals, error: verifyTotalsError } = await supabase
            .from('calculator_totals')
            .select('model_id')
            .in('model_id', PROBLEMATIC_IDS);
        
        if (verifyTotalsError) {
            console.error('❌ Error verificando calculator_totals:', verifyTotalsError);
        } else {
            console.log('📊 Calculator totals restantes:', remainingTotals?.length || 0);
        }
        
        const { data: remainingAnticipos, error: verifyAnticiposError } = await supabase
            .from('anticipos')
            .select('model_id')
            .in('model_id', PROBLEMATIC_IDS);
        
        if (verifyAnticiposError) {
            console.error('❌ Error verificando anticipos:', verifyAnticiposError);
        } else {
            console.log('💰 Anticipos restantes:', remainingAnticipos?.length || 0);
        }
        
        // Verificar si la eliminación fue exitosa
        const totalRemaining = (remainingUsers?.length || 0) + 
                              (remainingGroups?.length || 0) + 
                              (remainingValues?.length || 0) + 
                              (remainingHistory?.length || 0) + 
                              (remainingTotals?.length || 0) + 
                              (remainingAnticipos?.length || 0);
        
        if (totalRemaining === 0) {
            console.log('\n🎉 [SUCCESS] ¡Eliminación completada exitosamente!');
            console.log('✅ Todas las cuentas problemáticas han sido eliminadas completamente');
            console.log('✅ Ya no aparecerán en el Resumen de Facturación');
            console.log('✅ Puedes proceder a crearlas manualmente');
        } else {
            console.log('\n⚠️ [WARNING] Eliminación parcial');
            console.log(`❌ Quedan ${totalRemaining} registros relacionados`);
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar la eliminación
deleteProblematicAccounts();
