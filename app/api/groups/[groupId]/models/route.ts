import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params;

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: 'ID de grupo requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener modelos del grupo específico
    // Como la columna groups no existe, vamos a obtener todos los modelos activos
    // y por ahora retornar todos (esto se puede refinar después)
    const { data: allModels, error: modelsError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active
      `)
      .eq('role', 'modelo')
      .eq('is_active', true);

    if (modelsError) {
      console.error('Error obteniendo modelos:', modelsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo modelos' },
        { status: 500 }
      );
    }

    // Por ahora, retornar todos los modelos activos
    // TODO: Implementar lógica de grupos cuando la columna groups esté disponible
    const models = allModels || [];

    console.log(`✅ [API] Modelos encontrados para grupo ${groupId}:`, models?.length || 0);

    return NextResponse.json({
      success: true,
      models: models || []
    });

  } catch (error) {
    console.error('Error en GET /api/groups/[groupId]/models:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
