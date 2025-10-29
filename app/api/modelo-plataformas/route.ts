import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// GET - Obtener plataformas de modelos con filtros
export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno durante el build
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('model_id');
    const groupId = searchParams.get('group_id');
    const roomId = searchParams.get('room_id');
    const jornada = searchParams.get('jornada');
    const platformId = searchParams.get('platform_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('modelo_plataformas_detailed')
      .select('*');

    // Aplicar filtros
    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    if (platformId) {
      query = query.eq('platform_id', platformId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Si se especifica room o jornada, necesitamos filtrar por modelos asignadas
    if (roomId || jornada) {
      const { data: assignments } = await supabase
        .from('room_assignments_detailed')
        .select('model_id')
        .eq(roomId ? 'room_id' : 'id', roomId || '')
        .eq(jornada ? 'jornada' : 'id', jornada || '');

      if (assignments && assignments.length > 0) {
        const modelIds = assignments.map(a => a.model_id);
        query = query.in('model_id', modelIds);
      }
    }

    // Forzar filtro por rol 'modelo' en servidor usando join implícito del view
    if (!modelId) {
      // Cuando no pedimos un modelo específico, filtramos por ids de usuarios con rol 'modelo'
      const { data: idsRes } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'modelo');
      const ids = (idsRes || []).map((r: any) => r.id);
      if (ids.length > 0) {
        query = query.in('model_id', ids);
      } else {
        return NextResponse.json([]);
      }
    }

    const { data, error } = await query.order('model_name', { ascending: true });

    if (error) {
      console.error('Error fetching modelo plataformas:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in GET /api/modelo-plataformas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Cambiar estado de plataforma
export async function POST(request: NextRequest) {
  try {
    // Verificar variables de entorno durante el build
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 503 });
    }
    const body = await request.json();
    const { model_id, platform_id, new_status, changed_by, reason, notes } = body;

    if (!model_id || !platform_id || !new_status || !changed_by) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: model_id, platform_id, new_status, changed_by' },
        { status: 400 }
      );
    }

    // Validar estado
    const validStatuses = ['disponible', 'solicitada', 'pendiente', 'entregada', 'desactivada', 'inviable'];
    if (!validStatuses.includes(new_status)) {
      return NextResponse.json(
        { error: 'Estado inválido' },
        { status: 400 }
      );
    }

    // Normalizar platform_id contra catálogo para evitar desajustes
    const normalizePlatformId = async (incomingId: string): Promise<string> => {
      let { data: byId } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .eq('id', incomingId)
        .maybeSingle();
      if (byId) return byId.id;
      let { data: byIlike } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .ilike('id', incomingId)
        .maybeSingle();
      if (byIlike) return byIlike.id;
      let { data: byName } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .eq('name', incomingId)
        .maybeSingle();
      if (byName) return byName.id;
      const compact = incomingId.replace(/\s+/g, '');
      let { data: byCompact } = await supabase
        .from('calculator_platforms')
        .select('id, name')
        .ilike('name', `%${compact}%`)
        .maybeSingle();
      if (byCompact) return byCompact.id;
      return incomingId;
    };

    const normalizedId = await normalizePlatformId(platform_id);

    // Usar la función SQL para cambiar el estado
    const { data, error } = await supabase.rpc('change_platform_status', {
      p_model_id: model_id,
      p_platform_id: normalizedId,
      p_new_status: new_status,
      p_changed_by: changed_by,
      p_reason: reason || notes || null
    });

    if (error) {
      console.error('Error changing platform status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sincronización con calculator_config según estado
    const nowIso = new Date().toISOString();
    if (new_status === 'disponible') {
      // Quitar de enabled_platforms y limpiar flags en modelo_plataformas
      const { data: cfg } = await supabase
        .from('calculator_config')
        .select('id, enabled_platforms')
        .eq('model_id', model_id)
        .eq('active', true)
        .maybeSingle();
      if (cfg && Array.isArray(cfg.enabled_platforms)) {
        const filtered = cfg.enabled_platforms.filter((p: string) => p !== normalizedId);
        await supabase
          .from('calculator_config')
          .update({ enabled_platforms: filtered, updated_at: nowIso })
          .eq('id', cfg.id);
      }
      // limpiar flags
      await supabase
        .from('modelo_plataformas')
        .update({ calculator_sync: false, calculator_activated_at: null })
        .eq('model_id', model_id)
        .eq('platform_id', normalizedId);
    } else if (new_status === 'confirmada') {
      // asegurar inclusión en enabled_platforms
      const { data: existingConfig, error: configError } = await supabase
        .from('calculator_config')
        .select('id, enabled_platforms')
        .eq('model_id', model_id)
        .eq('active', true)
        .maybeSingle();
      if (!configError) {
        if (existingConfig) {
          const enabled: string[] = Array.isArray(existingConfig.enabled_platforms)
            ? existingConfig.enabled_platforms
            : [];
          if (!enabled.includes(normalizedId)) {
            const newEnabled = [...enabled, normalizedId];
            await supabase
              .from('calculator_config')
              .update({ enabled_platforms: newEnabled, updated_at: nowIso })
              .eq('id', existingConfig.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `Estado cambiado a ${new_status}` });
  } catch (error) {
    console.error('Error in POST /api/modelo-plataformas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT - Actualizar información de plataforma
export async function PUT(request: NextRequest) {
  try {
    // Verificar variables de entorno durante el build
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 503 });
    }
    const body = await request.json();
    const { id, notes, revert_reason } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de plataforma requerido' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;
    if (revert_reason !== undefined) updateData.revert_reason = revert_reason;

    const { data, error } = await supabase
      .from('modelo_plataformas')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating modelo plataforma:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: data?.[0] 
    });
  } catch (error) {
    console.error('Error in PUT /api/modelo-plataformas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE - Eliminar registro de plataforma (solo para casos especiales)
export async function DELETE(request: NextRequest) {
  try {
    // Verificar variables de entorno durante el build
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de plataforma requerido' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('modelo_plataformas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting modelo plataforma:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Plataforma eliminada' 
    });
  } catch (error) {
    console.error('Error in DELETE /api/modelo-plataformas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}