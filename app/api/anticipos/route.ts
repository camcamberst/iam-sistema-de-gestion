import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getPeriodDetails } from '@/utils/calculator-dates';
import { notifyNewAnticipo } from '@/lib/email-service';
import { addAffiliateFilter, type AuthUser } from '@/lib/affiliates/filters';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Usar Service Role para permisos
const supabase = createClient(supabaseUrl, supabaseKey);

// =====================================================
// 📋 GET - Obtener historial de anticipos del modelo
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model_id = searchParams.get('modelId');
    const admin_id = searchParams.get('adminId');
    const estado = searchParams.get('estado');

    // 🔧 FIX: Permitir consulta si es Admin (adminId) o Modelo (modelId)
    if (!model_id && !admin_id) {
      return NextResponse.json({ success: false, error: 'modelId o adminId es requerido' }, { status: 400 });
    }

    // Determinar si necesitamos incluir grupos en la consulta
    let includeGroups = false;
    let adminGroups: string[] = [];
    let modelIds: string[] = [];

    // 🔒 FILTRAR POR GRUPOS DEL ADMIN (solo para admin, no super_admin)
    if (admin_id && !model_id) {
      // Obtener información del admin y sus grupos
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select(`
          role,
          affiliate_studio_id,
          user_groups(
            groups!inner(
              id,
              name
            )
          )
        `)
        .eq('id', admin_id)
        .single();

      if (adminError) {
        console.error('❌ [API ANTICIPOS] Error al obtener admin:', adminError);
        return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
      }

      const isSuperAdmin = adminUser.role === 'super_admin';
      const isAdmin = adminUser.role === 'admin';
      const isSuperadminAff = adminUser.role === 'superadmin_aff';

      if (!isSuperAdmin && !isAdmin && !isSuperadminAff) {
        return NextResponse.json({ success: false, error: 'No tienes permisos para ver anticipos' }, { status: 403 });
      }

      // Si es admin (no super_admin), filtrar por grupos asignados
      if (isAdmin && !isSuperAdmin) {
        adminGroups = adminUser.user_groups?.map((ug: any) => ug.groups.id) || [];
        console.log('🔒 [API ANTICIPOS] Filtrando por grupos del admin:', adminGroups);

        if (adminGroups.length > 0) {
          // Obtener modelos que pertenecen a los grupos del admin
          const { data: modelGroups, error: modelGroupsError } = await supabase
            .from('user_groups')
            .select('user_id')
            .in('group_id', adminGroups);

          if (modelGroupsError) {
            console.error('❌ [API ANTICIPOS] Error al obtener grupos de modelos:', modelGroupsError);
            return NextResponse.json({ success: false, error: 'Error al filtrar anticipos' }, { status: 500 });
          }

          modelIds = modelGroups?.map(mg => mg.user_id) || [];
          if (modelIds.length === 0) {
            // No hay modelos en los grupos del admin, devolver array vacío
            return NextResponse.json({ success: true, data: [] });
          }
        } else {
          // Admin sin grupos asignados, no puede ver anticipos
          return NextResponse.json({ success: true, data: [] });
        }
      }
      // Si es super_admin, no filtrar (ver todos los anticipos)
      includeGroups = true; // Incluir grupos en la respuesta para admins
    }

    // Construir la consulta con el select apropiado
    const selectQuery = includeGroups
      ? `
        *,
        period:periods(name, start_date, end_date),
        model:users!model_id(
          id,
          name,
          email,
          user_groups(
            groups!inner(
              id,
              name
            )
          )
        )
      `
      : `
        *,
        period:periods(name, start_date, end_date),
        model:users!model_id(name, email, id) 
      `;

    let query = supabase
      .from('anticipos')
      .select(selectQuery)
      .order('created_at', { ascending: false });

    // Si se especifica modelo, filtrar por modelo
    if (model_id) {
      query = query.eq('model_id', model_id);
    }

    // Si se especifica estado (opcional, útil para admin)
    if (estado) {
      // Soporte para múltiples estados separados por coma
      const estados = estado.split(',');
      if (estados.length > 1) {
        query = query.in('estado', estados);
      } else {
        query = query.eq('estado', estado);
      }
    }

    // Aplicar filtro por grupos del admin si es necesario
    if (modelIds.length > 0) {
      query = query.in('model_id', modelIds);
    }

    // Aplicar filtro de afiliado si el admin es superadmin_aff o admin de afiliado
    if (admin_id && !model_id) {
      const { data: adminUser } = await supabase
        .from('users')
        .select('role, affiliate_studio_id')
        .eq('id', admin_id)
        .single();

      if (adminUser) {
        const currentUser: AuthUser = {
          id: admin_id,
          role: adminUser.role,
          affiliate_studio_id: adminUser.affiliate_studio_id
        };
        // Aplicar filtro de afiliado a la tabla anticipos (que tiene affiliate_studio_id)
        query = addAffiliateFilter(query, currentUser);
      }
    }

    const { data: anticipos, error } = await query;

    if (error) {
      console.error('❌ [API ANTICIPOS] Error obteniendo anticipos:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Procesar anticipos para formatear grupos correctamente
    const processedAnticipos = (anticipos || []).map((anticipo: any) => ({
      ...anticipo,
      model: {
        ...anticipo.model,
        groups: anticipo.model?.user_groups?.map((ug: any) => ug.groups) || []
      }
    }));

    return NextResponse.json({ success: true, data: processedAnticipos });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// ➕ POST - Crear anticipo
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      model_id,
      monto_solicitado,
      porcentaje_solicitado,
      monto_disponible,
      medio_pago,
      nombre_beneficiario,
      numero_telefono,
      nombre_titular,
      banco,
      banco_otro,
      tipo_cuenta,
      numero_cuenta,
      documento_titular,
      period_date // Fecha de referencia para el periodo (puede ser hoy)
    } = body;

    // Validación básica
    if (!model_id || !monto_solicitado || !medio_pago) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // 1. Gestionar el Período
    // 🔧 FIX: Asegurar que se use el período quincenal correcto, NO uno diario
    const targetDate = period_date || getColombiaDate();
    const { startDate, endDate, name: periodName } = getPeriodDetails(targetDate);

    console.log('🔍 [API ANTICIPOS] Buscando/Creando período:', { targetDate, startDate, endDate, periodName });

    // Buscar período existente por fechas exactas (quincenal)
    let { data: period, error: periodError } = await supabase
      .from('periods')
      .select('id, is_active')
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .eq('is_active', true)
      .maybeSingle();

    let periodId = period?.id;

    if (!periodId) {
      // Crear período quincenal si no existe
      console.log('🔄 [API ANTICIPOS] Creando nuevo período quincenal:', periodName);
      const { data: newPeriod, error: createPeriodError } = await supabase
        .from('periods')
        .insert({
          name: periodName,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        })
        .select('id')
        .single();

      if (createPeriodError) {
        // Manejar race condition
        if (createPeriodError.code === '23505') { // Unique violation
           const { data: retryPeriod } = await supabase
            .from('periods')
            .select('id')
            .eq('start_date', startDate)
            .eq('end_date', endDate)
            .single();
           periodId = retryPeriod?.id;
        } else {
          console.error('❌ [API ANTICIPOS] Error creando período:', createPeriodError);
          return NextResponse.json({ success: false, error: 'Error creando período' }, { status: 500 });
        }
      } else {
        periodId = newPeriod.id;
      }
    }

    if (!periodId) {
       return NextResponse.json({ success: false, error: 'No se pudo asignar un período válido' }, { status: 500 });
    }

    // Verificar que no haya anticipos pendientes para el mismo período
    const { data: existingAnticipo, error: existingError } = await supabase
      .from('anticipos')
      .select('id, estado')
      .eq('model_id', model_id)
      .eq('period_id', periodId)
      .eq('estado', 'pendiente')
      .single();

    if (existingAnticipo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ya tienes una solicitud pendiente para este período' 
      }, { status: 400 });
    }

    // Crear anticipo
    const anticipoData: any = {
      model_id,
      period_id: periodId,
      monto_solicitado,
      porcentaje_solicitado,
      monto_disponible,
      medio_pago,
      estado: 'pendiente'
    };

    // Agregar datos según el medio de pago
    if (medio_pago === 'nequi' || medio_pago === 'daviplata') {
      anticipoData.nombre_beneficiario = nombre_beneficiario;
      anticipoData.numero_telefono = numero_telefono;
    } else if (medio_pago === 'cuenta_bancaria') {
      anticipoData.nombre_titular = nombre_titular;
      anticipoData.banco = banco;
      anticipoData.banco_otro = banco_otro;
      anticipoData.tipo_cuenta = tipo_cuenta;
      anticipoData.numero_cuenta = numero_cuenta;
      anticipoData.documento_titular = documento_titular;
    }

    const { data: newAnticipo, error: createError } = await supabase
      .from('anticipos')
      .insert(anticipoData)
      .select(`
        *,
        model:users!model_id(name, email)
      `)
      .single();

    if (createError) {
      console.error('❌ [API ANTICIPOS] Error creando anticipo:', createError);
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    // Enviar notificación por correo
    if (newAnticipo) {
      // Nombre de la modelo (seguro)
      const modelName = (newAnticipo.model as any)?.name || 'Modelo';
      
      // Disparamos la notificación sin esperar (fire and forget) para no demorar la respuesta al usuario
      notifyNewAnticipo({
        modelName: modelName,
        amount: monto_solicitado,
        requestId: newAnticipo.id,
        paymentMethod: medio_pago,
        modelId: model_id
      }).catch(err => console.error('❌ Error async enviando email:', err));
    }

    return NextResponse.json({ success: true, data: newAnticipo });

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
