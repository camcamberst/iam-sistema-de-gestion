# 🔍 DEBUG API: VERIFICAR LÓGICA DE CONFIG-V2

## 🎯 PROBLEMA IDENTIFICADO:
- **Datos existen** (16 valores, 3 modelos)
- **Admin no ve** configuraciones
- **Causa probable:** RLS o lógica de API

## 🔍 VERIFICACIÓN REQUERIDA:

### PASO 1: Verificar en consola del navegador
```javascript
// Abrir "Ver Calculadora de Modelo" en admin
// Abrir consola del navegador (F12)
// Ver logs de la API config-v2
```

### PASO 2: Verificar parámetros enviados
```javascript
// Buscar en consola:
// "🔍 [CONFIG-V2] Loading config for modelId:"
// Verificar que se pasa modelId correcto
```

### PASO 3: Verificar respuesta de API
```javascript
// Buscar en consola:
// "🔍 [CONFIG-V2] No config found for modelId:"
// O error de permisos
```

## 🚀 SOLUCIONES POSIBLES:

### A) PROBLEMA DE RLS:
- **Ejecutar:** `fix_admin_access_system.sql`
- **Crear política** para permitir acceso del admin

### B) PROBLEMA DE API:
- **Verificar lógica** en `app/api/calculator/config-v2/route.ts`
- **Corregir búsqueda** de configuraciones
- **Asegurar** que use `SUPABASE_SERVICE_ROLE_KEY`

### C) PROBLEMA DE PARÁMETROS:
- **Verificar** que se pasa `modelId` correcto
- **No** `userId` del admin
- **Sí** `modelId` de la modelo seleccionada

## 🎯 RESULTADO ESPERADO:
- **Admin ve** configuraciones de todas las modelos
- **"Ver Calculadora de Modelo"** funciona correctamente
- **Sistema unificado** entre admin y modelo
