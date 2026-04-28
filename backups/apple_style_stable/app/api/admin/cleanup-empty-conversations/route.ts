import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 [ADMIN] Iniciando limpieza de conversaciones vacías...');

    // 1. Obtener todas las conversaciones
    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from('chat_conversations')
      .select('id');

    if (conversationsError) {
      console.error('❌ [ADMIN] Error obteniendo conversaciones:', conversationsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo conversaciones' },
        { status: 500 }
      );
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay conversaciones para limpiar',
        stats: { conversationsDeleted: 0 }
      });
    }

    // 2. Verificar cuáles conversaciones no tienen mensajes
    const conversationIds = conversations.map(conv => conv.id);
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds);

    if (messagesError) {
      console.error('❌ [ADMIN] Error obteniendo mensajes:', messagesError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo mensajes' },
        { status: 500 }
      );
    }

    // 3. Identificar conversaciones sin mensajes
    const conversationsWithMessages = new Set(messages?.map(msg => msg.conversation_id) || []);
    const emptyConversations = conversations.filter(conv => 
      !conversationsWithMessages.has(conv.id)
    );

    if (emptyConversations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay conversaciones vacías para eliminar',
        stats: { conversationsDeleted: 0 }
      });
    }

    // 4. Eliminar conversaciones vacías
    const emptyConversationIds = emptyConversations.map(conv => conv.id);
    const { error: deleteError } = await supabaseAdmin
      .from('chat_conversations')
      .delete()
      .in('id', emptyConversationIds);

    if (deleteError) {
      console.error('❌ [ADMIN] Error eliminando conversaciones vacías:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error eliminando conversaciones vacías' },
        { status: 500 }
      );
    }

    const stats = {
      timestamp: new Date().toISOString(),
      totalConversations: conversations.length,
      conversationsWithMessages: conversationsWithMessages.size,
      conversationsDeleted: emptyConversations.length
    };

    console.log('✅ [ADMIN] Limpieza de conversaciones vacías completada:', stats);

    return NextResponse.json({
      success: true,
      message: `${emptyConversations.length} conversaciones vacías eliminadas`,
      stats
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error en limpieza de conversaciones vacías:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error ejecutando limpieza de conversaciones vacías',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Obtener estadísticas de conversaciones
    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from('chat_conversations')
      .select('id');

    if (conversationsError) {
      console.error('❌ [ADMIN] Error obteniendo conversaciones:', conversationsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo conversaciones' },
        { status: 500 }
      );
    }

    const conversationIds = conversations?.map(conv => conv.id) || [];
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds);

    if (messagesError) {
      console.error('❌ [ADMIN] Error obteniendo mensajes:', messagesError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo mensajes' },
        { status: 500 }
      );
    }

    const conversationsWithMessages = new Set(messages?.map(msg => msg.conversation_id) || []);
    const emptyConversations = conversations?.filter(conv => 
      !conversationsWithMessages.has(conv.id)
    ) || [];

    const stats = {
      timestamp: new Date().toISOString(),
      totalConversations: conversations?.length || 0,
      conversationsWithMessages: conversationsWithMessages.size,
      emptyConversations: emptyConversations.length,
      emptyConversationIds: emptyConversations.map(conv => conv.id)
    };

    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo estadísticas',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
