/**
 * 🏢 API: Gestión de Superadmin AFF para Estudios Afiliados
 * 
 * Endpoints:
 * - POST: Crear superadmin AFF para un estudio
 * - PUT: Actualizar superadmin AFF
 * - DELETE: Eliminar superadmin AFF
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

  // Solo superadmin puede gestionar superadmin AFF
  if (userData.role !== 'super_admin') {
    return { error: 'No autorizado. Se requiere rol de super_admin', user: null };
  }

  return { error: null, user: { id: user.id, role: userData.role } };
}

const supabase = createClient(supabaseUrl, supabaseKey);

// POST: Crear superadmin AFF para un estudio
export async function POST(
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

    const { id: affiliateStudioId } = params;
    const body = await request.json();
    const { email, name, password } = body;

    // Validaciones
    if (!email || !name || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email, nombre y contraseña son requeridos'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      }, { status: 400 });
    }

    // Verificar que el estudio existe
    const { data: studio, error: studioError } = await supabase
      .from('affiliate_studios')
      .select('id, name')
      .eq('id', affiliateStudioId)
      .single();

    if (studioError || !studio) {
      return NextResponse.json({
        success: false,
        error: 'Estudio afiliado no encontrado'
      }, { status: 404 });
    }

    // Verificar que no exista ya un superadmin AFF para este estudio
    const { data: existingSuperadmin } = await supabase
      .from('users')
      .select('id')
      .eq('affiliate_studio_id', affiliateStudioId)
      .eq('role', 'superadmin_aff')
      .maybeSingle();

    if (existingSuperadmin) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un superadmin AFF para este estudio. Elimina el existente primero.'
      }, { status: 400 });
    }

    // Verificar que el email no esté en uso
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Este email ya está registrado'
      }, { status: 400 });
    }

    // Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        role: 'superadmin_aff'
      }
    });

    if (authError || !authData.user) {
      console.error('❌ [AFFILIATES] Error creando usuario en Auth:', authError);
      return NextResponse.json({
        success: false,
        error: authError?.message || 'Error creando usuario en Auth'
      }, { status: 500 });
    }

    // Crear perfil en users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        name: name.trim(),
        email: email.trim(),
        role: 'superadmin_aff',
        affiliate_studio_id: affiliateStudioId,
        is_active: true
      })
      .select('id, name, email, is_active')
      .single();

    if (userError) {
      console.error('❌ [AFFILIATES] Error creando perfil de usuario:', userError);
      // Intentar eliminar el usuario de Auth si falla
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({
        success: false,
        error: userError.message || 'Error creando perfil de usuario'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: userData,
      message: 'Superadmin AFF creado exitosamente'
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// PUT: Actualizar superadmin AFF
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

    const { id: affiliateStudioId } = params;
    const body = await request.json();
    const { email, name, is_active, password } = body;

    // Verificar que el estudio existe
    const { data: studio } = await supabase
      .from('affiliate_studios')
      .select('id')
      .eq('id', affiliateStudioId)
      .single();

    if (!studio) {
      return NextResponse.json({
        success: false,
        error: 'Estudio afiliado no encontrado'
      }, { status: 404 });
    }

    // Obtener el superadmin AFF actual
    const { data: currentSuperadmin, error: findError } = await supabase
      .from('users')
      .select('id, email')
      .eq('affiliate_studio_id', affiliateStudioId)
      .eq('role', 'superadmin_aff')
      .maybeSingle();

    if (findError || !currentSuperadmin) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró superadmin AFF para este estudio'
      }, { status: 404 });
    }

    // Preparar datos de actualización
    const updateData: any = {};

    if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    // Si se cambia el email, verificar que no esté en uso
    if (email !== undefined && email.trim() !== currentSuperadmin.email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim())
        .neq('id', currentSuperadmin.id)
        .maybeSingle();

      if (existingUser) {
        return NextResponse.json({
          success: false,
          error: 'Este email ya está registrado'
        }, { status: 400 });
      }

      updateData.email = email.trim();
      
      // Actualizar email en Auth también
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        currentSuperadmin.id,
        { email: email.trim() }
      );

      if (authUpdateError) {
        console.error('❌ [AFFILIATES] Error actualizando email en Auth:', authUpdateError);
      }
    }

    // Si se proporciona nueva contraseña
    if (password !== undefined && password.trim() !== '') {
      if (password.length < 6) {
        return NextResponse.json({
          success: false,
          error: 'La contraseña debe tener al menos 6 caracteres'
        }, { status: 400 });
      }

      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        currentSuperadmin.id,
        { password: password }
      );

      if (passwordError) {
        console.error('❌ [AFFILIATES] Error actualizando contraseña:', passwordError);
        return NextResponse.json({
          success: false,
          error: 'Error actualizando contraseña'
        }, { status: 500 });
      }
    }

    // Actualizar perfil en users
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', currentSuperadmin.id)
      .select('id, name, email, is_active')
      .single();

    if (updateError) {
      console.error('❌ [AFFILIATES] Error actualizando usuario:', updateError);
      return NextResponse.json({
        success: false,
        error: updateError.message || 'Error actualizando usuario'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Superadmin AFF actualizado exitosamente'
    });

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// DELETE: Eliminar superadmin AFF
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

    const { id: affiliateStudioId } = params;

    // Verificar que el estudio existe
    const { data: studio } = await supabase
      .from('affiliate_studios')
      .select('id, name')
      .eq('id', affiliateStudioId)
      .single();

    if (!studio) {
      return NextResponse.json({
        success: false,
        error: 'Estudio afiliado no encontrado'
      }, { status: 404 });
    }

    // Obtener el superadmin AFF
    const { data: superadminAff, error: findError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('affiliate_studio_id', affiliateStudioId)
      .eq('role', 'superadmin_aff')
      .maybeSingle();

    if (findError || !superadminAff) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró superadmin AFF para este estudio'
      }, { status: 404 });
    }

    // Verificar si tiene usuarios asociados (modelos, admins, etc.)
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('affiliate_studio_id', affiliateStudioId)
      .neq('id', superadminAff.id);

    if (usersCount && usersCount > 0) {
      // Solo desactivar, no eliminar
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', superadminAff.id);

      if (updateError) {
        return NextResponse.json({
          success: false,
          error: updateError.message || 'Error desactivando superadmin AFF'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Superadmin AFF desactivado. El estudio tiene ${usersCount} usuario(s) asociado(s).`
      });
    } else {
      // Eliminar completamente si no hay usuarios asociados
      // Primero eliminar de Auth
      const { error: authError } = await supabase.auth.admin.deleteUser(superadminAff.id);
      
      if (authError) {
        console.error('❌ [AFFILIATES] Error eliminando usuario de Auth:', authError);
      }

      // Luego eliminar de users
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', superadminAff.id);

      if (deleteError) {
        return NextResponse.json({
          success: false,
          error: deleteError.message || 'Error eliminando superadmin AFF'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Superadmin AFF eliminado exitosamente'
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
