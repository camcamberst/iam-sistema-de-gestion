import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 [DEBUG] Verificando datos de modelos...');

    // 1. Obtener todos los modelos activos
    const { data: allModels, error: modelsError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        organization_id,
        created_at
      `)
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('Error obteniendo modelos:', modelsError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error obteniendo modelos',
          details: modelsError 
        },
        { status: 500 }
      );
    }

    // 2. Obtener información de asignaciones existentes
    const { data: assignments, error: assignmentsError } = await supabase
      .from('modelo_assignments')
      .select(`
        model_id,
        group_id,
        room_id,
        jornada,
        is_active
      `)
      .eq('is_active', true);

    // 3. Obtener información de rooms y grupos
    const { data: rooms, error: roomsError } = await supabase
      .from('group_rooms')
      .select(`
        id,
        room_name,
        group_id,
        groups!inner(
          id,
          name
        )
      `);

    return NextResponse.json({
      success: true,
      data: {
        totalModels: allModels?.length || 0,
        models: allModels || [],
        totalAssignments: assignments?.length || 0,
        assignments: assignments || [],
        totalRooms: rooms?.length || 0,
        rooms: rooms || [],
        errors: {
          modelsError,
          assignmentsError,
          roomsError
        }
      }
    });

  } catch (error) {
    console.error('Error en check-models-data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error 
      },
      { status: 500 }
    );
  }
}
