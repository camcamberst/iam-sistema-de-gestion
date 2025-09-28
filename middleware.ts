// =====================================================
// 🛡️ MIDDLEWARE DE AUTENTICACIÓN GLOBAL
// =====================================================
// Middleware para manejar autenticación en todas las rutas
// =====================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  try {
    // Crear cliente Supabase SSR
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // No-op: cookies are handled by the browser
          },
          remove(name: string, options: any) {
            // No-op: cookies are handled by the browser
          },
        },
      }
    );

    // Obtener usuario autenticado
    const { data: { user }, error } = await supabase.auth.getUser();
    
    // Si es una ruta de API que requiere autenticación
    if (request.nextUrl.pathname.startsWith('/api/')) {
      // Excluir rutas de autenticación
      if (request.nextUrl.pathname.startsWith('/api/auth/')) {
        return NextResponse.next();
      }
      
      // Para otras rutas de API, verificar autenticación
      if (!user || error) {
        return NextResponse.json(
          { success: false, error: 'No autenticado' },
          { status: 401 }
        );
      }
      
      // Agregar usuario a headers para uso en API routes
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email || '');
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // Para rutas de páginas, continuar normalmente
    return NextResponse.next();

  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
