// =====================================================
// 🔍 VERIFICAR ANTICIPOS EN SUPABASE
// =====================================================
// Script para verificar si existen anticipos en la base de datos
// =====================================================

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU2NzQ4MzQsImV4cCI6MjA1MTI1MDgzNH0.8QZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarAnticipos() {
  console.log('🔍 [VERIFICACIÓN] Iniciando verificación de anticipos...\n');

  try {
    // 1. Verificar si existen anticipos
    console.log('📋 [PASO 1] Verificando anticipos existentes:');
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select('*')
      .order('created_at', { ascending: false });

    if (anticiposError) {
      console.error('❌ Error obteniendo anticipos:', anticiposError.message);
      return;
    }

    console.log(`✅ Total de anticipos encontrados: ${anticipos?.length || 0}`);
    
    if (anticipos && anticipos.length > 0) {
      console.log('\n📋 [DETALLES] Primeros 5 anticipos:');
      anticipos.slice(0, 5).forEach((anticipo, index) => {
        console.log(`  ${index + 1}. ID: ${anticipo.id}`);
        console.log(`     - Monto: $${anticipo.monto_solicitado?.toLocaleString() || 'N/A'} COP`);
        console.log(`     - Estado: ${anticipo.estado || 'N/A'}`);
        console.log(`     - Modelo ID: ${anticipo.model_id || 'N/A'}`);
        console.log(`     - Creado: ${anticipo.created_at || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ No se encontraron anticipos en la base de datos');
    }

    // 2. Verificar usuarios con rol 'modelo'
    console.log('📋 [PASO 2] Verificando usuarios modelo:');
    const { data: modelos, error: modelosError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'modelo');

    if (modelosError) {
      console.error('❌ Error obteniendo modelos:', modelosError.message);
    } else {
      console.log(`✅ Total de modelos encontrados: ${modelos?.length || 0}`);
      if (modelos && modelos.length > 0) {
        console.log('\n📋 [DETALLES] Modelos disponibles:');
        modelos.forEach((modelo, index) => {
          console.log(`  ${index + 1}. ${modelo.name} (${modelo.email}) - ID: ${modelo.id}`);
        });
      }
    }

    // 3. Verificar grupos
    console.log('\n📋 [PASO 3] Verificando grupos:');
    const { data: grupos, error: gruposError } = await supabase
      .from('groups')
      .select('id, name');

    if (gruposError) {
      console.error('❌ Error obteniendo grupos:', gruposError.message);
    } else {
      console.log(`✅ Total de grupos encontrados: ${grupos?.length || 0}`);
      if (grupos && grupos.length > 0) {
        console.log('\n📋 [DETALLES] Grupos disponibles:');
        grupos.forEach((grupo, index) => {
          console.log(`  ${index + 1}. ${grupo.name} - ID: ${grupo.id}`);
        });
      }
    }

    // 4. Verificar relaciones user_groups
    console.log('\n📋 [PASO 4] Verificando relaciones usuario-grupo:');
    const { data: userGroups, error: userGroupsError } = await supabase
      .from('user_groups')
      .select(`
        user_id,
        group_id,
        users!user_groups_user_id_fkey (
          name,
          role
        ),
        groups!user_groups_group_id_fkey (
          name
        )
      `);

    if (userGroupsError) {
      console.error('❌ Error obteniendo relaciones:', userGroupsError.message);
    } else {
      console.log(`✅ Total de relaciones encontradas: ${userGroups?.length || 0}`);
      if (userGroups && userGroups.length > 0) {
        console.log('\n📋 [DETALLES] Relaciones usuario-grupo:');
        userGroups.forEach((rel, index) => {
          console.log(`  ${index + 1}. ${rel.users?.name} (${rel.users?.role}) -> ${rel.groups?.name}`);
        });
      }
    }

    console.log('\n✅ [VERIFICACIÓN] Verificación completada');

  } catch (error) {
    console.error('❌ [ERROR] Error general:', error.message);
  }
}

// Ejecutar verificación
verificarAnticipos();
