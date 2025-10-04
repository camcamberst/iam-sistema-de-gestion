import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar service role key para bypass RLS
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

// Valores a restaurar basados en los datos que obtuvimos anteriormente
const valuesToRestore = [
  // Modelo: fe54995d-1828-4721-8153-53fce6f4fe56 (Melanié)
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "777", value: "0.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "babestation", value: "135.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "big7", value: "0.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "camcontacts", value: "0.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "camlust", value: "0.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "dirtyfans", value: "76.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "livecreator", value: "5.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "mdh", value: "4.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "modelka", value: "3.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "mondo", value: "0.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "skypvt", value: "20.00", period_date: "2025-10-04" },
  { model_id: "fe54995d-1828-4721-8153-53fce6f4fe56", platform_id: "vx", value: "0.00", period_date: "2025-10-04" },

  // Modelo: 9c146218-1d30-4b83-a3a6-ff894d3b7f8d (lillysky)
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "777", value: "6.16", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "camcontacts", value: "15.10", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "dirtyfans", value: "68.00", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "dxlive", value: "11.00", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "livecreator", value: "61.28", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "mdh", value: "29.00", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "modelka", value: "300.00", period_date: "2025-10-04" },
  { model_id: "9c146218-1d30-4b83-a3a6-ff894d3b7f8d", platform_id: "vx", value: "13.00", period_date: "2025-10-04" },

  // Modelo: c8a156fb-1a56-4160-a63d-679c36bda1e7 (Elizabeth)
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "777", value: "10.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "babestation", value: "40.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "big7", value: "670.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "dxlive", value: "640.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "livecreator", value: "343.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "modelka", value: "343.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "myfreecams", value: "656.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "secretfriends", value: "0.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "skypvt", value: "0.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "stripchat", value: "0.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "superfoon", value: "0.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "vx", value: "0.00", period_date: "2025-10-04" },
  { model_id: "c8a156fb-1a56-4160-a63d-679c36bda1e7", platform_id: "xmodels", value: "0.00", period_date: "2025-10-04" }
];

// POST: Restaurar valores manualmente
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [RESTORE-MANUAL] Iniciando restauración manual de valores...');
    
    // 1. Eliminar valores existentes para el período 2025-10-04
    console.log('🔄 [RESTORE-MANUAL] Eliminando valores existentes...');
    const { error: deleteError } = await supabase
      .from('model_values')
      .delete()
      .eq('period_date', '2025-10-04');
    
    if (deleteError) {
      console.error('❌ [RESTORE-MANUAL] Error eliminando valores existentes:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error eliminando valores existentes' 
      }, { status: 500 });
    }
    
    console.log('✅ [RESTORE-MANUAL] Valores existentes eliminados');
    
    // 2. Insertar valores restaurados
    console.log('🔄 [RESTORE-MANUAL] Insertando valores restaurados...');
    const { data: restoredValues, error: insertError } = await supabase
      .from('model_values')
      .insert(valuesToRestore)
      .select();
    
    if (insertError) {
      console.error('❌ [RESTORE-MANUAL] Error insertando valores:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error insertando valores' 
      }, { status: 500 });
    }
    
    console.log('✅ [RESTORE-MANUAL] Valores restaurados exitosamente:', restoredValues?.length || 0);
    
    return NextResponse.json({
      success: true,
      message: 'Valores restaurados exitosamente',
      restored_count: restoredValues?.length || 0,
      total_values: valuesToRestore.length,
      values: restoredValues
    });
    
  } catch (error) {
    console.error('❌ [RESTORE-MANUAL] Error en restauración manual:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// GET: Verificar valores restaurados
export async function GET(request: NextRequest) {
  try {
    const { data: currentValues, error: valuesError } = await supabase
      .from('model_values')
      .select('*')
      .eq('period_date', '2025-10-04');
    
    if (valuesError) {
      console.error('❌ [RESTORE-MANUAL] Error obteniendo valores:', valuesError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obteniendo valores' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      current_count: currentValues?.length || 0,
      values: currentValues || []
    });
    
  } catch (error) {
    console.error('❌ [RESTORE-MANUAL] Error verificando valores:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
