import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cleanupInactiveUsers } from '@/lib/chat/status-manager';

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
    console.log('🧹 [CLEANUP] Iniciando limpieza de usuarios inactivos...');

    // Ejecutar limpieza
    await cleanupInactiveUsers();

    // Obtener estadísticas después de la limpieza
    const { data: onlineUsers, error: statsError } = await supabaseAdmin
      .from('chat_user_status')
      .select('*')
      .eq('is_online', true);

    if (statsError) {
      console.error('❌ [CLEANUP] Error obteniendo estadísticas:', statsError);
    }

    const stats = {
      timestamp: new Date().toISOString(),
      usersOnline: onlineUsers?.length || 0,
      cleanupExecuted: true
    };

    console.log('✅ [CLEANUP] Limpieza completada:', stats);

    return NextResponse.json({
      success: true,
      message: 'Limpieza de usuarios inactivos completada',
      stats
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error en limpieza:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error ejecutando limpieza de usuarios inactivos',
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
      console.error('❌ [CLEANUP] Error obteniendo estadísticas:', onlineError || allError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo estadísticas' },
        { status: 500 }
      );
    }

    const stats = {
      timestamp: new Date().toISOString(),
      usersOnline: onlineUsers?.length || 0,
      totalUsers: allUsers?.length || 0,
      usersOffline: (allUsers?.length || 0) - (onlineUsers?.length || 0)
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error obteniendo estadísticas:', error);
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
