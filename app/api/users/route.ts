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
import { atomicArchiveAndReset } from '@/lib/calculator/period-closure-helpers';
import { getTotalSavingsBalance } from '@/lib/savings/savings-utils';

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
        avatar_url,
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
        avatar_url: user.avatar_url,
        affiliate_studio_id: user.affiliate_studio_id || null,
        groups: userGroups,
        user_groups: userGroups,
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
    
    const { id, name, email, password, role, is_active, group_ids, jornada, room_id, liquidar } = body;
    console.log('🔍 [DEBUG] Datos extraídos en PUT:', { id, name, email, password: !!password, role, is_active, group_ids, jornada, room_id, liquidar });

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
      .select('id, role, affiliate_studio_id, is_active, name, email')
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

    // ── Proceso de Liquidación y Ctrl+Z de Modelos ──────────────────────────
    if (targetUser.role === 'modelo') {
      // 1. LIQUIDACIÓN COMPLETA AL DESACTIVAR
      if (targetUser.is_active === true && is_active === false && liquidar === true) {
        console.log(`💼 [LIQUIDAR] Iniciando liquidación para modelo ${name} (${email})`);
        try {
          // 🛡️ ESCUDO 1: Cascada Cronológica Inteligente
          const { data: rawValues, error: mvError } = await supabase
            .from('model_values')
            .select('period_date, value')
            .eq('model_id', id);

          if (mvError) throw new Error(`Error consultando model_values: ${mvError.message}`);

          const openPeriodsMap = new Map<string, { periodDate: string; periodType: '1-15' | '16-31' }>();
          for (const val of rawValues || []) {
            const valNum = Number(val.value || 0);
            if (valNum <= 0) continue;

            const dateStr = val.period_date;
            const [year, month, day] = dateStr.split('-').map(Number);
            let periodDate: string;
            let periodType: '1-15' | '16-31';

            if (day >= 1 && day <= 15) {
              periodDate = `${year}-${String(month).padStart(2, '0')}-01`;
              periodType = '1-15';
            } else {
              periodDate = `${year}-${String(month).padStart(2, '0')}-16`;
              periodType = '16-31';
            }

            const key = `${periodDate}_${periodType}`;
            if (!openPeriodsMap.has(key)) {
              openPeriodsMap.set(key, { periodDate, periodType });
            }
          }

          const { data: rawTotals } = await supabase
            .from('calculator_totals')
            .select('period_date, total_cop_modelo')
            .eq('model_id', id);

          for (const tot of rawTotals || []) {
            const totNum = Number(tot.total_cop_modelo || 0);
            if (totNum <= 0) continue;

            const dateStr = tot.period_date;
            const [year, month, day] = dateStr.split('-').map(Number);
            let periodDate: string;
            let periodType: '1-15' | '16-31';

            if (day >= 1 && day <= 15) {
              periodDate = `${year}-${String(month).padStart(2, '0')}-01`;
              periodType = '1-15';
            } else {
              periodDate = `${year}-${String(month).padStart(2, '0')}-16`;
              periodType = '16-31';
            }

            const key = `${periodDate}_${periodType}`;
            if (!openPeriodsMap.has(key)) {
              openPeriodsMap.set(key, { periodDate, periodType });
            }
          }

          // Filtrar períodos que ya estén en history
          const openPeriods: Array<{ periodDate: string; periodType: '1-15' | '16-31' }> = [];
          for (const entry of Array.from(openPeriodsMap.values())) {
            const { data: historyExists } = await supabase
              .from('calculator_history')
              .select('id')
              .eq('model_id', id)
              .eq('period_date', entry.periodDate)
              .eq('period_type', entry.periodType)
              .limit(1);

            if (!historyExists || historyExists.length === 0) {
              openPeriods.push(entry);
            }
          }

          // Ordenar cronológicamente
          openPeriods.sort((a, b) => {
            const timeA = new Date(a.periodDate).getTime();
            const timeB = new Date(b.periodDate).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return a.periodType === '1-15' ? -1 : 1;
          });

          // Fallback para período actual del sistema
          const colombiaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
          const [year, month, day] = colombiaDate.split('-').map(Number);
          const currentSysPeriodType = day >= 1 && day <= 15 ? '1-15' : '16-31';
          const currentSysPeriodDate = currentSysPeriodType === '1-15'
            ? `${year}-${String(month).padStart(2, '0')}-01`
            : `${year}-${String(month).padStart(2, '0')}-16`;

          const latestPeriod = openPeriods[openPeriods.length - 1] || { periodDate: currentSysPeriodDate, periodType: currentSysPeriodType };

          // A. Cerrar y archivar cada período atómicamente
          let totalEarningsCOP = 0;
          for (const p of openPeriods) {
            const closeResult = await atomicArchiveAndReset(id, p.periodDate, p.periodType);
            if (!closeResult.success) {
              throw new Error(`Fallo en el cierre atómico del período ${p.periodDate} (${p.periodType}): ${closeResult.error}`);
            }

            const { data: histRows } = await supabase
              .from('calculator_history')
              .select('value_cop_modelo')
              .eq('model_id', id)
              .eq('period_date', p.periodDate)
              .eq('period_type', p.periodType)
              .neq('platform_id', '__CONSOLIDATED_TOTAL__');

            const periodEarnings = (histRows || []).reduce((sum, r) => sum + Number(r.value_cop_modelo || 0), 0);
            totalEarningsCOP += periodEarnings;
          }

          // B. 🛡️ ESCUDO 5: Exclusión de Ahorro Circular y Reembolso de Ahorros
          const targetPeriodDates = openPeriods.length > 0 ? openPeriods.map(p => p.periodDate) : [latestPeriod.periodDate];
          await supabase
            .from('model_savings')
            .update({
              estado: 'cancelado',
              cancelled_at: new Date().toISOString(),
              cancelled_by: currentUser.id,
              comentarios_admin: 'Ahorro cancelado por liquidación y retiro de modelo'
            })
            .eq('model_id', id)
            .in('period_date', targetPeriodDates);

          const balanceResult = await getTotalSavingsBalance(id);
          const saldo_actual = balanceResult.success ? balanceResult.saldo_actual : 0;

          if (saldo_actual > 0) {
            // Reembolso con saldo negativo en deductions
            const { error: refundDedError } = await supabase
              .from('calculator_deductions')
              .insert({
                model_id: id,
                period_date: latestPeriod.periodDate,
                period_type: latestPeriod.periodType,
                concept: 'Reembolso Total de Ahorros por Liquidación',
                amount: -saldo_actual,
                created_by: currentUser.id
              });

            if (refundDedError) throw new Error(`Error registrando reembolso: ${refundDedError.message}`);

            // Registrar retiro realizado en withdrawals
            const { error: withdrawalError } = await supabase
              .from('savings_withdrawals')
              .insert({
                model_id: id,
                monto_solicitado: saldo_actual,
                porcentaje_retiro: 100.00,
                medio_pago: 'cuenta_bancaria',
                estado: 'realizado',
                comentarios_admin: 'Reembolso automático por liquidación y retiro de modelo',
                realized_at: new Date().toISOString(),
                realized_by: currentUser.id
              });

            if (withdrawalError) throw new Error(`Error registrando retiro de ahorros: ${withdrawalError.message}`);
          }

          // C. Calcular activos disponibles
          let totalAnticipos = 0;
          if (openPeriods.length > 0) {
            const { data: periodsData } = await supabase
              .from('periods')
              .select('id')
              .in('start_date', openPeriods.map(p => p.periodDate));
            const periodIds = periodsData?.map(p => p.id) || [];

            if (periodIds.length > 0) {
              const { data: anticiposData } = await supabase
                .from('anticipos')
                .select('monto_solicitado')
                .eq('model_id', id)
                .in('period_id', periodIds)
                .in('estado', ['aprobado', 'realizado', 'confirmado']);
              totalAnticipos = (anticiposData || []).reduce((sum, a) => sum + Number(a.monto_solicitado || 0), 0);
            }
          }

          const { data: deductionsData } = await supabase
            .from('calculator_deductions')
            .select('amount, concept')
            .eq('model_id', id)
            .in('period_date', targetPeriodDates);

          const totalOtherDeductions = (deductionsData || [])
            .filter(d => d.concept !== 'Reembolso Total de Ahorros por Liquidación')
            .reduce((sum, d) => sum + Number(d.amount || 0), 0);

          const availableAssets = Math.max(0, totalEarningsCOP + saldo_actual - totalAnticipos - totalOtherDeductions);

          // D. 🛡️ ESCUDO 2: Deducción Secuencial con Tope de Deudas (Sexshop)
          const { data: pendingInstallments } = await supabase
            .from('shop_financing_installments')
            .select('id, financing_id, installment_no, amount, status')
            .eq('status', 'pendiente')
            .order('created_at', { ascending: true })
            .order('installment_no', { ascending: true });

          const { data: modelFinancings } = await supabase
            .from('shop_financing')
            .select('id')
            .eq('model_id', id)
            .eq('status', 'aprobado');

          const modelFinancingIds = new Set((modelFinancings || []).map(f => f.id));
          const modelPendingInstallments = (pendingInstallments || []).filter(inst => modelFinancingIds.has(inst.financing_id));

          let remainingAssets = availableAssets;
          let totalUnpaidDebt = 0;

          for (const inst of modelPendingInstallments) {
            const instAmount = Number(inst.amount);
            if (remainingAssets >= instAmount) {
              // Cobro completo
              await supabase
                .from('shop_financing_installments')
                .update({
                  status: 'cobrada',
                  deducted_at: new Date().toISOString(),
                  deducted_by: currentUser.id
                })
                .eq('id', inst.id);

              await supabase
                .from('calculator_deductions')
                .insert({
                  model_id: id,
                  period_date: latestPeriod.periodDate,
                  period_type: latestPeriod.periodType,
                  concept: `Deducción Sexshop - Cuota ${inst.installment_no} (Finan. ID: ${inst.financing_id.substring(0, 8)})`,
                  amount: instAmount,
                  created_by: currentUser.id
                });

              remainingAssets -= instAmount;

              // Comprobar si se completó el financiamiento
              const { data: otherInst } = await supabase
                .from('shop_financing_installments')
                .select('id, status')
                .eq('financing_id', inst.financing_id);

              const allPaid = (otherInst || []).every(i => i.status === 'cobrada' || i.id === inst.id);
              if (allPaid) {
                await supabase
                  .from('shop_financing')
                  .update({ status: 'completado' })
                  .eq('id', inst.financing_id);
              }
            } else if (remainingAssets > 0) {
              // Cobro parcial
              const partialAmount = remainingAssets;
              await supabase
                .from('calculator_deductions')
                .insert({
                  model_id: id,
                  period_date: latestPeriod.periodDate,
                  period_type: latestPeriod.periodType,
                  concept: `Deducción Parcial Sexshop - Saldo Incompleto (Finan. ID: ${inst.financing_id.substring(0, 8)})`,
                  amount: partialAmount,
                  created_by: currentUser.id
                });

              totalUnpaidDebt += (instAmount - partialAmount);
              remainingAssets = 0;
            } else {
              totalUnpaidDebt += instAmount;
            }
          }

          // Enviar alerta de deuda pendiente
          if (totalUnpaidDebt > 0) {
            const { sendBotNotification } = await import('@/lib/chat/bot-notifications');
            const debtMsg = `⚠️ **Liquidación de Modelo — Deuda Sexshop Pendiente**\n\nLa modelo **${name}** (${email}) ha sido desactivada y liquidada.\n\n- **Ingresos Generados:** $${totalEarningsCOP.toLocaleString('es-CO')} COP\n- **Ahorros Reembolsados:** $${saldo_actual.toLocaleString('es-CO')} COP\n- **Activos Totales Disponibles:** $${availableAssets.toLocaleString('es-CO')} COP\n- **Deuda Cobrada:** $${(availableAssets - remainingAssets).toLocaleString('es-CO')} COP\n- **Deuda Pendiente Restante (Sin Cubrir):** $${totalUnpaidDebt.toLocaleString('es-CO')} COP\n\nLas cuotas restantes permanecen en estado **'pendiente'** en la base de datos para seguimiento contable.`;
            await sendBotNotification(currentUser.id, 'custom_message' as never, debtMsg);
          }

          console.log(`✅ [LIQUIDAR] Liquidación completada exitosamente para ${email}`);

        } catch (liquidationErr: any) {
          console.error(`❌ [LIQUIDAR] Error crítico durante la liquidación:`, liquidationErr);
          return NextResponse.json(
            { success: false, error: `Error durante el proceso de liquidación: ${liquidationErr.message}` },
            { status: 500 }
          );
        }
      }

      // 2. ADVERTENCIA SIMPLE AL DESACTIVAR (SIN LIQUIDAR)
      else if (targetUser.is_active === true && is_active === false && liquidar !== true) {
        const { data: pendingFinancings } = await supabase
          .from('shop_financing')
          .select('id, total_amount, installments, shop_financing_installments(amount, status)')
          .eq('model_id', id)
          .eq('status', 'aprobado');

        if (pendingFinancings && pendingFinancings.length > 0) {
          const totalDebt = pendingFinancings.reduce((sum: number, fin: any) => {
            const pendingInstallments = (fin.shop_financing_installments || []).filter((i: any) => i.status === 'pendiente');
            return sum + pendingInstallments.reduce((s: number, i: any) => s + i.amount, 0);
          }, 0);

          if (totalDebt > 0) {
            try {
              const { sendBotNotification } = await import('@/lib/chat/bot-notifications');
              const debtMsg = `⚠️ **Advertencia — Cuenta desactivada con deuda de Sexshop**\n\nEl usuario **${name}** (${email}) fue desactivado, pero tiene **deuda pendiente de Sexshop por $${totalDebt.toLocaleString('es-CO')} COP** en ${pendingFinancings.length} financiación(es).\n\nSe recomienda gestionar el cobro pendiente antes de proceder. La desactivación fue ejecutada de todas formas (sin liquidar saldos).`;
              await sendBotNotification(currentUser.id, 'custom_message' as never, debtMsg);
            } catch (e) {
              console.error('Error enviando alerta sexshop deuda:', e);
            }
          }
        }
      }

      // 3. 🛡️ ESCUDO 3: REVERSIBILIDAD COMPLETA ("Ctrl+Z" al reactivar)
      else if (targetUser.is_active === false && is_active === true) {
        console.log(`🔄 [REACTIVAR] Reactivando modelo ${name} (${email}) - Revirtiendo liquidación`);
        try {
          const { data: openStatuses } = await supabase
            .from('calculator_period_closure_status')
            .select('period_date, period_type')
            .eq('status', 'completed');

          const { data: historyEntries } = await supabase
            .from('calculator_history')
            .select('period_date, period_type')
            .eq('model_id', id);

          const seen = new Set<string>();
          const closedOpenPeriods: Array<{ periodDate: string; periodType: '1-15' | '16-31' }> = [];

          for (const entry of historyEntries || []) {
            const key = `${entry.period_date}_${entry.period_type}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const isCompletedGlobal = (openStatuses || []).some(
              os => os.period_date === entry.period_date && os.period_type === entry.period_type
            );

            if (!isCompletedGlobal) {
              closedOpenPeriods.push({
                periodDate: entry.period_date,
                periodType: entry.period_type as '1-15' | '16-31'
              });
            }
          }

          for (const p of closedOpenPeriods) {
            // A. Eliminar calculator_history
            await supabase
              .from('calculator_history')
              .delete()
              .eq('model_id', id)
              .eq('period_date', p.periodDate)
              .eq('period_type', p.periodType);

            // B. Restaurar model_values desde safety backup
            const { data: backups } = await supabase
              .from('model_values_safety_backup')
              .select('*')
              .eq('model_id', id)
              .eq('period_start_date', p.periodDate)
              .eq('period_type', p.periodType);

            if (backups && backups.length > 0) {
              const restoredValues = backups.map(b => ({
                id: b.original_id,
                model_id: b.model_id,
                platform_id: b.platform_id,
                value: Number(b.value),
                period_date: b.period_date,
                created_at: b.original_created_at,
                updated_at: b.original_updated_at
              }));

              await supabase
                .from('model_values')
                .insert(restoredValues);

              // Eliminar backup físico
              await supabase
                .from('model_values_safety_backup')
                .delete()
                .eq('model_id', id)
                .eq('period_start_date', p.periodDate)
                .eq('period_type', p.periodType);
            }
          }

          // C. Revertir cobros de Sexshop
          const targetPeriodDates = closedOpenPeriods.map(p => p.periodDate);
          if (targetPeriodDates.length > 0) {
            const { data: shopDeductions } = await supabase
              .from('calculator_deductions')
              .select('id, concept')
              .eq('model_id', id)
              .in('period_date', targetPeriodDates);

            const shopDeductionIds = (shopDeductions || [])
              .filter(d => d.concept.startsWith('Deducción Sexshop - Cuota') || d.concept.startsWith('Deducción Parcial Sexshop'))
              .map(d => d.id);

            if (shopDeductionIds.length > 0) {
              await supabase
                .from('calculator_deductions')
                .delete()
                .in('id', shopDeductionIds);
            }
          }

          // Revertir cuotas a pendiente
          const { data: modelFinancings } = await supabase
            .from('shop_financing')
            .select('id')
            .eq('model_id', id);

          const modelFinancingIds = (modelFinancings || []).map(f => f.id);

          if (modelFinancingIds.length > 0) {
            const { data: cobradasInstallments } = await supabase
              .from('shop_financing_installments')
              .select('id, financing_id')
              .eq('status', 'cobrada')
              .in('financing_id', modelFinancingIds)
              .is('period_id', null);

            if (cobradasInstallments && cobradasInstallments.length > 0) {
              await supabase
                .from('shop_financing_installments')
                .update({
                  status: 'pendiente',
                  deducted_at: null,
                  deducted_by: null
                })
                .in('id', cobradasInstallments.map(i => i.id));

              const financingIdsToRevert = Array.from(new Set(cobradasInstallments.map(i => i.financing_id)));
              await supabase
                .from('shop_financing')
                .update({ status: 'aprobado' })
                .in('id', financingIdsToRevert)
                .eq('status', 'completado');
            }
          }

          // D. Revertir reembolso de ahorros
          const { data: refundDeductions } = await supabase
            .from('calculator_deductions')
            .select('id')
            .eq('model_id', id)
            .eq('concept', 'Reembolso Total de Ahorros por Liquidación');

          if (refundDeductions && refundDeductions.length > 0) {
            await supabase
              .from('calculator_deductions')
              .delete()
              .in('id', refundDeductions.map(d => d.id));
          }

          const { data: refundWithdrawals } = await supabase
            .from('savings_withdrawals')
            .select('id')
            .eq('model_id', id)
            .eq('estado', 'realizado')
            .eq('comentarios_admin', 'Reembolso automático por liquidación y retiro de modelo');

          if (refundWithdrawals && refundWithdrawals.length > 0) {
            await supabase
              .from('savings_withdrawals')
              .update({
                estado: 'cancelado',
                cancelled_at: new Date().toISOString(),
                cancelled_by: currentUser.id,
                comentarios_admin: 'Retiro cancelado por reactivación de modelo (Ctrl+Z)'
              })
              .in('id', refundWithdrawals.map(w => w.id));
          }

          console.log(`✅ [REACTIVAR] Reactivación y Ctrl+Z completados exitosamente para ${email}`);

        } catch (reactivationErr: any) {
          console.error(`❌ [REACTIVAR] Error crítico durante reactivación:`, reactivationErr);
          return NextResponse.json(
            { success: false, error: `Error durante la reactivación: ${reactivationErr.message}` },
            { status: 500 }
          );
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