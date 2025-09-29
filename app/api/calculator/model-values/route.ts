import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET /api/calculator/model-values - Obtener valores de una modelo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: 'modelId es requerido' },
        { status: 400 }
      );
    }

    // Obtener valores de la modelo
    const { data: values, error } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('active', true);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: values || []
    });

  } catch (error: any) {
    console.error('Error fetching model values:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/calculator/model-values - Guardar valores de una modelo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, values, periodId } = body;

    if (!modelId || !values) {
      return NextResponse.json(
        { success: false, error: 'modelId y values son requeridos' },
        { status: 400 }
      );
    }

    // Desactivar valores anteriores
    await supabase
      .from('model_values')
      .update({ active: false })
      .eq('model_id', modelId);

    // Insertar nuevos valores
    const valuesToInsert = Object.entries(values).map(([platform, value]) => ({
      model_id: modelId,
      platform,
      value: parseFloat(value as string) || 0,
      period_id: periodId || null,
      active: true,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('model_values')
      .insert(valuesToInsert)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Valores guardados correctamente'
    });

  } catch (error: any) {
    console.error('Error saving model values:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
