import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// POST: Limpiar usuarios inactivos automáticamente
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🧹 [AUTO-CLEANUP] Iniciando limpieza automática de usuarios inactivos...');

    // Obtener usuarios que no han enviado heartbeat en los últimos 2 minutos
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: inactiveUsers, error: fetchError } = await supabase
      .from('chat_user_status')
      .select('user_id, last_seen, updated_at')
      .eq('is_online', true)
      .lt('updated_at', twoMinutesAgo);

    if (fetchError) {
      console.error('❌ [AUTO-CLEANUP] Error obteniendo usuarios inactivos:', fetchError);
      return NextResponse.json({ error: 'Error obteniendo usuarios inactivos' }, { status: 500 });
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('✅ [AUTO-CLEANUP] No hay usuarios inactivos para limpiar');
      return NextResponse.json({ 
        success: true, 
        message: 'No hay usuarios inactivos para limpiar',
        cleanedCount: 0
      });
    }

    console.log(`🔍 [AUTO-CLEANUP] Encontrados ${inactiveUsers.length} usuarios inactivos:`, 
      inactiveUsers.map(u => u.user_id));

    // Marcar usuarios inactivos como offline
    const userIds = inactiveUsers.map(u => u.user_id);
    const { error: updateError } = await supabase
      .from('chat_user_status')
      .update({ 
        is_online: false,
        updated_at: new Date().toISOString()
      })
      .in('user_id', userIds);

    if (updateError) {
      console.error('❌ [AUTO-CLEANUP] Error marcando usuarios como offline:', updateError);
      return NextResponse.json({ error: 'Error marcando usuarios como offline' }, { status: 500 });
    }

    console.log(`✅ [AUTO-CLEANUP] ${inactiveUsers.length} usuarios marcados como offline`);

    return NextResponse.json({ 
      success: true, 
      message: `${inactiveUsers.length} usuarios marcados como offline`,
      cleanedCount: inactiveUsers.length,
      cleanedUsers: inactiveUsers.map(u => u.user_id)
    });

  } catch (error) {
    console.error('❌ [AUTO-CLEANUP] Error general:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// GET: Obtener estadísticas de usuarios online/offline
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📊 [AUTO-CLEANUP] Obteniendo estadísticas de usuarios...');

    // Obtener estadísticas generales
    const { data: allStatuses, error: fetchError } = await supabase
      .from('chat_user_status')
      .select('is_online, updated_at');

    if (fetchError) {
      console.error('❌ [AUTO-CLEANUP] Error obteniendo estadísticas:', fetchError);
      return NextResponse.json({ error: 'Error obteniendo estadísticas' }, { status: 500 });
    }

    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    const stats = {
      total: allStatuses?.length || 0,
      online: allStatuses?.filter(s => s.is_online).length || 0,
      offline: allStatuses?.filter(s => !s.is_online).length || 0,
      potentiallyInactive: allStatuses?.filter(s => 
        s.is_online && new Date(s.updated_at) < twoMinutesAgo
      ).length || 0,
      lastCleanup: new Date().toISOString()
    };

    console.log('📊 [AUTO-CLEANUP] Estadísticas:', stats);

    return NextResponse.json({ 
      success: true, 
      stats
    });

  } catch (error) {
    console.error('❌ [AUTO-CLEANUP] Error obteniendo estadísticas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
