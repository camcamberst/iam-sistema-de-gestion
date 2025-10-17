// Script específico para eliminar angelicawinter completamente
const { createClient } = require('@supabase/supabase-js');

// Usar las credenciales que funcionan en el navegador
const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgxNjU0NywiZXhwIjoyMDc0MzkyNTQ3fQ.REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

// ID específico de angelicawinter
const ANGELICAWINTER_ID = 'fe54995d-1828-4721-8153-53fce6f4fe56';

async function deleteAngelicawinter() {
    console.log('🗑️ [DELETE] Eliminando angelicawinter específicamente...');
    console.log('📋 ID a eliminar:', ANGELICAWINTER_ID);
    
    try {
        // Verificar datos existentes antes de eliminar
        console.log('\n📋 [VERIFY] Verificando datos existentes antes de eliminar...');
        
        const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('id', ANGELICAWINTER_ID);
        
        if (userError) {
            console.error('❌ Error verificando usuario:', userError);
        } else {
            console.log('👥 Usuario encontrado:', existingUser?.length || 0);
            if (existingUser && existingUser.length > 0) {
                console.log(`  - ${existingUser[0].email}: ${existingUser[0].name}`);
            }
        }
        
        const { data: existingGroups, error: groupsError } = await supabase
            .from('user_groups')
            .select('user_id')
            .eq('user_id', ANGELICAWINTER_ID);
        
        if (groupsError) {
            console.error('❌ Error verificando user_groups:', groupsError);
        } else {
            console.log('👥 User groups encontrados:', existingGroups?.length || 0);
        }
        
        const { data: existingValues, error: valuesError } = await supabase
            .from('model_values')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (valuesError) {
            console.error('❌ Error verificando model_values:', valuesError);
        } else {
            console.log('📊 Model values encontrados:', existingValues?.length || 0);
        }
        
        const { data: existingHistory, error: historyError } = await supabase
            .from('calculator_history')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (historyError) {
            console.error('❌ Error verificando calculator_history:', historyError);
        } else {
            console.log('📊 Calculator history encontrado:', existingHistory?.length || 0);
        }
        
        const { data: existingTotals, error: totalsError } = await supabase
            .from('calculator_totals')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (totalsError) {
            console.error('❌ Error verificando calculator_totals:', totalsError);
        } else {
            console.log('📊 Calculator totals encontrados:', existingTotals?.length || 0);
        }
        
        const { data: existingAnticipos, error: anticiposError } = await supabase
            .from('anticipos')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (anticiposError) {
            console.error('❌ Error verificando anticipos:', anticiposError);
        } else {
            console.log('💰 Anticipos encontrados:', existingAnticipos?.length || 0);
        }
        
        // Proceder con la eliminación
        console.log('\n🗑️ [DELETE] Iniciando eliminación...');
        
        // 1. Eliminar anticipos
        console.log('📋 [STEP 1] Eliminando anticipos...');
        const { error: anticiposDeleteError } = await supabase
            .from('anticipos')
            .delete()
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (anticiposDeleteError) {
            console.error('❌ Error eliminando anticipos:', anticiposDeleteError);
        } else {
            console.log('✅ Anticipos eliminados');
        }
        
        // 2. Eliminar calculator_totals
        console.log('📋 [STEP 2] Eliminando calculator_totals...');
        const { error: totalsDeleteError } = await supabase
            .from('calculator_totals')
            .delete()
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (totalsDeleteError) {
            console.error('❌ Error eliminando calculator_totals:', totalsDeleteError);
        } else {
            console.log('✅ Calculator totals eliminados');
        }
        
        // 3. Eliminar calculator_history
        console.log('📋 [STEP 3] Eliminando calculator_history...');
        const { error: historyDeleteError } = await supabase
            .from('calculator_history')
            .delete()
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (historyDeleteError) {
            console.error('❌ Error eliminando calculator_history:', historyDeleteError);
        } else {
            console.log('✅ Calculator history eliminado');
        }
        
        // 4. Eliminar model_values
        console.log('📋 [STEP 4] Eliminando model_values...');
        const { error: valuesDeleteError } = await supabase
            .from('model_values')
            .delete()
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (valuesDeleteError) {
            console.error('❌ Error eliminando model_values:', valuesDeleteError);
        } else {
            console.log('✅ Model values eliminados');
        }
        
        // 5. Eliminar user_groups
        console.log('📋 [STEP 5] Eliminando user_groups...');
        const { error: groupsDeleteError } = await supabase
            .from('user_groups')
            .delete()
            .eq('user_id', ANGELICAWINTER_ID);
        
        if (groupsDeleteError) {
            console.error('❌ Error eliminando user_groups:', groupsDeleteError);
        } else {
            console.log('✅ User groups eliminados');
        }
        
        // 6. Eliminar usuario principal
        console.log('📋 [STEP 6] Eliminando usuario principal...');
        const { error: userDeleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', ANGELICAWINTER_ID);
        
        if (userDeleteError) {
            console.error('❌ Error eliminando usuario:', userDeleteError);
        } else {
            console.log('✅ Usuario principal eliminado');
        }
        
        // Verificar eliminación final
        console.log('\n📋 [VERIFY] Verificando eliminación final...');
        
        const { data: remainingUser, error: finalUserError } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('id', ANGELICAWINTER_ID);
        
        if (finalUserError) {
            console.error('❌ Error verificando usuario final:', finalUserError);
        } else {
            console.log('👥 Usuario restante:', remainingUser?.length || 0);
            if (remainingUser && remainingUser.length > 0) {
                console.log(`  - ${remainingUser[0].email}: ${remainingUser[0].name}`);
            }
        }
        
        const { data: remainingGroups, error: finalGroupsError } = await supabase
            .from('user_groups')
            .select('user_id')
            .eq('user_id', ANGELICAWINTER_ID);
        
        if (finalGroupsError) {
            console.error('❌ Error verificando user_groups final:', finalGroupsError);
        } else {
            console.log('👥 User groups restantes:', remainingGroups?.length || 0);
        }
        
        const { data: remainingValues, error: finalValuesError } = await supabase
            .from('model_values')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (finalValuesError) {
            console.error('❌ Error verificando model_values final:', finalValuesError);
        } else {
            console.log('📊 Model values restantes:', remainingValues?.length || 0);
        }
        
        const { data: remainingHistory, error: finalHistoryError } = await supabase
            .from('calculator_history')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (finalHistoryError) {
            console.error('❌ Error verificando calculator_history final:', finalHistoryError);
        } else {
            console.log('📊 Calculator history restante:', remainingHistory?.length || 0);
        }
        
        const { data: remainingTotals, error: finalTotalsError } = await supabase
            .from('calculator_totals')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (finalTotalsError) {
            console.error('❌ Error verificando calculator_totals final:', finalTotalsError);
        } else {
            console.log('📊 Calculator totals restantes:', remainingTotals?.length || 0);
        }
        
        const { data: remainingAnticipos, error: finalAnticiposError } = await supabase
            .from('anticipos')
            .select('model_id')
            .eq('model_id', ANGELICAWINTER_ID);
        
        if (finalAnticiposError) {
            console.error('❌ Error verificando anticipos final:', finalAnticiposError);
        } else {
            console.log('💰 Anticipos restantes:', remainingAnticipos?.length || 0);
        }
        
        // Verificar si la eliminación fue exitosa
        const totalRemaining = (remainingUser?.length || 0) + 
                              (remainingGroups?.length || 0) + 
                              (remainingValues?.length || 0) + 
                              (remainingHistory?.length || 0) + 
                              (remainingTotals?.length || 0) + 
                              (remainingAnticipos?.length || 0);
        
        if (totalRemaining === 0) {
            console.log('\n🎉 [SUCCESS] ¡angelicawinter eliminada exitosamente!');
            console.log('✅ La cuenta ha sido eliminada completamente');
            console.log('✅ Ya no aparecerá en el Resumen de Facturación');
            console.log('✅ Puedes proceder a crearla manualmente');
        } else {
            console.log('\n⚠️ [WARNING] Eliminación parcial');
            console.log(`❌ Quedan ${totalRemaining} registros relacionados`);
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar la eliminación
deleteAngelicawinter();
