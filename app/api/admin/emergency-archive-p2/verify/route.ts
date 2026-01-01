/**
 * Endpoint de verificación: Revisar estado del archivado de P2 de Diciembre
 * Verifica si hay registros en calculator_history y valores en model_values
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Helper para verificar autenticación y rol de admin
async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  console.log('🔐 [VERIFY-AUTH] Verificando autenticación...');
  console.log('🔐 [VERIFY-AUTH] Header authorization:', authHeader ? 'Presente' : 'Ausente');
  
  if (!authHeader) {
    console.error('❌ [VERIFY-AUTH] No hay header de autorización');
    return { error: 'Token de autorización requerido', user: null };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.error('❌ [VERIFY-AUTH] Header no tiene formato Bearer');
    return { error: 'Token de autorización requerido', user: null };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('❌ [VERIFY-AUTH] Token vacío');
    return { error: 'Token de autorización requerido', user: null };
  }
  
  console.log('🔐 [VERIFY-AUTH] Token obtenido, verificando con Supabase...');
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    console.error('❌ [VERIFY-AUTH] Error verificando token:', error.message);
    return { error: `Token inválido: ${error.message}`, user: null };
  }
  
  if (!user) {
    console.error('❌ [VERIFY-AUTH] Usuario no encontrado');
    return { error: 'Token inválido', user: null };
  }
  
  console.log('✅ [VERIFY-AUTH] Usuario autenticado:', user.id);

  // Verificar rol del usuario
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error('❌ [VERIFY-AUTH] Error obteniendo datos de usuario:', userError.message);
    return { error: `Error obteniendo datos de usuario: ${userError.message}`, user: null };
  }
  
  if (!userData) {
    console.error('❌ [VERIFY-AUTH] Datos de usuario no encontrados');
    return { error: 'Error obteniendo datos de usuario', user: null };
  }
  
  console.log('🔐 [VERIFY-AUTH] Rol del usuario:', userData.role);

  // Solo permitir admin y super_admin
  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    console.error('❌ [VERIFY-AUTH] Rol no autorizado:', userData.role);
    return { error: 'No autorizado. Se requiere rol de admin o super_admin', user: null };
  }
  
  console.log('✅ [VERIFY-AUTH] Autenticación exitosa para:', userData.role);

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación y rol de admin
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const startDate = '2025-12-16';
    const endDate = '2025-12-31';
    const periodType = '16-31';

    // 1. Verificar registros en calculator_history
    const { data: history, error: historyError } = await supabase
      .from('calculator_history')
      .select('model_id, platform_id, period_date, period_type, value, archived_at')
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (historyError) {
      return NextResponse.json({
        success: false,
        error: `Error consultando calculator_history: ${historyError.message}`
      }, { status: 500 });
    }

    // 2. Verificar valores en model_values
    const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISO = fechaLimite.toISOString();

    const { data: modelValues, error: modelValuesError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, period_date, value, updated_at')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    if (modelValuesError) {
      return NextResponse.json({
        success: false,
        error: `Error consultando model_values: ${modelValuesError.message}`
      }, { status: 500 });
    }

    // 3. Agrupar por modelo
    const modelosEnHistory = new Set<string>();
    const modelosEnModelValues = new Set<string>();
    
    history?.forEach(h => modelosEnHistory.add(h.model_id));
    modelValues?.forEach(v => modelosEnModelValues.add(v.model_id));

    // 4. Contar plataformas por modelo
    const plataformasPorModelo = new Map<string, number>();
    modelValues?.forEach(v => {
      const count = plataformasPorModelo.get(v.model_id) || 0;
      plataformasPorModelo.set(v.model_id, count + 1);
    });

    // 5. Obtener emails de modelos
    const todosLosModelIds = Array.from(new Set([
      ...Array.from(modelosEnHistory),
      ...Array.from(modelosEnModelValues)
    ]));

    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', todosLosModelIds);

    const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

    // 6. Preparar resumen
    const resumen = {
      registros_en_history: history?.length || 0,
      registros_en_model_values: modelValues?.length || 0,
      modelos_en_history: modelosEnHistory.size,
      modelos_en_model_values: modelosEnModelValues.size,
      modelos_solo_en_model_values: Array.from(modelosEnModelValues).filter(id => !modelosEnHistory.has(id)).length,
      fecha_limite: fechaLimiteISO
    };

    // 7. Preparar detalles por modelo
    const detalles = Array.from(modelosEnModelValues).map(modelId => {
      const enHistory = modelosEnHistory.has(modelId);
      const plataformas = plataformasPorModelo.get(modelId) || 0;
      const email = emailMap.get(modelId) || modelId;

      return {
        model_id: modelId,
        email,
        en_history: enHistory,
        plataformas_en_model_values: plataformas,
        necesita_archivado: !enHistory
      };
    });

    return NextResponse.json({
      success: true,
      resumen,
      detalles: detalles.slice(0, 50), // Limitar a 50 para no sobrecargar
      total_modelos: detalles.length
    });

  } catch (error: any) {
    console.error('❌ [VERIFY-ARCHIVE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}



