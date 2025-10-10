import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuración de base de datos no disponible' }, { status: 500 });
    }

    const { userRole, userGroups } = await request.json();

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
        reverted_at,
        notes,
        group_name
      `)
      .in('status', ['solicitada', 'pendiente', 'entregada', 'inviable'])
      .is('closed_at', null) // Solo solicitudes no cerradas
      .not('is_initial_config', true) // Excluir configuraciones iniciales automáticas
      .not('requested_at', 'is', null) // Solo registros que fueron realmente solicitados
      .order('requested_at', { ascending: false });

    // Filtrar por grupos si es admin (no super_admin)
    if (userRole === 'admin' && userGroups && userGroups.length > 0) {
      query = query.in('group_name', userGroups);
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
