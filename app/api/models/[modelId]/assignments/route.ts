import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    const { modelId } = params;

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'ID de modelo requerido' },
        { status: 400 }
      );
    }

    console.log('🔍 [API] Obteniendo asignaciones para modelo:', modelId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener todas las asignaciones de la modelo usando la vista detallada
    const { data: assignments, error } = await supabase
      .from('room_assignments_detailed')
      .select('*')
      .eq('model_id', modelId)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error obteniendo asignaciones de modelo:', error);
      return NextResponse.json(
        { success: false, error: `Error obteniendo asignaciones: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ [API] Asignaciones encontradas para modelo ${modelId}:`, assignments?.length || 0);

    return NextResponse.json({
      success: true,
      assignments: assignments || []
    });

  } catch (error) {
    console.error('❌ [API] Error general en /api/models/[modelId]/assignments:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}