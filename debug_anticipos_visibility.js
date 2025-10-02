// =====================================================
// 🔍 DIAGNÓSTICO DE VISIBILIDAD DE ANTICIPOS
// =====================================================
// Script para diagnosticar por qué no se ven anticipos
// =====================================================

const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticarAnticipos() {
  console.log('🔍 [DIAGNÓSTICO] Iniciando diagnóstico de anticipos...\n');

  try {
    // 1. Verificar configuración
    console.log('📋 [PASO 1] Verificando configuración:');
    console.log('  - Supabase URL:', supabaseUrl ? '✅ Configurado' : '❌ No configurado');
    console.log('  - Supabase Key:', supabaseKey ? '✅ Configurado' : '❌ No configurado');
    console.log('  - Usando:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');
    console.log('');

    // 2. Verificar estructura de tablas
    console.log('📋 [PASO 2] Verificando estructura de tablas:');
    
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['anticipos', 'users', 'user_groups', 'groups']);

    if (tablesError) {
      console.error('❌ Error verificando tablas:', tablesError.message);
    } else {
      console.log('  - Tablas encontradas:', tables.map(t => t.table_name).join(', '));
    }
    console.log('');

    // 3. Verificar anticipos en la base de datos
    console.log('📋 [PASO 3] Verificando anticipos en la base de datos:');
    
    const { data: anticipos, error: anticiposError } = await supabase
      .from('anticipos')
      .select(`
        id,
        monto_solicitado,
        estado,
        created_at,
        model:users!anticipos_model_id_fkey (
          id,
          name,
          email,
          role
        )
      `)
      .order('created_at', { ascending: false });

    if (anticiposError) {
      console.error('❌ Error obteniendo anticipos:', anticiposError.message);
    } else {
      console.log(`  - Total de anticipos: ${anticipos?.length || 0}`);
      if (anticipos && anticipos.length > 0) {
        console.log('  - Primeros 3 anticipos:');
        anticipos.slice(0, 3).forEach((anticipo, index) => {
          console.log(`    ${index + 1}. ID: ${anticipo.id}, Estado: ${anticipo.estado}, Modelo: ${anticipo.model?.name || 'N/A'}`);
        });
      }
    }
    console.log('');

    // 4. Verificar usuarios admin/super_admin
    console.log('📋 [PASO 4] Verificando usuarios admin/super_admin:');
    
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .in('role', ['admin', 'super_admin']);

    if (adminsError) {
      console.error('❌ Error obteniendo admins:', adminsError.message);
    } else {
      console.log(`  - Total de admins: ${admins?.length || 0}`);
      if (admins && admins.length > 0) {
        console.log('  - Admins encontrados:');
        admins.forEach((admin, index) => {
          console.log(`    ${index + 1}. ${admin.name} (${admin.email}) - Rol: ${admin.role}`);
        });
      }
    }
    console.log('');

    // 5. Verificar grupos y relaciones
    console.log('📋 [PASO 5] Verificando grupos y relaciones:');
    
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name');

    if (groupsError) {
      console.error('❌ Error obteniendo grupos:', groupsError.message);
    } else {
      console.log(`  - Total de grupos: ${groups?.length || 0}`);
      if (groups && groups.length > 0) {
        console.log('  - Grupos encontrados:');
        groups.forEach((group, index) => {
          console.log(`    ${index + 1}. ${group.name} (ID: ${group.id})`);
        });
      }
    }
    console.log('');

    // 6. Verificar relaciones user_groups
    console.log('📋 [PASO 6] Verificando relaciones user_groups:');
    
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
      console.error('❌ Error obteniendo user_groups:', userGroupsError.message);
    } else {
      console.log(`  - Total de relaciones: ${userGroups?.length || 0}`);
      if (userGroups && userGroups.length > 0) {
        console.log('  - Primeras 5 relaciones:');
        userGroups.slice(0, 5).forEach((rel, index) => {
          console.log(`    ${index + 1}. ${rel.users?.name} (${rel.users?.role}) -> ${rel.groups?.name}`);
        });
      }
    }
    console.log('');

    // 7. Simular consulta de API
    console.log('📋 [PASO 7] Simulando consulta de API para super_admin:');
    
    if (admins && admins.length > 0) {
      const superAdmin = admins.find(a => a.role === 'super_admin');
      if (superAdmin) {
        console.log(`  - Simulando consulta para super_admin: ${superAdmin.name}`);
        
        const { data: apiResult, error: apiError } = await supabase
          .from('anticipos')
          .select(`
            *,
            model:users!anticipos_model_id_fkey (
              id,
              name,
              email,
              role
            ),
            period:periods (
              id,
              name,
              start_date,
              end_date
            )
          `)
          .order('created_at', { ascending: false });

        if (apiError) {
          console.error('❌ Error en consulta simulada:', apiError.message);
        } else {
          console.log(`  - Resultado de consulta: ${apiResult?.length || 0} anticipos`);
          if (apiResult && apiResult.length > 0) {
            console.log('  - Estados de anticipos:');
            const estados = {};
            apiResult.forEach(anticipo => {
              estados[anticipo.estado] = (estados[anticipo.estado] || 0) + 1;
            });
            Object.entries(estados).forEach(([estado, count]) => {
              console.log(`    - ${estado}: ${count}`);
            });
          }
        }
      } else {
        console.log('  - No se encontró super_admin');
      }
    }

    console.log('\n✅ [DIAGNÓSTICO] Diagnóstico completado');

  } catch (error) {
    console.error('❌ [DIAGNÓSTICO] Error general:', error.message);
  }
}

// Ejecutar diagnóstico
diagnosticarAnticipos();
