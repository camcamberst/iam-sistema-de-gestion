/**
 * Sistema de Base de Conocimiento para Botty
 * ===========================================
 * Permite que admins/super admins entrenen a Botty agregando
 * información global que será incluida en todos los prompts
 */

import { createClient } from '@supabase/supabase-js';
import { saveMemory as saveUserMemory } from './bot-memory';

// Re-exportar saveMemory para compatibilidad
export { saveUserMemory as saveMemory };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface KnowledgeEntry {
  id?: string;
  category: 'system_info' | 'tips' | 'policies' | 'procedures' | 'faq' | 'custom';
  title: string;
  content: string;
  tags: string[];
  priority: number;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

/**
 * Obtener cliente de Supabase
 */
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Guardar nueva entrada de conocimiento
 */
export async function saveKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'created_at' | 'updated_at'>): Promise<KnowledgeEntry | null> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('bot_knowledge_base')
      .insert({
        category: entry.category,
        title: entry.title,
        content: entry.content,
        tags: entry.tags || [],
        priority: entry.priority || 0,
        is_active: entry.is_active !== false,
        created_by: entry.created_by
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [BOT-KNOWLEDGE] Error guardando conocimiento:', error);
      return null;
    }

    return data as KnowledgeEntry;
  } catch (error) {
    console.error('❌ [BOT-KNOWLEDGE] Error en saveKnowledge:', error);
    return null;
  }
}

/**
 * Actualizar entrada de conocimiento existente
 */
export async function updateKnowledge(
  id: string,
  updates: Partial<Pick<KnowledgeEntry, 'title' | 'content' | 'category' | 'tags' | 'priority' | 'is_active'>>
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('bot_knowledge_base')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('❌ [BOT-KNOWLEDGE] Error actualizando conocimiento:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [BOT-KNOWLEDGE] Error en updateKnowledge:', error);
    return false;
  }
}

/**
 * Obtener todas las entradas de conocimiento activas
 */
export async function getAllKnowledge(category?: KnowledgeEntry['category']): Promise<KnowledgeEntry[]> {
  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('bot_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [BOT-KNOWLEDGE] Error obteniendo conocimiento:', error);
      return [];
    }

    return (data || []) as KnowledgeEntry[];
  } catch (error) {
    console.error('❌ [BOT-KNOWLEDGE] Error en getAllKnowledge:', error);
    return [];
  }
}

/**
 * Buscar conocimiento por tags o keywords
 */
export async function searchKnowledge(keywords: string[]): Promise<KnowledgeEntry[]> {
  try {
    const supabase = getSupabaseClient();

    // Buscar en tags y contenido
    const { data, error } = await supabase
      .from('bot_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('❌ [BOT-KNOWLEDGE] Error buscando conocimiento:', error);
      return [];
    }

    // Filtrar por keywords (buscar en tags y contenido)
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    const filtered = (data || []).filter((entry: KnowledgeEntry) => {
      const entryTags = (entry.tags || []).map(t => t.toLowerCase());
      const entryContent = `${entry.title} ${entry.content}`.toLowerCase();
      
      return lowerKeywords.some(keyword => 
        entryTags.some(tag => tag.includes(keyword)) ||
        entryContent.includes(keyword)
      );
    });

    return filtered as KnowledgeEntry[];
  } catch (error) {
    console.error('❌ [BOT-KNOWLEDGE] Error en searchKnowledge:', error);
    return [];
  }
}

/**
 * Formatear conocimiento para incluir en el prompt de Botty
 */
export function formatKnowledgeForPrompt(knowledge: KnowledgeEntry[]): string {
  if (knowledge.length === 0) {
    return '';
  }

  const knowledgeText = knowledge.map((entry, index) => {
    const tagsText = entry.tags.length > 0 ? ` [Tags: ${entry.tags.join(', ')}]` : '';
    return `
${index + 1}. [${entry.category.toUpperCase()}] ${entry.title}${tagsText}
   ${entry.content}`;
  }).join('\n');

  return `
CONOCIMIENTO ADICIONAL DEL SISTEMA (Aprendido por admins):
============================================================
${knowledgeText}

IMPORTANTE: Usa este conocimiento adicional para responder preguntas relacionadas. Este conocimiento tiene prioridad sobre el conocimiento base del sistema.
`;
}

/**
 * Obtener conocimiento relevante para una consulta
 */
export async function getRelevantKnowledge(userMessage: string, limit: number = 10): Promise<KnowledgeEntry[]> {
  try {
    // Extraer keywords del mensaje
    const keywords = extractKeywords(userMessage);
    
    // Buscar conocimiento relevante
    const relevant = await searchKnowledge(keywords);
    
    // Si no hay resultados, traer los más recientes
    if (relevant.length === 0) {
      const all = await getAllKnowledge();
      return all.slice(0, limit);
    }
    
    return relevant.slice(0, limit);
  } catch (error) {
    console.error('❌ [BOT-KNOWLEDGE] Error obteniendo conocimiento relevante:', error);
    return [];
  }
}

/**
 * Extraer keywords del mensaje
 */
function extractKeywords(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  // Palabras clave comunes
  const commonKeywords = [
    'makeup', 'maquillaje', 'iluminacion', 'iluminación', 'angulos', 'ángulos',
    'camara', 'cámara', 'audio', 'sonido', 'micrófono', 'microfono',
    'anticipo', 'anticipos', 'solicitud', 'aprobar', 'rechazar',
    'calculadora', 'ingresos', 'ganancias', 'productividad',
    'plataforma', 'chaturbate', 'stripchat', 'myfreecams',
    'grupo', 'grupos', 'sede', 'sedes', 'organización',
    'usuario', 'usuarios', 'modelo', 'modelos', 'admin', 'administrador',
    'facturación', 'billing', 'totales', 'período', 'periodo',
    'configuración', 'configuracion', 'settings', 'ajustes'
  ];

  const foundKeywords = commonKeywords.filter(keyword => 
    lowerMessage.includes(keyword)
  );

  // También extraer palabras significativas (más de 4 caracteres)
  const words = message.toLowerCase().split(/\s+/).filter(word => 
    word.length > 4 && 
    !['para', 'como', 'que', 'con', 'por', 'del', 'las', 'los', 'una', 'uno', 'este', 'esta', 'esto'].includes(word)
  );

  return [...foundKeywords, ...words];
}

