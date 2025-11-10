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
    // Usamos una consulta alternativa más robusta: primero obtenemos los user_ids del grupo,
    // luego obtenemos los usuarios. Esto evita problemas de sincronización con joins complejos.
    
    // Paso 1: Obtener todos los user_ids que pertenecen a este grupo
    const { data: userGroupsData, error: userGroupsError } = await supabase
      .from('user_groups')
      .select('user_id')
      .eq('group_id', groupId);

    if (userGroupsError) {
      console.error('❌ [API] Error obteniendo user_groups:', userGroupsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo relaciones de grupo' },
        { status: 500 }
      );
    }

    // Si no hay usuarios en el grupo, retornar array vacío
    if (!userGroupsData || userGroupsData.length === 0) {
      console.log(`ℹ️ [API] No hay usuarios en el grupo ${groupId}`);
      return NextResponse.json({
        success: true,
        models: []
      });
    }

    const userIds = userGroupsData.map((ug: any) => ug.user_id);
    console.log(`🔍 [API] User IDs encontrados en el grupo ${groupId}:`, userIds.length);

    // Paso 2: Obtener los usuarios que son modelos activos y están en la lista de IDs
    const { data: groupModels, error: modelsError } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active
      `)
      .eq('role', 'modelo')
      .eq('is_active', true)
      .in('id', userIds)
      .order('name', { ascending: true });

    if (modelsError) {
      console.error('❌ [API] Error obteniendo modelos del grupo:', modelsError);
      console.error('❌ [API] Detalles del error:', JSON.stringify(modelsError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Error obteniendo modelos del grupo' },
        { status: 500 }
      );
    }

    const models = groupModels || [];

    console.log(`✅ [API] Modelos encontrados para grupo ${groupId}:`, models?.length || 0);
    if (models.length > 0) {
      console.log(`📋 [API] IDs de modelos encontrados:`, models.map((m: any) => m.id));
    }

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
