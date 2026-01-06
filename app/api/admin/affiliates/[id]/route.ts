/**
 * 🏢 API: Operaciones individuales de Estudios Afiliados
 * 
 * Endpoints:
 * - GET: Obtener un estudio afiliado por ID
 * - PUT: Actualizar un estudio afiliado
 * - DELETE: Eliminar (desactivar) un estudio afiliado
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Helper para verificar autenticación y rol de admin/superadmin
async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autorización requerido', user: null };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { error: 'Token inválido', user: null };
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, affiliate_studio_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    return { error: 'Error obteniendo datos de usuario', user: null };
  }

  // Solo superadmin y admin de Innova pueden gestionar afiliados
  if (userData.role !== 'super_admin' && (userData.role !== 'admin' || userData.affiliate_studio_id)) {
    return { error: 'No autorizado. Se requiere rol de super_admin o admin de Innova', user: null };
  }

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Obtener un estudio afiliado por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = params;

    const { data: studio, error } = await supabase
      .from('affiliate_studios')
      .select(`
        id,
        name,
        description,
        commission_percentage,
        is_active,
        created_at,
        updated_at,
        created_by,
        created_by_user:users!affiliate_studios_created_by_fkey(id, name, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: false,
          error: 'Estudio afiliado no encontrado'
        }, { status: 404 });
      }
      
      console.error('❌ [AFFILIATES] Error obteniendo estudio:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Obtener estadísticas
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_studio_id', id);

    const { count: sedesCount } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_studio_id', id);

    const { count: modelsCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_studio_id', id)
      .eq('role', 'modelo');

    return NextResponse.json({
      success: true,
      data: {
        ...studio,
        stats: {
          users: usersCount || 0,
          sedes: sedesCount || 0,
          models: modelsCount || 0
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// PUT: Actualizar un estudio afiliado
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, commission_percentage, is_active } = body;

    // Verificar que el estudio existe
    const { data: existing } = await supabase
      .from('affiliate_studios')
      .select('id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Estudio afiliado no encontrado'
      }, { status: 404 });
    }

    // Preparar datos para actualizar
    const updateData: any = {};

    if (name !== undefined) {
      if (name.trim() === '') {
        return NextResponse.json({
          success: false,
          error: 'El nombre del estudio no puede estar vacío'
        }, { status: 400 });
      }

      // Verificar que no exista otro estudio con el mismo nombre
      const { data: duplicate } = await supabase
        .from('affiliate_studios')
        .select('id')
        .eq('name', name.trim())
        .neq('id', id)
        .single();

      if (duplicate) {
        return NextResponse.json({
          success: false,
          error: 'Ya existe otro estudio afiliado con ese nombre'
        }, { status: 400 });
      }

      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (commission_percentage !== undefined) {
      const commission = parseFloat(commission_percentage);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return NextResponse.json({
          success: false,
          error: 'El porcentaje de comisión debe estar entre 0 y 100'
        }, { status: 400 });
      }
      updateData.commission_percentage = commission;
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    // Actualizar el estudio
    const { data: updatedStudio, error } = await supabase
      .from('affiliate_studios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ [AFFILIATES] Error actualizando estudio:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedStudio,
      message: 'Estudio afiliado actualizado exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// DELETE: Desactivar un estudio afiliado (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verificar que el estudio existe
    const { data: existing } = await supabase
      .from('affiliate_studios')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Estudio afiliado no encontrado'
      }, { status: 404 });
    }

    // Verificar si tiene usuarios asociados
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_studio_id', id);

    if (usersCount && usersCount > 0) {
      // Soft delete: solo desactivar
      const { data: updatedStudio, error } = await supabase
        .from('affiliate_studios')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [AFFILIATES] Error desactivando estudio:', error);
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: updatedStudio,
        message: `Estudio afiliado "${existing.name}" desactivado exitosamente. Tiene ${usersCount} usuario(s) asociado(s).`
      });
    } else {
      // Hard delete: eliminar completamente si no tiene usuarios
      const { error } = await supabase
        .from('affiliate_studios')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ [AFFILIATES] Error eliminando estudio:', error);
        return NextResponse.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Estudio afiliado "${existing.name}" eliminado exitosamente`
      });
    }

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

