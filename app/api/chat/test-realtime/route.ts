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

    // Verificar que las tablas existen y tienen realtime habilitado
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['chat_messages', 'chat_conversations', 'chat_user_status']);

    if (error) {
      console.error('Error verificando tablas:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Error verificando tablas',
        details: error.message 
      }, { status: 500 });
    }

    // Verificar configuración de realtime
    const { data: realtimeConfig, error: realtimeError } = await supabase
      .from('realtime.subscription')
      .select('*')
      .limit(1);

    const result = {
      success: true,
      tables: tables?.map(t => t.table_name) || [],
      realtimeAvailable: !realtimeError,
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
