import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  getColombiaDate, 
  getColombiaDateTime,
  isClosureDay, 
  EARLY_FREEZE_PLATFORMS,
  getEuropeanCentralMidnightInColombia
} from '@/utils/period-closure-dates';
import { getFrozenPlatformsForModel } from '@/lib/calculator/period-closure-helpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * GET: Obtiene el estado de congelación de plataformas para un modelo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const periodDate = searchParams.get('periodDate') || getColombiaDate();

    if (!modelId) {
      return NextResponse.json({
        success: false,
        error: 'modelId es requerido'
      }, { status: 400 });
    }

    // Obtener plataformas congeladas para este modelo desde BD (si existen)
    const frozenPlatformsFromDB = await getFrozenPlatformsForModel(periodDate, modelId);
    const allFrozenPlatforms = new Set(frozenPlatformsFromDB.map(p => p.toLowerCase()));

    // 🔒 VERIFICACIÓN AUTOMÁTICA ESCALABLE:
    // Si es día de cierre (1 o 16) Y ya pasó medianoche Europa Central,
    // aplicar early freeze automáticamente para TODOS los modelos (existentes Y futuros)
    // Esto NO depende de que el cron se haya ejecutado - es automático basado en hora/fecha
    const isClosure = isClosureDay();
    
    if (isClosure) {
      const now = new Date();
      const europeMidnight = getEuropeanCentralMidnightInColombia(now);
      const colombiaTimeStr = getColombiaDateTime();
      
      // Extraer hora y minuto actuales de Colombia
      const timePart = colombiaTimeStr.split(' ')[1] || '00:00:00';
      const [currentHour, currentMinute] = timePart.split(':').map(Number);
      const [targetHour, targetMinute] = europeMidnight.colombiaTime.split(':').map(Number);
      
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      const targetTimeMinutes = targetHour * 60 + targetMinute;
      
      // Si ya pasó medianoche Europa Central (hora actual >= hora objetivo + margen de seguridad 15 min)
      // Esto asegura que funciona incluso si el cron no se ejecutó
      const hasPassedEarlyFreeze = currentTimeMinutes >= (targetTimeMinutes + 15);
      
      if (hasPassedEarlyFreeze) {
        console.log(`🔒 [PLATFORM-FREEZE-STATUS] Early freeze automático activo para modelo ${modelId.substring(0, 8)}...`);
        console.log(`   Hora Colombia: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
        console.log(`   Medianoche Europa Central (Colombia): ${targetHour}:${String(targetMinute).padStart(2, '0')}`);
        EARLY_FREEZE_PLATFORMS.forEach(platform => {
          allFrozenPlatforms.add(platform.toLowerCase());
        });
      }
    }

    const frozenPlatforms = Array.from(allFrozenPlatforms);

    return NextResponse.json({
      success: true,
      model_id: modelId,
      period_date: periodDate,
      frozen_platforms: frozenPlatforms,
      is_frozen: frozenPlatforms.length > 0,
      auto_detected: frozenPlatforms.length > frozenPlatformsFromDB.length
    });

  } catch (error) {
    console.error('❌ [PLATFORM-FREEZE-STATUS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

