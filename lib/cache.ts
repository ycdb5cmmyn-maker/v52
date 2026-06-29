/**
 * Cache simple en memoria para análisis
 * En producción, usar Redis o similar
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();

// TTL por defecto: 24 horas
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

/**
 * Generar clave de caché basada en texto y tipo
 */
export function generateCacheKey(texto: string, tipo: string): string {
  // Hash simple del contenido
  let hash = 0;
  const str = `${texto.slice(0, 1000)}:${tipo}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `cache_${Math.abs(hash)}`;
}

/**
 * Obtener del caché
 */
export function getCacheEntry(key: string): any | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // Verificar si expiró
  if (Date.now() > entry.timestamp + entry.ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Guardar en caché
 */
export function setCacheEntry(key: string, data: any, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

/**
 * Limpiar caché expirado
 */
export function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.timestamp + entry.ttl) {
      cache.delete(key);
    }
  }
}

// Limpiar cada hora
if (typeof global !== 'undefined' && !global.cacheCleanupInterval) {
  global.cacheCleanupInterval = setInterval(cleanExpiredCache, 60 * 60 * 1000);
}
