const { createClient } = require('@supabase/supabase-js');

// Usar las variables de entorno del archivo env.modern
const supabaseUrl = 'https://mhernfrkvwigxdubiozm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgxNjU0NywiZXhwIjoyMDc0MzkyNTQ3fQ.REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables de entorno faltantes');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyChatTables() {
  console.log('🔍 Verificando tablas de chat...\n');

  try {
    // Verificar si las tablas existen
    const tables = [
      'chat_conversations',
      'chat_messages', 
      'chat_support_queries',
      'chat_user_status'
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Tabla ${table}: ${error.message}`);
        } else {
          console.log(`✅ Tabla ${table}: Existe`);
        }
      } catch (err) {
        console.log(`❌ Tabla ${table}: ${err.message}`);
      }
    }

    // Verificar usuarios disponibles
    console.log('\n👥 Verificando usuarios...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('is_active', true);

    if (usersError) {
      console.log('❌ Error obteniendo usuarios:', usersError.message);
    } else {
      console.log(`✅ Usuarios activos encontrados: ${users.length}`);
      users.forEach(user => {
        console.log(`  - ${user.name} (${user.role}) - ${user.email}`);
      });
    }

    // Verificar estados de chat
    console.log('\n💬 Verificando estados de chat...');
    const { data: statuses, error: statusError } = await supabase
      .from('chat_user_status')
      .select('*');

    if (statusError) {
      console.log('❌ Error obteniendo estados:', statusError.message);
    } else {
      console.log(`✅ Estados de chat encontrados: ${statuses.length}`);
      statuses.forEach(status => {
        console.log(`  - Usuario ${status.user_id}: ${status.is_online ? 'En línea' : 'Offline'} (${status.last_seen})`);
      });
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

verifyChatTables();
