import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener modelos disponibles para configurar (según jerarquía del admin)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ success: false, error: 'adminId es requerido' }, { status: 400 });
  }

  try {
    // Obtener información del admin (simplificado)
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError) {
      console.error('Error al obtener admin:', adminError);
      return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
    }

    // Obtener todas las modelos (simplificado para testing)
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        calculator_config:calculator_config!calculator_config_model_id_fkey(
          id,
          active,
          enabled_platforms,
          percentage_override,
          min_quota_override,
          group_percentage,
          group_min_quota,
          created_at
        )
      `)
      .eq('role', 'modelo');

    if (modelsError) {
      console.error('Error al obtener modelos:', modelsError);
      return NextResponse.json({ success: false, error: modelsError.message }, { status: 500 });
    }

    // Procesar datos para incluir configuración actual
    const processedModels = models?.map(model => ({
      id: model.id,
      email: model.email,
      name: model.name,
      role: model.role,
      groups: [{ id: 'default', name: 'Grupo por defecto' }], // Mock para testing
      hasConfig: model.calculator_config && model.calculator_config.length > 0,
      currentConfig: model.calculator_config?.[0] || null
    })) || [];

    return NextResponse.json({
      success: true,
      data: processedModels
    });

  } catch (error: any) {
    console.error('Error en /api/calculator/models:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
