/**
 * 🗑️ Endpoint para eliminar valores de model_values del período P2 de Diciembre
 * 
 * IMPORTANTE: 
 * - Solo elimina valores que están archivados en calculator_history
 * - Verifica que cada modelo tiene archivo antes de eliminar
 * - Solo elimina valores hasta las 23:59:59 del 31 de diciembre
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Helper para verificar autenticación y rol de admin
async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  console.log('🔐 [DELETE-AUTH] Verificando autenticación...');
  console.log('🔐 [DELETE-AUTH] Header authorization:', authHeader ? 'Presente' : 'Ausente');
  
  if (!authHeader) {
    console.error('❌ [DELETE-AUTH] No hay header de autorización');
    return { error: 'Token de autorización requerido', user: null };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.error('❌ [DELETE-AUTH] Header no tiene formato Bearer');
    return { error: 'Token de autorización requerido', user: null };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('❌ [DELETE-AUTH] Token vacío');
    return { error: 'Token de autorización requerido', user: null };
  }
  
  console.log('🔐 [DELETE-AUTH] Token obtenido, verificando con Supabase...');
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    console.error('❌ [DELETE-AUTH] Error verificando token:', error.message);
    return { error: `Token inválido: ${error.message}`, user: null };
  }
  
  if (!user) {
    console.error('❌ [DELETE-AUTH] Usuario no encontrado');
    return { error: 'Token inválido', user: null };
  }

  console.log('✅ [DELETE-AUTH] Usuario autenticado:', user.id);

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError) {
    console.error('❌ [DELETE-AUTH] Error obteniendo datos de usuario:', userError.message);
    return { error: `Error obteniendo datos de usuario: ${userError.message}`, user: null };
  }
  
  if (!userData) {
    console.error('❌ [DELETE-AUTH] Datos de usuario no encontrados');
    return { error: 'Error obteniendo datos de usuario', user: null };
  }

  console.log('🔐 [DELETE-AUTH] Rol del usuario:', userData.role);

  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    console.error('❌ [DELETE-AUTH] Rol no autorizado:', userData.role);
    return { error: 'No autorizado. Se requiere rol de admin o super_admin', user: null };
  }

  console.log('✅ [DELETE-AUTH] Autenticación exitosa para:', userData.role);

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Función compartida para la lógica de eliminación
async function deleteValuesLogic() {
  const startDate = '2025-12-16';
  const endDate = '2025-12-31';
  const periodType = '16-31';
  const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
  const fechaLimiteISO = fechaLimite.toISOString();

  console.log('🗑️ [DELETE-VALUES] Iniciando eliminación de valores de P2 de diciembre...');
  console.log(`📅 [DELETE-VALUES] Rango: ${startDate} a ${endDate}`);
  console.log(`⏰ [DELETE-VALUES] Solo valores hasta: ${fechaLimiteISO}`);

  // 1. Obtener modelos con valores en el período
  const { data: valores, error: valoresError } = await supabase
    .from('model_values')
    .select('model_id')
    .gte('period_date', startDate)
    .lte('period_date', endDate)
    .lte('updated_at', fechaLimiteISO);

  if (valoresError) {
    console.error('❌ [DELETE-VALUES] Error obteniendo valores:', valoresError);
    throw new Error(`Error obteniendo valores: ${valoresError.message}`);
  }

  if (!valores || valores.length === 0) {
    return {
      success: true,
      mensaje: 'No hay valores para eliminar',
      eliminados: 0,
      resumen: {
        total_modelos: 0,
        exitosos: 0,
        errores: 0,
        modelos_sin_archivo: 0,
        total_eliminados: 0,
        residuales_restantes: 0
      },
      resultados: []
    };
  }

  // Agrupar por modelo
  const modelosConValores = Array.from(new Set(valores.map(v => v.model_id)));
  console.log(`📦 [DELETE-VALUES] Modelos con valores: ${modelosConValores.length}`);

  // 2. Obtener emails
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .in('id', modelosConValores);

  const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

  // 3. Verificar que cada modelo tiene archivo
  console.log('🔍 [DELETE-VALUES] Verificando que los modelos tienen archivo...');
  const resultados = [];
  let modelosConArchivo = 0;
  let modelosSinArchivo = 0;

  for (const modelId of modelosConValores) {
    const email = emailMap.get(modelId) || modelId;
    const resultado: any = {
      model_id: modelId,
      email,
      tiene_archivo: false,
      registros_archivados: 0,
      valores_eliminados: 0,
      error: null
    };

    // Verificar archivo
    const { data: archivo, error: archivoError } = await supabase
      .from('calculator_history')
      .select('platform_id')
      .eq('model_id', modelId)
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (!archivoError && archivo && archivo.length > 0) {
      resultado.tiene_archivo = true;
      resultado.registros_archivados = archivo.length;
      modelosConArchivo++;
    } else {
      modelosSinArchivo++;
      resultado.error = 'No tiene archivo en calculator_history';
    }

    resultados.push(resultado);
  }

  console.log(`✅ [DELETE-VALUES] Modelos con archivo: ${modelosConArchivo}`);
  console.log(`⚠️ [DELETE-VALUES] Modelos sin archivo: ${modelosSinArchivo}`);

  // 4. Eliminar valores SOLO de modelos con archivo
  console.log('🗑️ [DELETE-VALUES] Eliminando valores (solo modelos con archivo)...');
  let exitosos = 0;
  let errores = 0;
  let totalEliminados = 0;

  for (const resultado of resultados) {
    if (!resultado.tiene_archivo) {
      console.log(`⚠️ [DELETE-VALUES] ${resultado.email}: NO tiene archivo, se omite`);
      errores++;
      continue;
    }

    console.log(`🗑️ [DELETE-VALUES] Eliminando valores de ${resultado.email}...`);

    try {
      const { data: deletedData, error: deleteError } = await supabase
        .from('model_values')
        .delete()
        .eq('model_id', resultado.model_id)
        .gte('period_date', startDate)
        .lte('period_date', endDate)
        .lte('updated_at', fechaLimiteISO)
        .select();

      if (deleteError) {
        resultado.error = `Error eliminando: ${deleteError.message}`;
        console.error(`❌ [DELETE-VALUES] Error eliminando ${resultado.email}:`, deleteError);
        errores++;
      } else {
        const deletedCount = deletedData?.length || 0;
        resultado.valores_eliminados = deletedCount;
        totalEliminados += deletedCount;
        console.log(`✅ [DELETE-VALUES] ${resultado.email}: ${deletedCount} valores eliminados`);
        exitosos++;
      }
    } catch (error: any) {
      resultado.error = error.message || 'Error desconocido';
      console.error(`❌ [DELETE-VALUES] Error crítico eliminando ${resultado.email}:`, error);
      errores++;
    }
  }

  // 5. Verificación final
  console.log('🔍 [DELETE-VALUES] Verificación final...');
  const { data: finalValores } = await supabase
    .from('model_values')
    .select('model_id')
    .gte('period_date', startDate)
    .lte('period_date', endDate)
    .lte('updated_at', fechaLimiteISO);

  const residuales = finalValores?.length || 0;

  console.log(`✅ [DELETE-VALUES] Proceso completado: ${exitosos} exitosos, ${errores} errores, ${totalEliminados} valores eliminados`);

  return {
    success: true,
    mensaje: `Eliminación completada. ${totalEliminados} valores eliminados de ${exitosos} modelos.`,
    resumen: {
      total_modelos: resultados.length,
      exitosos,
      errores,
      modelos_sin_archivo: modelosSinArchivo,
      total_eliminados: totalEliminados,
      residuales_restantes: residuales
    },
    resultados: resultados
  };
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ [DELETE-VALUES] Endpoint DELETE llamado');
    
    // Verificar autenticación y rol de admin
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      console.error('❌ [DELETE-VALUES] Error de autenticación:', auth.error);
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    console.log('✅ [DELETE-VALUES] Autenticación exitosa, usuario:', auth.user.id);

    const result = await deleteValuesLogic();
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ [DELETE-VALUES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// También permitir POST como alternativa
export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ [DELETE-VALUES] Endpoint POST llamado (alternativa)');
    
    // Verificar autenticación y rol de admin
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      console.error('❌ [DELETE-VALUES] Error de autenticación:', auth.error);
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    console.log('✅ [DELETE-VALUES] Autenticación exitosa, usuario:', auth.user.id);

    const result = await deleteValuesLogic();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ [DELETE-VALUES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

