// =====================================================
// 👥 API ULTRA SIMPLE - SOLO DATOS VITALES
// =====================================================
// Solo maneja: Nombre, Email, Rol, Grupos
// Sin complejidades que causen errores

export const dynamic = 'force-dynamic';
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAuth } from '@/lib/supabase-server';
import { addAffiliateFilter, type AuthUser } from '@/lib/affiliates/filters';

// =====================================================
// 📋 GET - Obtener usuarios (SOLO DATOS VITALES)
// =====================================================

// Helper para obtener usuario autenticado con affiliate_studio_id
async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    const { data: userData } = await supabaseServer
      .from('users')
      .select('role, affiliate_studio_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return null;
    }

    return {
      id: user.id,
      role: userData.role,
      affiliate_studio_id: userData.affiliate_studio_id
    };
  } catch (error) {
    console.error('❌ [API] Error obteniendo usuario autenticado:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('👥 [API] Obteniendo usuarios (SOLO DATOS VITALES)');
    
    const supabase = supabaseServer;
    
    // Obtener usuario autenticado para aplicar filtros de afiliado
    const currentUser = await getAuthenticatedUser(request);

    // Construir query base
    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        is_active,
        created_at,
        affiliate_studio_id,
        user_groups(
          groups!inner(
            id,
            name
          )
        )
      `);

    // Aplicar filtro de afiliado si es necesario
    query = addAffiliateFilter(query, currentUser);

    // Ejecutar query con ordenamiento
    const { data: users, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo usuarios' },
        { status: 500 }
      );
    }

    // Obtener asignaciones por separado para usuarios modelo
    const modelUserIds = (users || []).filter(u => u.role === 'modelo').map(u => u.id);
    let assignmentsMap: Record<string, any> = {};
    
    console.log(`🔍 [DEBUG] Usuarios totales: ${(users || []).length}`);
    console.log(`🔍 [DEBUG] Usuarios modelo: ${modelUserIds.length}`);
    console.log(`🔍 [DEBUG] IDs de usuarios modelo:`, modelUserIds);
    
    if (modelUserIds.length > 0) {
      console.log(`🔍 [DEBUG] Obteniendo asignaciones para ${modelUserIds.length} usuarios modelo`);
      
      try {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('room_assignments_detailed')
          .select('model_id, jornada, room_id, room_name')
          .in('model_id', modelUserIds);
        
        if (assignmentsError) {
          console.error('❌ [API] Error obteniendo asignaciones:', assignmentsError);
          console.log('🔍 [DEBUG] Error details:', JSON.stringify(assignmentsError, null, 2));
        } else {
          console.log(`🔍 [DEBUG] Asignaciones raw:`, assignments);
          
          // Crear mapa de asignaciones por user_id
          assignmentsMap = (assignments || []).reduce((acc, assignment) => {
            acc[assignment.model_id] = assignment;
            return acc;
          }, {} as Record<string, any>);
          
          console.log(`✅ [API] Asignaciones obtenidas: ${Object.keys(assignmentsMap).length}`);
        }
      } catch (error) {
        console.error('❌ [API] Error en try-catch de asignaciones:', error);
      }
    } else {
      console.log('🔍 [DEBUG] No hay usuarios modelo, saltando consulta de asignaciones');
    }

    // Formatear usuarios con grupos Y asignaciones
    const formattedUsers = (users || []).map(user => {
      const userGroups = user.user_groups?.map((ug: any) => ({
        id: ug.groups.id,
        name: ug.groups.name
      })) || [];
      
      // Obtener asignación activa (si existe)
      const activeAssignment = assignmentsMap[user.id] || null;
      
      console.log(`🔍 [DEBUG] Usuario ${user.name} (${user.email}):`, {
        user_groups_raw: user.user_groups,
        formatted_groups: userGroups,
        groups_count: userGroups.length,
        active_assignment: activeAssignment
      });
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        affiliate_studio_id: user.affiliate_studio_id || null,
        groups: userGroups,
        user_groups: userGroups, // AGREGAR ESTA LÍNEA para compatibilidad con frontend
        // Campos de asignación (solo para modelos con asignaciones)
        jornada: activeAssignment?.jornada || undefined,
        room_id: activeAssignment?.room_id || undefined
      };
    });

    console.log('✅ [API] Usuarios obtenidos:', formattedUsers.length);

    return NextResponse.json({
      success: true,
      users: formattedUsers
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// =====================================================
// ➕ POST - Crear usuario (SOLO DATOS VITALES)
// =====================================================

export async function POST(request: NextRequest) {
  try {
    console.log('➕ [API] Creando usuario (SOLO DATOS VITALES)');
    
    const supabase = supabaseServer;

    // Obtener usuario autenticado para asignar affiliate_studio_id si es necesario
    const currentUser = await getAuthenticatedUser(request);

    const body = await request.json();
    console.log('🔍 [DEBUG] Body completo recibido:', JSON.stringify(body, null, 2));
    
    const { email, password, name, role, group_ids, jornada, room_id } = body;
    console.log('🔍 [DEBUG] Datos extraídos:', { email, name, role, group_ids, jornada, room_id });

    // Validación de datos vitales
    if (!email || !password || !name || !role) {
      console.log('❌ [DEBUG] Datos faltantes:', { email: !!email, password: !!password, name: !!name, role: !!role });
      return NextResponse.json(
        { success: false, error: 'Datos vitales faltantes' },
        { status: 400 }
      );
    }

    // Si el usuario que crea es superadmin_aff, asignar automáticamente su affiliate_studio_id
    let affiliateStudioId = null;
    if (currentUser && (currentUser.role === 'superadmin_aff' || (currentUser.role === 'admin' && currentUser.affiliate_studio_id))) {
      affiliateStudioId = currentUser.affiliate_studio_id;
      console.log('🔍 [API] Usuario afiliado creando usuario, asignando affiliate_studio_id:', affiliateStudioId);
    }

    console.log('📋 [API] Datos recibidos:', { name, email, role, group_ids, affiliateStudioId });

    // 1. Crear usuario en Auth (solo datos básicos)
    console.log('🔍 [DEBUG] Creando usuario en Auth con:', { email, name, role });
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (authError || !authData.user) {
      console.error('❌ [API] Error Auth:', authError);
      console.log('🔍 [DEBUG] Auth error details:', JSON.stringify(authError, null, 2));
      
      // Para cualquier error de Auth, asumir que es por duplicado (más común)
      // y mostrar mensaje claro al usuario
      return NextResponse.json(
        { success: false, error: 'Este email ya está registrado. Por favor, usa un email diferente.' },
        { status: 400 }
      );
    }

    console.log('✅ [API] Usuario creado en Auth:', authData.user.id);
    console.log('🔍 [DEBUG] Auth user metadata:', authData.user.user_metadata);

    // 2. Crear perfil en tabla users (solo datos vitales)
    const userData: any = {
      id: authData.user.id,
      name,
      email,
      role,
      is_active: true
    };

    // Asignar affiliate_studio_id si corresponde
    if (affiliateStudioId) {
      userData.affiliate_studio_id = affiliateStudioId;
    }

    console.log('🔍 [DEBUG] Creando perfil en users con:', userData);
    const { error: profileError } = await supabase
      .from('users')
      .insert(userData);

    if (profileError) {
      console.error('❌ [API] Error perfil:', profileError);
      console.log('🔍 [DEBUG] Profile error details:', JSON.stringify(profileError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Error creando perfil' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Perfil creado en users');

    // 3. Asignar grupos (solo si se proporcionaron)
    let assignedGroups: Array<{ id: string; name: string }> = [];
    if (group_ids && group_ids.length > 0) {
      console.log('📋 [API] Asignando grupos:', group_ids);
      console.log('🔍 [DEBUG] Group IDs recibidos:', JSON.stringify(group_ids, null, 2));
      
      const userGroups = group_ids.map((groupId: string) => ({
        user_id: authData.user.id,
        group_id: groupId,
        is_manager: false
      }));

      console.log('🔍 [DEBUG] User groups a insertar:', JSON.stringify(userGroups, null, 2));

      const { data: groupsData, error: groupsError } = await supabase
        .from('user_groups')
        .insert(userGroups)
        .select(`
          groups!inner(
            id,
            name
          )
        `);

      if (groupsError) {
        console.error('❌ [API] Error asignando grupos:', groupsError);
        console.log('🔍 [DEBUG] Groups error details:', JSON.stringify(groupsError, null, 2));
        // No fallar la creación del usuario por esto
      } else {
        assignedGroups = groupsData?.map((ug: any) => ({
          id: ug.groups.id,
          name: ug.groups.name
        })) || [];
        console.log('✅ [API] Grupos asignados:', assignedGroups.length);
        console.log('🔍 [DEBUG] Grupos asignados:', JSON.stringify(assignedGroups, null, 2));
        
        // 3.1. REGLA AUTOMÁTICA: Si es admin y se le asignó un grupo que cumple ROOM + Jornada,
        // crear automáticamente la sede con un room por defecto
        if (role === 'admin' && assignedGroups.length > 0) {
          console.log('🏗️ [API] Verificando si se debe crear sede automáticamente...');
          
          for (const group of assignedGroups) {
            // Verificar si este grupo ya tiene rooms
            const { data: existingRooms, error: roomsError } = await supabase
              .from('group_rooms')
              .select('id, room_name')
              .eq('group_id', group.id);
              
            if (roomsError) {
              console.error(`❌ [API] Error verificando rooms para ${group.name}:`, roomsError);
              continue;
            }
            
            // Si no tiene rooms, crear uno por defecto
            if (!existingRooms || existingRooms.length === 0) {
              console.log(`🏗️ [API] Creando room por defecto para ${group.name}...`);
              
              const { data: newRoom, error: createRoomError } = await supabase
                .from('group_rooms')
                .insert({
                  group_id: group.id,
                  room_name: 'ROOM01',
                  is_active: true
                })
                .select()
                .single();
                
              if (createRoomError) {
                console.error(`❌ [API] Error creando room para ${group.name}:`, createRoomError);
              } else {
                console.log(`✅ [API] Room creado automáticamente: ${newRoom.room_name} para ${group.name}`);
              }
            } else {
              console.log(`ℹ️ [API] ${group.name} ya tiene ${existingRooms.length} rooms configurados`);
            }
          }
        }
        
        // Verificación post-asignación: consultar grupos del usuario recién creado
        console.log('🔍 [DEBUG] Verificando grupos asignados en BD...');
        const { data: verifyGroups, error: verifyError } = await supabase
          .from('user_groups')
          .select(`
            groups!inner(
              id,
              name
            )
          `)
          .eq('user_id', authData.user.id);
          
        if (verifyError) {
          console.error('❌ [DEBUG] Error verificando grupos:', verifyError);
        } else {
          const verifiedGroups = verifyGroups?.map((ug: any) => ({
            id: ug.groups.id,
            name: ug.groups.name
          })) || [];
          console.log('🔍 [DEBUG] Grupos verificados en BD:', JSON.stringify(verifiedGroups, null, 2));
        }
      }
    } else {
      console.log('🔍 [DEBUG] No se proporcionaron grupos o están vacíos');
    }

    // 4. Crear asignación de modelo (solo si es modelo y se proporcionaron jornada/room)
    if (role === 'modelo' && jornada && room_id && group_ids && group_ids.length > 0) {
      console.log('📋 [API] Creando asignación de modelo:', { jornada, room_id, group_id: group_ids[0] });
      
      // Validar que no existe otra asignación activa para el mismo room/jornada/grupo
      console.log('🔍 [API] Validando conflicto de asignación...');
      
      // 1. Verificar que no haya otra modelo en el mismo room/jornada
      const { data: existingAssignments, error: checkError } = await supabase
        .from('room_assignments')
        .select('id, model_id')
        .eq('room_id', room_id)
        .eq('jornada', jornada);
      
      if (checkError) {
        console.error('❌ [API] Error verificando asignaciones existentes:', checkError);
        return NextResponse.json(
          { success: false, error: 'Error verificando disponibilidad' },
          { status: 500 }
        );
      }
      
      if (existingAssignments && existingAssignments.length > 0) {
        console.log('❌ [API] Conflicto detectado:', existingAssignments);
        return NextResponse.json(
          { success: false, error: 'Este room ya está ocupado en la jornada seleccionada para este grupo' },
          { status: 400 }
        );
      }

      // 2. Verificar que la misma modelo no esté ya asignada en otra jornada del mismo room
      const { data: sameModelAssignments, error: sameModelError } = await supabase
        .from('room_assignments')
        .select('id, jornada')
        .eq('model_id', authData.user.id)
        .eq('room_id', room_id);
      
      if (sameModelError) {
        console.error('❌ [API] Error verificando asignaciones de la misma modelo:', sameModelError);
        return NextResponse.json(
          { success: false, error: 'Error verificando asignaciones de la modelo' },
          { status: 500 }
        );
      }
      
      if (sameModelAssignments && sameModelAssignments.length > 0) {
        const existingJornadas = sameModelAssignments.map(a => a.jornada);
        console.log('❌ [API] Modelo ya asignada a este room en otras jornadas:', existingJornadas);
        return NextResponse.json(
          { success: false, error: `Esta modelo ya está asignada a este room en la(s) jornada(s): ${existingJornadas.join(', ')}` },
          { status: 400 }
        );
      }
      
      console.log('✅ [API] No hay conflictos, procediendo con la asignación');
      
      try {
        const { error: assignmentError } = await supabase
          .from('room_assignments')
          .insert({
            model_id: authData.user.id,
            room_id: room_id,
            jornada: jornada,
            assigned_by: authData.user.id
          });

        if (assignmentError) {
          console.error('❌ [API] Error creando asignación:', assignmentError);
          // No fallar la creación del usuario por esto, solo logear
          console.log('⚠️ [WARNING] Asignación no creada, pero usuario sí');
        } else {
          console.log('✅ [API] Asignación de modelo creada exitosamente');
          
          // Actualizar estado de jornada
          const { error: stateError } = await supabase
            .from('jornada_states')
            .update({
              state: 'OCUPADA',
              model_id: authData.user.id,
              updated_at: new Date().toISOString(),
              updated_by: authData.user.id
            })
            .eq('group_id', group_ids[0])
            .eq('room_id', room_id)
            .eq('jornada', jornada);

          if (stateError) {
            console.error('❌ [API] Error actualizando estado de jornada:', stateError);
          } else {
            console.log('✅ [API] Estado de jornada actualizado a OCUPADA');
          }
        }
      } catch (assignmentError) {
        console.error('❌ [API] Error general en asignación:', assignmentError);
        console.log('⚠️ [WARNING] Asignación no creada, pero usuario sí');
      }
    } else if (role === 'modelo') {
      console.log('🔍 [DEBUG] Usuario modelo creado sin asignación (datos faltantes):', {
        jornada: !!jornada,
        room_id: !!room_id,
        group_ids: group_ids?.length || 0
      });
    }

    console.log('✅ [API] Usuario creado completamente:', authData.user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        name,
        email,
        role,
        is_active: true,
        groups: assignedGroups
      }
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// =====================================================
// ✏️ PUT - Editar usuario (SOLO DATOS VITALES)
// =====================================================

export async function PUT(request: NextRequest) {
  try {
    console.log('✏️ [API] Editando usuario (SOLO DATOS VITALES)');
    
    const supabase = supabaseServer;

    // Obtener usuario autenticado para validar permisos
    const currentUser = await getAuthenticatedUser(request);
    
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('🔍 [DEBUG] Body completo recibido en PUT:', JSON.stringify(body, null, 2));
    
    const { id, name, email, password, role, is_active, group_ids, jornada, room_id } = body;
    console.log('🔍 [DEBUG] Datos extraídos en PUT:', { id, name, email, password: !!password, role, is_active, group_ids, jornada, room_id });

    if (!id || !name || !email || !role) {
      console.log('❌ [DEBUG] Datos faltantes en PUT:', { 
        id: !!id, 
        name: !!name, 
        email: !!email, 
        role: !!role 
      });
      return NextResponse.json(
        { success: false, error: 'Datos vitales faltantes' },
        { status: 400 }
      );
    }

    // Obtener información del usuario a editar
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id, role, affiliate_studio_id')
      .eq('id', id)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Validar permisos de edición
    // Super_admin puede editar a cualquiera
    if (currentUser.role === 'super_admin') {
      // Permitir edición
    } 
    // Superadmin_aff solo puede editar usuarios de su estudio
    else if (currentUser.role === 'superadmin_aff') {
      // No puede editar a super_admin ni a otro superadmin_aff
      if (targetUser.role === 'super_admin' || targetUser.role === 'superadmin_aff') {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para editar este usuario' },
          { status: 403 }
        );
      }
      
      // Verificar que ambos usuarios pertenezcan al mismo estudio afiliado
      if (currentUser.affiliate_studio_id) {
        if (targetUser.affiliate_studio_id !== currentUser.affiliate_studio_id) {
          return NextResponse.json(
            { success: false, error: 'Solo puedes editar usuarios de tu estudio afiliado' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para editar usuarios' },
          { status: 403 }
        );
      }
    }
    // Admin solo puede editar modelos de sus grupos (validación adicional si es necesario)
    else if (currentUser.role === 'admin') {
      // La validación completa se hace en el frontend con canEditUser
      // Aquí solo verificamos que no sea super_admin
      if (targetUser.role === 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para editar este usuario' },
          { status: 403 }
        );
      }
    }
    // Otros roles no pueden editar usuarios
    else {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para editar usuarios' },
        { status: 403 }
      );
    }

    // ── Advertencia de deuda sexshop al desactivar/eliminar modelo ──────────
    if (is_active === false && targetUser.role === 'modelo') {
      const { data: pendingFinancings } = await supabase
        .from('shop_financing')
        .select('id, total_amount, installments, shop_financing_installments(amount, status)')
        .eq('model_id', id)
        .eq('status', 'aprobado');

      if (pendingFinancings && pendingFinancings.length > 0) {
        const totalDebt = pendingFinancings.reduce((sum: number, fin: { shop_financing_installments?: Array<{ amount: number; status: string }> }) => {
          const pendingInstallments = (fin.shop_financing_installments || []).filter((i: { status: string }) => i.status === 'pendiente');
          return sum + pendingInstallments.reduce((s: number, i: { amount: number }) => s + i.amount, 0);
        }, 0);

        if (totalDebt > 0) {
          try {
            const { sendBotNotification } = await import('@/lib/chat/bot-notifications');
            const debtMsg = `⚠️ **Advertencia — Cuenta desactivada con deuda de Sexshop**\n\nEl usuario **${name}** (${email}) fue desactivado o eliminado, pero tiene **deuda pendiente de Sexshop por $${totalDebt.toLocaleString('es-CO')} COP** en ${pendingFinancings.length} financiación(es).\n\nSe recomienda gestionar el cobro pendiente antes de proceder. La desactivación fue ejecutada de todas formas.`;
            await sendBotNotification(currentUser.id, 'custom_message' as never, debtMsg);
          } catch (e) {
            console.error('Error enviando alerta sexshop deuda:', e);
          }
        }
      }
    }

    // Actualizar datos vitales en tabla users
    console.log('🔍 [DEBUG] Actualizando usuario con:', { id, name, email, role, is_active });
    const { error: updateError } = await supabase
      .from('users')
      .update({
        name,
        email,
        role,
        is_active: is_active !== undefined ? is_active : true
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ [API] Error actualizando:', updateError);
      console.log('🔍 [DEBUG] Update error details:', JSON.stringify(updateError, null, 2));
      return NextResponse.json(
        { success: false, error: 'Error actualizando usuario' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Usuario actualizado exitosamente (tabla users):', id);

    // Sincronizar cambios sensibles con Supabase Auth (email/contraseña/is_active)
    try {
      const authUpdates: { 
        email?: string; 
        password?: string;
        email_confirm?: boolean;
      } = {};
      
      // Si hay cambios de email o contraseña
      if (email) authUpdates.email = email;
      if (password && typeof password === 'string' && password.trim().length >= 6) {
        authUpdates.password = password.trim();
      }
      
      // 🔧 CRÍTICO: Manejar activación/desactivación en Auth
      // Cuando se reactiva un usuario, asegurar que el email esté confirmado
      if (is_active !== undefined) {
        if (is_active) {
          // Usuario se está activando: confirmar email explícitamente
          // Esto asegura que el usuario pueda iniciar sesión después de ser reactivado
          authUpdates.email_confirm = true;
          console.log('✅ [API] Activando usuario en Auth - confirmando email para permitir login');
        } else {
          // Usuario se está desactivando: mantener email confirmado pero el login será bloqueado por is_active en la app
          authUpdates.email_confirm = true; // Mantener confirmado para cuando se reactive
          console.log('⚠️ [API] Desactivando usuario - email permanece confirmado para reactivación futura');
        }
      } else {
        // Si no se especifica is_active pero el usuario existe, asegurar email confirmado
        authUpdates.email_confirm = true;
      }
      
      // Solo actualizar Auth si hay cambios
      if (authUpdates.email || authUpdates.password || authUpdates.email_confirm !== undefined) {
        console.log('🔐 [API] Sincronizando con Supabase Auth:', { 
          hasEmail: !!authUpdates.email, 
          hasPassword: !!authUpdates.password,
          emailConfirm: authUpdates.email_confirm
        });
        
        const { error: authUpdateError } = await supabaseAuth.auth.admin.updateUserById(id, authUpdates);
        if (authUpdateError) {
          console.error('❌ [API] Error sincronizando con Auth:', authUpdateError);
          // No abortar: devolveremos success con warning
        } else {
          console.log('✅ [API] Auth actualizado para usuario:', id);
        }
      }
    } catch (e) {
      console.error('⚠️ [API] Excepción sincronizando con Auth (continuando):', e);
    }

    // Actualizar grupos si se proporcionaron explícitamente
    // NOTA: Si group_ids es undefined, NO se tocan los grupos existentes (preserva grupos al cambiar solo is_active)
    if (group_ids !== undefined) {
      console.log('🔍 [DEBUG] Actualizando grupos:', group_ids);
      console.log('🔍 [DEBUG] Group IDs recibidos en PUT:', JSON.stringify(group_ids, null, 2));
      
      // Eliminar grupos existentes y esperar a que se complete
      const { error: deleteError } = await supabase
        .from('user_groups')
        .delete()
        .eq('user_id', id);

      if (deleteError) {
        console.error('❌ [API] Error eliminando grupos existentes:', deleteError);
      } else {
        console.log('✅ [API] Grupos antiguos eliminados');
      }

      // Agregar nuevos grupos (incluso si es array vacío, se eliminan todos)
      if (group_ids.length > 0) {
        const userGroups = group_ids.map((groupId: string) => ({
          user_id: id,
          group_id: groupId,
          is_manager: false
        }));

        console.log('🔍 [DEBUG] User groups a insertar en PUT:', JSON.stringify(userGroups, null, 2));

        const { error: groupsError, data: insertedGroups } = await supabase
          .from('user_groups')
          .insert(userGroups)
          .select();

        if (groupsError) {
          console.error('❌ [API] Error actualizando grupos:', groupsError);
          console.log('🔍 [DEBUG] Groups error details en PUT:', JSON.stringify(groupsError, null, 2));
          // No fallar la actualización del usuario por esto
        } else {
          console.log('✅ [API] Grupos actualizados exitosamente');
          console.log('🔍 [DEBUG] Grupos insertados:', JSON.stringify(insertedGroups, null, 2));
          
          // Verificar que los grupos se insertaron correctamente
          const { data: verifyGroups, error: verifyError } = await supabase
            .from('user_groups')
            .select('group_id')
            .eq('user_id', id);
          
          if (verifyError) {
            console.error('❌ [API] Error verificando grupos insertados:', verifyError);
          } else {
            console.log('✅ [API] Verificación de grupos:', verifyGroups?.map((g: any) => g.group_id));
          }
        }
      } else {
        console.log('⚠️ [API] Array de grupos vacío - todos los grupos fueron eliminados');
      }
    } else {
      console.log('ℹ️ [API] group_ids no proporcionado - grupos existentes se preservan');
    }

    // Actualizar asignación de modelo (solo si es modelo y se proporcionaron jornada/room)
    if (role === 'modelo' && jornada && room_id && group_ids && group_ids.length > 0) {
      console.log('📋 [API] Actualizando asignación de modelo:', { jornada, room_id, group_id: group_ids[0] });
      
      // Validar que no existe otra asignación activa para el mismo room/jornada/grupo
      // (excluyendo las asignaciones del usuario actual)
      console.log('🔍 [API] Validando conflicto de asignación en edición...');
      
      // 1. Verificar que no haya otra modelo en el mismo room/jornada (excluyendo la actual)
      const { data: existingAssignments, error: checkError } = await supabase
        .from('room_assignments')
        .select('id, model_id')
        .eq('room_id', room_id)
        .eq('jornada', jornada)
        .neq('model_id', id); // Excluir asignaciones del usuario actual
      
      if (checkError) {
        console.error('❌ [API] Error verificando asignaciones existentes:', checkError);
        return NextResponse.json(
          { success: false, error: 'Error verificando disponibilidad' },
          { status: 500 }
        );
      }
      
      if (existingAssignments && existingAssignments.length > 0) {
        console.log('❌ [API] Conflicto detectado en edición:', existingAssignments);
        return NextResponse.json(
          { success: false, error: 'Este room ya está ocupado en la jornada seleccionada para este grupo' },
          { status: 400 }
        );
      }

      // 2. Verificar que la misma modelo no esté ya asignada en otra jornada del mismo room
      // (excluyendo la jornada actual que se está editando)
      const { data: sameModelAssignments, error: sameModelError } = await supabase
        .from('room_assignments')
        .select('id, jornada')
        .eq('model_id', id)
        .eq('room_id', room_id)
        .neq('jornada', jornada); // Excluir la jornada que se está editando
      
      if (sameModelError) {
        console.error('❌ [API] Error verificando asignaciones de la misma modelo:', sameModelError);
        return NextResponse.json(
          { success: false, error: 'Error verificando asignaciones de la modelo' },
          { status: 500 }
        );
      }
      
      if (sameModelAssignments && sameModelAssignments.length > 0) {
        const existingJornadas = sameModelAssignments.map(a => a.jornada);
        console.log('❌ [API] Modelo ya asignada a este room en otras jornadas:', existingJornadas);
        return NextResponse.json(
          { success: false, error: `Esta modelo ya está asignada a este room en la(s) jornada(s): ${existingJornadas.join(', ')}` },
          { status: 400 }
        );
      }
      
      console.log('✅ [API] No hay conflictos, procediendo con la actualización');
      
      try {
        // Eliminar asignaciones existentes
        await supabase
          .from('room_assignments')
          .delete()
          .eq('model_id', id);

        // Crear nueva asignación
        const { error: assignmentError } = await supabase
          .from('room_assignments')
          .insert({
            model_id: id,
            room_id: room_id,
            jornada: jornada,
            assigned_by: id
          });

        if (assignmentError) {
          console.error('❌ [API] Error actualizando asignación:', assignmentError);
          console.log('⚠️ [WARNING] Asignación no actualizada, pero usuario sí');
        } else {
          console.log('✅ [API] Asignación de modelo actualizada exitosamente');
          
          // Actualizar estado de jornada
          const { error: stateError } = await supabase
            .from('jornada_states')
            .update({
              state: 'OCUPADA',
              model_id: id,
              updated_at: new Date().toISOString(),
              updated_by: id
            })
            .eq('group_id', group_ids[0])
            .eq('room_id', room_id)
            .eq('jornada', jornada);

          if (stateError) {
            console.error('❌ [API] Error actualizando estado de jornada:', stateError);
          } else {
            console.log('✅ [API] Estado de jornada actualizado a OCUPADA');
          }
        }
      } catch (assignmentError) {
        console.error('❌ [API] Error general en actualización de asignación:', assignmentError);
        console.log('⚠️ [WARNING] Asignación no actualizada, pero usuario sí');
      }
    } else if (role === 'modelo') {
      // Si es modelo pero no tiene jornada/room, eliminar asignaciones existentes
      console.log('🔍 [DEBUG] Eliminando asignaciones existentes para modelo sin jornada/room');
      await supabase
        .from('room_assignments')
        .delete()
        .eq('model_id', id);
    }

    console.log('✅ [API] Usuario actualizado:', id);

    // Obtener grupos actuales del usuario para devolverlos en la respuesta
    let currentGroups: Array<{ id: string; name: string }> = [];
    if (group_ids !== undefined) {
      // Si se actualizaron grupos, obtener los nuevos
      if (group_ids.length > 0) {
        const { data: groupsData } = await supabase
          .from('user_groups')
          .select(`
            groups!inner(
              id,
              name
            )
          `)
          .eq('user_id', id);
        
        currentGroups = groupsData?.map((ug: any) => ({
          id: ug.groups.id,
          name: ug.groups.name
        })) || [];
      }
    } else {
      // Si no se actualizaron grupos, obtener los existentes (preservados)
      const { data: groupsData } = await supabase
        .from('user_groups')
        .select(`
          groups!inner(
            id,
            name
          )
        `)
        .eq('user_id', id);
      
      currentGroups = groupsData?.map((ug: any) => ({
        id: ug.groups.id,
        name: ug.groups.name
      })) || [];
    }

    return NextResponse.json({
      success: true,
      user: { 
        id, 
        name, 
        email, 
        role, 
        is_active,
        groups: currentGroups
      }
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}

// =====================================================
// 🗑️ DELETE - Eliminar usuario (SOLO DATOS VITALES)
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [API] Eliminando usuario (SOLO DATOS VITALES)');
    
    const supabase = supabaseServer;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    // Obtener usuario autenticado para validar permisos
    const currentUser = await getAuthenticatedUser(request);
    
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Obtener información del usuario a eliminar
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id, role, affiliate_studio_id')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Validar permisos de eliminación
    // Super_admin puede eliminar a cualquiera
    if (currentUser.role === 'super_admin') {
      // Permitir eliminación
    } 
    // Superadmin_aff solo puede eliminar usuarios de su estudio
    else if (currentUser.role === 'superadmin_aff') {
      // No puede eliminar a super_admin ni a otro superadmin_aff
      if (targetUser.role === 'super_admin' || targetUser.role === 'superadmin_aff') {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para eliminar este usuario' },
          { status: 403 }
        );
      }
      
      // Verificar que ambos usuarios pertenezcan al mismo estudio afiliado
      if (currentUser.affiliate_studio_id) {
        if (targetUser.affiliate_studio_id !== currentUser.affiliate_studio_id) {
          return NextResponse.json(
            { success: false, error: 'Solo puedes eliminar usuarios de tu estudio afiliado' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para eliminar usuarios' },
          { status: 403 }
        );
      }
    }
    // Admin solo puede eliminar modelos de sus grupos (validación adicional si es necesario)
    else if (currentUser.role === 'admin') {
      // La validación completa se hace en el frontend con canDeleteUser
      // Aquí solo verificamos que no sea super_admin
      if (targetUser.role === 'super_admin') {
        return NextResponse.json(
          { success: false, error: 'No tienes permisos para eliminar este usuario' },
          { status: 403 }
        );
      }
    }
    // Otros roles no pueden eliminar usuarios
    else {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para eliminar usuarios' },
        { status: 403 }
      );
    }

    // Eliminar grupos primero
    await supabase
      .from('user_groups')
      .delete()
      .eq('user_id', userId);

    // Eliminar de tabla users
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('❌ [API] Error eliminando:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando usuario' },
        { status: 500 }
      );
    }

    // Eliminar de Auth
    await supabase.auth.admin.deleteUser(userId);

    console.log('✅ [API] Usuario eliminado:', userId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}