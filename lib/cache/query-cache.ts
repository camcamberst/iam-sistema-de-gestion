// Query Cache para optimizar consultas a Supabase
// ================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 60000; // 1 minuto por defecto

  /**
   * Obtener datos del cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Guardar datos en cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt
    });
  }

  /**
   * Invalidar cache por key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidar cache por patrón
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar cache expirado
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtener estadísticas del cache
   */
  getStats() {
    this.cleanup();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const queryCache = new QueryCache();

// Limpiar cache expirado cada 5 minutos
setInterval(() => {
  queryCache.cleanup();
}, 300000);

/**
 * Ejecutar función con cache
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Intentar obtener del cache
  const cached = queryCache.get<T>(key);
  if (cached !== null) {
    console.log(`💾 [CACHE] Hit: ${key}`);
    return cached;
  }

  // Ejecutar función y guardar en cache
  console.log(`🔄 [CACHE] Miss: ${key}`);
  const data = await fn();
  queryCache.set(key, data, ttl);
  return data;
}

/**
 * Generar key de cache para consultas
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}:${params[k]}`)
    .join('|');
  return `${prefix}|${sortedParams}`;
}

