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
    // El early freeze debe activarse cuando:
    // 1. Es día de cierre (1 o 16) Y ya pasó medianoche Europa Central, O
    // 2. Es día previo al cierre (31 o 15) Y ya pasó medianoche Europa Central
    // IMPORTANTE: Solo si el período NO ha sido cerrado aún
    // Esto NO depende de que el cron se haya ejecutado - es automático basado en hora/fecha
    const isClosure = isClosureDay();
    const colombiaDate = getColombiaDate();
    const day = parseInt(colombiaDate.split('-')[2]);
    
    // Verificar si es día previo al cierre (31 o 15)
    const isDayBeforeClosure = day === 31 || day === 15;
    
    // 🔍 VERIFICAR SI EL PERÍODO ACTUAL YA FUE CERRADO
    // Si el período ya fue cerrado, NO aplicar early freeze (período nuevo inició)
    let periodAlreadyClosed = false;
    if (isClosure || isDayBeforeClosure) {
      // Determinar el período actual basado en la fecha
      // Si estamos en día 1-15, el período actual es 1-15 (fecha: día 1 del mes)
      // Si estamos en día 16-31, el período actual es 16-31 (fecha: día 16 del mes)
      const [year, month] = colombiaDate.split('-');
      const currentPeriodType = day <= 15 ? '1-15' : '16-31';
      const currentPeriodDate = day <= 15 
        ? `${year}-${month}-01`
        : `${year}-${month}-16`;
      
      const { data: closureStatus } = await supabase
        .from('calculator_period_closure_status')
        .select('status')
        .eq('period_date', currentPeriodDate)
        .eq('period_type', currentPeriodType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      periodAlreadyClosed = closureStatus?.status === 'completed';
      
      if (periodAlreadyClosed) {
        console.log(`✅ [PLATFORM-FREEZE-STATUS] Período ${currentPeriodType} (${currentPeriodDate}) ya fue cerrado. No aplicar early freeze.`);
      } else {
        console.log(`📅 [PLATFORM-FREEZE-STATUS] Período ${currentPeriodType} (${currentPeriodDate}) aún no ha sido cerrado. Early freeze puede aplicarse.`);
      }
    }
    
    console.log(`🔍 [PLATFORM-FREEZE-STATUS] Verificando early freeze:`, {
      modelId: modelId.substring(0, 8),
      periodDate,
      colombiaDate,
      day,
      isClosureDay: isClosure,
      isDayBeforeClosure,
      periodAlreadyClosed
    });
    
    // Verificar early freeze si es día de cierre O día previo al cierre
    // PERO solo si el período NO ha sido cerrado aún
    if ((isClosure || isDayBeforeClosure) && !periodAlreadyClosed) {
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
      
      console.log(`🔍 [PLATFORM-FREEZE-STATUS] Cálculo de hora:`, {
        currentTimeColombia: `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`,
        currentTimeMinutes,
        targetTimeColombia: `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`,
        targetTimeMinutes,
        margin: 15,
        hasPassedEarlyFreeze,
        europeMidnightDate: europeMidnight.europeDate,
        europeMidnightColombiaTime: europeMidnight.colombiaTime
      });
      
      if (hasPassedEarlyFreeze) {
        console.log(`🔒 [PLATFORM-FREEZE-STATUS] Early freeze automático activo para modelo ${modelId.substring(0, 8)}...`);
        console.log(`   Hora Colombia: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);
        console.log(`   Medianoche Europa Central (Colombia): ${targetHour}:${String(targetMinute).padStart(2, '0')}`);
        console.log(`   Agregando ${EARLY_FREEZE_PLATFORMS.length} plataformas:`, EARLY_FREEZE_PLATFORMS);
        EARLY_FREEZE_PLATFORMS.forEach(platform => {
          allFrozenPlatforms.add(platform.toLowerCase());
        });
      } else {
        console.log(`⏳ [PLATFORM-FREEZE-STATUS] Aún no es hora de early freeze`);
        console.log(`   Falta ${(targetTimeMinutes + 15) - currentTimeMinutes} minutos`);
      }

      // 🔒 DX LIVE: Congelación especial a las 10:00 AM Colombia (en días de cierre de período)
      // DX Live sigue la misma lógica de cierre de período pero a las 10:00 AM Colombia
      const dxLiveFreezeHour = 10; // 10:00 AM Colombia
      const dxLiveFreezeMinutes = dxLiveFreezeHour * 60;
      const hasPassedDxLiveFreeze = currentTimeMinutes >= (dxLiveFreezeMinutes + 5); // +5 minutos de margen
      
      if (hasPassedDxLiveFreeze) {
        console.log(`🔒 [PLATFORM-FREEZE-STATUS] DX Live congelado (10:00 AM Colombia)`);
        allFrozenPlatforms.add('dxlive');
      } else {
        console.log(`⏳ [PLATFORM-FREEZE-STATUS] DX Live aún no está congelado (antes de 10:00 AM Colombia)`);
        console.log(`   Falta ${(dxLiveFreezeMinutes + 5) - currentTimeMinutes} minutos`);
      }
    } else {
      console.log(`📅 [PLATFORM-FREEZE-STATUS] No es día de cierre (días 1, 15, 16 o 31)`);
    }

    const frozenPlatforms = Array.from(allFrozenPlatforms);

    console.log(`✅ [PLATFORM-FREEZE-STATUS] Respuesta final:`, {
      modelId: modelId.substring(0, 8),
      frozenPlatformsCount: frozenPlatforms.length,
      frozenPlatforms,
      fromDB: frozenPlatformsFromDB.length,
      autoDetected: frozenPlatforms.length > frozenPlatformsFromDB.length
    });

    return NextResponse.json({
      success: true,
      model_id: modelId,
      period_date: periodDate,
      frozen_platforms: frozenPlatforms,
      is_frozen: frozenPlatforms.length > 0,
      auto_detected: frozenPlatforms.length > frozenPlatformsFromDB.length,
      // 🔍 DEBUG: Información adicional para diagnóstico
      debug: {
        isClosureDay: isClosure,
        colombiaDate,
        colombiaDay: day,
        frozenFromDB: frozenPlatformsFromDB.length,
        frozenAuto: frozenPlatforms.length - frozenPlatformsFromDB.length
      }
    });

  } catch (error) {
    console.error('❌ [PLATFORM-FREEZE-STATUS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

