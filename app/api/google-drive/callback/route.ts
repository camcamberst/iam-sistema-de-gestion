import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET: Callback de OAuth - recibe el código de autorización
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId que pasamos en el state
    const error = searchParams.get('error');

    if (error) {
      console.error('❌ [GOOGLE-DRIVE-CALLBACK] Error de OAuth:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_error=missing_code_or_state`
      );
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-drive/callback`;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_error=oauth_not_configured`
      );
    }

    // Crear cliente OAuth2
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // Intercambiar código por tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_error=no_access_token`
      );
    }

    // Guardar tokens en la base de datos (asociados al usuario)
    const supabase = supabaseServer;
    const userId = state; // El userId que pasamos en el state

    // Guardar tokens en una tabla (necesitamos crear esta tabla)
    // Por ahora, los guardamos en metadata del usuario o en una tabla separada
    const { error: updateError } = await supabase
      .from('users')
      .update({
        metadata: {
          ...((await supabase.from('users').select('metadata').eq('id', userId).single()).data?.metadata || {}),
          google_drive: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
            token_type: tokens.token_type,
            scope: tokens.scope
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ [GOOGLE-DRIVE-CALLBACK] Error guardando tokens:', updateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_error=save_tokens_failed`
      );
    }

    console.log('✅ [GOOGLE-DRIVE-CALLBACK] Tokens guardados exitosamente para usuario:', userId);

    // Redirigir de vuelta a la aplicación con éxito
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_success=true`
    );

  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE-CALLBACK] Error general:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/sedes/portafolio?oauth_error=${encodeURIComponent(error.message || 'unknown_error')}`
    );
  }
}

