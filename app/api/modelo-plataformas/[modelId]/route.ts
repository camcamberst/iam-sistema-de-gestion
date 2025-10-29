import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// GET - Obtener todas las plataformas de una modelo específica
export async function GET(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    // Verificar variables de entorno durante el build
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 503 });
    }
    const { modelId } = params;

    if (!modelId) {
      return NextResponse.json(
        { error: 'ID de modelo requerido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario es role 'modelo'
    const { data: userRoleCheck, error: roleErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', modelId)
      .single();

    if (roleErr || !userRoleCheck || userRoleCheck.role !== 'modelo') {
      return NextResponse.json([]);
    }

    // Obtener plataformas existentes de la modelo
    const { data: existingPlatforms, error: existingError } = await supabase
      .from('modelo_plataformas_detailed')
      .select('*')
      .eq('model_id', modelId)
      .order('platform_name', { ascending: true });

    if (existingError) {
      console.error('Error fetching existing platforms:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    // Obtener todas las plataformas del catálogo
    const { data: allPlatforms, error: catalogError } = await supabase
      .from('calculator_platforms')
      .select('id, name')
      .order('name', { ascending: true });

    if (catalogError) {
      console.error('Error fetching catalog platforms:', catalogError);
      return NextResponse.json({ error: catalogError.message }, { status: 500 });
    }

    // Crear mapa de plataformas existentes
    const existingMap = new Map(
      existingPlatforms?.map(p => [p.platform_id, p]) || []
    );

    // Combinar con plataformas del catálogo (agregar las que faltan como 'disponible')
    const completePlatforms = allPlatforms?.map(platform => {
      const existing = existingMap.get(platform.id);
      if (existing) {
        return existing;
      } else {
        // Plataforma disponible pero no asignada
        return {
          id: null,
          model_id: modelId,
          platform_id: platform.id,
          platform_name: platform.name,
          platform_code: platform.id,
          status: 'disponible',
          requested_at: null,
          delivered_at: null,
          confirmed_at: null,
          deactivated_at: null,
          reverted_at: null,
          requested_by_name: null,
          delivered_by_name: null,
          confirmed_by_name: null,
          deactivated_by_name: null,
          reverted_by_name: null,
          notes: null,
          revert_reason: null,
          is_initial_config: false,
          calculator_sync: false,
          calculator_activated_at: null,
          created_at: null,
          updated_at: null
        };
      }
    }) || [];

    return NextResponse.json(completePlatforms);
  } catch (error) {
    console.error('Error in GET /api/modelo-plataformas/[modelId]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT - Actualizar múltiples plataformas de una modelo
export async function PUT(
  request: NextRequest,
  { params }: { params: { modelId: string } }
) {
  try {
    // Verificar variables de entorno durante el build
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 503 });
    }
    const { modelId } = params;
    const body = await request.json();
    const { platforms, changed_by } = body;

    if (!modelId || !platforms || !Array.isArray(platforms) || !changed_by) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: modelId, platforms (array), changed_by' },
        { status: 400 }
      );
    }

    const results: Array<{ platform_id: string; status: string; success: boolean }> = [];
    const errors: string[] = [];

    // Procesar cada plataforma
    for (const platform of platforms) {
      const { platform_id, new_status, reason } = platform;

      if (!platform_id || !new_status) {
        errors.push(`Plataforma ${platform_id}: faltan campos requeridos`);
        continue;
      }

      try {
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

        const { data, error } = await supabase.rpc('change_platform_status', {
          p_model_id: modelId,
          p_platform_id: normalizedId,
          p_new_status: new_status,
          p_changed_by: changed_by,
          p_reason: reason || null
        });

        if (error) {
          errors.push(`Plataforma ${platform_id}: ${error.message}`);
        } else {
          results.push({
            platform_id: normalizedId,
            status: new_status,
            success: true
          });

          // Si se marcó como confirmada, activar automáticamente en calculator_config
          if (new_status === 'confirmada') {
            try {
              const nowIso = new Date().toISOString();
              // Obtener config activa existente
              const { data: existingConfig, error: configError } = await supabase
                .from('calculator_config')
                .select('id, enabled_platforms')
                .eq('model_id', modelId)
                .eq('active', true)
                .maybeSingle();

              if (configError && configError.code !== 'PGRST116') {
                console.warn('[modelo-plataformas][PUT] Error leyendo calculator_config:', configError.message);
              }

              if (existingConfig) {
                const enabled: string[] = Array.isArray(existingConfig.enabled_platforms)
                  ? existingConfig.enabled_platforms
                  : [];
                if (!enabled.includes(normalizedId)) {
                  const newEnabled = [...enabled, normalizedId];
                  const { error: updateConfigError } = await supabase
                    .from('calculator_config')
                    .update({ enabled_platforms: newEnabled, updated_at: nowIso })
                    .eq('id', existingConfig.id);
                  if (updateConfigError) {
                    console.warn('[modelo-plataformas][PUT] No se pudo actualizar enabled_platforms:', updateConfigError.message);
                  }
                }
              } else {
                // Crear configuración mínima
                const { error: insertConfigError } = await supabase
                  .from('calculator_config')
                  .insert({
                    model_id: modelId,
                    active: true,
                    enabled_platforms: [normalizedId],
                    created_at: nowIso,
                    updated_at: nowIso
                  });
                if (insertConfigError) {
                  console.warn('[modelo-plataformas][PUT] No se pudo crear calculator_config:', insertConfigError.message);
                }
              }
            } catch (syncErr: any) {
              console.warn('[modelo-plataformas][PUT] Error sincronizando calculadora:', syncErr?.message || syncErr);
            }
          }
        }
      } catch (err) {
        errors.push(`Plataforma ${platform_id}: Error inesperado`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors,
      message: `Procesadas ${results.length} plataformas${errors.length > 0 ? ` con ${errors.length} errores` : ''}`
    });
  } catch (error) {
    console.error('Error in PUT /api/modelo-plataformas/[modelId]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}