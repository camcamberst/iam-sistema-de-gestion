import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyNewAnnouncement } from '@/lib/chat/bot-notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Función para notificar a usuarios afectados por una publicación
async function notifyAffectedUsers(
  announcementId: string,
  isGeneral: boolean,
  groupIds: string[],
  announcementTitle: string
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let userIds: string[] = [];

    if (isGeneral) {
      // Si es general, notificar a todos los modelos
      const { data: allModels } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'modelo')
        .eq('is_active', true);

      userIds = allModels?.map((u: any) => u.id) || [];
    } else if (groupIds.length > 0) {
      // Si es específico de grupos, obtener modelos que pertenecen a esos grupos
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', groupIds);

      const userIdsFromGroups = userGroups?.map((ug: any) => ug.user_id) || [];
      
      // Obtener información de usuarios para filtrar solo modelos activos
      if (userIdsFromGroups.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .in('id', userIdsFromGroups)
          .eq('role', 'modelo')
          .eq('is_active', true);

        userIds = users?.map((u: any) => u.id) || [];
      }
    }

    console.log('📢 [ANNOUNCEMENTS] Enviando notificaciones a usuarios:', {
      announcementId,
      isGeneral,
      groupIds,
      totalUsers: userIds.length
    });

    // Enviar notificaciones en paralelo (sin esperar todas)
    const notificationPromises = userIds.map(userId => 
      notifyNewAnnouncement(userId, announcementTitle).catch(err => {
        console.error(`❌ [ANNOUNCEMENTS] Error notificando a usuario ${userId}:`, err);
        return false;
      })
    );

    // Ejecutar en segundo plano, no bloquear la respuesta
    Promise.all(notificationPromises).then(results => {
      const successCount = results.filter(r => r === true).length;
      console.log(`✅ [ANNOUNCEMENTS] Notificaciones enviadas: ${successCount}/${userIds.length}`);
    });

  } catch (error) {
    console.error('❌ [ANNOUNCEMENTS] Error notificando usuarios:', error);
    // No fallar la creación del anuncio si fallan las notificaciones
  }
}

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

    // Obtener información del usuario autenticado
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    // Obtener rol del usuario desde la base de datos
    const { data: userData } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    const actualUserRole = userData?.role || userRole;
    const isAdmin = actualUserRole === 'super_admin' || actualUserRole === 'admin';
    const isSuperAdmin = actualUserRole === 'super_admin';
    
    // Construir query base
    let query = supabase
      .from('announcements')
      .select(`
        *,
        category:announcement_categories(*),
        author:users(id, name, email),
        group_targets:announcement_group_targets(
          group:groups(id, name)
        ),
        target_roles
      `);

    // Si es admin (no super_admin), mostrar:
    // - SUS propias publicaciones
    // - Publicaciones generales del super admin
    // - Publicaciones dirigidas a sus grupos
    // - Publicaciones dirigidas específicamente a él
    if (isAdmin && !isSuperAdmin) {
      // Obtener publicaciones donde el admin es autor
      const { data: ownAnnouncements } = await supabase
        .from('announcements')
        .select('id')
        .eq('author_id', user.id);
      
      const ownAnnouncementIds = ownAnnouncements?.map((a: any) => a.id) || [];

      // Obtener publicaciones generales del super admin
      const { data: generalAnnouncements } = await supabase
        .from('announcements')
        .select('id')
        .eq('is_general', true)
        .eq('is_published', true);
      
      const generalAnnouncementIds = generalAnnouncements?.map((a: any) => a.id) || [];

      // Obtener publicaciones dirigidas a los grupos del admin
      const { data: userGroupsData } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);
      
      const userGroupIds = userGroupsData?.map((ug: any) => ug.group_id) || [];
      let groupAnnouncementIds: string[] = [];
      
      if (userGroupIds.length > 0) {
        const { data: targetAnnouncements } = await supabase
          .from('announcement_group_targets')
          .select('announcement_id')
          .in('group_id', userGroupIds);
        
        groupAnnouncementIds = targetAnnouncements?.map((t: any) => t.announcement_id) || [];
      }

      // Obtener publicaciones dirigidas por rol (si el admin tiene el rol seleccionado)
      const { data: roleTargetAnnouncements } = await supabase
        .from('announcements')
        .select('id, target_roles')
        .eq('is_published', true);
      
      let roleAnnouncementIds: string[] = [];
      if (roleTargetAnnouncements && roleTargetAnnouncements.length > 0) {
        // Verificar si alguna publicación tiene el rol del usuario actual en target_roles
        for (const ann of roleTargetAnnouncements) {
          if (ann.target_roles && Array.isArray(ann.target_roles) && ann.target_roles.length > 0) {
            if (ann.target_roles.includes(actualUserRole)) {
              roleAnnouncementIds.push(ann.id);
            }
          }
        }
      }

      // Combinar todos los IDs únicos
      const allAnnouncementIds = [
        ...ownAnnouncementIds,
        ...generalAnnouncementIds,
        ...groupAnnouncementIds,
        ...roleAnnouncementIds
      ].filter((id, index, arr) => arr.indexOf(id) === index); // Eliminar duplicados

      if (allAnnouncementIds.length > 0) {
        query = query.in('id', allAnnouncementIds);
      } else {
        // Si no hay publicaciones, devolver array vacío
        query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // UUID inválido para no devolver resultados
      }
    }

    // Si es modelo, solo mostrar publicadas y no expiradas
    if (actualUserRole === 'modelo') {
      query = query
        .eq('is_published', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
    }

    // Si es admin, solo mostrar publicadas (para el widget de visualización)
    if (isAdmin && !isSuperAdmin && actualUserRole !== 'modelo') {
      query = query.eq('is_published', true);
    }

    // Si es modelo, filtrar por sus grupos o generales
    if (actualUserRole === 'modelo') {
      // Obtener IDs de grupos del usuario
      const { data: userGroupsData } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', userId!);

      const userGroupIds = userGroupsData?.map(ug => ug.group_id) || [];

      console.log('🔍 [ANNOUNCEMENTS] Filtrado para modelo:', {
        userId,
        userGroupIds,
        userGroupsParam: userGroups
      });

      // Si el usuario tiene grupos, filtrar: generales O que tengan al menos un grupo objetivo del usuario
      if (userGroupIds.length > 0) {
        // Obtener IDs de anuncios que tienen al menos un grupo objetivo del usuario
        const { data: targetAnnouncements } = await supabase
          .from('announcement_group_targets')
          .select('announcement_id')
          .in('group_id', userGroupIds);

        const targetAnnouncementIds = targetAnnouncements?.map((t: any) => t.announcement_id) || [];

        console.log('📋 [ANNOUNCEMENTS] Anuncios con grupos objetivo:', {
          targetAnnouncementIds,
          userGroupIds
        });

        // Filtrar: generales O que estén en la lista de anuncios con grupos objetivo
        if (targetAnnouncementIds.length > 0) {
          query = query.or(`is_general.eq.true,id.in.(${targetAnnouncementIds.join(',')})`);
        } else {
          // Si no hay anuncios con grupos objetivo, solo mostrar generales
          query = query.eq('is_general', true);
        }
      } else {
        // Si el usuario no tiene grupos, solo mostrar generales
        query = query.eq('is_general', true);
      }
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

    console.log('📊 [ANNOUNCEMENTS] Resultados obtenidos:', {
      count: data?.length || 0,
      userId,
      userRole,
      isAdmin,
      announcements: data?.map((a: any) => ({
        id: a.id,
        title: a.title,
        is_published: a.is_published,
        is_general: a.is_general,
        published_at: a.published_at,
        group_targets_count: a.group_targets?.length || 0
      }))
    });

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
      })) || [],
      target_roles: announcement.target_roles || []
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
      target_roles,
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

    // Preparar datos para insertar
    const announcementData = {
      author_id: user.id,
      category_id: category_id || null,
      title,
      content,
      excerpt: excerpt || title.substring(0, 150),
      featured_image_url: featured_image_url || null,
      image_urls: image_urls || [],
      is_general: is_general || false,
      organization_id: organizationId,
      target_roles: target_roles && target_roles.length > 0 ? target_roles : [],
      is_published: is_published || false,
      is_pinned: is_pinned || false,
      priority: priority || 0,
      published_at: is_published ? new Date().toISOString() : null,
      expires_at: expires_at || null
    };

    console.log('📝 [ANNOUNCEMENTS] Creando anuncio:', {
      title,
      is_published,
      is_general,
      group_ids: group_ids || [],
      target_roles: target_roles || [],
      published_at: announcementData.published_at
    });

    // Crear anuncio
    const { data: announcement, error: insertError } = await supabase
      .from('announcements')
      .insert(announcementData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [ANNOUNCEMENTS] Error creando anuncio:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log('✅ [ANNOUNCEMENTS] Anuncio creado:', {
      id: announcement.id,
      title: announcement.title,
      is_published: announcement.is_published,
      is_general: announcement.is_general,
      published_at: announcement.published_at
    });

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
          const groupTargets = validGroupIds.map((group_id: string) => ({
            announcement_id: announcement.id,
            group_id
          }));
          
          console.log('🔗 [ANNOUNCEMENTS] Creando relaciones con grupos (admin):', groupTargets);
          
          const { error: targetsError } = await supabase
            .from('announcement_group_targets')
            .insert(groupTargets);

          if (targetsError) {
            console.error('❌ [ANNOUNCEMENTS] Error creando relaciones con grupos:', targetsError);
          } else {
            console.log('✅ [ANNOUNCEMENTS] Relaciones con grupos creadas exitosamente');
          }
        }
      } else {
        // Super admin puede asignar a cualquier grupo
        const groupTargets = group_ids.map((group_id: string) => ({
          announcement_id: announcement.id,
          group_id
        }));
        
        console.log('🔗 [ANNOUNCEMENTS] Creando relaciones con grupos (super_admin):', groupTargets);
        
        const { error: targetsError } = await supabase
          .from('announcement_group_targets')
          .insert(groupTargets);

        if (targetsError) {
          console.error('❌ [ANNOUNCEMENTS] Error creando relaciones con grupos:', targetsError);
        } else {
          console.log('✅ [ANNOUNCEMENTS] Relaciones con grupos creadas exitosamente');
        }
      }
    } else if (is_general) {
      console.log('📢 [ANNOUNCEMENTS] Anuncio general, no se crean relaciones con grupos');
    }

    // target_roles ya está guardado en announcementData, no se necesita acción adicional
    if (target_roles && target_roles.length > 0) {
      console.log('✅ [ANNOUNCEMENTS] Roles objetivo guardados:', target_roles);
    }

    // Si se publicó el anuncio, enviar notificaciones a los usuarios afectados
    if (is_published && announcement) {
      await notifyAffectedUsers(announcement.id, is_general, group_ids || [], announcement.title);
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

