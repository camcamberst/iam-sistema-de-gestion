import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener todos los usuarios modelo activos
    const { data: allModels, error: modelsError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        groups
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

    console.log('🔍 [DEBUG] Todos los modelos:', allModels);

    // Verificar estructura de groups
    const modelsWithGroups = allModels?.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      groups: user.groups,
      groupsType: typeof user.groups,
      groupsIsArray: Array.isArray(user.groups)
    })) || [];

    return NextResponse.json({
      success: true,
      totalModels: allModels?.length || 0,
      models: modelsWithGroups,
      sampleUser: allModels?.[0] || null
    });

  } catch (error) {
    console.error('Error en debug test-models:', error);
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
