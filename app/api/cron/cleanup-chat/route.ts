import { NextRequest, NextResponse } from 'next/server';
import { cleanupInactiveUsers } from '@/lib/chat/status-manager';

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON] Ejecutando limpieza automática de chat...');

    // Verificar que sea una llamada autorizada (desde Vercel Cron o similar)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Ejecutar limpieza
    await cleanupInactiveUsers();

    console.log('✅ [CRON] Limpieza automática completada');

    return NextResponse.json({
      success: true,
      message: 'Limpieza automática de chat completada',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [CRON] Error en limpieza automática:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error ejecutando limpieza automática',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// También permitir POST para llamadas manuales
export async function POST(request: NextRequest) {
  return GET(request);
}
