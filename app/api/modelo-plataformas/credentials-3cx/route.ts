import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/encryption';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Autenticación de usuario
async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token de autenticación requerido', user: null };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Token inválido o expirado', user: null };
  }

  // Verificar rol del usuario
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    return { error: 'Error obteniendo datos de usuario', user: null };
  }

  // Permitir admin, super_admin y modelo
  const allowedRoles = ['admin', 'super_admin', 'modelo'];
  if (!allowedRoles.includes(userData.role)) {
    return { error: 'No autorizado', user: null };
  }

  return { error: null, user: { id: user.id, role: userData.role } };
}

// GET - Obtener credenciales de 3CX
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get('platform_id');
    const modelId = searchParams.get('model_id');

    if (!platformId || !modelId) {
      return NextResponse.json(
        { error: 'platform_id y model_id son requeridos' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar que la relación modelo-plataforma existe
    const { data: platformData, error: checkError } = await supabase
      .from('modelo_plataformas')
      .select('id, app_3cx_username, app_3cx_password_encrypted')
      .eq('model_id', modelId)
      .eq('platform_id', platformId)
      .maybeSingle();

    if (checkError) {
      console.error('Error verificando plataforma:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (!platformData) {
      return NextResponse.json(
        { error: 'Plataforma no encontrada para este modelo' },
        { status: 404 }
      );
    }

    // Si no hay credenciales, retornar vacío
    if (!platformData.app_3cx_username || !platformData.app_3cx_password_encrypted) {
      return NextResponse.json({
        success: true,
        data: {
          app_3cx_username: null,
          app_3cx_password: null,
          hasCredentials: false
        }
      });
    }

    // Desencriptar contraseña
    let decryptedPassword: string;
    try {
      decryptedPassword = decrypt(platformData.app_3cx_password_encrypted);
    } catch (decryptError) {
      console.error('Error desencriptando contraseña 3CX:', decryptError);
      return NextResponse.json(
        { error: 'Error desencriptando contraseña' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        app_3cx_username: platformData.app_3cx_username,
        app_3cx_password: decryptedPassword,
        hasCredentials: true
      }
    });
  } catch (error) {
    console.error('Error in GET /api/modelo-plataformas/credentials-3cx:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Guardar/actualizar credenciales de 3CX
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { platform_id, model_id, app_3cx_username, app_3cx_password } = body;

    // Validaciones
    if (!platform_id || !model_id) {
      return NextResponse.json(
        { error: 'platform_id y model_id son requeridos' },
        { status: 400 }
      );
    }

    if (!app_3cx_username || !app_3cx_password) {
      return NextResponse.json(
        { error: 'app_3cx_username y app_3cx_password son requeridos' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar que la relación modelo-plataforma existe
    const { data: platformExists, error: checkError } = await supabase
      .from('modelo_plataformas')
      .select('id, status')
      .eq('model_id', model_id)
      .eq('platform_id', platform_id)
      .maybeSingle();

    if (checkError) {
      console.error('Error verificando plataforma:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (!platformExists) {
      return NextResponse.json(
        { error: 'Plataforma no encontrada para este modelo' },
        { status: 404 }
      );
    }

    // Encriptar contraseña
    let encryptedPassword: string;
    try {
      encryptedPassword = encrypt(app_3cx_password);
    } catch (encryptError) {
      console.error('Error encriptando contraseña 3CX:', encryptError);
      return NextResponse.json(
        { error: 'Error encriptando contraseña' },
        { status: 500 }
      );
    }

    // Actualizar credenciales de 3CX
    const { data, error } = await supabase
      .from('modelo_plataformas')
      .update({
        app_3cx_username,
        app_3cx_password_encrypted: encryptedPassword,
        app_3cx_credentials_updated_at: new Date().toISOString(),
        app_3cx_credentials_updated_by: auth.user!.id,
        updated_at: new Date().toISOString()
      })
      .eq('model_id', model_id)
      .eq('platform_id', platform_id)
      .select('id, app_3cx_username, app_3cx_credentials_updated_at')
      .single();

    if (error) {
      console.error('Error guardando credenciales 3CX:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Credenciales de 3CX guardadas correctamente',
      data: {
        id: data.id,
        app_3cx_username: data.app_3cx_username,
        app_3cx_credentials_updated_at: data.app_3cx_credentials_updated_at
      }
    });
  } catch (error) {
    console.error('Error in POST /api/modelo-plataformas/credentials-3cx:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

