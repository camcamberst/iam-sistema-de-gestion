// Bot Memory - Sistema de memoria estructurada para conversaciones
// ==================================================================

import { createClient } from '@supabase/supabase-js';
import type { UserContext } from './aim-botty';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface MemoryEntry {
  id?: string;
  user_id: string;
  type: 'preference' | 'context' | 'fact' | 'reminder' | 'goal' | 'issue';
  key: string; // e.g., 'favorite_platforms', 'preferred_hours', 'last_problem'
  value: string | number | boolean | object;
  metadata?: {
    source_conversation_id?: string;
    mentioned_at?: string;
    confidence?: number;
    expires_at?: string; // Para datos temporales
  };
  created_at?: string;
  updated_at?: string;
}

export interface ConversationSummary {
  conversation_id: string;
  user_id: string;
  summary: string; // Resumen de la conversación
  key_points: string[]; // Puntos clave extraídos
  important_facts: string[]; // Hechos importantes mencionados
  created_at: string;
  updated_at: string;
}

// Cliente Supabase
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Guardar una entrada de memoria
 */
export async function saveMemory(entry: MemoryEntry): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // Verificar si ya existe una entrada con esta key para este usuario
    const { data: existing } = await supabase
      .from('bot_memory')
      .select('id')
      .eq('user_id', entry.user_id)
      .eq('key', entry.key)
      .single();

    if (existing) {
      // Actualizar entrada existente
      const { error } = await supabase
        .from('bot_memory')
        .update({
          value: entry.value,
          metadata: entry.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error('❌ [BOT-MEMORY] Error actualizando memoria:', error);
        return false;
      }
    } else {
      // Crear nueva entrada
      const { error } = await supabase
        .from('bot_memory')
        .insert({
          user_id: entry.user_id,
          type: entry.type,
          key: entry.key,
          value: entry.value,
          metadata: entry.metadata
        });

      if (error) {
        console.error('❌ [BOT-MEMORY] Error guardando memoria:', error);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error en saveMemory:', error);
    return false;
  }
}

/**
 * Obtener todas las memorias de un usuario
 */
export async function getUserMemories(
  userId: string,
  type?: MemoryEntry['type']
): Promise<MemoryEntry[]> {
  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('bot_memory')
      .select('*')
      .eq('user_id', userId);

    if (type) {
      query = query.eq('type', type);
    }

    // Filtrar entradas expiradas
    query = query.or('metadata->expires_at.is.null,metadata->expires_at.gt.' + new Date().toISOString());

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [BOT-MEMORY] Error obteniendo memorias:', error);
      return [];
    }

    return (data || []).map((entry: any) => ({
      ...entry,
      value: typeof entry.value === 'string' ? tryParseJson(entry.value) : entry.value
    }));
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error en getUserMemories:', error);
    return [];
  }
}

/**
 * Obtener una memoria específica
 */
export async function getMemory(
  userId: string,
  key: string
): Promise<MemoryEntry | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('key', key)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      ...data,
      value: typeof data.value === 'string' ? tryParseJson(data.value) : data.value
    };
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error en getMemory:', error);
    return null;
  }
}

/**
 * Eliminar una memoria
 */
export async function deleteMemory(
  userId: string,
  key: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('bot_memory')
      .delete()
      .eq('user_id', userId)
      .eq('key', key);

    return !error;
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error eliminando memoria:', error);
    return false;
  }
}

/**
 * Extraer información relevante de un mensaje y guardarla
 */
export async function extractAndSaveMemory(
  userId: string,
  conversationId: string,
  message: string,
  userContext: UserContext
): Promise<void> {
  try {
    // Detectar preferencias comunes
    const preferences = extractPreferences(message);
    
    for (const pref of preferences) {
      await saveMemory({
        user_id: userId,
        type: pref.type,
        key: pref.key,
        value: pref.value,
        metadata: {
          source_conversation_id: conversationId,
          mentioned_at: new Date().toISOString(),
          confidence: pref.confidence || 0.7
        }
      });
    }
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error extrayendo memoria:', error);
  }
}

/**
 * Extraer preferencias del mensaje usando patrones simples
 */
function extractPreferences(message: string): Array<{
  type: MemoryEntry['type'];
  key: string;
  value: any;
  confidence?: number;
}> {
  const lowerMessage = message.toLowerCase();
  const preferences: Array<{
    type: MemoryEntry['type'];
    key: string;
    value: any;
    confidence?: number;
  }> = [];

  // Preferencias de horario
  if (lowerMessage.match(/me gusta trabajar|prefiero trabajar|trabajo mejor|soy más productiv/)) {
    const timeMatch = lowerMessage.match(/(mañana|tarde|noche|madrugada|día|evening|morning|afternoon)/);
    if (timeMatch) {
      preferences.push({
        type: 'preference',
        key: 'preferred_hours',
        value: timeMatch[1],
        confidence: 0.8
      });
    }
  }

  // Plataforma favorita
  if (lowerMessage.match(/mi plataforma favorita|me gusta más|prefiero usar|trabajo mejor en/)) {
    const platformMatch = lowerMessage.match(/(chaturbate|streamate|myfreecams|cam4|camsoda|stripchat|livejasmin|flirt4free|camcontacts|big7|mondo|superfoon)/);
    if (platformMatch) {
      preferences.push({
        type: 'preference',
        key: 'favorite_platforms',
        value: platformMatch[1],
        confidence: 0.8
      });
    }
  }

  // Metas mencionadas
  if (lowerMessage.match(/mi meta|mi objetivo|quiero ganar|mi objetivo es/)) {
    const amountMatch = lowerMessage.match(/(\d+)\s*(usd|dólar|dolar)/);
    if (amountMatch) {
      preferences.push({
        type: 'goal',
        key: 'personal_goal',
        value: parseInt(amountMatch[1]),
        confidence: 0.7
      });
    }
  }

  // Problemas mencionados
  if (lowerMessage.match(/tengo un problema|estoy teniendo|no puedo|no funciona|me está pasando/)) {
    preferences.push({
      type: 'issue',
      key: 'last_mentioned_issue',
      value: message.substring(0, 200), // Primeros 200 caracteres
      confidence: 0.6
    });
  }

  return preferences;
}

/**
 * Obtener contexto de memoria formateado para el prompt
 */
export async function getMemoryContext(userId: string): Promise<string> {
  try {
    const memories = await getUserMemories(userId);
    
    if (memories.length === 0) {
      return '';
    }

    const contextParts: string[] = ['MEMORIA DEL USUARIO (información recordada de conversaciones anteriores):'];
    
    const byType = memories.reduce((acc, mem) => {
      if (!acc[mem.type]) acc[mem.type] = [];
      acc[mem.type].push(mem);
      return acc;
    }, {} as Record<string, MemoryEntry[]>);

    if (byType.preference?.length > 0) {
      contextParts.push('\nPREFERENCIAS:');
      byType.preference.forEach(mem => {
        contextParts.push(`- ${mem.key}: ${formatMemoryValue(mem.value)}`);
      });
    }

    if (byType.goal?.length > 0) {
      contextParts.push('\nOBJETIVOS MENCIONADOS:');
      byType.goal.forEach(mem => {
        contextParts.push(`- ${mem.key}: ${formatMemoryValue(mem.value)}`);
      });
    }

    if (byType.fact?.length > 0) {
      contextParts.push('\nINFORMACIÓN RELEVANTE:');
      byType.fact.forEach(mem => {
        contextParts.push(`- ${mem.key}: ${formatMemoryValue(mem.value)}`);
      });
    }

    if (byType.issue?.length > 0) {
      const lastIssue = byType.issue[0]; // Más reciente
      contextParts.push(`\nÚLTIMO PROBLEMA MENCIONADO: ${formatMemoryValue(lastIssue.value)}`);
    }

    return contextParts.join('\n');
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error obteniendo contexto de memoria:', error);
    return '';
  }
}

function formatMemoryValue(value: any): string {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Guardar resumen de conversación
 */
export async function saveConversationSummary(
  conversationId: string,
  userId: string,
  summary: string,
  keyPoints: string[],
  importantFacts: string[]
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('bot_conversation_summaries')
      .upsert({
        conversation_id: conversationId,
        user_id: userId,
        summary,
        key_points: keyPoints,
        important_facts: importantFacts,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      });

    return !error;
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error guardando resumen:', error);
    return false;
  }
}

/**
 * Obtener resumen de conversación
 */
export async function getConversationSummary(
  conversationId: string
): Promise<ConversationSummary | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_conversation_summaries')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ConversationSummary;
  } catch (error) {
    console.error('❌ [BOT-MEMORY] Error obteniendo resumen:', error);
    return null;
  }
}



