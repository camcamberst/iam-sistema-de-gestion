const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c'
);

async function forceClearCache() {
  try {
    console.log('🔍 [CACHE] Forzando limpieza de cache del frontend...');
    
    // 1. Verificar si la tabla calculator_notifications existe
    const { data: tableCheck, error: tableError } = await supabase
      .from('calculator_notifications')
      .select('id')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST116') {
      console.log('ℹ️ [CACHE] Tabla calculator_notifications no existe, creándola...');
      
      // Crear la tabla usando SQL directo
      const { error: createError } = await supabase.rpc('exec', {
        sql: `
          CREATE TABLE IF NOT EXISTS calculator_notifications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            model_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            notification_type text NOT NULL,
            notification_data jsonb NOT NULL,
            period_date date NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            read_at timestamptz,
            expires_at timestamptz DEFAULT (now() + interval '24 hours')
          );
        `
      });
      
      if (createError) {
        console.log('ℹ️ [CACHE] Error creando tabla (puede que ya exista):', createError.message);
      }
    }
    
    // 2. Obtener usuarios modelo activos
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'modelo')
      .eq('is_active', true);
    
    if (usersError) {
      console.error('❌ [CACHE] Error obteniendo usuarios:', usersError);
      return;
    }
    
    console.log('📊 [CACHE] Usuarios modelo activos encontrados:', users?.length || 0);
    
    if (users && users.length > 0) {
      // 3. Crear notificaciones de limpieza
      const notifications = users.map(user => ({
        model_id: user.id,
        notification_type: 'force_clear_cache',
        notification_data: {
          type: 'force_clear_cache',
          model_id: user.id,
          reason: 'Limpieza masiva de cache - datos fantasma detectados',
          timestamp: new Date().toISOString(),
          action: 'clear_all_cache',
          clear_localStorage: true,
          clear_sessionStorage: true,
          clear_all_data: true,
          force_refresh: true,
          message: 'Se detectaron datos fantasma en el historial. Limpiando cache...'
        },
        period_date: new Date().toISOString().split('T')[0],
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      }));
      
      // 4. Insertar notificaciones
      const { error: insertError } = await supabase
        .from('calculator_notifications')
        .insert(notifications);
      
      if (insertError) {
        console.error('❌ [CACHE] Error insertando notificaciones:', insertError);
      } else {
        console.log('✅ [CACHE] Notificaciones de limpieza enviadas:', notifications.length);
        console.log('✅ [CACHE] Los usuarios verán una notificación para limpiar su cache');
      }
    } else {
      console.log('ℹ️ [CACHE] No se encontraron usuarios modelo activos');
    }
    
    console.log('✅ [CACHE] Proceso de limpieza de cache completado');
    
  } catch (error) {
    console.error('❌ [CACHE] Error:', error);
  }
}

forceClearCache();


