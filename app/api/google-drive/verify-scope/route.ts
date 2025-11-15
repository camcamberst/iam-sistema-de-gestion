import { NextRequest, NextResponse } from 'next/server';
import { getGoogleDriveTokens } from '@/lib/google-drive/auth';

export const dynamic = 'force-dynamic';

// GET: Verificar el scope del usuario autenticado
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId es requerido' 
      }, { status: 400 });
    }

    const tokens = await getGoogleDriveTokens(userId);
    
    if (!tokens) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        error: 'Usuario no autenticado con Google Drive'
      });
    }

    const hasFullDriveAccess = tokens.scope?.includes('https://www.googleapis.com/auth/drive');
    const hasDriveFileAccess = tokens.scope?.includes('https://www.googleapis.com/auth/drive.file');

    return NextResponse.json({
      success: true,
      authenticated: true,
      scope: tokens.scope,
      hasFullDriveAccess,
      hasDriveFileAccess,
      needsReauth: !hasFullDriveAccess,
      expiryDate: tokens.expiry_date,
      isExpired: tokens.expiry_date ? tokens.expiry_date < Date.now() : false
    });

  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE-VERIFY-SCOPE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al verificar scope'
    }, { status: 500 });
  }
}

