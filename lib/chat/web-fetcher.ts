/**
 * Web Fetcher - Extrae contenido de URLs para Botty
 * ===================================================
 * Utiliza function calling de Gemini para acceder a contenido web en tiempo real
 */

import cheerio from 'cheerio';

export interface FetchedContent {
  url: string;
  title: string;
  content: string;
  success: boolean;
  error?: string;
}

/**
 * Extraer contenido legible de una URL
 */
export async function fetchUrlContent(url: string): Promise<FetchedContent> {
  try {
    // Validar URL
    if (!url || !url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        url,
        title: '',
        content: '',
        success: false,
        error: 'URL inválida'
      };
    }

    console.log(`🌐 [WEB-FETCHER] Obteniendo contenido de: ${url}`);

    // Fetch del HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      // Timeout de 10 segundos
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return {
        url,
        title: '',
        content: '',
        success: false,
        error: `Error HTTP ${response.status}: ${response.statusText}`
      };
    }

    const html = await response.text();
    
    // Parsear HTML con cheerio
    const $ = cheerio.load(html);
    
    // Extraer título
    const title = $('title').text() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text() || 
                  'Sin título';
    
    // Remover scripts, styles, y elementos no deseados
    $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement').remove();
    
    // Extraer contenido principal
    // Intentar encontrar el contenido principal (article, main, o body)
    let content = '';
    
    const article = $('article').first();
    const main = $('main').first();
    const body = $('body');
    
    const contentSource = article.length ? article : (main.length ? main : body);
    
    // Extraer texto de párrafos, listas, y encabezados
    contentSource.find('p, li, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 20) { // Solo párrafos con contenido significativo
        content += text + '\n\n';
      }
    });
    
    // Si no hay suficiente contenido, usar todo el body
    if (content.length < 200) {
      content = body.text().trim();
    }
    
    // Limpiar y truncar contenido
    content = content
      .replace(/\s+/g, ' ') // Normalizar espacios
      .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos de línea seguidos
      .trim();
    
    // Limitar a 8000 caracteres para no sobrecargar el prompt
    if (content.length > 8000) {
      content = content.substring(0, 8000) + '... [contenido truncado]';
    }
    
    console.log(`✅ [WEB-FETCHER] Contenido obtenido: ${content.length} caracteres de "${title}"`);
    
    return {
      url,
      title: title.trim(),
      content: content.trim(),
      success: true
    };
    
  } catch (error: any) {
    console.error(`❌ [WEB-FETCHER] Error obteniendo contenido de ${url}:`, error);
    
    return {
      url,
      title: '',
      content: '',
      success: false,
      error: error.message || 'Error desconocido al obtener contenido'
    };
  }
}

/**
 * Fetch múltiples URLs en paralelo
 */
export async function fetchMultipleUrls(urls: string[]): Promise<FetchedContent[]> {
  const results = await Promise.allSettled(
    urls.map(url => fetchUrlContent(url))
  );
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        url: urls[index],
        title: '',
        content: '',
        success: false,
        error: result.reason?.message || 'Error desconocido'
      };
    }
  });
}

