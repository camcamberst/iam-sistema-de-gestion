import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Confirmar recepción de plataforma entregada
export async function POST(request: NextRequest) {
  try {
    const { platformId, modelId } = await request.json();

    if (!platformId || !modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'platformId y modelId son requeridos' 
      }, { status: 400 });
    }

    // Verificar que la plataforma existe y está en estado 'entregada'
    const { data: platform, error: platformError } = await supabase
      .from('modelo_plataformas')
      .select('*')
      .eq('model_id', modelId)
      .eq('platform_id', platformId)
      .single();

    if (platformError || !platform) {
      return NextResponse.json({ 
        success: false, 
        error: 'Plataforma no encontrada' 
      }, { status: 404 });
    }

    if (platform.status !== 'entregada') {
      return NextResponse.json({ 
        success: false, 
        error: 'Solo se pueden confirmar plataformas en estado entregada' 
      }, { status: 400 });
    }

    // Actualizar a estado 'confirmada'
    const { data: updatedPlatform, error: updateError } = await supabase
      .from('modelo_plataformas')
      .update({
        status: 'confirmada',
        confirmed_at: new Date().toISOString(),
        confirmed_by: modelId,
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId)
      .eq('platform_id', platformId)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando plataforma:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al confirmar la plataforma' 
      }, { status: 500 });
    }

    // Notificar a admins via chatbot (opcional)
    try {
      await fetch('/api/chat/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'platform_confirmed',
          modelId: modelId,
          platformId: platformId,
          message: `Modelo confirmó recepción de plataforma ${platform.platform_name}`
        })
      });
    } catch (notificationError) {
      console.warn('Error enviando notificación:', notificationError);
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedPlatform,
      message: 'Plataforma confirmada correctamente'
    });

  } catch (error: any) {
    console.error('Error en confirmación de plataforma:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
