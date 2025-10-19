import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [ADMIN] Iniciando limpieza manual de usuarios inactivos...');

    // Limpiar usuarios inactivos (más de 2 minutos)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { error, count } = await supabaseAdmin
      .from('chat_user_status')
      .update({ is_online: false })
      .lt('updated_at', twoMinutesAgo)
      .eq('is_online', true)
      .select('*', { count: 'exact' });

    if (error) {
      console.error('❌ [ADMIN] Error limpiando usuarios inactivos:', error);
      return NextResponse.json(
        { success: false, error: 'Error limpiando usuarios inactivos' },
        { status: 500 }
      );
    }

    // Obtener estadísticas después de la limpieza
    const { data: onlineUsers, error: statsError } = await supabaseAdmin
      .from('chat_user_status')
      .select('*')
      .eq('is_online', true);

    if (statsError) {
      console.error('❌ [ADMIN] Error obteniendo estadísticas:', statsError);
    }

    const stats = {
      timestamp: new Date().toISOString(),
      usersCleaned: count || 0,
      usersOnline: onlineUsers?.length || 0,
      cleanupExecuted: true
    };

    console.log('✅ [ADMIN] Limpieza manual completada:', stats);

    return NextResponse.json({
      success: true,
      message: `Limpieza manual completada. ${count || 0} usuarios marcados como offline.`,
      stats
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error en limpieza manual:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error ejecutando limpieza manual',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Obtener estadísticas actuales
    const { data: onlineUsers, error: onlineError } = await supabaseAdmin
      .from('chat_user_status')
      .select('*')
      .eq('is_online', true);

    const { data: allUsers, error: allError } = await supabaseAdmin
      .from('chat_user_status')
      .select('*');

    if (onlineError || allError) {
      console.error('❌ [ADMIN] Error obteniendo estadísticas:', onlineError || allError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo estadísticas' },
        { status: 500 }
      );
    }

    // Obtener usuarios inactivos (más de 2 minutos)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const inactiveUsers = allUsers?.filter(user => 
      user.is_online && new Date(user.updated_at) < new Date(twoMinutesAgo)
    ) || [];

    const stats = {
      timestamp: new Date().toISOString(),
      usersOnline: onlineUsers?.length || 0,
      totalUsers: allUsers?.length || 0,
      usersOffline: (allUsers?.length || 0) - (onlineUsers?.length || 0),
      inactiveUsers: inactiveUsers.length,
      inactiveUsersList: inactiveUsers.map(user => ({
        user_id: user.user_id,
        last_seen: user.updated_at,
        minutes_inactive: Math.floor((new Date().getTime() - new Date(user.updated_at).getTime()) / (1000 * 60))
      }))
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo estadísticas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
