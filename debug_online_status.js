// Script para diagnosticar el estado de usuarios en línea
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function debugOnlineStatus() {
  console.log('🔍 Diagnosticando estado de usuarios en línea...\n');

  try {
    // 1. Verificar usuarios en chat_user_status
    console.log('📊 Usuarios en chat_user_status:');
    const { data: chatStatus, error: chatError } = await supabase
      .from('chat_user_status')
      .select('*')
      .order('updated_at', { ascending: false });

    if (chatError) {
      console.error('❌ Error obteniendo chat_user_status:', chatError);
      return;
    }

    console.log(`Total usuarios en chat_user_status: ${chatStatus.length}`);
    chatStatus.forEach(user => {
      const lastSeen = new Date(user.last_seen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
      
      console.log(`- ${user.user_id}: ${user.is_online ? '🟢 En línea' : '🔴 Offline'} (última vez: ${diffMinutes} min atrás)`);
    });

    // 2. Verificar usuarios en línea (más de 5 minutos)
    console.log('\n⏰ Usuarios "en línea" pero inactivos (>5 min):');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const inactiveOnline = chatStatus.filter(user => 
      user.is_online && new Date(user.last_seen) < new Date(fiveMinutesAgo)
    );

    console.log(`Usuarios inactivos encontrados: ${inactiveOnline.length}`);
    inactiveOnline.forEach(user => {
      const lastSeen = new Date(user.last_seen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
      console.log(`- ${user.user_id}: Inactivo por ${diffMinutes} minutos`);
    });

    // 3. Verificar información de usuarios
    console.log('\n👥 Información detallada de usuarios:');
    for (const user of chatStatus) {
      const { data: userInfo, error: userError } = await supabase
        .from('users')
        .select('id, email, role, name')
        .eq('id', user.user_id)
        .single();

      if (userError) {
        console.log(`- ${user.user_id}: ❌ Usuario no encontrado en tabla users`);
      } else {
        const lastSeen = new Date(user.last_seen);
        const now = new Date();
        const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        
        console.log(`- ${userInfo.name || userInfo.email} (${userInfo.role}): ${user.is_online ? '🟢' : '🔴'} - ${diffMinutes} min atrás`);
      }
    }

    // 4. Verificar sesiones activas de Supabase Auth
    console.log('\n🔐 Verificando sesiones activas en Supabase Auth...');
    const { data: sessions, error: sessionsError } = await supabase.auth.admin.listUsers();
    
    if (sessionsError) {
      console.error('❌ Error obteniendo sesiones:', sessionsError);
    } else {
      console.log(`Total usuarios en Supabase Auth: ${sessions.users.length}`);
      const activeUsers = sessions.users.filter(user => user.last_sign_in_at);
      console.log(`Usuarios con sesiones: ${activeUsers.length}`);
      
      // Comparar con chat_user_status
      const chatOnlineUsers = chatStatus.filter(u => u.is_online).map(u => u.user_id);
      const authUsers = activeUsers.map(u => u.id);
      
      console.log('\n🔍 Comparación:');
      console.log(`Usuarios en línea en chat: ${chatOnlineUsers.length}`);
      console.log(`Usuarios con sesiones auth: ${authUsers.length}`);
      
      const mismatched = chatOnlineUsers.filter(id => !authUsers.includes(id));
      if (mismatched.length > 0) {
        console.log(`\n⚠️ Usuarios marcados como en línea pero sin sesión activa: ${mismatched.length}`);
        mismatched.forEach(id => {
          const user = chatStatus.find(u => u.user_id === id);
          const lastSeen = new Date(user.last_seen);
          const now = new Date();
          const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
          console.log(`- ${id}: Inactivo por ${diffMinutes} minutos`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

debugOnlineStatus();
