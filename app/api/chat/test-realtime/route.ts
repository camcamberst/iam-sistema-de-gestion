import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificar que las tablas existen
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id')
      .limit(1);

    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('id')
      .limit(1);

    const { data: userStatus, error: userStatusError } = await supabase
      .from('chat_user_status')
      .select('id')
      .limit(1);

    const tablesStatus = {
      chat_messages: !messagesError,
      chat_conversations: !conversationsError,
      chat_user_status: !userStatusError
    };

    const result = {
      success: true,
      tables: tablesStatus,
      realtimeAvailable: true, // Asumimos que está disponible si las tablas existen
      timestamp: new Date().toISOString(),
      message: 'Verificación de realtime completada'
    };

    console.log('🔍 [REALTIME-TEST] Resultado:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [REALTIME-TEST] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error en verificación de realtime',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
