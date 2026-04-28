import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

// GET /api/rates/[id] - Obtener tasa específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: rate, error } = await supabase
      .from('rates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error al obtener tasa:', error);
      return NextResponse.json(
        { success: false, error: 'Tasa no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rate
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al obtener tasa' },
      { status: 500 }
    );
  }
}

// PATCH /api/rates/[id] - Actualizar tasa
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { value, author_id } = body;

    if (!value || !author_id) {
      return NextResponse.json(
        { success: false, error: 'value y author_id son requeridos' },
        { status: 400 }
      );
    }

    // Desactivar tasa anterior
    await supabase
      .from('rates')
      .update({ valid_to: new Date().toISOString() })
      .eq('id', params.id);

    // Crear nueva tasa
    const { data, error } = await supabase
      .from('rates')
      .insert({
        kind: body.kind,
        value: parseFloat(value),
        scope: body.scope || 'global',
        scope_id: body.scope_id || null,
        author_id: author_id,
        valid_from: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar tasa:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Tasa actualizada exitosamente'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al actualizar tasa' },
      { status: 500 }
    );
  }
}

// DELETE /api/rates/[id] - Eliminar tasa (marcar como inactiva)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('rates')
      .update({ 
        valid_to: new Date().toISOString(),
        active: false 
      })
      .eq('id', params.id);

    if (error) {
      console.error('Error al eliminar tasa:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tasa eliminada exitosamente'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al eliminar tasa' },
      { status: 500 }
    );
  }
}
