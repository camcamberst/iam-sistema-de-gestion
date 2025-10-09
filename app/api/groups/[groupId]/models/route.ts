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

    // Obtener solo las modelos que pertenecen a este grupo/sede
    const { data: groupModels, error: modelsError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        user_groups!inner(
          group_id
        )
      `)
      .eq('role', 'modelo')
      .eq('is_active', true)
      .eq('user_groups.group_id', groupId)
      .order('name', { ascending: true });

    if (modelsError) {
      console.error('Error obteniendo modelos del grupo:', modelsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo modelos del grupo' },
        { status: 500 }
      );
    }

    const models = groupModels || [];

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
