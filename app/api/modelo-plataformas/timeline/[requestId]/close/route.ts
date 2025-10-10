import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 500 });
    }

    const { requestId } = params;

    // Verificar que la solicitud existe y está en estado final
    const { data: existingRequest, error: fetchError } = await supabase
      .from('modelo_plataformas')
      .select('status')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Solo permitir cerrar si está en estado final
    if (!['entregada', 'inviable'].includes(existingRequest.status)) {
      return NextResponse.json({ 
        error: 'Solo se pueden cerrar solicitudes en estado final (entregada o inviable)' 
      }, { status: 400 });
    }

    // Marcar como cerrada
    const { error: updateError } = await supabase
      .from('modelo_plataformas')
      .update({ 
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error closing request:', updateError);
      return NextResponse.json({ error: 'Error al cerrar solicitud' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Solicitud cerrada exitosamente' });
  } catch (error) {
    console.error('Close request API error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
