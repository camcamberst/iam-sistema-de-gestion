import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Verificar variables de entorno críticas para el chatbot
    const envCheck = {
      GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA',
      CHATBOT_MODE: process.env.CHATBOT_MODE || 'NO CONFIGURADO',
      CHATBOT_ENABLE_ESCALATION: process.env.CHATBOT_ENABLE_ESCALATION || 'NO CONFIGURADO',
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'CONFIGURADA' : 'NO CONFIGURADA',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      environment: envCheck,
      message: 'Verificación de variables de entorno completada'
    });
  } catch (error: any) {
    console.error('Error checking environment:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
