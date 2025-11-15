import { google } from 'googleapis';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Obtener tokens de Google Drive para un usuario
 */
export async function getGoogleDriveTokens(userId: string) {
  try {
    const supabase = supabaseServer;
    const { data, error } = await supabase
      .from('users')
      .select('metadata')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    const metadata = data.metadata as any;
    const googleDrive = metadata?.google_drive;

    if (!googleDrive || !googleDrive.access_token) {
      return null;
    }

    return {
      access_token: googleDrive.access_token,
      refresh_token: googleDrive.refresh_token,
      expiry_date: googleDrive.expiry_date,
      token_type: googleDrive.token_type,
      scope: googleDrive.scope
    };
  } catch (error) {
    console.error('❌ [GOOGLE-DRIVE-AUTH] Error obteniendo tokens:', error);
    return null;
  }
}

/**
 * Crear cliente OAuth2 autenticado para un usuario
 */
export async function getAuthenticatedOAuth2Client(userId: string) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-drive/callback`;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth no está configurado');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const tokens = await getGoogleDriveTokens(userId);
  
  if (!tokens) {
    throw new Error('Usuario no autenticado con Google Drive');
  }

  // Verificar que el scope incluya acceso completo a Drive
  const hasFullDriveAccess = tokens.scope?.includes('https://www.googleapis.com/auth/drive');
  if (!hasFullDriveAccess) {
    console.warn('⚠️ [GOOGLE-DRIVE-AUTH] Scope insuficiente. Scope actual:', tokens.scope);
    throw new Error('Usuario necesita reautenticarse con permisos completos de Google Drive');
  }

  console.log('✅ [GOOGLE-DRIVE-AUTH] Tokens válidos con scope completo:', tokens.scope);
  oauth2Client.setCredentials(tokens);

  // Verificar si el token está expirado y refrescarlo si es necesario
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    if (tokens.refresh_token) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Guardar nuevos tokens
        const supabase = supabaseServer;
        await supabase
          .from('users')
          .update({
            metadata: {
              ...((await supabase.from('users').select('metadata').eq('id', userId).single()).data?.metadata || {}),
              google_drive: {
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token || tokens.refresh_token,
                expiry_date: credentials.expiry_date,
                token_type: credentials.token_type,
                scope: credentials.scope
              }
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        oauth2Client.setCredentials(credentials);
      } catch (error) {
        console.error('❌ [GOOGLE-DRIVE-AUTH] Error refrescando token:', error);
        throw new Error('Error al refrescar token de acceso');
      }
    } else {
      throw new Error('Token expirado y no hay refresh token disponible');
    }
  }

  return oauth2Client;
}


