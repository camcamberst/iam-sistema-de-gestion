# 🤖 Optimizaciones y Memoria de AIM Botty

## 📋 Resumen

Este documento describe las optimizaciones implementadas para AIM Botty para cumplir con límites de APIs y mejorar la experiencia del usuario mediante memoria persistente.

---

## 🚦 Rate Limiting para Google Gemini API

### Implementación
- **Ubicación**: `lib/chat/rate-limiter.ts`
- **Límites configurados**:
  - 15 requests por minuto (RPM)
  - 1,500 requests por día (RPD)

### Funcionamiento
1. **Queue inteligente**: Si se alcanza el límite, las requests esperan automáticamente
2. **Limpieza automática**: Los logs antiguos se limpian cada minuto
3. **Monitoreo**: Estadísticas disponibles con `geminiRateLimiter.getStats()`

### Uso
```typescript
import { executeWithRateLimit } from '@/lib/chat/rate-limiter';

const result = await executeWithRateLimit(
  async () => {
    // Tu llamada a Gemini API aquí
    return await model.generateContent(prompt);
  }
);
```

### Beneficios
- ✅ Evita exceder límites del plan gratuito
- ✅ Previene errores 429 (Too Many Requests)
- ✅ Manejo automático de cola cuando hay alta demanda

---

## 💾 Sistema de Memoria Estructurada

### Tablas de Base de Datos

#### `bot_memory`
Almacena información recordada sobre cada usuario:
- **Tipos**: `preference`, `context`, `fact`, `reminder`, `goal`, `issue`
- **Key-value**: Un valor por key por usuario
- **Metadata**: Incluye fuente, confianza, expiración

#### `bot_conversation_summaries`
Resúmenes de conversaciones largas:
- Resumen del contenido
- Puntos clave extraídos
- Hechos importantes mencionados

### Crear Tablas
Ejecutar en Supabase SQL Editor:
```sql
-- Ver: scripts/create_bot_memory_tables.sql
```

### Funcionalidades

#### 1. Extracción Automática
El bot detecta automáticamente:
- **Preferencias de horario**: "Me gusta trabajar en la tarde"
- **Plataformas favoritas**: "Mi plataforma favorita es Chaturbate"
- **Metas mencionadas**: "Mi meta es ganar $1000 USD"
- **Problemas reportados**: "Tengo un problema con..."

#### 2. Contexto en Prompts
La memoria se incluye automáticamente en cada prompt:
```
MEMORIA DEL USUARIO:
PREFERENCIAS:
- preferred_hours: tarde
- favorite_platforms: chaturbate

OBJETIVOS MENCIONADOS:
- personal_goal: 1000
```

#### 3. Persistencia
- Las memorias persisten entre conversaciones
- Se actualizan automáticamente cuando el usuario menciona algo nuevo
- Se pueden consultar vía API: `GET /api/admin/bot-memory`

### Uso Programático

```typescript
import { 
  saveMemory, 
  getUserMemories, 
  getMemoryContext,
  extractAndSaveMemory 
} from '@/lib/chat/bot-memory';

// Guardar memoria manualmente
await saveMemory({
  user_id: userId,
  type: 'preference',
  key: 'favorite_platforms',
  value: 'chaturbate',
  metadata: {
    confidence: 0.9,
    mentioned_at: new Date().toISOString()
  }
});

// Obtener todas las memorias
const memories = await getUserMemories(userId);

// Obtener contexto formateado para prompt
const context = await getMemoryContext(userId);

// Extraer automáticamente del mensaje
await extractAndSaveMemory(userId, conversationId, message, userContext);
```

---

## 🔄 Sistema de Cache

### Implementación
- **Ubicación**: `lib/cache/query-cache.ts`
- **TTL por defecto**: 1 minuto
- **Limpieza automática**: Cada 5 minutos

### Uso

```typescript
import { withCache, generateCacheKey } from '@/lib/cache/query-cache';

// Con TTL personalizado
const data = await withCache(
  'user_context|userId:123',
  async () => {
    // Query costosa aquí
    return await expensiveQuery();
  },
  300000 // Cache por 5 minutos
);

// Generar key automáticamente
const key = generateCacheKey('productivity', { 
  startDate: '2025-01-01', 
  endDate: '2025-01-31' 
});
// Resultado: "productivity|endDate:2025-01-31|startDate:2025-01-01"
```

### Beneficios
- ✅ Reduce requests a Supabase
- ✅ Mejora tiempos de respuesta
- ✅ Ahorra ancho de banda
- ✅ Cache automático en consultas analíticas (10 min TTL)

---

## 📊 Optimizaciones Implementadas

### 1. Llamadas a Gemini
**Antes**: Intentaba con 6 modelos diferentes (consumía cuota rápida)
**Ahora**: Usa solo `gemini-pro` con fallback a `gemini-1.5-flash` solo si falla

### 2. Consultas Analíticas
**Antes**: Consulta directa cada vez
**Ahora**: Cache de 10 minutos para datos históricos

### 3. Contexto de Usuario
**Antes**: Query cada vez
**Ahora**: Cache de 5 minutos

### 4. Rate Limiting
**Antes**: Sin control, riesgo de exceder límites
**Ahora**: Control automático con queue inteligente

---

## 🔍 Monitoreo

### Estadísticas de Rate Limiter
```typescript
import { geminiRateLimiter } from '@/lib/chat/rate-limiter';

const stats = geminiRateLimiter.getStats();
console.log(stats);
// {
//   requestsLastMinute: 5,
//   requestsPerMinuteLimit: 15,
//   requestsToday: 234,
//   requestsPerDayLimit: 1500,
//   canMakeRequest: true,
//   waitTime: 0
// }
```

### Estadísticas de Cache
```typescript
import { queryCache } from '@/lib/cache/query-cache';

const stats = queryCache.getStats();
console.log(stats);
// {
//   size: 12,
//   keys: ['user_context|userId:123', ...]
// }
```

---

## 🚨 Alertas Recomendadas

1. **Rate Limiter cerca del límite**:
   - Si `requestsLastMinute >= 12`: Advertencia
   - Si `requestsToday >= 1400`: Advertencia crítica

2. **Cache tamaño**:
   - Si `cache.size > 1000`: Considerar limpieza manual

3. **Memoria creciendo**:
   - Monitorear tamaño de `bot_memory` table
   - Limpiar entradas expiradas periódicamente

---

## 📝 Notas Importantes

1. **Ejecutar SQL primero**: Antes de usar el sistema de memoria, ejecutar `scripts/create_bot_memory_tables.sql`

2. **Configuración de límites**: Los límites de rate limiting se pueden ajustar en `lib/chat/rate-limiter.ts`

3. **TTL de cache**: Ajustar según necesidades:
   - Datos estáticos: TTL largo (30+ minutos)
   - Datos dinámicos: TTL corto (1-5 minutos)
   - Datos históricos: TTL medio (10 minutos)

4. **Memoria persistente**: Las memorias se guardan automáticamente, pero se pueden limpiar manualmente vía API si es necesario

---

## ✅ Checklist de Implementación

- [x] Rate limiting implementado
- [x] Sistema de memoria creado
- [x] Tablas SQL definidas
- [x] Cache implementado
- [x] Extracción automática de memoria
- [x] Integración en prompts del bot
- [x] Endpoint de gestión de memoria
- [x] Optimización de llamadas Gemini
- [x] Documentación completa

---

*Última actualización: Enero 2025*



