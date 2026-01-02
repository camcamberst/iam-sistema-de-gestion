/**
 * 🔓 Endpoint para descongelar plataformas especiales
 * Permite descongelar todas las plataformas o por modelo específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Helper para verificar autenticación y rol de admin
async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
  
  if (error || !user) {
    return { error: `Token inválido: ${error?.message || 'Usuario no encontrado'}`, user: null };
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    return { error: 'Error obteniendo datos de usuario', user: null };
  }

  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    return { error: 'No autorizado. Se requiere rol de admin o super_admin', user: null };
  }

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET: Verificar estado de plataformas congeladas
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    let query = supabase
      .from('calculator_early_frozen_platforms')
      .select('period_date, platform_id, model_id, frozen_at')
      .order('frozen_at', { ascending: false });

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    const { data: frozenRecords, error } = await query;

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Agrupar por modelo y período
    const byModel = new Map<string, any[]>();
    frozenRecords?.forEach(record => {
      if (!byModel.has(record.model_id)) {
        byModel.set(record.model_id, []);
      }
      byModel.get(record.model_id)!.push(record);
    });

    // Obtener emails de modelos
    const modelIds = Array.from(byModel.keys());
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    const emailMap = new Map(users?.map(u => [u.id, u.email]) || []);

    const summary = Array.from(byModel.entries()).map(([id, records]) => ({
      model_id: id,
      email: emailMap.get(id) || id,
      frozen_count: records.length,
      platforms: Array.from(new Set(records.map(r => r.platform_id))),
      periods: Array.from(new Set(records.map(r => r.period_date)))
    }));

    return NextResponse.json({
      success: true,
      total_records: frozenRecords?.length || 0,
      total_models: byModel.size,
      summary: summary,
      records: frozenRecords || []
    });

  } catch (error: any) {
    console.error('❌ [UNFREEZE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * DELETE: Descongelar plataformas
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const all = searchParams.get('all') === 'true';

    console.log('🔓 [UNFREEZE] Iniciando descongelamiento de plataformas...', {
      modelId: modelId?.substring(0, 8),
      all
    });

    let query = supabase
      .from('calculator_early_frozen_platforms')
      .delete();

    if (all) {
      // Eliminar TODOS los registros
      query = query.neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      console.log('🔓 [UNFREEZE] Descongelando TODAS las plataformas de TODOS los modelos...');
    } else if (modelId) {
      // Eliminar para un modelo específico
      query = query.eq('model_id', modelId);
      console.log(`🔓 [UNFREEZE] Descongelando plataformas para modelo ${modelId.substring(0, 8)}...`);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Se requiere modelId o all=true'
      }, { status: 400 });
    }

    const { data: deletedData, error: deleteError } = await query.select();

    if (deleteError) {
      console.error('❌ [UNFREEZE] Error:', deleteError);
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 });
    }

    const deletedCount = deletedData?.length || 0;
    console.log(`✅ [UNFREEZE] Descongelamiento completado: ${deletedCount} registros eliminados`);

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      message: `Se descongelaron ${deletedCount} plataforma(s)`
    });

  } catch (error: any) {
    console.error('❌ [UNFREEZE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

