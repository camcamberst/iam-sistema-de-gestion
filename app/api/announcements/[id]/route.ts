import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Crear cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener anuncio con relaciones
    const { data: announcement, error } = await supabase
      .from('announcements')
      .select(`
        *,
        category:announcement_categories(*),
        author:users(id, name, email),
        group_targets:announcement_group_targets(
          group:groups(id, name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ [ANNOUNCEMENTS] Error obteniendo anuncio:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!announcement) {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });
    }

    // Formatear respuesta
    const formatted = {
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
      updated_at: announcement.updated_at,
      group_targets: announcement.group_targets?.map((gt: any) => ({
        id: gt.group.id,
        name: gt.group.name
      })) || []
    };

    // Registrar visualización si el usuario está autenticado
    const authHeader = request.headers.get('authorization');
    if (authHeader && announcement.is_published) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        await supabase
          .from('announcement_views')
          .upsert({
            announcement_id: id,
            user_id: user.id,
            viewed_at: new Date().toISOString()
          }, {
            onConflict: 'announcement_id,user_id'
          });

        // Incrementar contador de visualizaciones
        await supabase
          .from('announcements')
          .update({ views_count: (announcement.views_count || 0) + 1 })
          .eq('id', id);
      }
    }

    return NextResponse.json({
      success: true,
      data: formatted
    });

  } catch (error: any) {
    console.error('❌ [ANNOUNCEMENTS] Error en GET [id]:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Crear cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Verificar permisos
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'No tienes permisos para editar anuncios' }, { status: 403 });
    }

    // Verificar que el anuncio existe y el usuario puede editarlo
    const { data: existingAnnouncement } = await supabase
      .from('announcements')
      .select('author_id, organization_id')
      .eq('id', id)
      .single();

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });
    }

    // Solo el autor o super_admin puede editar
    if (existingAnnouncement.author_id !== user.id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'No tienes permisos para editar este anuncio' }, { status: 403 });
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
    if (body.category_id !== undefined) updateData.category_id = body.category_id;
    if (body.featured_image_url !== undefined) updateData.featured_image_url = body.featured_image_url;
    if (body.image_urls !== undefined) updateData.image_urls = body.image_urls;
    if (body.is_general !== undefined) updateData.is_general = body.is_general;
    if (body.is_published !== undefined) {
      updateData.is_published = body.is_published;
      if (body.is_published && !existingAnnouncement.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }
    if (body.is_pinned !== undefined) updateData.is_pinned = body.is_pinned;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.expires_at !== undefined) updateData.expires_at = body.expires_at;

    // Actualizar anuncio
    const { data: updated, error: updateError } = await supabase
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [ANNOUNCEMENTS] Error actualizando anuncio:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Actualizar grupos objetivo si se proporcionan
    if (body.group_ids !== undefined) {
      // Eliminar relaciones existentes
      await supabase
        .from('announcement_group_targets')
        .delete()
        .eq('announcement_id', id);

      // Crear nuevas relaciones si hay grupos
      if (body.group_ids.length > 0) {
        // Verificar permisos del admin
        if (userData.role === 'admin') {
          const { data: userGroups } = await supabase
            .from('user_groups')
            .select('group_id')
            .eq('user_id', user.id);

          const allowedGroupIds = userGroups?.map(ug => ug.group_id) || [];
          const validGroupIds = body.group_ids.filter((gid: string) => allowedGroupIds.includes(gid));

          if (validGroupIds.length > 0) {
            await supabase
              .from('announcement_group_targets')
              .insert(
                validGroupIds.map((group_id: string) => ({
                  announcement_id: id,
                  group_id
                }))
              );
          }
        } else {
          // Super admin puede asignar a cualquier grupo
          await supabase
            .from('announcement_group_targets')
            .insert(
              body.group_ids.map((group_id: string) => ({
                announcement_id: id,
                group_id
              }))
            );
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updated
    });

  } catch (error: any) {
    console.error('❌ [ANNOUNCEMENTS] Error en PUT [id]:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Obtener usuario autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Crear cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Verificar permisos
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar anuncios' }, { status: 403 });
    }

    // Verificar que el anuncio existe y el usuario puede eliminarlo
    const { data: existingAnnouncement } = await supabase
      .from('announcements')
      .select('author_id')
      .eq('id', id)
      .single();

    if (!existingAnnouncement) {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });
    }

    // Solo el autor o super_admin puede eliminar
    if (existingAnnouncement.author_id !== user.id && userData.role !== 'super_admin') {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este anuncio' }, { status: 403 });
    }

    // Eliminar anuncio (las relaciones se eliminan por CASCADE)
    const { error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ [ANNOUNCEMENTS] Error eliminando anuncio:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Anuncio eliminado correctamente'
    });

  } catch (error: any) {
    console.error('❌ [ANNOUNCEMENTS] Error en DELETE [id]:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}

