import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addAffiliateFilter } from '@/lib/affiliates/filters';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 500 });
    }

    const { userRole, userGroups, userId } = await request.json();

    // Obtener información del usuario para aplicar filtro de afiliado
    let currentUser: { id: string; role: string; affiliate_studio_id: string | null } | null = null;
    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, affiliate_studio_id')
        .eq('id', userId)
        .single();
      
      if (!userError && userData) {
        currentUser = {
          id: userData.id,
          role: userData.role,
          affiliate_studio_id: userData.affiliate_studio_id || null
        };
      }
    }

    // Obtener IDs de modelos permitidos según el rol y filtros
    let allowedModelIds: string[] | null = null;

    // Aplicar filtro de afiliado si es necesario
    if (currentUser) {
      // Si es superadmin_aff o admin de afiliado, filtrar por affiliate_studio_id del modelo
      if (currentUser.role === 'superadmin_aff' || (currentUser.role === 'admin' && currentUser.affiliate_studio_id)) {
        if (currentUser.affiliate_studio_id) {
          // Filtrar por affiliate_studio_id del modelo
          const { data: modelIds, error: modelIdsError } = await supabase
            .from('users')
            .select('id')
            .eq('affiliate_studio_id', currentUser.affiliate_studio_id)
            .eq('role', 'modelo');
          
          if (modelIdsError) {
            console.error('Error al obtener IDs de modelos:', modelIdsError);
            return NextResponse.json({ error: 'Error al filtrar modelos' }, { status: 500 });
          }
          
          allowedModelIds = modelIds?.map((m: any) => m.id) || [];
          if (allowedModelIds.length === 0) {
            return NextResponse.json({ requests: [] });
          }
        } else {
          // Si no tiene affiliate_studio_id, no mostrar nada
          return NextResponse.json({ requests: [] });
        }
      }
    }

    // Filtrar por grupos si es admin (no super_admin ni superadmin_aff)
    if (userRole === 'admin' && userGroups && userGroups.length > 0 && currentUser && currentUser.role === 'admin' && !currentUser.affiliate_studio_id) {
      // Obtener IDs de grupos por nombre
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id')
        .in('name', userGroups);
      
      if (!groupsError && groupsData) {
        const groupIds = groupsData.map((g: any) => g.id);
        if (groupIds.length > 0) {
          // Obtener user_ids que pertenecen a estos grupos
          const { data: userGroupsData, error: userGroupsError } = await supabase
            .from('user_groups')
            .select('user_id')
            .in('group_id', groupIds);
          
          if (!userGroupsError && userGroupsData) {
            allowedModelIds = userGroupsData.map((ug: any) => ug.user_id);
            if (allowedModelIds.length === 0) {
              return NextResponse.json({ requests: [] });
            }
          }
        }
      }
    }

    // Construir query base para solicitudes activas (no cerradas)
    let query = supabase
      .from('modelo_plataformas_detailed')
      .select(`
        id,
        model_id,
        model_email,
        platform_name,
        status,
        requested_at,
        delivered_at,
        confirmed_at,
        deactivated_at,
        reverted_at,
        updated_at,
        notes,
        group_name
      `)
      .in('status', ['solicitada', 'pendiente', 'entregada', 'inviable'])
      .is('closed_at', null) // Solo solicitudes no cerradas
      .not('is_initial_config', 'eq', true) // Excluir configuraciones iniciales automáticas
      .not('requested_at', 'is', null) // Solo registros que fueron realmente solicitados
      .order('requested_at', { ascending: false });

    // Aplicar filtro de modelos permitidos si existe
    if (allowedModelIds && allowedModelIds.length > 0) {
      query = query.in('model_id', allowedModelIds);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Error fetching timeline data:', error);
      return NextResponse.json({ error: 'Error al obtener datos del timeline' }, { status: 500 });
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    console.error('Timeline API error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
