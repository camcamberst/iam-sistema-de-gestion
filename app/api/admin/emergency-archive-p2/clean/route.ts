/**
 * 🧹 Endpoint para limpiar registros archivados incorrectamente
 * Elimina los registros de calculator_history para el período P2 de diciembre
 * para permitir un re-archivado correcto
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Helper para verificar autenticación y rol de admin
async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return { error: 'Token de autorización requerido', user: null };
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autorización requerido', user: null };
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return { error: 'Token de autorización requerido', user: null };
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    return { error: `Token inválido: ${error.message}`, user: null };
  }
  
  if (!user) {
    return { error: 'Token inválido', user: null };
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError) {
    return { error: `Error obteniendo datos de usuario: ${userError.message}`, user: null };
  }
  
  if (!userData) {
    return { error: 'Error obteniendo datos de usuario', user: null };
  }

  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    return { error: 'No autorizado. Se requiere rol de admin o super_admin', user: null };
  }

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function DELETE(request: NextRequest) {
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
    const periodType = '16-31';

    console.log('🧹 [CLEAN] Eliminando registros archivados incorrectamente...');
    console.log(`🧹 [CLEAN] Período: ${startDate} (${periodType})`);

    // Eliminar registros del período
    const { data: deletedData, error: deleteError } = await supabase
      .from('calculator_history')
      .delete()
      .eq('period_date', startDate)
      .eq('period_type', periodType)
      .select('id, model_id, platform_id');

    if (deleteError) {
      console.error('❌ [CLEAN] Error eliminando registros:', deleteError);
      return NextResponse.json({
        success: false,
        error: `Error eliminando registros: ${deleteError.message}`
      }, { status: 500 });
    }

    const deletedCount = deletedData?.length || 0;
    console.log(`✅ [CLEAN] Eliminados ${deletedCount} registros`);

    // Verificar que se eliminaron
    const { count: remainingCount, error: verifyError } = await supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    if (verifyError) {
      console.error('⚠️ [CLEAN] Error verificando eliminación:', verifyError);
    }

    return NextResponse.json({
      success: true,
      mensaje: `Se eliminaron ${deletedCount} registros del historial. Ahora puedes volver a archivar correctamente.`,
      eliminados: deletedCount,
      restantes: remainingCount || 0
    });

  } catch (error: any) {
    console.error('❌ [CLEAN] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

