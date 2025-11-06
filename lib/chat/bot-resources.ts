/**
 * Sistema de Recursos para Botty
 * ================================
 * Gestiona enlaces, documentos y recursos útiles que Botty puede usar
 * para responder consultas de las modelos de manera más precisa.
 */

import { createClient } from '@supabase/supabase-js';
import type { UserContext } from './aim-botty';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface BotResource {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: 'tips_transmision' | 'tips_plataforma' | 'guia_tecnica' | 'soporte' | 'consejeria' | 'productividad' | 'seguridad' | 'general';
  platform_id: string | null;
  tags: string[];
  priority: number;
  is_active: boolean;
}

/**
 * Obtener recursos relevantes para una consulta
 */
export async function getRelevantResources(
  userMessage: string,
  userContext: UserContext
): Promise<BotResource[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Extraer palabras clave del mensaje para búsqueda
    const keywords = extractKeywords(userMessage);

    // Construir query base
    let query = supabase
      .from('bot_resources')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    // Si el usuario es modelo, filtrar por sus plataformas o recursos generales
    if (userContext.role === 'modelo') {
      const platformIds = userContext.portfolio?.map(p => p.platform_id).filter(Boolean) || [];
      
      if (platformIds.length > 0) {
        // Recursos generales O recursos de sus plataformas
        query = query.or(`platform_id.is.null,platform_id.in.(${platformIds.join(',')})`);
      } else {
        // Solo recursos generales
        query = query.is('platform_id', null);
      }
    }

    const { data: resources, error } = await query.limit(20);

    if (error) {
      console.error('❌ [BOT-RESOURCES] Error obteniendo recursos:', error);
      return [];
    }

    if (!resources || resources.length === 0) {
      return [];
    }

    // Filtrar y ordenar por relevancia
    const relevantResources = scoreResources(resources as BotResource[], keywords, userMessage);

    // Retornar top 5-10 más relevantes
    return relevantResources.slice(0, 10);
  } catch (error) {
    console.error('❌ [BOT-RESOURCES] Error obteniendo recursos:', error);
    return [];
  }
}

/**
 * Extraer palabras clave del mensaje
 */
function extractKeywords(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  
  // Palabras clave comunes relacionadas con transmisión, plataformas, etc.
  const commonKeywords = [
    'makeup', 'maquillaje', 'iluminacion', 'iluminación', 'angulos', 'ángulos',
    'camara', 'cámara', 'audio', 'sonido', 'micrófono', 'microfono',
    'vestuario', 'ropa', 'fondos', 'setup', 'configuracion', 'configuración',
    'tips', 'consejos', 'ayuda', 'soporte', 'problema', 'error',
    'productividad', 'ganancias', 'ingresos', 'dinero',
    'seguridad', 'privacidad', 'proteccion', 'protección',
    'chaturbate', 'stripchat', 'myfreecams', 'bonga', 'cam4', 'livejasmin'
  ];

  const foundKeywords = commonKeywords.filter(keyword => 
    lowerMessage.includes(keyword)
  );

  // También extraer palabras significativas (más de 3 caracteres)
  const words = message.toLowerCase().split(/\s+/).filter(word => 
    word.length > 3 && !['para', 'como', 'que', 'con', 'por', 'del', 'las', 'los', 'una', 'uno'].includes(word)
  );

  return [...foundKeywords, ...words];
}

/**
 * Calcular relevancia de recursos basado en keywords y mensaje
 */
function scoreResources(
  resources: BotResource[],
  keywords: string[],
  message: string
): BotResource[] {
  const lowerMessage = message.toLowerCase();

  return resources.map(resource => {
    let score = resource.priority; // Prioridad base

    // Score por título
    const lowerTitle = resource.title.toLowerCase();
    keywords.forEach(keyword => {
      if (lowerTitle.includes(keyword)) {
        score += 10;
      }
    });

    // Score por descripción
    if (resource.description) {
      const lowerDesc = resource.description.toLowerCase();
      keywords.forEach(keyword => {
        if (lowerDesc.includes(keyword)) {
          score += 5;
        }
      });
    }

    // Score por tags
    resource.tags.forEach(tag => {
      const lowerTag = tag.toLowerCase();
      if (lowerMessage.includes(lowerTag)) {
        score += 8;
      }
      keywords.forEach(keyword => {
        if (lowerTag.includes(keyword) || keyword.includes(lowerTag)) {
          score += 5;
        }
      });
    });

    // Bonus si es categoría relevante
    const categoryKeywords: Record<string, string[]> = {
      'tips_transmision': ['transmision', 'transmisión', 'transmitir', 'stream', 'streaming', 'tips', 'consejos', 'makeup', 'iluminacion'],
      'tips_plataforma': ['plataforma', 'chaturbate', 'stripchat', 'mfc', 'myfreecams'],
      'guia_tecnica': ['tecnico', 'técnico', 'configuracion', 'configuración', 'setup', 'instalar', 'instalacion'],
      'soporte': ['soporte', 'ayuda', 'problema', 'error', 'no funciona', 'bug'],
      'consejeria': ['emocional', 'sentimientos', 'estres', 'ansiedad', 'depresion', 'motivacion'],
      'productividad': ['productividad', 'ganancias', 'ingresos', 'dinero', 'ganar', 'mejorar'],
      'seguridad': ['seguridad', 'privacidad', 'proteccion', 'protección', 'seguro', 'anonimo']
    };

    const categoryKeywordsArray = categoryKeywords[resource.category] || [];
    categoryKeywordsArray.forEach(keyword => {
      if (lowerMessage.includes(keyword)) {
        score += 7;
      }
    });

    return { ...resource, _score: score };
  }).sort((a, b) => (b as any)._score - (a as any)._score)
    .map(({ _score, ...resource }) => resource);
}

/**
 * Formatear recursos para incluir en el prompt de Botty
 */
export function formatResourcesForPrompt(resources: BotResource[]): string {
  if (resources.length === 0) {
    return '';
  }

  const resourcesText = resources.map((resource, index) => {
    const platformInfo = resource.platform_id ? ` (Plataforma específica)` : ' (General)';
    const tagsInfo = resource.tags.length > 0 ? ` - Tags: ${resource.tags.join(', ')}` : '';
    
    return `
${index + 1}. ${resource.title}${platformInfo}${tagsInfo}
   URL: ${resource.url}
   ${resource.description ? `Descripción: ${resource.description}` : ''}`;
  }).join('\n');

  return `
RECURSOS ÚTILES DISPONIBLES:
=============================
${resourcesText}

INSTRUCCIONES PARA USAR RECURSOS:
- Si el usuario pregunta sobre algo relacionado con estos recursos, puedes mencionarlos y sugerir que los visite
- Si un recurso es específico de una plataforma, solo menciónalo si el usuario pregunta sobre esa plataforma
- Puedes mencionar múltiples recursos si son relevantes
- Siempre incluye el título y la URL del recurso cuando lo menciones
- Formatea las URLs de manera clara y legible
`;
}

/**
 * Obtener recursos para una categoría específica
 */
export async function getResourcesByCategory(
  category: BotResource['category'],
  platformId?: string | null
): Promise<BotResource[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    let query = supabase
      .from('bot_resources')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('priority', { ascending: false });

    if (platformId) {
      query = query.or(`platform_id.is.null,platform_id.eq.${platformId}`);
    } else {
      query = query.is('platform_id', null);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      console.error('❌ [BOT-RESOURCES] Error obteniendo recursos por categoría:', error);
      return [];
    }

    return (data || []) as BotResource[];
  } catch (error) {
    console.error('❌ [BOT-RESOURCES] Error obteniendo recursos por categoría:', error);
    return [];
  }
}

