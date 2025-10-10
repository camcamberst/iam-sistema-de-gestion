import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Obtener catálogo completo de plataformas disponibles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('include_stats') === 'true';

    let query = supabase
      .from('calculator_platforms')
      .select('id, name')
      .order('name', { ascending: true });

    const { data: platforms, error } = await query;

    if (error) {
      console.error('Error fetching platforms catalog:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!includeStats) {
      return NextResponse.json(platforms || []);
    }

    // Si se solicitan estadísticas, agregar información de uso
    const platformsWithStats = await Promise.all(
      (platforms || []).map(async (platform) => {
        // Contar cuántas modelos tienen esta plataforma
        const { data: stats, error: statsError } = await supabase
          .from('modelo_plataformas')
          .select('status')
          .eq('platform_id', platform.id);

        if (statsError) {
          console.error(`Error fetching stats for platform ${platform.id}:`, statsError);
          return {
            ...platform,
            total_models: 0,
            status_counts: {}
          };
        }

        // Contar por estado
        const statusCounts = (stats || []).reduce((acc: any, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {});

        return {
          ...platform,
          total_models: stats?.length || 0,
          status_counts: statusCounts
        };
      })
    );

    return NextResponse.json(platformsWithStats);
  } catch (error) {
    console.error('Error in GET /api/plataformas-catalogo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Agregar nueva plataforma al catálogo (solo Super Admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, created_by } = body;

    if (!id || !name || !created_by) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: id, name, created_by' },
        { status: 400 }
      );
    }

    // Verificar que el usuario sea super_admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', created_by)
      .single();

    if (userError || !user || user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo Super Admins pueden agregar plataformas' },
        { status: 403 }
      );
    }

    // Agregar la plataforma al catálogo
    const { data, error } = await supabase
      .from('calculator_platforms')
      .insert({
        id: id.toLowerCase(),
        name: name.toUpperCase()
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Duplicate key
        return NextResponse.json(
          { error: 'Ya existe una plataforma con ese ID' },
          { status: 409 }
        );
      }
      console.error('Error creating platform:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Plataforma agregada al catálogo'
    });
  } catch (error) {
    console.error('Error in POST /api/plataformas-catalogo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}