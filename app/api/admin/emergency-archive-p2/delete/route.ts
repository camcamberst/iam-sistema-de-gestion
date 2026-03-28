
export const dynamic = 'force-dynamic';

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
async function deleteValuesLogic(forceDelete: boolean = false) {
  const startDate = '2025-12-16';
  const endDate = '2025-12-31';
  const periodType = '16-31';
  const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
  const fechaLimiteISO = fechaLimite.toISOString();
  
  if (forceDelete) {
    console.log('⚠️ [DELETE-VALUES] MODO FORZADO: Se eliminarán valores incluso sin archivo');
  }

  console.log('🗑️ [DELETE-VALUES] Iniciando eliminación de valores de P2 de diciembre...');
  console.log(`📅 [DELETE-VALUES] Rango: ${startDate} a ${endDate}`);
  if (forceDelete) {
    console.log(`⚠️ [DELETE-VALUES] MODO FORZADO: Eliminando TODOS los valores del período (sin filtro de updated_at)`);
  } else {
    console.log(`⏰ [DELETE-VALUES] Solo valores hasta: ${fechaLimiteISO}`);
  }

  // 1. Obtener modelos con valores en el período
  let valoresQuery = supabase
    .from('model_values')
    .select('model_id')
    .gte('period_date', startDate)
    .lte('period_date', endDate);
  
  // Solo aplicar filtro de updated_at si NO es modo forzado
  if (!forceDelete) {
    valoresQuery = valoresQuery.lte('updated_at', fechaLimiteISO);
  }
  
  const { data: valores, error: valoresError } = await valoresQuery;

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
        error: null,
        valores_en_model_values: 0
      };

      // Contar valores en model_values para este modelo
      let countQuery = supabase
        .from('model_values')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId)
        .gte('period_date', startDate)
        .lte('period_date', endDate);
      
      // Solo aplicar filtro de updated_at si NO es modo forzado
      if (!forceDelete) {
        countQuery = countQuery.lte('updated_at', fechaLimiteISO);
      }
      
      const { count: valoresCount } = await countQuery;
      resultado.valores_en_model_values = valoresCount || 0;

      // Verificar archivo - buscar en diferentes posibles period_date
      // A veces el period_date puede ser diferente (ej: 2025-12-31 en lugar de 2025-12-16)
      const { data: archivo, error: archivoError } = await supabase
        .from('calculator_history')
        .select('platform_id, period_date')
        .eq('model_id', modelId)
        .eq('period_type', periodType)
        .gte('period_date', startDate)
        .lte('period_date', endDate);

      if (!archivoError && archivo && archivo.length > 0) {
        resultado.tiene_archivo = true;
        resultado.registros_archivados = archivo.length;
        resultado.period_date_encontrado = archivo[0].period_date; // Mostrar qué period_date se encontró
        modelosConArchivo++;
        console.log(`✅ [DELETE-VALUES] ${email}: Tiene ${archivo.length} registros archivados (period_date: ${archivo[0].period_date})`);
      } else {
        modelosSinArchivo++;
        resultado.error = `No tiene archivo en calculator_history para period_date=${startDate}, period_type=${periodType}`;
        if (archivoError) {
          resultado.error += ` (Error: ${archivoError.message})`;
        }
        console.log(`⚠️ [DELETE-VALUES] ${email}: NO tiene archivo. Valores en model_values: ${resultado.valores_en_model_values}`);
      }

      resultados.push(resultado);
    }

  console.log(`✅ [DELETE-VALUES] Modelos con archivo: ${modelosConArchivo}`);
  console.log(`⚠️ [DELETE-VALUES] Modelos sin archivo (se omitirán): ${modelosSinArchivo}`);

  if (modelosConArchivo === 0 && !forceDelete) {
    console.log('⚠️ [DELETE-VALUES] No hay modelos con archivo. No se eliminará ningún valor.');
    return {
      success: true,
      mensaje: `No se eliminaron valores. ${modelosSinArchivo} modelo(s) no tienen archivo y fueron omitidos por seguridad.`,
      eliminados: 0,
      resumen: {
        total_modelos: resultados.length,
        exitosos: 0,
        errores: modelosSinArchivo,
        modelos_sin_archivo: modelosSinArchivo,
        total_eliminados: 0,
        residuales_restantes: valores.length
      },
      resultados: resultados
    };
  }
  
  if (forceDelete && modelosConArchivo === 0) {
    console.log('⚠️ [DELETE-VALUES] MODO FORZADO: Eliminando valores de modelos sin archivo...');
  }

  // 4. Eliminar valores
  const modelosAEliminar = forceDelete ? resultados.length : modelosConArchivo;
  const modelosAOmitir = forceDelete ? 0 : modelosSinArchivo;
  console.log(`🗑️ [DELETE-VALUES] Eliminando valores de ${modelosAEliminar} modelo(s) ${forceDelete ? '(MODO FORZADO - incluyendo sin archivo)' : '(solo con archivo)'} (omitidos ${modelosAOmitir} sin archivo)...`);
  let exitosos = 0;
  let errores = 0;
  let totalEliminados = 0;

  for (const resultado of resultados) {
    if (!resultado.tiene_archivo && !forceDelete) {
      console.log(`⏭️ [DELETE-VALUES] ${resultado.email}: Omitido (no tiene archivo, ${resultado.valores_en_model_values} valores no eliminados)`);
      // No contar como error, solo como omitido
      continue;
    }
    
    if (!resultado.tiene_archivo && forceDelete) {
      console.log(`⚠️ [DELETE-VALUES] ${resultado.email}: MODO FORZADO - Eliminando sin archivo (${resultado.valores_en_model_values} valores)`);
    }

    console.log(`🗑️ [DELETE-VALUES] Eliminando valores de ${resultado.email}...`);

    try {
      // Si es modo forzado, eliminar sin filtro de updated_at para asegurar que se eliminen todos
      let deleteQuery = supabase
        .from('model_values')
        .delete()
        .eq('model_id', resultado.model_id)
        .gte('period_date', startDate)
        .lte('period_date', endDate);
      
      // Solo aplicar filtro de updated_at si NO es modo forzado
      if (!forceDelete) {
        deleteQuery = deleteQuery.lte('updated_at', fechaLimiteISO);
      } else {
        console.log(`   ⚠️ [DELETE-VALUES] MODO FORZADO: Eliminando TODOS los valores del período (sin filtro de updated_at)`);
      }
      
      const { data: deletedData, error: deleteError } = await deleteQuery.select();

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
        // No contar como error si se eliminó exitosamente
      }
    } catch (error: any) {
      resultado.error = error.message || 'Error desconocido';
      console.error(`❌ [DELETE-VALUES] Error crítico eliminando ${resultado.email}:`, error);
      errores++;
    }
  }

  // 5. Verificación final
  console.log('🔍 [DELETE-VALUES] Verificación final...');
  let finalQuery = supabase
    .from('model_values')
    .select('model_id')
    .gte('period_date', startDate)
    .lte('period_date', endDate);
  
  // Solo aplicar filtro de updated_at si NO es modo forzado
  if (!forceDelete) {
    finalQuery = finalQuery.lte('updated_at', fechaLimiteISO);
  }
  
  const { data: finalValores } = await finalQuery;

  const residuales = finalValores?.length || 0;

  console.log(`✅ [DELETE-VALUES] Proceso completado: ${exitosos} exitosos, ${errores} errores, ${totalEliminados} valores eliminados`);

  // Separar modelos omitidos (sin archivo) de errores reales
  const modelosOmitidos = resultados.filter(r => !r.tiene_archivo);
  const modelosConErrores = resultados.filter(r => r.tiene_archivo && r.error);
  
  let mensaje = `Eliminación completada. ${totalEliminados} valores eliminados de ${exitosos} modelo(s).`;
  if (modelosOmitidos.length > 0) {
    mensaje += ` ${modelosOmitidos.length} modelo(s) omitido(s) por no tener archivo.`;
  }
  if (modelosConErrores.length > 0) {
    mensaje += ` ${modelosConErrores.length} modelo(s) con errores.`;
  }

  return {
    success: true,
    mensaje,
    resumen: {
      total_modelos: resultados.length,
      exitosos,
      errores: modelosConErrores.length, // Solo errores reales, no omitidos
      modelos_omitidos: modelosOmitidos.length, // Modelos sin archivo (no son errores)
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

    // Verificar si se solicita eliminación forzada
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    const result = await deleteValuesLogic(forceDelete);
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

    // Verificar si se solicita eliminación forzada desde el body
    let forceDelete = false;
    try {
      const body = await request.json();
      forceDelete = body.force === true;
    } catch {
      // Si no hay body, verificar query params
      const { searchParams } = new URL(request.url);
      forceDelete = searchParams.get('force') === 'true';
    }

    const result = await deleteValuesLogic(forceDelete);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ [DELETE-VALUES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

