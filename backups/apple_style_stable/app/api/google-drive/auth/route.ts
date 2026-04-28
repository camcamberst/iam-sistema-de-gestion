import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

// GET: Iniciar flujo de autenticación OAuth
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // ID del usuario que está autenticando

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId es requerido' 
      }, { status: 400 });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-drive/callback`;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({ 
        success: false, 
        error: 'Google OAuth no está configurado. Por favor, configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno.',
        requiresSetup: true
      }, { status: 500 });
    }

    // Crear cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Scopes necesarios para Google Drive
    // drive.file solo permite acceso a archivos creados por la app
    // drive permite acceso completo a todas las carpetas y archivos
    const scopes = [
      'https://www.googleapis.com/auth/drive', // Acceso completo para subir a carpetas existentes
    ];

    // Generar URL de autorización
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Para obtener refresh token
      scope: scopes,
      prompt: 'consent', // Forzar consentimiento para obtener refresh token
      state: userId, // Pasar el userId en el state para recuperarlo en el callback
    });

    return NextResponse.json({
      success: true,
      authUrl
    });

  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE-AUTH] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al generar URL de autenticación'
    }, { status: 500 });
  }
}


