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

    // 0) Normalizar platformId contra el catálogo para evitar desajustes (espacios/mayúsculas)
    const normalizePlatformId = async (incomingId: string): Promise<string> => {
      // Intento directo por id exacto
      let { data: byId } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .eq('id', incomingId)
        .maybeSingle();
      if (byId) return byId.id;

      // Intento por id case-insensitive
      let { data: byIlike } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .ilike('id', incomingId)
        .maybeSingle();
      if (byIlike) return byIlike.id;

      // Intento por name exacto
      let { data: byName } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .eq('name', incomingId)
        .maybeSingle();
      if (byName) return byName.id;

      // Intento por name sin espacios / case-insensitive
      const compact = incomingId.replace(/\s+/g, '');
      let { data: byCompact } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .ilike('name', `%${compact}%`)
        .maybeSingle();
      if (byCompact) return byCompact.id;

      // fallback a incomingId
      return incomingId;
    };

    const normalizedPlatformId = await normalizePlatformId(platformId);

    // Verificar que la plataforma existe y está en estado 'entregada'
    const { data: platform, error: platformError } = await supabase
      .from('modelo_plataformas')
      .select('*')
      .eq('model_id', modelId)
      .eq('platform_id', normalizedPlatformId)
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

    // Actualizar a estado 'confirmada' y activar en calculadora
    const nowIso = new Date().toISOString();
    const { data: updatedPlatform, error: updateError } = await supabase
      .from('modelo_plataformas')
      .update({
        status: 'confirmada',
        confirmed_at: nowIso,
        confirmed_by: modelId,
        calculator_sync: true,
        calculator_activated_at: nowIso,
        updated_at: nowIso
      })
      .eq('model_id', modelId)
      .eq('platform_id', normalizedPlatformId)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando plataforma:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al confirmar la plataforma' 
      }, { status: 500 });
    }

    // Asegurar que la plataforma quede habilitada en calculator_config
    try {
      // 1) Intentar obtener configuración activa
      const { data: existingConfig, error: configError } = await supabase
        .from('calculator_config')
        .select('*')
        .eq('model_id', modelId)
        .eq('active', true)
        .single();

      if (configError && configError.code !== 'PGRST116') {
        console.warn('⚠️ [CONFIRM] Error obteniendo config calculadora:', configError.message);
      }

      if (existingConfig) {
        const enabled: string[] = Array.isArray(existingConfig.enabled_platforms)
          ? existingConfig.enabled_platforms
          : [];
        if (!enabled.includes(normalizedPlatformId)) {
          const newEnabled = [...enabled, normalizedPlatformId];
          const { error: updateConfigError } = await supabase
            .from('calculator_config')
            .update({ enabled_platforms: newEnabled, updated_at: nowIso })
            .eq('id', existingConfig.id);
          if (updateConfigError) {
            console.warn('⚠️ [CONFIRM] No se pudo actualizar enabled_platforms:', updateConfigError.message);
          }
        }
      } else {
        // 2) Crear config mínima si no existe
        const { error: insertConfigError } = await supabase
          .from('calculator_config')
          .insert({
            model_id: modelId,
            active: true,
            enabled_platforms: [normalizedPlatformId],
            created_at: nowIso,
            updated_at: nowIso
          });
        if (insertConfigError) {
          console.warn('⚠️ [CONFIRM] No se pudo crear calculator_config:', insertConfigError.message);
        }
      }
    } catch (syncError: any) {
      console.warn('⚠️ [CONFIRM] Error sincronizando calculadora:', syncError?.message || syncError);
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
