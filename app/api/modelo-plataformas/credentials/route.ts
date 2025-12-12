// =====================================================
// 🔐 API DE CREDENCIALES DE PLATAFORMAS
// =====================================================
// Endpoint para guardar/obtener credenciales de login
// Solo accesible para admin y super_admin
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper para verificar autenticación y rol
async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', user: null };
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { error: 'Token inválido', user: null };
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

  if (userData.role !== 'admin' && userData.role !== 'super_admin') {
    return { error: 'No autorizado: solo admin y super_admin pueden acceder', user: null };
  }

  return { error: null, user: { id: user.id, role: userData.role } };
}

// GET - Obtener credenciales de una plataforma
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

    const { data, error } = await supabase
      .from('modelo_plataformas')
      .select('id, login_url, login_username, login_password_encrypted, credentials_updated_at, credentials_updated_by')
      .eq('model_id', modelId)
      .eq('platform_id', platformId)
      .maybeSingle();

    if (error) {
      console.error('Error obteniendo credenciales:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: true, 
        hasCredentials: false,
        data: null 
      });
    }

    // Desencriptar contraseña si existe
    let password = null;
    if (data.login_password_encrypted) {
      try {
        password = decrypt(data.login_password_encrypted);
      } catch (decryptError) {
        console.error('Error desencriptando contraseña:', decryptError);
        return NextResponse.json(
          { error: 'Error desencriptando contraseña' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      hasCredentials: !!(data.login_url && data.login_username && data.login_password_encrypted),
      data: {
        id: data.id,
        login_url: data.login_url,
        login_username: data.login_username,
        login_password: password,
        credentials_updated_at: data.credentials_updated_at,
        credentials_updated_by: data.credentials_updated_by
      }
    });
  } catch (error) {
    console.error('Error in GET /api/modelo-plataformas/credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Guardar/actualizar credenciales
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateUser(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { platform_id, model_id, login_url, login_username, login_password } = body;

    // Validaciones
    if (!platform_id || !model_id) {
      return NextResponse.json(
        { error: 'platform_id y model_id son requeridos' },
        { status: 400 }
      );
    }

    if (!login_url || !login_username || !login_password) {
      return NextResponse.json(
        { error: 'login_url, login_username y login_password son requeridos' },
        { status: 400 }
      );
    }

    // Validar URL
    try {
      new URL(login_url);
    } catch {
      return NextResponse.json(
        { error: 'login_url debe ser una URL válida' },
        { status: 400 }
      );
    }

    // Encriptar contraseña
    let encryptedPassword: string;
    try {
      encryptedPassword = encrypt(login_password);
    } catch (encryptError) {
      console.error('Error encriptando contraseña:', encryptError);
      return NextResponse.json(
        { error: 'Error encriptando contraseña' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verificar que la plataforma existe
    const { data: platformExists, error: checkError } = await supabase
      .from('modelo_plataformas')
      .select('id, status')
      .eq('model_id', modelId)
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

    // Actualizar o insertar credenciales
    const { data, error } = await supabase
      .from('modelo_plataformas')
      .update({
        login_url,
        login_username,
        login_password_encrypted: encryptedPassword,
        credentials_updated_at: new Date().toISOString(),
        credentials_updated_by: auth.user!.id,
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId)
      .eq('platform_id', platform_id)
      .select('id, login_url, login_username, credentials_updated_at')
      .single();

    if (error) {
      console.error('Error guardando credenciales:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Credenciales guardadas correctamente',
      data: {
        id: data.id,
        login_url: data.login_url,
        login_username: data.login_username,
        credentials_updated_at: data.credentials_updated_at
      }
    });
  } catch (error) {
    console.error('Error in POST /api/modelo-plataformas/credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar credenciales
export async function DELETE(request: NextRequest) {
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

    const { error } = await supabase
      .from('modelo_plataformas')
      .update({
        login_url: null,
        login_username: null,
        login_password_encrypted: null,
        credentials_updated_at: null,
        credentials_updated_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId)
      .eq('platform_id', platformId);

    if (error) {
      console.error('Error eliminando credenciales:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Credenciales eliminadas correctamente'
    });
  } catch (error) {
    console.error('Error in DELETE /api/modelo-plataformas/credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

