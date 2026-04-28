// =====================================================
// 🌐 API PARA AIM BROWSER
// =====================================================
// Endpoint para que AIM Browser consuma credenciales de plataformas
// Formato optimizado para integración con navegador
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Obtener todas las credenciales de plataformas para un modelo
// Formato: { platform_id: { login_url, login_username, login_password } }
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('model_id');
    const platformId = searchParams.get('platform_id'); // Opcional: filtrar por plataforma específica

    if (!modelId) {
      return NextResponse.json(
        { error: 'model_id es requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Construir query (obtener login_url desde calculator_platforms)
    let query = supabase
      .from('modelo_plataformas')
      .select(`
        platform_id,
        login_username,
        login_password_encrypted,
        status,
        calculator_platforms (
          id,
          name,
          login_url
        )
      `)
      .eq('model_id', modelId)
      .eq('status', 'entregada')
      .not('login_username', 'is', null)
      .not('login_password_encrypted', 'is', null);

    if (platformId) {
      query = query.eq('platform_id', platformId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo credenciales para AIM Browser:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        model_id: modelId,
        credentials: {},
        count: 0
      });
    }

    // Procesar y desencriptar credenciales
    const credentials: Record<string, {
      platform_name: string;
      login_url: string;
      login_username: string;
      login_password: string;
      status: string;
    }> = {};

    for (const item of data) {
      try {
        const password = decrypt(item.login_password_encrypted);
        const platformInfo = item.calculator_platforms as any;
        const platformName = platformInfo?.name || item.platform_id;
        const platformLoginUrl = platformInfo?.login_url;

        // Solo incluir si la plataforma tiene URL configurado
        if (!platformLoginUrl) {
          console.warn(`Plataforma ${item.platform_id} no tiene URL de login configurado`);
          continue;
        }

        credentials[item.platform_id] = {
          platform_name: platformName,
          login_url: platformLoginUrl,
          login_username: item.login_username!,
          login_password: password,
          status: item.status
        };
      } catch (decryptError) {
        console.error(`Error desencriptando contraseña para plataforma ${item.platform_id}:`, decryptError);
        // Continuar con otras plataformas aunque una falle
      }
    }

    return NextResponse.json({
      success: true,
      model_id: modelId,
      credentials,
      count: Object.keys(credentials).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in GET /api/aim-browser/platform-credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Obtener credenciales con autenticación (más seguro)
// Requiere token de autenticación
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorización requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { model_id, platform_id } = body;

    if (!model_id) {
      return NextResponse.json(
        { error: 'model_id es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene acceso (es el modelo o es admin/super_admin)
    const { data: userData } = await supabase
      .from('users')
      .select('role, id')
      .eq('id', user.id)
      .single();

    const isAuthorized = userData?.id === model_id || 
                        userData?.role === 'admin' || 
                        userData?.role === 'super_admin';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No autorizado para acceder a estas credenciales' },
        { status: 403 }
      );
    }

    // Misma lógica que GET pero con autenticación (obtener login_url desde calculator_platforms)
    let query = supabase
      .from('modelo_plataformas')
      .select(`
        platform_id,
        login_username,
        login_password_encrypted,
        status,
        calculator_platforms (
          id,
          name,
          login_url
        )
      `)
      .eq('model_id', model_id)
      .eq('status', 'entregada')
      .not('login_username', 'is', null)
      .not('login_password_encrypted', 'is', null);

    if (platform_id) {
      query = query.eq('platform_id', platform_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo credenciales para AIM Browser:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        model_id,
        credentials: {},
        count: 0
      });
    }

    // Procesar y desencriptar credenciales
    const credentials: Record<string, {
      platform_name: string;
      login_url: string;
      login_username: string;
      login_password: string;
      status: string;
    }> = {};

    for (const item of data) {
      try {
        const password = decrypt(item.login_password_encrypted);
        const platformInfo = item.calculator_platforms as any;
        const platformName = platformInfo?.name || item.platform_id;
        const platformLoginUrl = platformInfo?.login_url;

        // Solo incluir si la plataforma tiene URL configurado
        if (!platformLoginUrl) {
          console.warn(`Plataforma ${item.platform_id} no tiene URL de login configurado`);
          continue;
        }

        credentials[item.platform_id] = {
          platform_name: platformName,
          login_url: platformLoginUrl,
          login_username: item.login_username!,
          login_password: password,
          status: item.status
        };
      } catch (decryptError) {
        console.error(`Error desencriptando contraseña para plataforma ${item.platform_id}:`, decryptError);
      }
    }

    return NextResponse.json({
      success: true,
      model_id,
      credentials,
      count: Object.keys(credentials).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in POST /api/aim-browser/platform-credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

