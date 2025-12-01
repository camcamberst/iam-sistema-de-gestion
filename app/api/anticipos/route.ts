import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getColombiaDate, getPeriodDetails } from '@/utils/calculator-dates';
import { sendAnticipoNotificationEmail } from '@/lib/email-service';

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

    if (!model_id) {
      return NextResponse.json({ success: false, error: 'modelId es requerido' }, { status: 400 });
    }

    const { data: anticipos, error } = await supabase
      .from('anticipos')
      .select(`
        *,
        period:periods(name, start_date, end_date)
      `)
      .eq('model_id', model_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API ANTICIPOS] Error obteniendo anticipos:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: anticipos });

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
        model:users(name, email)
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
      sendAnticipoNotificationEmail({
        modelo: modelName,
        monto: monto_solicitado,
        idSolicitud: newAnticipo.id,
        medioPago: medio_pago
      }).catch(err => console.error('❌ Error async enviando email:', err));
    }

    return NextResponse.json({ success: true, data: newAnticipo });

  } catch (error: any) {
    console.error('❌ [API ANTICIPOS] Error general:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
