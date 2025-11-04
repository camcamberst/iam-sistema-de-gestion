import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('userRole');
    const userGroups = searchParams.get('userGroups')?.split(',') || [];

    // Crear cliente de Supabase con service role para bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Construir query base
    let query = supabase
      .from('announcements')
      .select(`
        *,
        category:announcement_categories(*),
        author:users(id, name, email),
        group_targets:announcement_group_targets(
          group:groups(id, name)
        )
      `)
      .eq('is_published', true)
      .is('expires_at', null)
      .or('expires_at.gt.' + new Date().toISOString());

    // Si es modelo, filtrar por sus grupos o generales
    if (userRole === 'modelo' && userGroups.length > 0) {
      // Obtener IDs de grupos del usuario
      const { data: userGroupsData } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', userId!);

      const userGroupIds = userGroupsData?.map(ug => ug.group_id) || [];

      // Filtrar: generales O que tengan al menos un grupo objetivo del usuario
      query = query.or(
        `is_general.eq.true,announcement_group_targets.group_id.in.(${userGroupIds.join(',')})`
      );
    }

    // Filtrar por categoría si se especifica
    if (category) {
      query = query.eq('category.slug', category);
    }

    // Ordenar: primero fijados, luego por fecha de publicación
    query = query.order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .order('priority', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('❌ [ANNOUNCEMENTS] Error obteniendo anuncios:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Formatear datos
    const formatted = (data || []).map((announcement: any) => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      excerpt: announcement.excerpt || announcement.title,
      featured_image_url: announcement.featured_image_url,
      image_urls: announcement.image_urls || [],
      category: announcement.category ? {
        id: announcement.category.id,
        name: announcement.category.name,
        slug: announcement.category.slug,
        icon: announcement.category.icon,
        color: announcement.category.color
      } : null,
      author: announcement.author ? {
        id: announcement.author.id,
        name: announcement.author.name,
        email: announcement.author.email
      } : null,
      is_general: announcement.is_general,
      is_pinned: announcement.is_pinned,
      priority: announcement.priority,
      views_count: announcement.views_count,
      published_at: announcement.published_at,
      expires_at: announcement.expires_at,
      created_at: announcement.created_at,
      group_targets: announcement.group_targets?.map((gt: any) => ({
        id: gt.group.id,
        name: gt.group.name
      })) || []
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      count: formatted.length
    });

  } catch (error: any) {
    console.error('❌ [ANNOUNCEMENTS] Error en GET:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      content,
      excerpt,
      category_id,
      featured_image_url,
      image_urls,
      is_general,
      group_ids,
      is_published,
      is_pinned,
      priority,
      expires_at
    } = body;

    // Validar campos requeridos
    if (!title || !content) {
      return NextResponse.json({ error: 'Título y contenido son requeridos' }, { status: 400 });
    }

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Crear cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar que el usuario es admin o super_admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, organization_id')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'No tienes permisos para crear anuncios' }, { status: 403 });
    }

    // Obtener organization_id si no se proporciona
    const organizationId = body.organization_id || userData.organization_id;

    // Crear anuncio
    const { data: announcement, error: insertError } = await supabase
      .from('announcements')
      .insert({
        author_id: user.id,
        category_id: category_id || null,
        title,
        content,
        excerpt: excerpt || title.substring(0, 150),
        featured_image_url: featured_image_url || null,
        image_urls: image_urls || [],
        is_general: is_general || false,
        organization_id: organizationId,
        is_published: is_published || false,
        is_pinned: is_pinned || false,
        priority: priority || 0,
        published_at: is_published ? new Date().toISOString() : null,
        expires_at: expires_at || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [ANNOUNCEMENTS] Error creando anuncio:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Si no es general y hay grupos seleccionados, crear relaciones
    if (!is_general && group_ids && group_ids.length > 0) {
      // Verificar que el admin solo puede asignar a sus grupos
      if (userData.role === 'admin') {
        const { data: userGroups } = await supabase
          .from('user_groups')
          .select('group_id')
          .eq('user_id', user.id);

        const allowedGroupIds = userGroups?.map(ug => ug.group_id) || [];
        const validGroupIds = group_ids.filter((gid: string) => allowedGroupIds.includes(gid));

        if (validGroupIds.length > 0) {
          await supabase
            .from('announcement_group_targets')
            .insert(
              validGroupIds.map((group_id: string) => ({
                announcement_id: announcement.id,
                group_id
              }))
            );
        }
      } else {
        // Super admin puede asignar a cualquier grupo
        await supabase
          .from('announcement_group_targets')
          .insert(
            group_ids.map((group_id: string) => ({
              announcement_id: announcement.id,
              group_id
            }))
          );
      }
    }

    return NextResponse.json({
      success: true,
      data: announcement
    });

  } catch (error: any) {
    console.error('❌ [ANNOUNCEMENTS] Error en POST:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

