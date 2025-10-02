import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { canRequestAnticipo } from '@/utils/anticipo-restrictions';

// Usar SERVICE_ROLE_KEY si está disponible, sino usar ANON_KEY
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey!
);

// Verificar configuración de Supabase
console.log('🔍 [API ANTICIPOS] Configuración Supabase:', {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configurado' : '❌ No configurado',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ No configurado',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ No configurado',
  usingKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON'
});

// =====================================================
// 📋 GET - Obtener anticipos
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const periodDate = searchParams.get('periodDate');
    const estado = searchParams.get('estado');
    const adminId = searchParams.get('adminId'); // Para admin/super_admin

    console.log('🔍 [API ANTICIPOS] GET request:', { modelId, periodDate, estado, adminId });

    // Filtros según el rol
    if (adminId) {
      // Admin/Super Admin: obtener anticipos
      console.log('🔍 [API ANTICIPOS] Buscando admin con ID:', adminId);
      
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminId)
        .single();

      console.log('🔍 [API ANTICIPOS] Resultado admin:', { adminUser, adminError });

      if (adminError) {
        console.error('❌ [API ANTICIPOS] Error al buscar admin:', adminError);
        return NextResponse.json({ success: false, error: `Error al buscar admin: ${adminError.message}` }, { status: 500 });
      }

      if (!adminUser) {
        console.error('❌ [API ANTICIPOS] Admin no encontrado con ID:', adminId);
        return NextResponse.json({ success: false, error: 'Admin no encontrado' }, { status: 404 });
      }

      console.log('🔍 [API ANTICIPOS] Rol del admin:', adminUser.role);

      // Consulta simplificada para debuggear
      let query = supabase
        .from('anticipos')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtrado por rol: Admin solo ve anticipos de su grupo, Super Admin ve todos
      console.log('🔍 [API ANTICIPOS] Aplicando filtros para rol:', adminUser.role);
      if (adminUser.role === 'admin') {
        // Admin: solo anticipos de modelos de su grupo
        // Obtener grupos del admin
        const { data: adminGroups } = await supabase
          .from('user_groups')
          .select('group_id')
          .eq('user_id', adminId);
        
        if (adminGroups && adminGroups.length > 0) {
          const groupIds = adminGroups.map(g => g.group_id);
          
          // Obtener IDs de modelos de esos grupos
          const { data: modelIds } = await supabase
            .from('user_groups')
            .select(`
              user_id,
              users!user_groups_user_id_fkey (
                id,
                role
              )
            `)
            .in('group_id', groupIds)
            .eq('users.role', 'modelo');
          
          if (modelIds && modelIds.length > 0) {
            const ids = modelIds.map(m => m.user_id);
            query = query.in('model_id', ids);
          } else {
            // Si no hay modelos en el grupo, devolver array vacío
            query = query.eq('id', 'no-exists');
          }
        } else {
          // Si el admin no tiene grupos, devolver array vacío
          query = query.eq('id', 'no-exists');
        }
      }
      
      // Aplicar filtros adicionales
      if (periodDate) {
        query = query.eq('period_id', 
          supabase
            .from('periods')
            .select('id')
            .eq('start_date', periodDate)
        );
      }
      
      if (estado && estado !== 'todos') {
        // Manejar múltiples estados separados por comas
        if (estado.includes(',')) {
          const estados = estado.split(',').map(e => e.trim());
          query = query.in('estado', estados);
        } else {
          query = query.eq('estado', estado);
        }
      }

      const { data: anticipos, error } = await query;
      
      console.log('🔍 [API ANTICIPOS] Resultado de la consulta:', { 
        anticiposCount: anticipos?.length || 0, 
        error: error?.message 
      });
      
      if (error) {
        console.error('❌ [API ANTICIPOS] Error fetching anticipos:', error);
        return NextResponse.json({ success: false, error: 'Error al obtener anticipos' }, { status: 500 });
      }

      return NextResponse.json({ success: true, anticipos: anticipos || [] });
      
    } else if (modelId) {
      // Modelo: solo sus propios anticipos
      let query = supabase
        .from('anticipos')
        .select(`
          *,
          model:users!anticipos_model_id_fkey(id, name, email, role),
          period:periods(id, name, start_date, end_date)
        `)
        .eq('model_id', modelId)
        .order('created_at', { ascending: false });

      // Filtros adicionales
      if (periodDate) {
        query = query.eq('period_id', 
          supabase
            .from('periods')
            .select('id')
            .eq('start_date', periodDate)
        );
      }

      if (estado) {
        // Soporte para múltiples estados separados por comas
        if (estado.includes(',')) {
          const estados = estado.split(',').map(e => e.trim());
          query = query.in('estado', estados);
        } else {
          query = query.eq('estado', estado);
        }
      }

      const { data: anticipos, error } = await query;

      if (error) {
        console.error('❌ [API ANTICIPOS] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      console.log('✅ [API ANTICIPOS] Anticipos encontrados:', anticipos?.length || 0);

      return NextResponse.json({
        success: true,
        data: anticipos || [],
        count: anticipos?.length || 0
      });
    } else {
      return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =====================================================
// ➕ POST - Crear anticipo
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // Validar restricciones temporales
    const restriction = canRequestAnticipo();
    if (!restriction.allowed) {
      console.log('🚫 [API ANTICIPOS] Solicitud bloqueada por restricción temporal:', restriction.reason);
      return NextResponse.json({ 
        success: false, 
        error: restriction.reason 
      }, { status: 400 });
    }

    const body = await request.json();
    console.log('🔍 [API ANTICIPOS] POST request body:', body);

    const {
      model_id,
      period_date,
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
      documento_titular
    } = body;

    // Validaciones
    if (!model_id || !period_date || !monto_solicitado || !medio_pago) {
      return NextResponse.json({ 
        success: false, 
        error: 'Datos requeridos: model_id, period_date, monto_solicitado, medio_pago' 
      }, { status: 400 });
    }

    if (monto_solicitado <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'El monto debe ser mayor a 0' 
      }, { status: 400 });
    }

    // Obtener o crear período
    const { data: period, error: periodError } = await supabase
      .from('periods')
      .select('id')
      .eq('start_date', period_date)
      .single();

    if (periodError && periodError.code !== 'PGRST116') {
      console.error('❌ [API ANTICIPOS] Error obteniendo período:', periodError);
      return NextResponse.json({ success: false, error: 'Error obteniendo período' }, { status: 500 });
    }

    let periodId = period?.id;

    if (!periodId) {
      // Crear período si no existe
      const { data: newPeriod, error: createPeriodError } = await supabase
        .from('periods')
        .insert({
          name: `Período ${period_date}`,
          start_date: period_date,
          end_date: period_date,
          is_active: true
        })
        .select('id')
        .single();

      if (createPeriodError) {
        console.error('❌ [API ANTICIPOS] Error creando período:', createPeriodError);
        return NextResponse.json({ success: false, error: 'Error creando período' }, { status: 500 });
      }

      periodId = newPeriod.id;
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
        model:users!anticipos_model_id_fkey(id, name, email),
        period:periods(id, name, start_date, end_date)
      `)
      .single();

    if (createError) {
      console.error('❌ [API ANTICIPOS] Error creando anticipo:', createError);
      return NextResponse.json({ success: false, error: createError.message }, { status: 500 });
    }

    console.log('✅ [API ANTICIPOS] Anticipo creado:', newAnticipo.id);

    return NextResponse.json({
      success: true,
      data: newAnticipo,
      message: 'Solicitud de anticipo enviada correctamente'
    });

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
