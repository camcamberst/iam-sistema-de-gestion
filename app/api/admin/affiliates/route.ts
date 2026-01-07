/**
 * 🏢 API: Gestión de Estudios Afiliados
 * 
 * Endpoints:
 * - GET: Listar todos los estudios afiliados
 * - POST: Crear un nuevo estudio afiliado
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

// GET: Listar todos los estudios afiliados
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { data: studios, error } = await supabase
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [AFFILIATES] Error obteniendo estudios:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Obtener estadísticas de cada estudio
    const studiosWithStats = await Promise.all(
      (studios || []).map(async (studio) => {
        // Contar usuarios del afiliado
        const { count: usersCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('affiliate_studio_id', studio.id);

        // Contar sedes/grupos del afiliado
        const { count: sedesCount } = await supabase
          .from('groups')
          .select('*', { count: 'exact', head: true })
          .eq('affiliate_studio_id', studio.id);

        // Contar modelos del afiliado
        const { count: modelsCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('affiliate_studio_id', studio.id)
          .eq('role', 'modelo');

        return {
          ...studio,
          stats: {
            users: usersCount || 0,
            sedes: sedesCount || 0,
            models: modelsCount || 0
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: studiosWithStats,
      total: studiosWithStats.length
    });

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// POST: Crear un nuevo estudio afiliado
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      name, 
      description, 
      commission_percentage,
      // Datos del superadmin AFF (opcional - puede crearse después)
      superadmin_email,
      superadmin_name,
      superadmin_password
    } = body;

    // Validaciones
    if (!name || name.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'El nombre del estudio es requerido'
      }, { status: 400 });
    }

    // Validar porcentaje de comisión (debe estar entre 0 y 100)
    const commission = commission_percentage ? parseFloat(commission_percentage) : 10.00;
    if (isNaN(commission) || commission < 0 || commission > 100) {
      return NextResponse.json({
        success: false,
        error: 'El porcentaje de comisión debe estar entre 0 y 100'
      }, { status: 400 });
    }

    // Verificar que no exista un estudio con el mismo nombre
    const { data: existing } = await supabase
      .from('affiliate_studios')
      .select('id')
      .eq('name', name.trim())
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un estudio afiliado con ese nombre'
      }, { status: 400 });
    }

    // Crear el estudio afiliado
    const { data: newStudio, error } = await supabase
      .from('affiliate_studios')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        commission_percentage: commission,
        is_active: true,
        created_by: auth.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [AFFILIATES] Error creando estudio:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    // Si se proporcionaron datos del superadmin AFF, crearlo automáticamente
    let superadminCreated = null;
    if (superadmin_email && superadmin_name && superadmin_password) {
      try {
        console.log('👤 [AFFILIATES] Creando superadmin AFF para el estudio:', newStudio.id);
        
        // 1. Crear usuario en Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: superadmin_email.trim(),
          password: superadmin_password,
          email_confirm: true,
          user_metadata: {
            name: superadmin_name.trim(),
            role: 'superadmin_aff'
          }
        });

        if (authError || !authData.user) {
          console.error('❌ [AFFILIATES] Error creando usuario en Auth:', authError);
          // No fallar la creación del estudio si falla el superadmin
          // Solo loguear el error
        } else {
          // 2. Crear perfil en users con affiliate_studio_id
          const { data: userData, error: userError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              name: superadmin_name.trim(),
              email: superadmin_email.trim(),
              role: 'superadmin_aff',
              affiliate_studio_id: newStudio.id, // 🔑 ASOCIACIÓN CRÍTICA
              is_active: true
            })
            .select()
            .single();

          if (userError) {
            console.error('❌ [AFFILIATES] Error creando perfil de usuario:', userError);
            // Intentar eliminar el usuario de Auth si falla
            await supabase.auth.admin.deleteUser(authData.user.id);
          } else {
            superadminCreated = {
              id: userData.id,
              email: userData.email,
              name: userData.name
            };
            console.log('✅ [AFFILIATES] Superadmin AFF creado exitosamente:', superadminCreated);
          }
        }
      } catch (superadminError: any) {
        console.error('❌ [AFFILIATES] Error inesperado creando superadmin AFF:', superadminError);
        // No fallar la creación del estudio
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...newStudio,
        superadmin_aff: superadminCreated
      },
      message: superadminCreated 
        ? 'Estudio afiliado y superadmin AFF creados exitosamente'
        : 'Estudio afiliado creado exitosamente. Recuerda crear el superadmin AFF después.'
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [AFFILIATES] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

